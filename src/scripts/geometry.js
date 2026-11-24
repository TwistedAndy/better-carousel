/*
 * Snap math: the snaps, the active slide, the slides in view and the progress. This module does not use the DOM.
 *
 * All values are on the main axis, in px. A slide is { start, end }: its border box at location 0, relative to the viewport start.
 * The location L is the translate of the container. A slide shows at start + L.
 * In loop mode, the period is the length of one copy of the slides. Without loop, it is 0.
 */

import { cloneCount } from './loop.js';

// Short names of the Math functions, which the minified file can make shorter
export const { abs, floor, round } = Math;

/**
 * Keep a value between two limits.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Get a valid snap index. In loop mode, the index goes around. Without loop, it stops at the first or the last snap.
 *
 * @param {number} index
 * @param {number} count The number of snaps.
 * @param {number} [period]
 * @returns {number}
 */
export function snapIndex(index, count, period) {
	return period ? (index % count + count) % count : clamp(index, 0, count - 1);
}

/**
 * Get the offset of a snap from the viewport start.
 *
 * @param {string|Function} align 'start', 'center', 'end' or (viewSize, snapSize, index) => offset.
 * @param {number} view The viewport size.
 * @param {number} size The snap size.
 * @param {number} index The snap index.
 * @returns {number}
 */
export function alignOffset(align, view, size, index) {
	if (typeof align === 'function') {
		return align(view, size, index);
	}
	return align === 'center' ? (view - size) / 2 : align === 'end' ? view - size : 0;
}

/**
 * Get the first start and the last end of the slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {{start: number, end: number, size: number, max: number}} max is the size of the largest slide.
 */
export function bounds(slides) {
	let start = Infinity,
		end = -Infinity,
		max = 0;

	for (const slide of slides) {
		if (slide.hidden) {
			continue;
		}
		start = Math.min(start, slide.start);
		end = Math.max(end, slide.end);
		max = Math.max(max, slide.end - slide.start);
	}

	return { start, end, size: end - start, max };
}

/**
 * Put the slides that start at the same position (1 px or less) into one column. A hidden slide is in no column.
 * In a flex row, one column has one slide. In a grid, a column can have more slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {Array<{start: number, end: number}>} The columns, sorted by start.
 */
export function columns(slides) {
	const order = slides.map((slide, index) => index).filter((index) => !slides[index].hidden).sort((a, b) => slides[a].start - slides[b].start || a - b),
		list = [];

	let column;

	for (const index of order) {
		const slide = slides[index];
		if (column && slide.start - column.start <= 1) {
			column.end = Math.max(column.end, slide.end);
		} else {
			column = { start: slide.start, end: slide.end };
			list.push(column);
		}
	}

	return list;
}

/**
 * Put the columns into groups. One group gives one snap.
 *
 * @param {Array<{start: number, end: number}>} list The columns.
 * @param {number} view
 * @param {number|string} count A number of columns, or 'auto' for as many as fit in the viewport.
 * @returns {Array<{start: number, end: number}>}
 */
export function groups(list, view, count) {
	const result = [];

	let group,
		size = 0;

	for (const column of list) {
		const fit = count === 'auto' ? group && column.end - group.start <= view + 1 : size < count;
		if (group && fit) {
			group.end = Math.max(group.end, column.end);
			size++;
		} else {
			group = { start: column.start, end: column.end };
			result.push(group);
			size = 1;
		}
	}

	return result;
}

/**
 * Find the item with the lowest score.
 *
 * @param {Array} list
 * @param {(item: *, index: number) => number} score Infinity excludes an item.
 * @param {number} [margin] A score must be lower than the best score by more than this value. Then the lower index wins a tie.
 * @returns {number} The index, or -1 if all items are excluded.
 */
function lowest(list, score, margin = 0) {
	let best = -1,
		gap = Infinity;

	list.forEach((item, index) => {
		const value = score(item, index);
		if (value < gap - margin) {
			gap = value;
			best = index;
		}
	});

	return best;
}

/**
 * Get the distance between two locations. In loop mode, use the shortest distance modulo the period.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} [period] The loop period, or 0 if the loop is off.
 * @returns {number} a - b
 */
export function distance(a, b, period) {
	const value = a - b;
	return period ? value - round(value / period) * period : value;
}

/**
 * Compute the snaps.
 *
 * @param {object} args
 * @param {Array<{start: number, end: number}>} args.slides
 * @param {number} args.view The viewport size.
 * @param {string|Function} args.align
 * @param {number|string} args.slidesPerSnap
 * @param {string|boolean} args.containScroll 'trimSnaps', 'keepSnaps' or false.
 * @param {number} [args.period] The loop period, or 0 if the loop is off.
 * @returns {{snaps: Array<{location: number, slide: number}>, min: number, max: number}}
 * Each snap has its location and its active slide. min and max are the limits of the location if the loop is off.
 * With the loop, max is the location of the first snap, where the progress is 0.
 */
