/*
 * Layout: the layout reads, and the observers that all carousels share.
 *
 * The reads run in the ResizeObserver callback, when the layout is clean.
 */

import { abs, round } from './geometry.js';

/**
 * Read the axis, the alignment, the direction and the gap from the computed style of the container.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {{axis: string, align: string|Function, rtl: boolean, sign: number, gap: number}} sign is -1 for a right-to-left carousel, else 1.
 */
export function readLayout(container, options) {
	const style = getComputedStyle(container),
		display = style.display,
		content = style.justifyContent;

	let axis = options.axis;

	if (axis === 'auto') {
		axis = 'x';
		if (display.includes('grid')) {
			axis = style.gridAutoFlow.startsWith('column') ? 'x' : 'y';
		} else if (display.includes('flex') && style.flexDirection.startsWith('column') && style.flexWrap === 'nowrap') {
			axis = 'y';
		}
	}

	let align = options.align;

	if (align === 'auto') {
		align = content === 'center' ? 'center' : content === 'flex-end' || content === 'end' || (axis === 'x' && content === 'right') ? 'end' : 'start';
	}

	const rtl = axis === 'x' && (options.dir === 'auto' ? style.direction === 'rtl' : options.dir === 'rtl');

	return {
		axis,
		align,
		rtl,
		sign: rtl ? -1 : 1,
		gap: parseFloat(axis === 'x' ? style.columnGap : style.rowGap) || 0
	};
}

/**
 * Read the slide boxes on the main axis, relative to the inner edge of the viewport padding at location 0. The snaps align to this edge.
 * The values are in the px of the carousel: in a parent with a CSS scale, such as a modal window that opens with a scale animation, the
 * values do not change with a scale or a rotation of a parent.
 * A slide with no box, such as a slide with display: none, is hidden. It gets no snap, and it stays at the end of the slide before it.
 *
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} nodes All slides, clones included.
 * @param {object} layout The result of readLayout().
 * @param {{axis: string, container: number, slides: number[]}} written The translate values that the library wrote, in px on the screen.
 * @returns {{view: number, slides: Array<{start: number, end: number, cross: number, hidden: boolean}>, gap: number, scale: number, pad: {start: number, end: number}}}
 * view is the viewport size without the padding. gap is the loop gap: the space between the last slide and the next copy of the first slide.
 * scale is the screen px of one px of the carousel. pad is the viewport padding at the start and at the end.
 */
export function readRects(viewport, nodes, layout, written) {
	const box = viewport.getBoundingClientRect(),
		x = layout.axis === 'x',
		sign = layout.sign,
		known = written.axis === layout.axis,
		shift = known ? written.container : 0,
		width = viewport.offsetWidth,
		height = viewport.offsetHeight,
		// offsetWidth is a whole number: a difference of less than 1 px is not a transform
		transformed = width && height && (abs(box.width - width) >= 1 || abs(box.height - height) >= 1),
		// A scale s and a rotation by an angle a give a box of s(w cos a + h sin a) by s(w sin a + h cos a). The main axis gets s cos a.
		scale = !transformed ? 1 : abs(width - height) > 1 ? (width * box.width - height * box.height) / (width * width - height * height) : box.width / width,
		view = !transformed ? (x ? box.width : box.height) : x ? width : height,
		style = getComputedStyle(viewport),
		side = x ? (layout.rtl ? ['Right', 'Left'] : ['Left', 'Right']) : ['Top', 'Bottom'],
		pad = { start: parseFloat(style['padding' + side[0]]) || 0, end: parseFloat(style['padding' + side[1]]) || 0 };

	const slides = nodes.map((node, index) => {
		const rect = node.getBoundingClientRect(),
			offset = sign * (shift + (known && written.slides[index] || 0)),
			start = (x ? (layout.rtl ? box.right - rect.right : rect.left - box.left) : rect.top - box.top) / scale - pad.start - offset,
			size = (x ? rect.width : rect.height) / scale;

		return { start, end: start + size, cross: (x ? rect.height : rect.width) / scale, hidden: !rect.width && !rect.height };
	});

	// A hidden slide goes to the end of the visible slide before it. The first and the last visible slides give the margins of the loop gap.
	let edge = slides.find((slide) => !slide.hidden)?.start || 0,
		first = -1,
		last = -1,
		gap = layout.gap;

	slides.forEach((slide, index) => {
		if (slide.hidden) {
			slide.start = slide.end = edge;
			return;
		}
		edge = slide.end;
		if (first < 0 || slide.start < slides[first].start) {
			first = index;
		}
		if (last < 0 || slide.end > slides[last].end) {
			last = index;
		}
	});

	if (first > -1) {
		gap += (parseFloat(getComputedStyle(nodes[first])['margin' + side[0]]) || 0) + (parseFloat(getComputedStyle(nodes[last])['margin' + side[1]]) || 0);
	}

	return {
		view: view - pad.start - pad.end,
		slides,
		gap,
		scale,
		pad
	};
}

