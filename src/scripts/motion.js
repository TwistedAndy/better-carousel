/*
 * Motion: the easing, the durations, the target after a drag, and the motion engine.
 */

import { clamp, nearestSnap, snapIndex, targetLocation } from './geometry.js';

// The easing of a goTo() motion
export const EASE = [0.25, 1, 0.5, 1];

// The easing of a glide after a free drag
export const GLIDE = [0.2, 0.6, 0.35, 1];

// The duration of the motion for one wheel event, in ms
export const WHEEL = 180;

// The time constant of the glide, in ms: the glide distance is velocity * MOMENTUM
const MOMENTUM = 325;

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
			if (Math.abs(error) < 1e-5) {
				return axis(y1, y2, t);
			}
			if (Math.abs(slope) < 1e-6) {
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
 * Get the duration of a goTo() motion.
 *
 * @param {number} duration The duration for one snap, in ms.
 * @param {number} count The number of snaps to move.
 * @returns {number}
 */
export function goToDuration(duration, count) {
	return count > 1 ? Math.min(2 * duration, duration * (1 + Math.log2(count))) : duration;
}

/**
 * Get the duration of a motion after a release, so that the motion starts at the release velocity.
 *
 * @param {number} path The distance of the motion: target - location.
 * @param {number} velocity The release velocity, in px/ms.
 * @param {number[]} curve The easing of the motion.
 * @param {number} fallback The duration if the velocity is too low or in the other direction.
 * @returns {number}
 */
export function releaseDuration(path, velocity, curve, fallback) {
	if (Math.sign(path) !== Math.sign(velocity) || Math.abs(velocity) < 0.05) {
		return fallback;
	}
	return clamp(Math.abs(path) * curve[1] / curve[0] / Math.abs(velocity), 200, 1200);
}

/**
 * Get the velocity from the last samples of a drag.
 *
 * @param {Array<number[]>} samples [location, time] pairs, the oldest first. A drag always has one sample or more.
 * @returns {number} px/ms
 */
export function velocity(samples) {
	const last = samples[samples.length - 1];

	// The last sample is always in its own window, so find() always finds a sample
	const first = samples.find((sample) => last[1] - sample[1] <= 100),
		time = last[1] - first[1];

	return time > 0 ? (last[0] - first[0]) / time : 0;
}

/**
 * Find the target of the motion after a drag.
 *
 * @param {object} args
 * @param {number} args.location The location at the release.
 * @param {number} args.from The location at the drag start.
 * @param {number} args.velocity The release velocity, in px/ms.
 * @param {number} args.current The selected snap at the drag start.
 * @param {Array<{location: number}>} args.snaps
 * @param {number} args.min
 * @param {number} args.max
 * @param {number} [args.period]
 * @param {boolean|number} [args.skipSnaps] true: go to the snap nearest to the projected location. A number: the same, but go at most this number of snaps.
 *     false: go at most one snap.
 * @param {boolean|string} [args.dragFree]
 * @returns {{location: number, snap: number}}
 */
export function releaseTarget({ location, from, velocity, current, snaps, min, max, period, skipSnaps, dragFree }) {
	const count = snaps.length;

	let projected = location + velocity * MOMENTUM;

	if (!period) {
		projected = clamp(projected, min, max);
	}

	// A number in skipSnaps: keep the projected location between the snaps that are skipSnaps snaps before and after the start snap
	if (typeof skipSnaps === 'number' && skipSnaps > 0 && skipSnaps < count - 1 + !period) {
		const limit = (direction) => targetLocation(snaps[snapIndex(current + direction * skipSnaps, count, period)].location, from, period, direction);
		projected = clamp(projected, limit(1), limit(-1));
	}

	if (dragFree === true) {
		return { location: projected, snap: nearestSnap(snaps, projected, period) };
	}

	if (dragFree || skipSnaps) {
		const snap = nearestSnap(snaps, projected, period);
		return { location: targetLocation(snaps[snap].location, projected, period), snap };
	}

	const moved = location - from;

	let direction = 0;

	if (Math.abs(velocity) > 0.3) {
		direction = velocity < 0 ? 1 : -1;
	} else if (Math.abs(moved) > 20) {
		direction = moved < 0 ? 1 : -1;
	}

	const snap = snapIndex(current + direction, count, period),
		target = snaps[snap].location;

	return {
		location: period ? targetLocation(target, direction ? from : location, period, snap === current ? 0 : direction) : target,
		snap
	};
}

/**
 * Make the motion engine of a carousel. A motion runs as a Web Animations API animation of the container translate, on the compositor.
 * With raf set, it runs as a requestAnimationFrame loop instead, which calls frame() on each frame.
 *
 * @param {HTMLElement} element The container.
 * @param {(location: number) => string} css Get the CSS translate value of a location.
 * @param {(location: number) => void} frame Write a location.
 * @param {() => void} done Called when a motion ends.
 * @returns {{run: Function, retarget: Function, stop: Function, current: Function}}
 */
export function animator(element, css, frame, done) {
	let state = null;

	const time = () => state.animation ? state.animation.currentTime || 0 : performance.now() - state.start,
		current = () => state && state.from + (state.to - state.from) * state.ease(time() / state.duration);

	function tick() {
		if (time() >= state.duration) {
			finish();
		} else {
			frame(current());
			state.raf = requestAnimationFrame(tick);
		}
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
			state.animation?.cancel();
			cancelAnimationFrame(state.raf);
			state = null;
		}
		return at;
	}

	function animate(at) {
		state.animation = element.animate([{ translate: css(state.from) }, { translate: css(state.to) }], { duration: state.duration, easing: 'cubic-bezier(' + state.curve + ')', fill: 'forwards' });
		state.animation.currentTime = at;
		state.animation.onfinish = finish;
	}

	return {
		/**
		 * Start a motion. It stops the motion that runs.
		 *
		 * @param {number} from
		 * @param {number} to
		 * @param {number} duration ms
		 * @param {number[]} curve The cubic Bézier easing.
		 * @param {boolean} raf Use a requestAnimationFrame loop.
		 */
		run(from, to, duration, curve, raf) {
			stop();
			state = { from, to, duration, curve, ease: bezier(curve) };
			if (raf) {
				state.start = performance.now();
				state.raf = requestAnimationFrame(tick);
			} else {
				animate(0);
			}
		},

		/**
		 * Change the end of the motion that runs. The start, the time and the easing stay, so the motion does not jump.
		 *
		 * @param {number} to
		 * @returns {boolean} false if no motion runs.
		 */
		retarget(to) {
			if (!state) {
				return false;
			}
			if (to === state.to) {
				return true;
			}
			state.to = to;
			if (state.animation) {
				const at = time();
				state.animation.cancel();
				animate(at);
			}
			return true;
		},
		stop,
		current
	};
}
