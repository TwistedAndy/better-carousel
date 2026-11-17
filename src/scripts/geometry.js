/*
 * Snap math: the snaps, the active slide, the slides in view and the progress. This module does not use the DOM.
 *
 * All values are on the main axis, in px. A slide is { start, end }: its border box at location 0, relative to the viewport start.
 * The location L is the translate of the container. A slide shows at start + L.
 * In loop mode, the period is the length of one copy of the slides. Without loop, it is 0.
 */

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
		start = Math.min(start, slide.start);
		end = Math.max(end, slide.end);
		max = Math.max(max, slide.end - slide.start);
	}

	return { start, end, size: end - start, max };
}

/**
 * Put the slides that start at the same position (1 px or less) into one column.
 * In a flex row, one column has one slide. In a grid, a column can have more slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {Array<{start: number, end: number}>} The columns, sorted by start.
 */
export function columns(slides) {
	const order = slides.map((slide, index) => index).sort((a, b) => slides[a].start - slides[b].start || a - b),
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
 * Get the distance between two locations. In loop mode, use the shortest distance modulo the period.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} [period] The loop period, or 0 if the loop is off.
 * @returns {number} a - b
 */
export function distance(a, b, period) {
	const value = a - b;
	return period ? value - Math.round(value / period) * period : value;
}

/**
 * Compute the snaps.
 *
 * @param {object} args
 * @param {Array<{start: number, end: number}>} args.slides
 * @param {number} args.view The viewport size.
 * @param {string|Function} args.align
 * @param {number|string} args.slidesToScroll
 * @param {string|boolean} args.containScroll 'trimSnaps', 'keepSnaps' or false.
 * @param {number} [args.period] The loop period, or 0 if the loop is off.
 * @returns {{snaps: Array<{location: number, slide: number}>, min: number, max: number}}
 * Each snap has its location and its active slide. min and max are the limits of the location if the loop is off.
 * With the loop, max is the location of the first snap, where the progress is 0.
 */
export function snaps({ slides, view, align, slidesToScroll, containScroll, period = 0 }) {
	const content = bounds(slides);

	let max = -content.start || 0,
		min = view - content.end,
		list = groups(columns(slides), view, slidesToScroll).map((group, index) => alignOffset(align, view, group.end - group.start, index) - group.start);

	if (!period) {
		if (containScroll) {
			list = list.map((location) => clamp(location, min, max));
		} else {
			max = Math.max(...list);
			min = Math.min(...list);
		}
	}

	if (period || containScroll !== 'keepSnaps') {
		list = list.filter((location, index) => !index || Math.abs(distance(location, list[index - 1], period)) > 1);
		if (period && list.length > 1 && Math.abs(distance(list[0], list[list.length - 1], period)) <= 1) {
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
 * If two slides have the same distance, the lower index wins.
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
	let best = -1,
		gap = Infinity;

	slides.forEach((slide, index) => {
		const value = Math.abs(distance(slide.start + location, alignOffset(align, view, slide.end - slide.start, index), period));
		if (index >= from && index < to && value < gap - 0.5) {
			gap = value;
			best = index;
		}
	});

	return best;
}

/**
 * Find the snap of a slide: the snap whose active slide it is, or the snap nearest to the raw location of the slide.
 *
 * @param {Array<{location: number, slide: number}>} list The snaps.
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} index The slide index.
 * @param {number} view
 * @param {string|Function} align
 * @param {number} [period]
 * @returns {number} The snap index.
 */
export function snapOfSlide(list, slides, index, view, align, period) {
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
	let best = 0,
		gap = Infinity;

	list.forEach((snap, index) => {
		const value = Math.abs(distance(snap.location, location, period));
		if (value < gap) {
			gap = value;
			best = index;
		}
	});

	return best;
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
		return target + (Math.floor((location + 0.5 - target) / period) + 1) * period;
	}

	return location + distance(target, location, period);
}

/**
 * Get the progress of a location, from 0 to 1.
 *
 * @param {number} location
 * @param {number} min
 * @param {number} max With the loop, the location of the first snap.
 * @param {number} [period]
 * @returns {number}
 */
export function progress(location, min, max, period) {
	if (period) {
		const value = (max - location) / period;
		return value - Math.floor(value);
	}
	return max > min ? clamp((max - location) / (max - min), 0, 1) : 0;
}

/**
 * Find the slides that show at a location.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} location
 * @param {number} view
 * @param {number} threshold The part of a slide that must show, from 0 to 1. With 0, any part is enough.
 * @param {number} [period]
 * @returns {number[]} The slide indexes.
 */
export function inView(slides, location, view, threshold, period) {
	const result = [];

	slides.forEach((slide, index) => {
		const size = slide.end - slide.start,
			start = period ? distance(slide.start + location + size / 2, view / 2, period) + view / 2 - size / 2 : slide.start + location,
			visible = Math.min(start + size, view) - Math.max(start, 0);

		if (visible > 0 && visible >= threshold * size - 0.5) {
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
