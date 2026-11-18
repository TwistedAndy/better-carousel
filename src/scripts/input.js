/*
 * Input: the pointer drag, the mouse wheel, the arrow keys, the keyboard focus, and the target of the motion after a drag.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { abs, clamp, inView, nearestSnap, snapIndex, targetLocation } from './geometry.js';
import { bind } from './markup.js';
import { EASE, GLIDE } from './motion.js';

// The targets that keep their own pointer and key behavior
const fields = 'input,textarea,select,[contenteditable]';

// true if an event comes from a form field. An event from a shadow root has the host as its target, so the check uses the first element of the event path.
const inField = (event) => event.composedPath()[0].closest(fields);

// The pointerdown events that a carousel took for a drag
const claimed = new WeakSet();

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
	if (Math.sign(path) !== Math.sign(velocity) || abs(velocity) < 0.05) {
		return fallback;
	}
	return clamp(abs(path) * curve[1] / curve[0] / abs(velocity), 200, 1200);
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

	if (abs(velocity) > 0.3) {
		direction = velocity < 0 ? 1 : -1;
	} else if (abs(moved) > 20) {
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
		// true if the press stopped a motion
		stopped = false,
		samples = [],
		// The selected snap at the drag start
		snap = 0;

	const listen = bind(window, [['pointermove', handle], ['pointerup', handle], ['pointercancel', handle]]);

	function down(event) {
		block = false;

		const geo = context.geo();

		// In nested carousels, the inner carousel gets the press first and claims it
		if (pointer !== null || event.button || !geo || geo.fit || claimed.has(event) || inField(event)) {
			return;
		}

		claimed.add(event);

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		// In a parent with a CSS scale, one px of the pointer is not one px of the carousel
		axis = { x: geo.axis === 'x', sign: geo.sign, scale: geo.scale };
		start = [event.clientX, event.clientY];
		samples = [];

		// A press stops a motion where it is. The release goes to a snap, and the click after it does not count.
		// The auto scroll does not stop here: its feature stops it during the press and starts it again after the release.
		stopped = context.moving();
		if (stopped) {
			base = context.halt();
			snap = context.selected();
			context.emit('interact');
		}

		listen(true);
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

		const dx = (event.clientX - start[0]) / axis.scale,
			dy = (event.clientY - start[1]) / axis.scale,
			main = axis.x ? dx * axis.sign : dy,
			cross = axis.x ? dy : dx;

		if (!context.dragging()) {
			// A touch move across the axis scrolls the page
			if (event.pointerType !== 'mouse' && abs(cross) > abs(main)) {
				return end();
			}
			if (abs(main) < options.dragThreshold) {
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
		context.hold(geo.period ? value : edge + (value - edge) / 4);
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
		listen();
		pointer = null;

		const dragged = context.dragging();

		if (!dragged && !stopped) {
			return;
		}

		const geo = context.geo(),
			location = context.location(),
			// A press that only stopped a motion has no samples
			speed = up && samples.length ? velocity(samples) : 0,
			// The snaps and the limits come from the geometry, and skipSnaps, dragFree and dragFriction from the options
			target = releaseTarget({ ...geo, ...options, location, from: base, velocity: speed, current: snap }),
			curve = options.dragFree === true ? GLIDE : EASE;

		block = true;
		if (dragged) {
			context.drag(false);
		}
		context.move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
	}

	// Cancel the click after a drag. A touch drag sends no click, so the next click can come from the keyboard or a script.
	// Such a click has no detail (the click count), and it is not cancelled.
	function click(event) {
		if (block && event.detail) {
			event.preventDefault();
			event.stopPropagation();
		}
		block = false;
	}

	const prevent = (event) => event.preventDefault();

	// Stop a text selection during a drag. A "user-select" rule on the dragging class does the same, but its change paints all layers of the carousel.
	const select = (event) => context.dragging() && event.preventDefault();

	const own = bind(viewport, [['pointerdown', down], ['click', click, true], ['dragstart', prevent], ['selectstart', select]]);

	own(true);

	return {
		remove() {
			listen();
			own();
		}
	};
}

/**
 * Find an element between a node and the viewport that can scroll in a direction.
 *
 * @param {Element} node The target of the wheel event.
 * @param {Element} viewport
 * @param {string} axis 'x' or 'y'.
 * @param {number} delta The wheel delta on the axis.
 * @returns {boolean}
 */
