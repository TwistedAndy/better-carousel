// Layout reads. They run in the ResizeObserver callback, when the layout is clean.

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
 * @returns {{view: number, cross: number, slides: Array<{start: number, end: number, cross: number}>, gap: number}}
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
		cross: x ? box.height : box.width,
		slides,
		gap
	};
}