export function snaps({ slides, view, align, slidesPerSnap, containScroll, period = 0 }) {
	const content = bounds(slides);

	let max = -content.start || 0,
		min = view - content.end,
		list = groups(columns(slides), view, slidesPerSnap).map((group, index) => alignOffset(align, view, group.end - group.start, index) - group.start);

	if (!period) {
		if (containScroll) {
			list = list.map((location) => clamp(location, min, max));
		} else {
			max = Math.max(...list);
			min = Math.min(...list);
		}
	}

	if (period || containScroll !== 'keepSnaps') {
		list = list.filter((location, index) => !index || abs(distance(location, list[index - 1], period)) > 1);
		if (period && list.length > 1 && abs(distance(list[0], list[list.length - 1], period)) <= 1) {
			list.pop();
		}
	}

	const result = list.map((location) => ({ location, slide: activeSlide(slides, location, view, align, period) }));

	// Without the loop, a trimmed snap at an end can get the slide of the snap next to it. Then it takes the nearest slide on its own side.
	const fix = (snap, from, to) => {
		const slide = activeSlide(slides, snap.location, view, align, 0, from, to);
		snap.slide = slide > -1 ? slide : snap.slide;
	};

	if (!period && result.length > 1) {
		const first = result[0],
			last = result[result.length - 1];
		if (first.slide >= result[1].slide) {
			fix(first, 0, result[1].slide);
		}
		if (last.slide <= result[result.length - 2].slide) {
			fix(last, result[result.length - 2].slide + 1, slides.length);
		}
	}

	return {
		snaps: result,
		min,
		max: period ? list[0] : max
	};
}

/**
 * Find the slide whose anchor is nearest to the align point at a location.
 * The anchor is the start for 'start', the center for 'center' and the end for 'end'.
 * If two slides have the same distance, the lower index wins. A hidden slide is never the active slide.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} location
 * @param {number} view
 * @param {string|Function} align
 * @param {number} [period]
 * @param {number} [from] The first slide to look at.
 * @param {number} [to] The slide after the last slide to look at.
 * @returns {number} The slide index, or -1 if the range is empty.
 */
export function activeSlide(slides, location, view, align, period, from = 0, to = slides.length) {
	return lowest(slides, (slide, index) => index >= from && index < to && !slide.hidden ? abs(distance(slide.start + location, alignOffset(align, view, slide.end - slide.start, index), period)) : Infinity, 0.5);
}

/**
 * Find the snap of a slide: the snap whose active slide it is, or the snap nearest to the raw location of the slide.
 *
 * @param {{snaps: Array<{location: number, slide: number}>, slides: Array<{start: number, end: number}>, view: number, align: string|Function, period?: number}} geo
 * @param {number} index The slide index.
 * @returns {number} The snap index.
 */
export function snapOfSlide({ snaps: list, slides, view, align, period }, index) {
	const found = list.findIndex((snap) => snap.slide === index),
		slide = slides[index];

	if (found > -1 || !slide) {
		return Math.max(found, 0);
	}

	return nearestSnap(list, alignOffset(align, view, slide.end - slide.start, index) - slide.start, period);
}

/**
 * Find the snap nearest to a location.
 *
 * @param {Array<{location: number}>} list The snaps.
 * @param {number} location
 * @param {number} [period]
 * @returns {number} The snap index.
 */
export function nearestSnap(list, location, period) {
	return Math.max(0, lowest(list, (snap) => abs(distance(snap.location, location, period))));
}

/**
 * Get the location of a snap that is nearest to the current location. In loop mode, a snap has a location in each period.
 *
 * @param {number} target The snap location.
 * @param {number} location The current location.
 * @param {number} [period]
 * @param {number} [direction] 1 to go forward (a smaller location), -1 to go back, 0 for the shortest path.
 * @returns {number}
 */
export function targetLocation(target, location, period, direction = 0) {
	if (!period) {
		return target;
	}

	if (direction > 0) {
		return target + (Math.ceil((location - 0.5 - target) / period) - 1) * period;
	}

	if (direction < 0) {
		return target + (floor((location + 0.5 - target) / period) + 1) * period;
	}

	return location + distance(target, location, period);
}

/**
 * Get the progress of a location, from 0 to 1.
 *
 * @param {number} location
 * @param {{min: number, max: number, cycle: number}} limits The limits of the location, and the length of one copy of the original slides in loop mode.
 * With the loop, max is the location of the first snap, and the progress goes from 0 to 1 in each copy. Without the loop, cycle is 0.
 * @returns {number}
 */
