/*
 * Input: the pointer drag, the mouse wheel, the keyboard focus, and the target of the motion after a drag.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { clamp, inView, nearestSnap, snapIndex, targetLocation } from './geometry.js';
import { EASE, GLIDE } from './motion.js';

// The targets that keep their own pointer behavior
const fields = 'input,textarea,select,[contenteditable]';

// The duration of the motion for one wheel event, in ms
const WHEEL = 180;

// The time constant of the glide, in ms: the glide distance is velocity * MOMENTUM
const MOMENTUM = 325;

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
 * @param {number} [args.dragFriction] The glide distance is divided by this number.
 * @returns {{location: number, snap: number}}
 */
export function releaseTarget({ location, from, velocity, current, snaps, min, max, period, skipSnaps, dragFree, dragFriction = 1 }) {
	const count = snaps.length;

	let projected = location + velocity * MOMENTUM / dragFriction;

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
 * Make the drag input of a carousel. The carousel follows the pointer. At the release, it goes to a snap, or with dragFree, it glides.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
export function drag(context) {
	const { viewport, options } = context;

	if (!options.drag) {
		return;
	}

	let pointer = null,
		start,
		base,
		axis,
		block = false,
		samples = [],
		// The selected snap at the drag start
		snap = 0;

	const listen = (method) => ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => window[method](name, handle));

	function down(event) {
		block = false;

		const geo = context.geo();

		if (pointer !== null || event.button || !geo || geo.fit || event.target.closest(fields)) {
			return;
		}

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		axis = { x: geo.axis === 'x', sign: geo.sign };
		start = [event.clientX, event.clientY];
		samples = [];
		listen('addEventListener');
	}

	function handle(event) {
		if (event.pointerId !== pointer) {
			return;
		}

		if (event.type !== 'pointermove') {
			// A stop before the release gives a low velocity
			if (samples.length) {
				samples.push([samples[samples.length - 1][0], event.timeStamp]);
			}
			return end(event.type === 'pointerup');
		}

		const dx = event.clientX - start[0],
			dy = event.clientY - start[1],
			main = axis.x ? dx * axis.sign : dy,
			cross = axis.x ? dy : dx;

		if (!context.dragging()) {
			// A touch move across the axis scrolls the page
			if (event.pointerType !== 'mouse' && Math.abs(cross) > Math.abs(main)) {
				return end();
			}
			if (Math.abs(main) < options.dragThreshold) {
				return;
			}
			// Stop the motion, and start the drag at the location where the carousel is now
			base = context.halt();
			snap = context.selected();
			context.drag(true);
			// Capture only now: with capture, a link in a slide does not get the click
			viewport.setPointerCapture(pointer);
		}

		const geo = context.geo(),
			value = base + main,
			edge = clamp(value, geo.min, geo.max);

		// Out of the limits, the carousel moves at a quarter of the pointer speed
		context.hold(geo.period ? value : edge + (value - edge) / 4, true);
		samples.push([main, event.timeStamp]);

		if (samples.length > 10) {
			samples.shift();
		}
	}

	/**
	 * End the drag.
	 *
	 * @param {boolean} [up] true for a pointerup. A pointercancel releases with no velocity.
	 */
	function end(up) {
		listen('removeEventListener');
		pointer = null;

		if (!context.dragging()) {
			return;
		}

		const geo = context.geo(),
			location = context.location(),
			speed = up ? velocity(samples) : 0,
			target = releaseTarget({ location, from: base, velocity: speed, current: snap, snaps: geo.snaps, min: geo.min, max: geo.max, period: geo.period, skipSnaps: options.skipSnaps, dragFree: options.dragFree, dragFriction: options.dragFriction }),
			curve = options.dragFree === true ? GLIDE : EASE;

		block = true;
		context.drag(false);
		context.move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
	}

	function click(event) {
		if (block) {
			block = false;
			event.preventDefault();
			event.stopPropagation();
		}
	}

	const prevent = (event) => event.preventDefault();

	viewport.addEventListener('pointerdown', down);
	viewport.addEventListener('click', click, true);
	viewport.addEventListener('dragstart', prevent);

	return {
		remove() {
			listen('removeEventListener');
			viewport.removeEventListener('pointerdown', down);
			viewport.removeEventListener('click', click, true);
			viewport.removeEventListener('dragstart', prevent);
		}
	};
}