function scrolls(node, viewport, axis, delta) {
	const [size, client, position, overflow] = axis === 'x' ? ['scrollWidth', 'clientWidth', 'scrollLeft', 'overflowX'] : ['scrollHeight', 'clientHeight', 'scrollTop', 'overflowY'];

	for (; node && node !== viewport; node = node.parentElement) {
		// Read the style only for an element with more content than space
		if (node[size] > node[client] && /auto|scroll/.test(getComputedStyle(node)[overflow])) {
			const at = abs(node[position]);
			if (delta > 0 ? at + node[client] < node[size] - 1 : at > 0) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Make the wheel input of a viewport. The carousel follows the wheel motion along its axis. A horizontal carousel follows a horizontal wheel motion,
 * such as a trackpad swipe, and a vertical wheel scrolls the page. With wheel: 'both', a horizontal carousel follows all wheel motions. The carousel
 * follows the wheel distance with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last
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

	// The time and the delta size of the last wheel event, and true if the gesture moved the carousel
	let time = 0,
		last = 0,
		held = false,
		// true while a gesture scrolls an element in a slide
		inner = false,
		// The timer that finds the end of a gesture
		timer = 0,
		// The selected snap at the gesture start, and the direction of the last step
		snap = 0,
		direction = 0;

	function onWheel(event) {
		const geo = context.geo(),
			side = geo.axis === 'x' && abs(event.deltaX) > abs(event.deltaY),
			delta = side ? event.deltaX * geo.sign : event.deltaY;

		// A nested carousel or the page took the event before: it cancelled the default action
		if (event.defaultPrevented || event.ctrlKey || !delta || context.dragging() || (geo.axis === 'x' && !side && options.wheel !== 'both')) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - time < 200,
			size = abs(delta),
			// A delta that does not grow is the inertia of the gesture, not a new push
			inertia = gesture && size <= last;

		time = now;
		last = size;
		held &&= gesture;

		// An element in a slide that can scroll in the wheel direction scrolls, also for the rest of its gesture
		inner = (gesture && inner) || scrolls(event.target, viewport, side ? 'x' : 'y', side ? event.deltaX : delta);
		if (inner) {
			return;
		}

		const base = context.location(),
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = clamp(target, geo.min, geo.max);
		}

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (abs(target - base) < 0.5) {
			if (held && inertia) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		context.emit('interact');

		if (!timer) {
			snap = context.selected();
		}
		held = true;
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
			away = abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		context.step(index, index === snap && away ? direction : 0);
	}

	// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page.
	// Add it only where the wheel moves the carousel.
	const listen = bind(viewport, [['wheel', onWheel, { passive: false }]]);

	context.on('init reinit resize', () => {
		const geo = context.geo();
		listen(!geo.fit);
	});

	return {
		remove() {
			listen();
			clearTimeout(timer);
		}
	};
}

/**
 * Make the arrow keys move the carousel while the keyboard focus is in its root: left and right in a horizontal carousel, up and down
 * in a vertical carousel. In a right-to-left carousel, the left arrow goes to the next slide. A key in a form field does not move the carousel.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
export function keys(context) {
	const { api, root, options } = context;

	if (!options.keys) {
		return;
	}

	function onKey(event) {
		const geo = context.geo(),
			// -1 for the previous slide, 1 for the next slide. A right-to-left carousel has the next slide at the left.
			direction = geo && !geo.fit && (geo.axis === 'y' ? { ArrowUp: -1, ArrowDown: 1 } : { ArrowLeft: -geo.sign, ArrowRight: geo.sign })[event.key],
			name = direction > 0 ? 'Next' : 'Prev';
		// At the first and the last slide, the key scrolls the page. A key that a nested carousel or the page took before has no default action.
		if (direction && !(event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || inField(event)) && api['canGoTo' + name]()) {
			event.preventDefault();
			api['goTo' + name]();
		}
	}

	const listen = bind(root, [['keydown', onKey]]);

	listen(true);

	return { remove: listen };
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
		if (!inField(event)) {
			pressed = event.timeStamp;
		}
	}

	function onFocus(event) {
		const geo = context.geo(),
			index = api.slideNodes().findIndex((node) => node.contains(event.target));

		if (!geo || index < 0 || event.timeStamp - pressed < 600) {
			return;
		}
		if (options.focus && !inView(geo, context.location(), 1).map((item) => item % geo.count).includes(index)) {
			api.goToSlide(index);
		}
		context.emit('slidefocus');
	}

	const listen = bind(container, [['pointerdown', press], ['focusin', onFocus]]);

	listen(true);

	return { remove: listen };
}