/**
 * Get the window size on the main axis.
 *
 * @param {string} axis 'x' or 'y'.
 * @returns {number}
 */
export function windowSize(axis) {
	return axis === 'x' ? document.documentElement.clientWidth : innerHeight;
}

/**
 * Get the part of the main axis where the loop must show slides, relative to the inner edge of the viewport padding.
 * It is the viewport with its padding. With clones: 'fill', it is the window, so that the slides fill it when the viewport overflow shows.
 *
 * @param {HTMLElement} viewport
 * @param {{axis: string, rtl: boolean}} layout
 * @param {number} view The viewport size without the padding.
 * @param {{start: number, end: number}} pad The viewport padding.
 * @param {number} [size] The window size on the main axis, for clones: 'fill'. Without it, the area is the viewport.
 * @returns {{start: number, size: number}}
 */
export function visibleArea(viewport, layout, view, pad, size) {
	if (!size) {
		return { start: -pad.start, size: pad.start + view + pad.end };
	}

	const box = viewport.getBoundingClientRect(),
		before = Math.max(0, round(layout.axis === 'x' ? (layout.rtl ? size - box.right : box.left) : box.top)) + pad.start;

	return { start: -before, size: before + Math.max(view + pad.end, round(size - before)) };
}

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. In this way, the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap(),
	// The elements of each owner, and the last size of each element
	watched = new WeakMap(),
	sizes = new WeakMap();

let resizer;

/**
 * Watch the size of elements. The ResizeObserver callback calls owner.read() for each owner, and then owner.write() for each owner whose read() returned true.
 * An entry for which owner.skip() returns true does not count. An entry with the same size as the last entry of its element does not count:
 * a new watch of an element after a write sends such an entry. observeSize() clears the last size, so its first entry always counts.
 *
 * @param {Element[]} nodes
 * @param {{read: () => boolean, write: () => void, skip: (entry: ResizeObserverEntry) => boolean}} [owner] Without an owner, stop the watch.
 */
export function observeSize(nodes, owner) {
	resizer ||= new ResizeObserver((entries) => {
		const list = new Set(entries.filter((entry) => {
			const { inlineSize, blockSize } = entry.borderBoxSize[0],
				size = inlineSize + ',' + blockSize,
				same = sizes.get(entry.target) === size;
			sizes.set(entry.target, size);
			return !same && !owners.get(entry.target)?.skip(entry);
		}).map((entry) => owners.get(entry.target)));
		const changed = [...list].filter((item) => item && item.read());
		changed.forEach((item) => item.write());
		// A write can change the size of an element that the observer watches, for example the auto height or the clones. If the observer has
		// a change to report after its callback, the browser sends the "ResizeObserver loop" error to window.onerror. Stop the watch of these
		// elements, and watch them again in the next frame. Then the first callback measures again and finds no change.
		if (changed.length) {
			changed.forEach((item) => watched.get(item)?.forEach((node) => resizer.unobserve(node)));
			requestAnimationFrame(() => changed.forEach((item) => watched.get(item)?.forEach((node) => owners.get(node) === item && resizer.observe(node))));
		}
	});

	if (owner) {
		watched.set(owner, nodes);
	}

	for (const node of nodes) {
		sizes.delete(node);
		if (owner) {
			owners.set(node, owner);
			resizer.observe(node);
		} else {
			owners.delete(node);
			resizer.unobserve(node);
		}
	}
}

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the boxes that readBoxes() read
const watchers = new Map(),
	waiters = new WeakMap(),
	boxes = new WeakMap();

/**
 * Read the boxes of elements before a carousel writes to the DOM. Then the reads of all carousels cause one layout, not one for each carousel.
 * waitNear() uses each box one time.
 *
 * @param {Element[]} elements
 */
export function readBoxes(elements) {
	elements.forEach((element) => boxes.set(element, element.getBoundingClientRect()));
}

/**
 * Wait until an element comes near the screen.
 *
 * @param {Element} node
 * @param {true|number} lazy The "lazy" option: true for one screen height, or a distance in px.
 * @param {Function} callback
 * @returns {Function|null} A function that stops the wait, or null if the element is near the screen now.
 */
export function waitNear(node, lazy, callback) {
	const near = lazy === true ? innerHeight : lazy,
		rect = boxes.get(node) || node.getBoundingClientRect(),
		margin = lazy === true ? '100%' : lazy + 'px';

	boxes.delete(node);

	if (rect.height && rect.bottom >= -near && rect.top <= innerHeight + near) {
		return null;
	}

	let observer = watchers.get(margin);
	if (!observer) {
		observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && waiters.get(entry.target)?.()), { rootMargin: margin });
		watchers.set(margin, observer);
	}
	waiters.set(node, callback);
	observer.observe(node);
	return () => {
		observer.unobserve(node);
		waiters.delete(node);
	};
}
