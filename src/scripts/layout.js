/*
 * Layout: the layout reads, and the observers that all carousels share.
 *
 * The reads run in the ResizeObserver callback, when the layout is clean.
 */

/**
 * Read the axis, the alignment, the direction and the gap from the computed style of the container.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {{axis: string, align: string|Function, rtl: boolean, gap: number}}
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

	return {
		axis,
		align,
		rtl: axis === 'x' && (options.direction === 'auto' ? style.direction === 'rtl' : options.direction === 'rtl'),
		gap: parseFloat(axis === 'x' ? style.columnGap : style.rowGap) || 0
	};
}

/**
 * Read the slide boxes on the main axis, relative to the viewport start at location 0.
 *
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} nodes All slides, clones included.
 * @param {object} layout The result of readLayout().
 * @param {{axis: string, container: number, slides: number[]}} written The translate values that the library wrote, in px on the screen.
 * @returns {{view: number, slides: Array<{start: number, end: number, cross: number}>, gap: number}}
 * gap is the loop gap: the space between the last slide and the next copy of the first slide.
 */
export function readRects(viewport, nodes, layout, written) {
	const box = viewport.getBoundingClientRect(),
		x = layout.axis === 'x',
		sign = layout.rtl ? -1 : 1,
		known = written.axis === layout.axis,
		shift = known ? written.container : 0;

	let first = 0,
		last = 0;

	const slides = nodes.map((node, index) => {
		const rect = node.getBoundingClientRect(),
			offset = sign * (shift + (known && written.slides[index] || 0)),
			start = (x ? (layout.rtl ? box.right - rect.right : rect.left - box.left) : rect.top - box.top) - offset,
			size = x ? rect.width : rect.height;

		return { start, end: start + size, cross: x ? rect.height : rect.width };
	});

	slides.forEach((slide, index) => {
		if (slide.start < slides[first].start) {
			first = index;
		}
		if (slide.end > slides[last].end) {
			last = index;
		}
	});

	let gap = layout.gap;

	if (slides.length) {
		const side = x ? (layout.rtl ? ['Right', 'Left'] : ['Left', 'Right']) : ['Top', 'Bottom'];
		gap += (parseFloat(getComputedStyle(nodes[first])['margin' + side[0]]) || 0) + (parseFloat(getComputedStyle(nodes[last])['margin' + side[1]]) || 0);
	}

	return {
		view: x ? box.width : box.height,
		slides,
		gap
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
 * Get the part of the main axis where the loop must show slides, relative to the viewport start.
 * It is the viewport. With clones: 'fill', it is the window, so that the slides fill it when the viewport overflow shows.
 *
 * @param {HTMLElement} viewport
 * @param {{axis: string, rtl: boolean}} layout
 * @param {number} view The viewport size.
 * @param {number} [size] The window size on the main axis, for clones: 'fill'. Without it, the area is the viewport.
 * @returns {{start: number, size: number}}
 */
export function visibleArea(viewport, layout, view, size) {
	if (!size) {
		return { start: 0, size: view };
	}

	const box = viewport.getBoundingClientRect(),
		before = Math.max(0, Math.round(layout.axis === 'x' ? (layout.rtl ? size - box.right : box.left) : box.top));

	return { start: -before, size: before + Math.max(view, Math.round(size - before)) };
}

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. In this way, the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap();

let resizer;

/**
 * Watch the size of elements. The ResizeObserver callback calls owner.read() for each owner, and then owner.write() for each owner whose read() returned true.
 *
 * @param {Element[]} nodes
 * @param {{read: () => boolean, write: () => void}} [owner] Without an owner, stop the watch.
 */
export function observeSize(nodes, owner) {
	resizer ||= new ResizeObserver((entries) => {
		const list = new Set(entries.map((entry) => owners.get(entry.target)));
		[...list].filter((item) => item && item.read()).forEach((item) => item.write());
	});

	for (const node of nodes) {
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
