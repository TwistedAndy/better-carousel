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
 * The values are in the px of the carousel: in a parent with a CSS scale or zoom, such as a modal window that opens with a scale animation,
 * the values do not change. A rotation of a parent is not supported.
 * A slide with no box, such as a slide with display: none, is hidden. It gets no snap, and it stays at the end of the slide before it.
 *
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} nodes All slides, clones included.
 * @param {object} layout The result of readLayout().
 * @param {{axis: string, container: number, slides: number[]}} written The translate values that the library wrote, in px on the screen.
 * @param {number} [size] The window size on the main axis, for clones: 'fill'.
 * @returns {{view: number, slides: Array<{start: number, end: number, cross: number, hidden: boolean}>, gap: number, scale: number, area: {start: number, size: number}}}
 * view is the viewport size without the padding. gap is the loop gap: the space between the last slide and the next copy of the first slide.
 * scale is the screen px of one px of the carousel. area is the part of the main axis where the loop must show slides: the viewport with its
 * padding, or with a size, the window, so that the slides fill it when the viewport overflow shows.
 */
export function readRects(viewport, nodes, layout, written, size) {
	const box = viewport.getBoundingClientRect(),
		x = layout.axis === 'x',
		sign = layout.sign,
		known = written.axis === layout.axis,
		shift = known ? written.container : 0,
		width = viewport.offsetWidth,
		height = viewport.offsetHeight,
		// offsetWidth is a whole number: a difference of less than 1 px is not a scale
		scale = width && height && (abs(box.width - width) >= 1 || abs(box.height - height) >= 1) ? (x ? box.width / width : box.height / height) : 1,
		view = (x ? box.width : box.height) / scale,
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

	const inner = view - pad.start - pad.end;

	// The area before and after the inner edge of the viewport padding: the padding, or the window
	let before = pad.start,
		after = inner + pad.end;

	if (size) {
		before += Math.max(0, round(x ? (layout.rtl ? size - box.right : box.left) : box.top));
		after = Math.max(after, round(size - before));
	}

	return {
		view: inner,
		slides,
		gap,
		scale,
		area: { start: -before, size: before + after }
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
		const changed = [...new Set(entries.filter((entry) => {
			const { inlineSize, blockSize } = entry.borderBoxSize[0],
				size = inlineSize + ',' + blockSize,
				same = sizes.get(entry.target) === size;
			sizes.set(entry.target, size);
			return !same && !owners.get(entry.target)?.skip(entry);
		}).map((entry) => owners.get(entry.target)))].filter((item) => item?.read());
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

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the elements to check: [node, lazy, margin]
const watchers = new Map(),
	waiters = new WeakMap();

let queue = [];

/**
 * Wait until an element comes near the screen. One microtask reads the boxes of all elements that started to wait, after the writes of
 * the carousels that started without a wait. Then the reads cause one layout, not one for each carousel. The microtask runs before the
 * first paint, so a carousel near the screen starts before the page shows, and it does not move the page.
 *
 * @param {Element} node
 * @param {true|number} lazy The "lazy" option: true for one screen height, or a distance in px.
 * @param {Function} callback
 * @returns {Function} A function that stops the wait.
 */
export function waitNear(node, lazy, callback) {
	const margin = lazy === true ? '100%' : lazy + 'px';

	if (!queue.length) {
		queueMicrotask(check);
	}
	queue.push([node, lazy, margin]);
	waiters.set(node, callback);

	return () => {
		watchers.get(margin)?.unobserve(node);
		waiters.delete(node);
	};
}

// Call the callback of each element near the screen, and watch the other elements. An element whose wait stopped has no callback.
function check() {
	const list = queue,
		rects = list.map(([node]) => node.getBoundingClientRect());

	queue = [];

	list.forEach(([node, lazy, margin], index) => {
		const near = lazy === true ? innerHeight : lazy,
			rect = rects[index],
			callback = waiters.get(node);

		if (!callback) {
			return;
		}

		if (rect.height && rect.bottom >= -near && rect.top <= innerHeight + near) {
			callback();
			return;
		}

		let observer = watchers.get(margin);
		if (!observer) {
			observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && waiters.get(entry.target)?.()), { rootMargin: margin });
			watchers.set(margin, observer);
		}
		observer.observe(node);
	});
}
