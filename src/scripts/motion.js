/*
 * Motion: the easing, the duration of a goToSnap() motion, and the motion engine.
 */

import { abs } from './geometry.js';
import { steps } from './loop.js';

// The easing of a goToSnap() motion
export const EASE = [0.25, 1, 0.5, 1];

// The easing of a glide after a free drag
export const GLIDE = [0.2, 0.6, 0.35, 1];

/**
 * Make a cubic Bézier easing function, the same as the CSS cubic-bezier().
 *
 * @param {number[]} curve [x1, y1, x2, y2]
 * @returns {(t: number) => number}
 */
export function bezier([x1, y1, x2, y2]) {
	const axis = (a, b, t) => ((1 + 3 * a - 3 * b) * t + 3 * b - 6 * a) * t * t + 3 * a * t;

	return (x) => {
		if (x <= 0 || x >= 1) {
			return x <= 0 ? 0 : 1;
		}

		let t = x;

		// Newton steps, then bisection if the slope is too small
		for (let i = 0; i < 6; i++) {
			const error = axis(x1, x2, t) - x,
				slope = 3 * (1 + 3 * x1 - 3 * x2) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
			if (abs(error) < 1e-5) {
				return axis(y1, y2, t);
			}
			if (abs(slope) < 1e-6) {
				break;
			}
			t -= error / slope;
		}

		let low = 0,
			high = 1;

		t = x;

		while (high - low > 1e-5) {
			if (axis(x1, x2, t) < x) {
				low = t;
			} else {
				high = t;
			}
			t = (low + high) / 2;
		}

		return axis(y1, y2, t);
	};
}

/**
 * Get the duration of a goToSnap() motion.
 *
 * @param {number} duration The duration for one snap, in ms.
 * @param {number} count The number of snaps to move.
 * @returns {number}
 */
export function snapDuration(duration, count) {
	return count > 1 ? Math.min(2 * duration, duration * (1 + Math.log2(count))) : duration;
}

/**
 * Make the motion engine of a carousel. A motion runs as a Web Animations API animation of the container translate, on the compositor.
 * With raf set, it runs as a requestAnimationFrame loop instead, which calls frame() on each frame.
 * A loop motion moves the container and the slides of a loop carousel at a constant speed, on the compositor, until it stops.
 *
 * @param {HTMLElement} element The container.
 * @param {(location: number) => string} css Get the CSS translate value of a location.
 * @param {(location: number) => void} frame Write a location.
 * @param {() => void} done Called when a motion ends. A loop motion does not end.
 * @param {((location: number) => void)|null} [tick] Called on each frame of a motion on the compositor, because such a motion runs no script.
 * @returns {{run: Function, loop: Function, retarget: Function, stop: Function, current: Function, shifts: Function}}
 */
export function animator(element, css, frame, done, tick) {
	let state = null;

	const time = () => state.animations ? state.animations[0].currentTime || 0 : performance.now() - state.start,
		current = () => state && state.from + (state.to - state.from) * state.ease(time() / state.duration);

	// The frame loop: a requestAnimationFrame motion writes the location, and a motion on the compositor calls tick().
	// The next frame starts before the callback, so that a callback that stops the motion also stops the loop.
	function step() {
		if (!state.animations && time() >= state.duration) {
			return finish();
		}
		state.raf = requestAnimationFrame(step);
		(state.animations ? tick : frame)(current());
	}

	function finish() {
		const to = state.to;
		stop();
		frame(to);
		done();
	}

	/**
	 * Stop the motion.
	 *
	 * @returns {number|null} The location at the stop, or null if no motion runs.
	 */
	function stop() {
		const at = current();
		if (state) {
			state.animations?.forEach((animation) => animation.cancel());
			cancelAnimationFrame(state.raf);
			state = null;
		}
		return at;
	}

	function animate(at) {
		const animation = element.animate([{ translate: css(state.from) }, { translate: css(state.to) }], { duration: state.duration, easing: 'cubic-bezier(' + state.curve + ')', fill: 'forwards' });
		animation.currentTime = at;
		animation.onfinish = finish;
		state.animations = [animation];
	}

	/**
	 * Start a motion. It stops the motion that runs.
	 *
	 * @param {object} next The state of the new motion. script: true runs it as a requestAnimationFrame loop.
	 * @param {HTMLElement[]} [nodes] The slides of a loop motion.
	 */
	function start(next, nodes) {
		stop();
		state = next;
		if (next.list) {
			const timing = { duration: next.duration, iterations: Infinity },
				begin = document.timeline.currentTime,
				{ from, to, length, direction } = next;
			next.animations = [
				element.animate([{ translate: css(from) }, { translate: css(to) }], timing),
				...nodes.map((node, index) => {
					const { k, offset } = next.list[index],
						before = css(k * length),
						after = css((k + direction) * length);
					return node.animate([{ translate: before }, { translate: before, offset }, { translate: after, offset }, { translate: after }], timing);
				})
			];
			next.animations.forEach((animation) => animation.startTime = begin);
		} else if (next.script) {
			next.start = performance.now();
		} else {
			animate(0);
		}
		if (next.script || tick) {
			next.raf = requestAnimationFrame(step);
		}
	}

	return {
		/**
		 * Start a motion to a location.
		 *
		 * @param {number} from
		 * @param {number} to
		 * @param {number} duration ms
		 * @param {number[]} curve The cubic Bézier easing.
		 * @param {boolean} raf Use a requestAnimationFrame loop.
		 */
		run: (from, to, duration, curve, raf) => start({ from, to, duration, curve, script: raf, ease: bezier(curve) }),

		/**
		 * Start a loop motion. The container moves by one period in each iteration, and each slide moves by one period
		 * at the time when it leaves the visible area.
		 *
		 * @param {number} from
		 * @param {number} direction 1 for forward, -1 for back.
		 * @param {number} duration The time of one iteration, in ms.
		 * @param {{slides: Array<{start: number, end: number}>, area: {start: number, size: number}, period: number}} geo
		 * @param {HTMLElement[]} nodes All slides, clones included.
		 */
		loop: (from, direction, duration, geo, nodes) => start({
			from,
			to: from - direction * geo.period,
			duration,
			direction,
			length: geo.period,
			list: steps(geo.slides, from, geo.area.size, geo.period, direction, geo.area.start),
			// The time in the iteration, from 0 to 1
			ease: (value) => value % 1
		}, nodes),

		/**
		 * Change the end of the motion that runs. The start, the time and the easing stay, so the motion does not jump.
		 *
		 * @param {number} to
		 * @returns {boolean} false if no motion runs, or if a loop motion runs: it has no end.
		 */
		retarget(to) {
			if (!state || state.list) {
				return false;
			}
			if (to !== state.to) {
				state.to = to;
				if (state.animations) {
					const at = time();
					state.animations[0].cancel();
					animate(at);
				}
			}
			return true;
		},

		stop,
		current,

		/**
		 * Get the translate values of the slides during a loop motion.
		 *
		 * @param {number} sign -1 for a right-to-left carousel.
		 * @returns {number[]|null} The values in px, or null if no loop motion runs.
		 */
		shifts(sign) {
			if (!state?.list) {
				return null;
			}
			const phase = time() / state.duration % 1;
			return state.list.map(({ k, offset }) => sign * (phase >= offset ? k + state.direction : k) * state.length);
		}
	};
}