/**
 * Make the wheel input of a viewport: in a vertical carousel, and with wheel: 'both' also in a horizontal carousel. The carousel follows
 * the wheel distance with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last
 * location, the page scrolls.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
export function wheel(context) {
	const { viewport, options } = context,
		// With dragFree: true, the carousel stays where the wheel stops
		free = options.dragFree === true;

	if (!options.wheel) {
		return;
	}

	// The time of the last wheel event, and of the last event that moved the carousel
	let time = 0,
		moved = 0,
		// The timer that finds the end of a gesture
		timer = 0,
		// The selected snap at the gesture start, and the direction of the last step
		snap = 0,
		direction = 0;

	function onWheel(event) {
		const geo = context.geo(),
			side = geo.axis === 'x' && Math.abs(event.deltaX) > Math.abs(event.deltaY),
			delta = side ? event.deltaX * geo.sign : event.deltaY;

		if (event.ctrlKey || !delta || context.dragging()) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - time < 200,
			base = context.location(),
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = clamp(target, geo.min, geo.max);
		}

		time = now;

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (Math.abs(target - base) < 0.5) {
			if (gesture && now - moved < 1000) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		context.emit('interact');

		if (!timer) {
			snap = context.selected();
		}
		moved = now;
		direction = path > 0 ? 1 : -1;
		context.move(nearestSnap(geo.snaps, target, geo.period), target, WHEEL, EASE);

		clearTimeout(timer);
		if (!free) {
			timer = setTimeout(end, 150);
		}
	}

	// Go to a snap when the wheel stops. A short wheel motion goes to the next snap in its direction, so that one wheel step always changes the slide.
	function end() {
		timer = 0;
		const geo = context.geo(),
			at = context.current(),
			index = nearestSnap(geo.snaps, at, geo.period),
			away = Math.abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		context.step(index, index === snap && away ? direction : 0);
	}

	// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page.
	// Add it only where the wheel moves the carousel.
	function listen() {
		const geo = context.geo();
		viewport[!geo.fit && (geo.axis === 'y' || options.wheel === 'both') ? 'addEventListener' : 'removeEventListener']('wheel', onWheel, { passive: false });
	}

	['init', 'reinit', 'resize'].forEach((name) => context.on(name, listen));

	return {
		remove() {
			viewport.removeEventListener('wheel', onWheel);
			clearTimeout(timer);
		}
	};
}

/**
 * Go to a slide that gets the keyboard focus, if it does not show fully. A focus soon after a pointer press does not move the carousel.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}}
 */
export function focus(context) {
	const { api, container, options } = context;

	// The time of the last pointer press
	let pressed = -1e4;

	function press(event) {
		if (!event.target.closest(fields)) {
			pressed = event.timeStamp;
		}
	}

	function onFocus(event) {
		const geo = context.geo(),
			index = api.slideNodes().findIndex((node) => node.contains(event.target));

		if (!geo || index < 0 || event.timeStamp - pressed < 600) {
			return;
		}
		if (options.focus && !inView(geo.slides, context.location(), geo.view, 1, geo.period).map((item) => item % geo.count).includes(index)) {
			api.goToSlide(index);
		}
		context.emit('slidefocus');
	}

	container.addEventListener('pointerdown', press);
	container.addEventListener('focusin', onFocus);

	return {
		remove() {
			container.removeEventListener('pointerdown', press);
			container.removeEventListener('focusin', onFocus);
		}
	};
}
