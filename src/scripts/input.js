/*
 * Input: the pointer drag and the mouse wheel.
 *
 * Each input takes the context of a carousel (see carousel.js) and returns an object with remove().
 */

import { clamp, nearestSnap, targetLocation } from './geometry.js';
import { setClass } from './markup.js';
import { EASE, GLIDE, releaseDuration, releaseTarget, velocity, WHEEL } from './motion.js';

// The targets that keep their own pointer behavior
const fields = 'input,textarea,select,[contenteditable]';

/**
 * Make the drag input of a carousel. The carousel follows the pointer. At the release, it goes to a snap, or with dragFree, it glides.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{dragging: () => boolean, pressed: () => number, remove: () => void}} pressed() gives the time of the last pointerdown.
 */
export function drag(context) {
	const { viewport, root, cls, options } = context;

	let pointer = null,
		start,
		base,
		axis,
		dragging = false,
		block = false,
		samples = [],
		// The time of the last pointerdown
		pressed = 0,
		// The selected snap at the drag start
		snap = 0;

	const listen = (method) => ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => window[method](name, handle));

	function down(event) {
		block = false;

		const geo = context.geo();

		if (pointer !== null || event.button || !geo || geo.fit || !options.draggable || event.target.closest(fields)) {
			return;
		}

		pressed = performance.now();

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		axis = { x: geo.axis === 'x', sign: geo.rtl ? -1 : 1 };
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

		if (!dragging) {
			// A touch move across the axis scrolls the page
			if (event.pointerType !== 'mouse' && Math.abs(cross) > Math.abs(main)) {
				return end();
			}
			if (Math.abs(main) < options.dragThreshold) {
				return;
			}
			begin();
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

	// Stop the motion, and start the drag at the location where the carousel is now
	function begin() {
		context.interrupt();
		base = context.halt();
		snap = context.selected();
		dragging = true;
		context.write(base);
		setClass(root, cls.dragging, true);
		context.emit('pointerdown');
	}

	/**
	 * End the drag.
	 *
	 * @param {boolean} [up] true for a pointerup. A pointercancel releases with no velocity.
	 */
	function end(up) {
		listen('removeEventListener');
		pointer = null;

		if (!dragging) {
			return;
		}

		const geo = context.geo(),
			location = context.location(),
			speed = up ? velocity(samples) : 0,
			target = releaseTarget({ location, from: base, velocity: speed, current: snap, snaps: geo.snaps, min: geo.min, max: geo.max, period: geo.period, skipSnaps: options.skipSnaps, dragFree: options.dragFree }),
			curve = options.dragFree === true ? GLIDE : EASE;

		dragging = false;
		block = true;
		setClass(root, cls.dragging, false);
		context.emit('pointerup');
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
		dragging: () => dragging,
		pressed: () => pressed,
		remove() {
			if (pointer !== null) {
				listen('removeEventListener');
				pointer = null;
			}
			dragging = false;
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
 * @returns {{listen: (on: boolean) => void, remove: () => void}}
 */
export function wheel(context) {
	const viewport = context.viewport,
		// With dragFree: true, the carousel stays where the wheel stops
		free = context.options.dragFree === true;

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
			delta = side ? event.deltaX * (geo.rtl ? -1 : 1) : event.deltaY;

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
		context.interrupt();

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

	return {
		// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page.
		// Add it only where the wheel moves the carousel.
		listen: (on) => viewport[on ? 'addEventListener' : 'removeEventListener']('wheel', onWheel, { passive: false }),
		remove() {
			viewport.removeEventListener('wheel', onWheel);
			clearTimeout(timer);
			timer = 0;
		}
	};
}
