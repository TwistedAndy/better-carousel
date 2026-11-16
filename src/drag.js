import { velocity } from './motion.js';

// The targets that keep their own pointer behavior
const fields = 'input,textarea,select,[contenteditable]';

/**
 * Make the drag input of a viewport.
 *
 * @param {HTMLElement} viewport
 * @param {object} hooks
 * @param {() => boolean} hooks.enabled
 * @param {() => {x: boolean, sign: number, threshold: number}} hooks.axis The axis, the sign of the main axis and the drag threshold.
 * @param {() => void} hooks.down Called on each pointerdown.
 * @param {() => number} hooks.begin Called when the drag starts. Returns the start location.
 * @param {(location: number) => void} hooks.move
 * @param {(velocity: number) => void} hooks.release
 * @returns {() => void} A function that removes the listeners.
 */
export function drag(viewport, hooks) {
	let pointer = null,
		start,
		base,
		axis,
		dragging = false,
		block = false,
		samples = [];

	const listen = (method) => ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => window[method](name, handle));

	function down(event) {
		block = false;

		if (pointer !== null || event.button || !hooks.enabled() || event.target.closest(fields)) {
			return;
		}

		hooks.down();

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		axis = hooks.axis();
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
			if (Math.abs(main) < axis.threshold) {
				return;
			}
			dragging = true;
			base = hooks.begin();
			// Capture only now: with capture, a link in a slide does not get the click
			viewport.setPointerCapture(pointer);
		}

		hooks.move(base + main);
		samples.push([main, event.timeStamp]);

		if (samples.length > 10) {
			samples.shift();
		}
	}

	function end(release) {
		listen('removeEventListener');
		pointer = null;
		if (dragging) {
			dragging = false;
			block = true;
			hooks.release(release ? velocity(samples) : 0);
		}
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

	return () => {
		if (pointer !== null) {
			listen('removeEventListener');
			pointer = null;
		}
		viewport.removeEventListener('pointerdown', down);
		viewport.removeEventListener('click', click, true);
		viewport.removeEventListener('dragstart', prevent);
	};
}