export function progress(location, { min, max, cycle }) {
	if (cycle) {
		const value = (max - location) / cycle;
		return value - floor(value);
	}
	return max > min ? clamp((max - location) / (max - min), 0, 1) : 0;
}

/**
 * Find the slides that show at a location.
 *
 * @param {{slides: Array<{start: number, end: number}>, view: number, period?: number}} geo
 * @param {number} location
 * @param {number} threshold The part of a slide that must show, from 0 to 1. With 0, any part is enough. A slide that is larger than the viewport
 * must fill this part of the viewport.
 * @returns {number[]} The slide indexes.
 */
export function inView({ slides, view, period }, location, threshold) {
	const result = [];

	slides.forEach((slide, index) => {
		const size = slide.end - slide.start,
			start = period ? distance(slide.start + location + size / 2, view / 2, period) + view / 2 - size / 2 : slide.start + location,
			visible = Math.min(start + size, view) - Math.max(start, 0);

		if (!slide.hidden && visible > 0 && visible >= threshold * Math.min(size, view) - 0.5) {
			result.push(index);
		}
	});

	return result;
}

/**
 * Get the position of a location between the snaps, as a fractional snap index: 2.4 is between snap 2 and snap 3.
 * In loop mode, a value after the last snap goes to the first snap again.
 *
 * @param {Array<{location: number}>} list The snaps.
 * @param {number} location
 * @param {number} [period]
 * @returns {number}
 */
export function snapPosition(list, location, period) {
	const last = list.length - 1,
		first = list[0].location,
		at = period ? first - ((first - location) % period + period) % period : clamp(location, list[last].location, first);

	let index = 0;

	while (index < last && list[index + 1].location >= at) {
		index++;
	}

	const from = list[index].location,
		to = index < last ? list[index + 1].location : first - period;

	return index + (to < from ? (from - at) / (from - to) : 0);
}

/**
 * Compute the geometry of a carousel from the layout reads: the loop period, the snaps, and the logical snaps.
 * With clones, a logical snap is a snap whose active slide is an original slide.
 *
 * @param {object} layout The result of readLayout().
 * @param {{view: number, slides: Array<{start: number, end: number}>, gap: number, area: {start: number, size: number}}} rects The result of readRects().
 * The slides after the first count slides are clones.
 * @param {number} count The number of original slides.
 * @param {object} options The options of the carousel.
 * @returns {object} The geometry. If the carousel needs a different number of clones, only { copies }: the number of copies of all slides.
 * map gives the logical snap of each snap.
 */
export function compute(layout, rects, count, options) {
	const content = bounds(rects.slides.slice(0, count)),
		// The auto scroll with the loop never fits, unless no slide shows, for example in a hidden tab
		fit = content.size <= rects.view + 1 && !(options.autoScroll && options.loop && content.max),
		loop = options.loop && !fit && count,
		// The loop period: the distance from the first slide start to the same point in the next copy of the slides
		period = loop ? bounds(rects.slides).size + rects.gap : 0,
		copies = loop && options.clones ? cloneCount(content.size + rects.gap, rects.area.size, content.max) : 0;

	if (copies * count !== rects.slides.length - count) {
		return { copies };
	}

	const geo = { ...layout, ...rects, fit, count, period, cycle: period / (copies + 1), min: 0, max: 0 };

	if (fit) {
		geo.snaps = [{ location: 0, slide: Math.max(0, activeSlide(rects.slides, 0, rects.view, layout.align)) }];
	} else {
		Object.assign(geo, snaps({ ...rects, align: layout.align, slidesPerSnap: options.slidesPerSnap, containScroll: options.containScroll, period }));
	}

	const list = geo.snaps.map((snap, index) => index).filter((index) => !copies || geo.snaps[index].slide < count);

	geo.logical = list;
	geo.map = geo.snaps.map((snap, index) => copies ? Math.max(0, list.findIndex((item) => geo.snaps[item].slide % count === snap.slide % count)) : index);

	return geo;
}

/**
 * Find the snap of a logical snap that is nearest to a location. With clones, a logical snap has more than one snap.
 *
 * @param {{snaps: Array<{location: number}>, logical: number[], map: number[], period: number}} geo The result of compute().
 * @param {number} index The logical snap. An index out of range goes to the first or the last logical snap, and an index that is not a number goes to the first.
 * @param {number} location
 * @returns {number} The snap index.
 */
export function physicalSnap(geo, index, location) {
	const logical = round(clamp(index, 0, geo.logical.length - 1)) || 0;

	return Math.max(0, lowest(geo.snaps, (snap, item) => geo.map[item] === logical ? abs(distance(snap.location, location, geo.period)) : Infinity));
}
