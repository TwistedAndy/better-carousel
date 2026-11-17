/*
 * Loop math: the period, the clones and the place of each slide. This module does not use the DOM.
 *
 * The values and the slides are the same as in geometry.js. In loop mode, each slide is at start + k * period.
 * The library writes k * period as the translate of the slide.
 */

/**
 * Get the number of full copies of the slides that the loop needs. With 0, the slides can loop with no clones:
 * no slide is necessary at two places at the same time.
 *
 * @param {number} length The loop period of the original slides.
 * @param {number} view
 * @param {number} max
 * @returns {number}
 */
export function cloneCount(length, view, max) {
	return length > 0 ? Math.max(0, Math.ceil((view + max) / length) - 1) : 0;
}

/**
 * Get the k of each slide for a motion from one location to another. With from = to, it is the placement at rest.
 * The slide center goes into a window of one period. The window has the same center as the part of the content that shows during the motion.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} to
 * @param {number} view The size of the visible area.
 * @param {number} length The loop period.
 * @param {number} [offset] The start of the visible area, relative to the viewport start.
 * @returns {number[]}
 */
export function placement(slides, from, to, view, length, offset = 0) {
	const center = offset + (view - from - to) / 2;
	return slides.map((slide) => Math.round((center - (slide.start + slide.end) / 2) / length) || 0);
}

/**
 * Find if one placement is correct for the full motion. If not, the motion must change the placement during the motion.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} to
 * @param {number} view
 * @param {number} length
 * @returns {boolean}
 */
export function pathFits(slides, from, to, view, length) {
	const path = view + Math.abs(to - from);
	return slides.every((slide) => length >= path + slide.end - slide.start);
}

/**
 * Get the steps of each slide for an auto scroll iteration. The container moves by one period, from `from` to `from - length` (forward)
 * or to `from + length` (back). Each slide moves by one period at one time in the iteration.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} view
 * @param {number} length
 * @param {number} direction 1 for forward, -1 for back.
 * @param {number} [offset] The start of the visible area, relative to the viewport start.
 * @returns {Array<{k: number, offset: number}>} k at the start of the iteration, and the time of the step, from 0 to 1.
 */
export function steps(slides, from, view, length, direction, offset = 0) {
	return slides.map((slide) => {
		const value = (offset + view / 2 - from - (slide.start + slide.end) / 2) / length,
			k = Math.round(value);

		return { k, offset: direction > 0 ? k + 0.5 - value : value - k + 0.5 };
	});
}

/**
 * Put a location into the range (-length, 0].
 *
 * @param {number} location
 * @param {number} length
 * @returns {number}
 */
export function normalize(location, length) {
	return location - Math.ceil(location / length) * length;
}
