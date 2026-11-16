// Default options, class presets and the option merge

const defaults = {
	axis: 'auto',
	align: 'auto',
	direction: 'auto',
	loop: false,
	dragFree: false,
	containScroll: 'trimSnaps',
	slidesToScroll: 1,
	skipSnaps: true,
	dragThreshold: 10,
	duration: 400,
	startSnap: 0,
	lazy: false,
	draggable: true,
	wheel: true,
	resize: true,
	slideChanges: true,
	focus: true,
	inViewThreshold: 0,
	active: true,
	breakpoints: {},
	container: null,
	slides: null,
	wrap: true,
	arrows: true,
	dots: true,
	labels: { carousel: 'Carousel', slide: '%d of %n', prev: 'Previous slide', next: 'Next slide', dot: 'Go to slide %d', play: 'Start the slide show', pause: 'Stop the slide show' },
	classes: null,
	state: '',
	sync: null,
	clones: 'auto',
	autoplay: false,
	autoScroll: false,
	autoHeight: false
};

// The class names of a prefix. The root class is the prefix, such as "better" or "embla".
const names = (prefix) => ({
	root: prefix,
	viewport: prefix + '_viewport',
	container: prefix + '_container',
	dynamic: prefix + '_dynamic',
	horizontal: prefix + '_horizontal',
	vertical: prefix + '_vertical',
	autoHeight: prefix + '_auto_height',
	button: prefix + '_button',
	prev: prefix + '_prev',
	next: prefix + '_next',
	dots: prefix + '_dots',
	dot: prefix + '_dot',
	play: prefix + '_play',
	clone: 'clone',
	active: 'active',
	inView: '',
	dragging: 'dragging',
	playing: 'playing',
	first: 'first',
	before: 'prev',
	current: 'current',
	after: 'next',
	last: 'last'
});

// The state classes get the "state" prefix
const states = ['active', 'inView', 'dragging', 'playing', 'first', 'before', 'current', 'after', 'last'];

/**
 * Get the class names from the "classes" and "state" options.
 *
 * @param {string|object|null} classes A prefix, such as 'embla', or an object with the names to change. The default prefix is 'better'.
 * The object can have a "prefix" key for the names that it does not change: { prefix: 'embla', active: 'selected' }.
 * @param {string} state The prefix of the state classes.
 * @returns {object}
 */
function classNames(classes, state) {
	const result = typeof classes === 'string' ? names(classes) : { ...names(classes?.prefix || 'better'), ...classes };

	for (const key of states) {
		if (result[key]) {
			result[key] = state + result[key];
		}
	}

	return result;
}

/**
 * Merge the option sources. A later source wins. Objects such as "labels" merge one level deep.
 *
 * @param {...object} sources
 * @returns {object}
 */
function merge(...sources) {
	const result = {};

	for (const source of sources) {
		for (const key in source) {
			const value = source[key],
				old = result[key];
			result[key] = value && old && typeof value === 'object' && typeof old === 'object' && value.constructor === Object && old.constructor === Object ? { ...old, ...value } : value;
		}
	}

	return result;
}

/**
 * Read the JSON options of the data-carousel attribute.
 *
 * @param {HTMLElement} element
 * @returns {object}
 */
function dataOptions(element) {
	try {
		return JSON.parse(element.dataset.carousel || '{}');
	} catch (error) {
		return {};
	}
}

/**
 * Make an event emitter. A handler gets (api, name), as in Embla.
 *
 * @param {object} api
 * @returns {{on: Function, off: Function, emit: Function, has: Function}}
 */
function emitter(api) {
	const map = {};

	return {
		on(name, handler) {
			(map[name] ||= new Set()).add(handler);
			return api;
		},
		off(name, handler) {
			map[name]?.delete(handler);
			return api;
		},
		emit(name) {
			map[name]?.forEach((handler) => handler(api, name));
		},
		has(name) {
			return !!map[name]?.size;
		}
	};
}

// DOM helpers. Each helper writes only when the value changes.

/**
 * Add or remove a class.
 *
 * @param {Element} element
 * @param {string} name An empty name does nothing.
 * @param {boolean} on
 */
function setClass(element, name, on) {
	if (name && element.classList.contains(name) !== !!on) {
		element.classList.toggle(name, !!on);
	}
}

/**
 * Set an attribute, or remove it if the value is null or false.
 *
 * @param {Element} element
 * @param {string} name
 * @param {string|boolean|null} value
 */
function setAttribute(element, name, value) {
	const text = value === true ? '' : value === false || value == null ? null : String(value);
	if (element.getAttribute(name) !== text) {
		if (text === null) {
			element.removeAttribute(name);
		} else {
			element.setAttribute(name, text);
		}
	}
}

/**
 * Set an inline style property.
 *
 * @param {HTMLElement} element
 * @param {string} name
 * @param {string} value An empty string removes the property.
 */
function setStyle(element, name, value) {
	if (element.style[name] !== value) {
		element.style[name] = value;
	}
}

/**
 * Get the CSS translate value for one axis.
 *
 * @param {string} axis 'x' or 'y'.
 * @param {number} value px
 * @returns {string}
 */
function translate(axis, value) {
	return value ? (axis === 'x' ? value + 'px' : '0 ' + value + 'px') : '';
}

/**
 * Remove an empty style attribute that the library left.
 *
 * @param {Element} element
 */
function cleanStyle(element) {
	if (element.getAttribute('style') === '') {
		element.removeAttribute('style');
	}
}

/**
 * Make an element.
 *
 * @param {string} tag
 * @param {string} className
 * @returns {HTMLElement}
 */
function create(tag, className) {
	const element = document.createElement(tag);
	if (className) {
		element.className = className;
	}
	return element;
}

// Layout reads. They run in the ResizeObserver callback, when the layout is clean.

/**
 * Read the axis, the alignment, the direction and the gap from the computed style of the container.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {{axis: string, align: string|Function, rtl: boolean, gap: number}}
 */
function readLayout(container, options) {
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
function readRects(viewport, nodes, layout, written) {
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

// Snap math. This module does not use the DOM.
//
// All values are on the main axis, in px. A slide is { start, end }: its border box at location 0, relative to the viewport start.
// The location L is the translate of the container. A slide shows at start + L.

/**
 * Get the offset of a snap from the viewport start.
 *
 * @param {string|Function} align 'start', 'center', 'end' or (viewSize, snapSize, index) => offset.
 * @param {number} view The viewport size.
 * @param {number} size The snap size.
 * @param {number} index The snap index.
 * @returns {number}
 */
function alignOffset(align, view, size, index) {
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
function bounds(slides) {
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
 * Find if all slides fit in the viewport.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} view
 * @returns {boolean}
 */
function fits(slides, view) {
	return !slides.length || bounds(slides).size <= view + 1;
}

/**
 * Put the slides that start at the same position (1 px or less) into one column.
 * In a flex row, one column has one slide. In a grid, a column can have more slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {Array<{start: number, end: number}>} The columns, sorted by start.
 */
function columns(slides) {
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
function groups(list, view, count) {
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
function distance(a, b, period) {
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
 */
function snaps({ slides, view, align, slidesToScroll, containScroll, period = 0 }) {
	const content = bounds(slides);

	let max = -content.start || 0,
		min = view - content.end,
		list = groups(columns(slides), view, slidesToScroll).map((group, index) => alignOffset(align, view, group.end - group.start, index) - group.start);

	if (!period) {
		if (containScroll) {
			list = list.map((location) => Math.min(max, Math.max(min, location)));
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
		max
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
function activeSlide(slides, location, view, align, period, from = 0, to = slides.length) {
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
function snapOfSlide(list, slides, index, view, align, period) {
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
function nearestSnap(list, location, period) {
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
function targetLocation(target, location, period, direction = 0) {
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
 * @param {number} max
 * @param {number} [period]
 * @returns {number}
 */
function progress(location, min, max, period) {
	if (period) {
		const value = -location / period;
		return value - Math.floor(value);
	}
	return max > min ? Math.min(1, Math.max(0, (max - location) / (max - min))) : 0;
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
function inView(slides, location, view, threshold, period) {
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

// Loop math. This module does not use the DOM.
//
// In loop mode, each slide is at start + k * period. The library writes k * period as the translate of the slide.

/**
 * Get the loop period: the distance from the first slide start to the same point in the next copy of the slides.
 *
 * @param {number} start The first slide start.
 * @param {number} end The last slide end.
 * @param {number} gap The gap between the last slide and the first slide of the next copy.
 * @returns {number}
 */
function period(start, end, gap) {
	return end + gap - start;
}

/**
 * Find if the slides can loop with no clones. No slide can be necessary at two places at the same time.
 *
 * @param {number} length The loop period.
 * @param {number} view The viewport size.
 * @param {number} max The size of the largest slide.
 * @returns {boolean}
 */
function canLoop(length, view, max) {
	return length >= view + max;
}

/**
 * Get the number of full copies of the slides that the loop needs.
 *
 * @param {number} length The loop period of the original slides.
 * @param {number} view
 * @param {number} max
 * @returns {number}
 */
function cloneCount(length, view, max) {
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
function placement(slides, from, to, view, length, offset = 0) {
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
function pathFits(slides, from, to, view, length) {
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
function steps(slides, from, view, length, direction, offset = 0) {
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
function normalize(location, length) {
	return location - Math.ceil(location / length) * length;
}

// Motion math. The functions in this part do not use the DOM.


// The easing of a goTo() motion
const EASE = [0.25, 1, 0.5, 1];

// The easing of a glide after a free drag
const GLIDE = [0.2, 0.6, 0.35, 1];

// The duration of the motion for one wheel event, in ms
const WHEEL = 180;

// The time constant of the glide, in ms: the glide distance is velocity * MOMENTUM
const MOMENTUM = 325;

/**
 * Make a cubic Bézier easing function, the same as the CSS cubic-bezier().
 *
 * @param {number[]} curve [x1, y1, x2, y2]
 * @returns {(t: number) => number}
 */
function bezier([x1, y1, x2, y2]) {
	const axis = (a, b, t) => ((1 + 3 * a - 3 * b) * t + 3 * b - 6 * a) * t * t + 3 * a * t;

	return (x) => {
		if (x <= 0 || x >= 1) {
			return x <= 0 ? 0 : 1;
		}

		let t = x;

		// Newton steps, then bisection if the slope is too small
		for (let i = 0; i < 6; i++) {
			const error = axis(x1, x2, t) - x,
				slope = 3 * (1 + 3 * x1 - 3 * x2) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
			if (Math.abs(error) < 1e-5) {
				return axis(y1, y2, t);
			}
			if (Math.abs(slope) < 1e-6) {
				break;
			}
			t -= error / slope;
		}

		let low = 0,
			high = 1;

		t = x;

		while (high - low > 1e-5) {
			if (axis(x1, x2, t) < x) {
				low = t;
			} else {
				high = t;
			}
			t = (low + high) / 2;
		}

		return axis(y1, y2, t);
	};
}

/**
 * Get the duration of a goTo() motion.
 *
 * @param {number} duration The duration for one snap, in ms.
 * @param {number} count The number of snaps to move.
 * @returns {number}
 */
function goToDuration(duration, count) {
	return count > 1 ? Math.min(2 * duration, duration * (1 + Math.log2(count))) : duration;
}

/**
 * Get the duration of a motion after a release, so that the motion starts at the release velocity.
 *
 * @param {number} path The distance of the motion: target - location.
 * @param {number} velocity The release velocity, in px/ms.
 * @param {number[]} curve The easing of the motion.
 * @param {number} fallback The duration if the velocity is too low or in the other direction.
 * @returns {number}
 */
function releaseDuration(path, velocity, curve, fallback) {
	if (Math.sign(path) !== Math.sign(velocity) || Math.abs(velocity) < 0.05) {
		return fallback;
	}
	return Math.min(1200, Math.max(200, Math.abs(path) * curve[1] / curve[0] / Math.abs(velocity)));
}

/**
 * Get the velocity from the last samples of a drag.
 *
 * @param {Array<number[]>} samples [location, time] pairs, the oldest first.
 * @returns {number} px/ms
 */
function velocity(samples) {
	const last = samples[samples.length - 1];

	if (!last) {
		return 0;
	}

	const first = samples.find((sample) => last[1] - sample[1] <= 100) || last,
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
 * @returns {{location: number, snap: number}}
 */
function releaseTarget({ location, from, velocity, current, snaps, min, max, period, skipSnaps, dragFree }) {
	const clamp = (value) => period ? value : Math.min(max, Math.max(min, value)),
		count = snaps.length;

	let projected = clamp(location + velocity * MOMENTUM);

	// A number in skipSnaps: keep the projected location between the snaps that are skipSnaps snaps before and after the start snap
	if (typeof skipSnaps === 'number' && skipSnaps > 0 && skipSnaps < count - 1 + !period) {
		const limit = (direction) => {
			const index = current + direction * skipSnaps;
			return period ? targetLocation(snaps[(index % count + count) % count].location, from, period, direction) : snaps[Math.min(count - 1, Math.max(0, index))].location;
		};
		projected = Math.min(limit(-1), Math.max(limit(1), projected));
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

	if (Math.abs(velocity) > 0.3) {
		direction = velocity < 0 ? 1 : -1;
	} else if (Math.abs(moved) > 20) {
		direction = moved < 0 ? 1 : -1;
	}

	let snap = current + direction;

	if (period) {
		snap = (snap + count) % count;
	} else {
		snap = Math.min(count - 1, Math.max(0, snap));
	}

	const target = snaps[snap].location;

	return {
		location: period ? targetLocation(target, direction ? from : location, period, snap === current ? 0 : direction) : target,
		snap
	};
}

/**
 * Get the location of a motion at a time.
 *
 * @param {number} from
 * @param {number} to
 * @param {number} time The time from the motion start, in ms.
 * @param {number} duration
 * @param {(t: number) => number} ease
 * @returns {number}
 */
function locationAt(from, to, time, duration, ease) {
	return from + (to - from) * ease(duration > 0 ? time / duration : 1);
}

/**
 * Get the rubber band location out of the limits.
 *
 * @param {number} location
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function resist(location, min, max) {
	if (location > max) {
		return max + (location - max) * 0.25;
	}
	if (location < min) {
		return min + (location - min) * 0.25;
	}
	return location;
}

/**
 * Make the motion engine of a carousel. A motion runs as a Web Animations API animation of the container translate, on the compositor.
 * With raf set, it runs as a requestAnimationFrame loop instead, which calls frame() on each frame.
 *
 * @param {HTMLElement} element The container.
 * @param {(location: number) => string} css Get the CSS translate value of a location.
 * @param {(location: number) => void} frame Write a location.
 * @param {() => void} done Called when a motion ends.
 * @returns {{run: Function, retarget: Function, stop: Function, current: Function}}
 */
function animator(element, css, frame, done) {
	let state = null;

	const time = () => state.animation ? state.animation.currentTime || 0 : performance.now() - state.start,
		current = () => state && locationAt(state.from, state.to, time(), state.duration, state.ease);

	function tick() {
		if (time() >= state.duration) {
			finish();
		} else {
			frame(current());
			state.raf = requestAnimationFrame(tick);
		}
	}

	function finish() {
		const to = state.to;
		stop();
		frame(to);
		done();
	}

	/**
	 * Stop the motion.
	 *
	 * @returns {number|null} The location at the stop, or null if no motion runs.
	 */
	function stop() {
		const at = current();
		if (state) {
			state.animation?.cancel();
			cancelAnimationFrame(state.raf);
			state = null;
		}
		return at;
	}

	function animate(at) {
		state.animation = element.animate([{ translate: css(state.from) }, { translate: css(state.to) }], { duration: state.duration, easing: 'cubic-bezier(' + state.curve + ')', fill: 'forwards' });
		state.animation.currentTime = at;
		state.animation.onfinish = finish;
	}

	return {
		/**
		 * Start a motion. It stops the motion that runs.
		 *
		 * @param {number} from
		 * @param {number} to
		 * @param {number} duration ms
		 * @param {number[]} curve The cubic Bézier easing.
		 * @param {boolean} raf Use a requestAnimationFrame loop.
		 */
		run(from, to, duration, curve, raf) {
			stop();
			state = { from, to, duration, curve, ease: bezier(curve) };
			if (raf) {
				state.start = performance.now();
				state.raf = requestAnimationFrame(tick);
			} else {
				animate(0);
			}
		},

		/**
		 * Change the end of the motion that runs. The start, the time and the easing stay, so the motion does not jump.
		 *
		 * @param {number} to
		 * @returns {boolean} false if no motion runs.
		 */
		retarget(to) {
			if (!state) {
				return false;
			}
			if (to === state.to) {
				return true;
			}
			state.to = to;
			if (state.animation) {
				const at = time();
				state.animation.cancel();
				animate(at);
			}
			return true;
		},
		stop,
		current
	};
}

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
function drag(viewport, hooks) {
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

/**
 * Find the element for the arrows or the dots.
 * A selector is searched in the root and then in each ancestor of the root, so that it finds a heading in the section of the carousel.
 *
 * @param {boolean|string|Element} value The "arrows" or "dots" option.
 * @param {HTMLElement} root
 * @returns {Element|null}
 */
function place(value, root) {
	if (typeof value === 'string') {
		for (let node = root; node; node = node.parentElement) {
			const found = node.querySelector(value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	return value === true ? root : value || null;
}

/**
 * Make the arrows and the dots of a carousel. They update on the carousel events.
 *
 * @param {object} api
 * @param {HTMLElement} root
 * @param {object} cls The class names.
 * @param {object} options
 * @returns {() => void} A function that removes the arrows and the dots.
 */
function nav(api, root, cls, options) {
	const labels = options.labels,
		arrows = place(options.arrows, root),
		box = place(options.dots, root),
		buttons = [],
		dots = [],
		list = box && create('div', cls.dots);

	let marks = new Map();

	if (arrows) {
		[['prev', 'goToPrev'], ['next', 'goToNext']].forEach(([key, method]) => {
			const button = create('button', cls.button + ' ' + cls[key]);
			button.type = 'button';
			button.setAttribute('aria-label', labels[key]);
			button.setAttribute('aria-controls', api.containerNode().id);
			button.addEventListener('click', () => api[method]());
			buttons.push(button);
		});
	}

	function update() {
		const fit = api.isFit(),
			count = fit ? 0 : api.snapList().length,
			selected = api.selectedSnap();

		buttons.forEach((button, index) => {
			if (fit) {
				button.remove();
			} else {
				if (!button.isConnected) {
					arrows.append(button);
				}
				const disabled = !(index ? api.canGoToNext() : api.canGoToPrev());
				if (button.disabled !== disabled) {
					button.disabled = disabled;
				}
			}
		});

		if (!list) {
			return;
		}

		if (count < 2) {
			list.remove();
			return;
		}

		while (dots.length > count) {
			dots.pop().remove();
			marks.delete(dots.length);
		}

		while (dots.length < count) {
			const dot = create('button', cls.dot),
				index = dots.length;
			dot.type = 'button';
			dot.setAttribute('aria-label', labels.dot.replace('%d', index + 1));
			dot.setAttribute('aria-controls', api.containerNode().id);
			// The window of the dots hides the dots out of the zoom: keep them out of the tab order
			dot.tabIndex = -1;
			dot.addEventListener('click', () => api.goTo(index));
			dots.push(dot);
			list.append(dot);
		}

		if (!list.isConnected) {
			box.append(list);
		}

		// The zoom effect: the 5 dots around the selected dot get state classes
		const next = new Map();

		['first', 'before', 'current', 'after', 'last'].forEach((key, offset) => {
			if (dots[selected + offset - 2]) {
				next.set(selected + offset - 2, cls[key]);
			}
		});

		marks.forEach((name, index) => {
			if (next.get(index) !== name && dots[index]) {
				setClass(dots[index], name, false);
				setAttribute(dots[index], 'aria-current', false);
				dots[index].tabIndex = -1;
			}
		});

		next.forEach((name, index) => {
			setClass(dots[index], name, true);
			setAttribute(dots[index], 'aria-current', index === selected && 'true');
			dots[index].tabIndex = 0;
		});

		marks = next;

		// Center the group of up to 5 dots in the window of the dots. The CSS moves the dots with "translate".
		const shift = 2 - (Math.max(0, selected - 2) + Math.min(count - 1, selected + 2)) / 2;
		if (list.style.getPropertyValue('--better-shift') !== String(shift)) {
			list.style.setProperty('--better-shift', shift);
		}
	}

	const names = ['init', 'reinit', 'resize', 'select', 'slideschanged'];

	names.forEach((name) => api.on(name, update));

	return () => {
		names.forEach((name) => api.off(name, update));
		buttons.forEach((button) => button.remove());
		list?.remove();
	};
}

/**
 * Connect a carousel to another carousel with the same slides, such as thumbnails to a main gallery. This carousel follows the slide
 * that the other carousel selects. Only a click on a slide of this carousel selects that slide in the other carousel: a drag does not.
 *
 * @param {object} api This carousel.
 * @param {object|string|Element} target The other carousel, its container or a selector.
 * @param {(element: Element) => object} find Get the carousel of an element.
 * @param {(node: Element) => number} slideOf Get the original slide index of a node in this carousel, or -1.
 * @param {(index: number) => void} follow Set the selected slide of this carousel.
 * @returns {() => void} A function that disconnects the carousels.
 */
function sync(api, target, find, slideOf, follow) {
	let other = null;

	// Show the slide that the other carousel selects
	function show(instant) {
		const index = other.selectedSlide();
		follow(index);
		api.goToSlide(index, instant === true);
	}

	function click(event) {
		const index = slideOf(event.target);
		if (other && index > -1) {
			other.goToSlide(index);
		}
	}

	// The other carousel can come later than this one, so find it at the init
	function connect() {
		if (other) {
			return;
		}
		other = target && target.goTo ? target : find(typeof target === 'string' ? place(target, api.rootNode()) : target);
		if (other) {
			other.on('select', show);
			show(true);
		}
	}

	api.on('init', connect);
	api.on('reinit', connect);
	api.containerNode().addEventListener('click', click);

	return () => {
		api.off('init', connect);
		api.off('reinit', connect);
		other?.off('select', show);
		api.containerNode().removeEventListener('click', click);
	};
}

/**
 * Watch the reasons to pause: the root is out of view, the tab is hidden, the mouse is on the root, or the keyboard focus is in the root.
 * Make it only while a feature plays, so that a carousel at rest has no listeners on the document.
 *
 * @param {HTMLElement} root
 * @param {{stopOnMouseEnter: boolean, stopOnFocusIn: boolean}} options
 * @param {() => void} change Called when the paused state changes.
 * @returns {{paused: () => boolean, remove: () => void}}
 */
function pauser(root, options, change) {
	const reasons = new Set(),
		set = (reason, on) => {
			const before = reasons.size;
			reasons[on ? 'add' : 'delete'](reason);
			if (!before !== !reasons.size) {
				change();
			}
		},
		observer = new IntersectionObserver(([entry]) => set('view', !entry.isIntersecting)),
		listeners = [
			[document, 'visibilitychange', () => set('tab', document.hidden)],
			[root, 'pointerenter', (event) => set('mouse', options.stopOnMouseEnter && event.pointerType === 'mouse')],
			[root, 'pointerleave', () => set('mouse', false)],
			// A mouse click also moves the focus to a button. Only the keyboard focus pauses.
			[root, 'focusin', (event) => set('focus', options.stopOnFocusIn && event.target.matches(':focus-visible'))],
			[root, 'focusout', (event) => set('focus', root.contains(event.relatedTarget) && reasons.has('focus'))]
		];

	observer.observe(root);
	listeners.forEach(([node, name, handler]) => node.addEventListener(name, handler));

	return {
		paused: () => reasons.size > 0,
		remove() {
			observer.disconnect();
			listeners.forEach(([node, name, handler]) => node.removeEventListener(name, handler));
		}
	};
}

/**
 * The part that autoplay and auto scroll share: the play and pause button (WCAG 2.2.2), the "playing" class, aria-live, the pause reasons and the events.
 *
 * @param {object} api
 * @param {string} name 'autoplay' or 'autoscroll', for the events.
 * @param {object} options The feature options.
 * @param {object} cls The class names.
 * @param {object} labels
 * @param {(name: string) => void} emit
 * @param {(value: string) => void} live Set aria-live on the container.
 * @param {{play: () => void, stop: () => void, pause: (paused: boolean) => void}} hooks
 * @returns {{play: () => void, stop: () => void, isPlaying: () => boolean, paused: () => boolean, remove: () => void}}
 */
function controller(api, name, options, cls, labels, emit, live, hooks) {
	const root = api.rootNode(),
		button = create('button', cls.button + ' ' + cls.play),
		names = ['init', 'reinit', 'resize'];

	let playing = false,
		watch = null;

	button.type = 'button';
	button.setAttribute('aria-controls', api.containerNode().id);
	button.addEventListener('click', () => playing ? control.stop() : control.play());

	function update() {
		setAttribute(button, 'aria-label', playing ? labels.pause : labels.play);
		setClass(root, cls.playing, playing);
		// A screen reader does not read each automatic change
		live(playing ? 'off' : 'polite');
	}

	function show() {
		if (api.isFit()) {
			button.remove();
		} else if (!button.isConnected) {
			root.append(button);
		}
	}

	// Start at the first init, unless the user prefers less motion
	function begin() {
		api.off('init', begin);
		api.off('reinit', begin);
		if (options.playOnInit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
			control.play();
		}
	}

	const control = {
		play() {
			if (!playing) {
				playing = true;
				watch = pauser(root, options, () => hooks.pause(watch.paused()));
				update();
				hooks.play();
				emit(name + ':play');
			}
		},
		stop() {
			if (playing) {
				playing = false;
				watch.remove();
				update();
				hooks.stop();
				emit(name + ':stop');
			}
		},
		isPlaying: () => playing,
		paused: () => !playing || watch.paused(),
		remove() {
			control.stop();
			names.forEach((item) => api.off(item, show));
			button.remove();
		}
	};

	names.forEach((item) => api.on(item, show));
	api.on('init', begin);
	api.on('reinit', begin);
	update();

	return control;
}

/**
 * Go to the next snap after a delay. The timer starts at "settle", so that a slow motion does not make the delay shorter.
 *
 * @param {object} api
 * @param {boolean|number|object} value The "autoplay" option: true, a delay in ms, or an object.
 * @param {object} cls
 * @param {object} labels
 * @param {(name: string) => void} emit
 * @param {(value: string) => void} live
 * @returns {object} The control: play(), stop(), reset(), isPlaying(), remove().
 */
function autoplay(api, value, cls, labels, emit, live) {
	const options = { delay: 4000, stopOnInteraction: true, stopOnMouseEnter: false, stopOnFocusIn: true, stopOnLastSnap: false, playOnInit: true, instant: false, ...(value > 0 ? { delay: value } : value) };

	let timer = 0,
		own = false;

	// The delay: data-delay on the selected slide, one value for each snap, or one value
	function delay() {
		const value = api.slideNodes()[api.selectedSlide()]?.dataset.delay || options.delay;
		return +(Array.isArray(value) ? value[api.selectedSnap()] : value);
	}

	function reset() {
		clearTimeout(timer);
		if (!control.paused() && !api.isFit()) {
			timer = setTimeout(next, delay());
		}
	}

	function next() {
		own = true;
		if (api.canGoToNext()) {
			api.goToNext(options.instant);
		} else if (options.stopOnLastSnap) {
			control.stop();
		} else {
			api.goTo(0, options.instant);
		}
		own = false;
	}

	// A drag, an arrow, a dot or the keyboard stops the autoplay. With stopOnInteraction: false, the timer starts again at "settle".
	function interact() {
		if (!own) {
			clearTimeout(timer);
			if (options.stopOnInteraction) {
				control.stop();
			}
		}
	}

	const control = controller(api, 'autoplay', options, cls, labels, emit, live, { play: reset, stop: () => clearTimeout(timer), pause: reset }),
		remove = control.remove;

	api.on('settle', reset);
	api.on('select', interact);
	api.on('pointerdown', interact);

	control.reset = reset;
	control.remove = () => {
		remove();
		api.off('settle', reset);
		api.off('select', interact);
		api.off('pointerdown', interact);
	};

	return control;
}

// The instance of each root, viewport and container
const registry = new WeakMap();

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. Thus the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap();

// The clones that the library made
const ours = new WeakSet();

// The attributes that the library added: element => names
const marked = new WeakMap();

// A counter for container ids
let uid = 0;

/**
 * Set an attribute that the page did not set. The library removes it in destroy().
 *
 * @param {Element} node
 * @param {string} name
 * @param {string} value
 */
function own(node, name, value) {
	const list = marked.get(node) || new Set();
	if (list.has(name) || !node.hasAttribute(name)) {
		list.add(name);
		marked.set(node, list);
		if (node.getAttribute(name) !== value) {
			node.setAttribute(name, value);
		}
	}
}

/**
 * Remove the attributes that own() added.
 *
 * @param {Element} node
 */
function disown(node) {
	marked.get(node)?.forEach((name) => node.removeAttribute(name));
	marked.delete(node);
}

// Slides that are a control keep their own role and name
const controls = 'a[href],button,input,select,textarea,[tabindex],[role]';

// The slides that can get the "group" role. An element with its own role, such as an article or a list item, does not permit "group".
const generic = 'div,span,section';

let sharedObserver;

function resizeObserver() {
	return sharedObserver ||= new ResizeObserver((entries) => {
		const list = new Set(entries.map((entry) => owners.get(entry.target)));
		[...list].filter((owner) => owner && owner.read()).forEach((owner) => owner.write());
	});
}

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the boxes that initAll() read
const watchers = new Map(),
	waiters = new WeakMap(),
	boxes = new WeakMap();

/**
 * Call a function when an element comes near the screen.
 *
 * @param {Element} node
 * @param {string} margin The rootMargin of the IntersectionObserver.
 * @param {Function} callback
 * @returns {Function} A function that stops the watch.
 */
function watch(node, margin, callback) {
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

/**
 * Make a carousel.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} [userOptions]
 * @returns {object} The carousel API.
 */
function BetterCarousel(element, userOptions = {}) {
	const found = registry.get(element);

	if (found) {
		return found;
	}

	let options,
		cls,
		root,
		viewport,
		container,
		slides = [],
		nodes = [],
		created = false,
		added = [],
		geo = null,
		location = 0,
		selected = 0,
		previous = 0,
		requested = -1,
		followed = -1,
		written = { axis: '', container: 0, slides: [] },
		observed = [],
		mutationObserver,
		queries = [],
		ready = false,
		started = false,
		changed = false,
		visible = [],
		signature = '',
		motion,
		removeDrag,
		lastDown = 0,
		dragFrom = 0,
		dragging = false,
		lastWindow = 0,
		wheelTime = 0,
		wheelMoved = 0,
		wheelTimer = 0,
		wheelSnap = 0,
		wheelDirection = 0,
		dragSnap = 0,
		clones = [],
		pending = -1,
		parts = [],
		scroll = null,
		scrollTimer = 0,
		scroller = null,
		scrollOptions;

	const api = {
		goTo: (index, instant) => go(physical(index), instant),
		goToNext: (instant) => api.canGoToNext() && go(wrap(selected + 1), instant, -1, 1),
		goToPrev: (instant) => api.canGoToPrev() && go(wrap(selected - 1), instant, -1, -1),
		goToSlide: (index, instant) => go(physical(api.snapOfSlide(index)), instant, index),
		canGoToNext: () => !!geo && !geo.fit && (!!geo.period || selected < geo.snaps.length - 1),
		canGoToPrev: () => !!geo && !geo.fit && (!!geo.period || selected > 0),
		selectedSnap: () => logical(selected),
		previousSnap: () => logical(previous),
		selectedSlide,
		snapOfSlide: (index) => geo ? logical(snapOfSlide(geo.snaps, geo.slides, index, geo.view, geo.align, geo.period)) : index,
		snapList: () => geo ? geo.logical.map((index) => progress(geo.snaps[index].location, geo.min, geo.max, geo.period)) : [],
		scrollProgress: () => geo ? progress(current(), geo.min, geo.max, geo.period) : 0,
		slideNodes: () => slides.slice(),
		slidesInView: () => visible.slice(),
		rootNode: () => root,
		viewportNode: () => viewport,
		containerNode: () => container,
		isFit: () => !geo || geo.fit,
		options: () => options,
		reInit,
		destroy
	};

	const events = emitter(api),
		owner = { read: measure, write: measured },
		hooks = {
			enabled: () => !!geo && !geo.fit && options.draggable,
			axis: () => ({ x: geo.axis === 'x', sign: geo.rtl ? -1 : 1, threshold: options.dragThreshold }),
			down: () => {
				lastDown = performance.now();
			},
			begin: () => {
				interrupt();
				const at = halt();
				dragFrom = at;
				dragSnap = selected;
				dragging = true;
				write(at);
				setClass(root, cls.dragging, true);
				events.emit('pointerdown');
				return at;
			},
			move: (value) => {
				location = geo.period ? value : resist(value, geo.min, geo.max);
				frame(location);
				if (select(nearestSnap(geo.snaps, location, geo.period))) {
					render(true);
					events.emit('select');
				}
			},
			release: (speed) => {
				const target = releaseTarget({ location, from: dragFrom, velocity: speed, current: dragSnap, snaps: geo.snaps, min: geo.min, max: geo.max, period: geo.period, skipSnaps: options.skipSnaps, dragFree: options.dragFree }),
					curve = options.dragFree === true ? GLIDE : EASE;
				setClass(root, cls.dragging, false);
				dragging = false;
				events.emit('pointerup');
				requested = -1;
				move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
			}
		};

	api.on = events.on;
	api.off = events.off;

	// The lazy option: a carousel that is not near the screen waits. A carousel near the screen starts now: a start after the first paint
	// adds the arrows and the dots in view, and this moves the page (CLS).
	let waiting = null;
	const lazy = merge(defaults, BetterCarousel.defaults, userOptions, dataOptions(element)).lazy;

	if (lazy) {
		const margin = lazy === true ? innerHeight : lazy,
			rect = boxes.get(element) || element.getBoundingClientRect();
		if (!rect.height || rect.bottom < -margin || rect.top > innerHeight + margin) {
			registry.set(element, api);
			waiting = watch(element, lazy === true ? '100%' : lazy + 'px', reInit);
		}
	}

	if (!waiting) {
		setup();
	}

	return api;

	/**
	 * Read the options, add the markup and start the observers. The first ResizeObserver callback measures the layout.
	 */
	function setup() {
		const base = merge(defaults, BetterCarousel.defaults, userOptions, dataOptions(element)),
			points = base.breakpoints || {};

		queries = Object.keys(points).map((query) => {
			const list = matchMedia(query);
			list.addEventListener('change', onQuery);
			return list;
		});

		options = merge(base, ...queries.filter((list) => list.matches).map((list) => points[list.media]));

		if (!options.active) {
			return;
		}

		cls = classNames(options.classes, options.state);

		container = options.container ? element.querySelector(options.container) : element;

		if (container.classList.contains(cls.viewport)) {
			container = container.firstElementChild;
		}

		if (!created) {
			viewport = container.parentElement;
			if (!viewport.classList.contains(cls.viewport) && options.wrap) {
				root = create('div');
				viewport = create('div');
				container.before(root);
				root.append(viewport);
				viewport.append(container);
				created = true;
			} else {
				root = viewport.parentElement;
			}
		}

		addClass(root, cls.root);
		addClass(viewport, cls.viewport);
		addClass(container, cls.container);

		// The carousel pattern of the WAI-ARIA Authoring Practices
		own(root, 'role', 'region');
		own(root, 'aria-roledescription', 'carousel');
		if (!root.hasAttribute('aria-labelledby')) {
			own(root, 'aria-label', options.labels.carousel);
		}
		own(container, 'id', container.id || 'carousel-' + ++uid);
		own(container, 'aria-live', 'polite');

		for (const node of [root, viewport, container]) {
			registry.set(node, api);
		}

		slides = readSlides();
		nodes = slides;

		observe();

		motion = animator(container, css, frame, settle);
		removeDrag = drag(viewport, hooks);
		container.addEventListener('focusin', onFocus);
		viewport.addEventListener('scroll', onScroll);
		if (options.loop && options.clones === 'fill') {
			addEventListener('resize', onWindow);
		}

		parts = [nav(api, root, cls, options)];

		const live = (value) => own(container, 'aria-live', value);

		if (options.autoplay) {
			api.autoplay = autoplay(api, options.autoplay, cls, options.labels, events.emit, live);
			parts.push(api.autoplay.remove);
		}

		if (options.autoScroll) {
			const value = options.autoScroll;
			scrollOptions = { speed: 120, direction: 'forward', startDelay: 1000, stopOnInteraction: true, stopOnMouseEnter: false, stopOnFocusIn: true, playOnInit: true, ...(value > 0 ? { speed: value } : value) };
			api.autoScroll = scroller = controller(api, 'autoscroll', scrollOptions, cls, options.labels, events.emit, live, { play: wait, stop: () => wait(-1) ?? halt(), pause: (paused) => scroll ? scroll.animations.forEach((animation) => animation[paused ? 'pause' : 'play']()) : paused ? halt() : kick() });
			parts.push(scroller.remove);
		}

		if (options.autoHeight) {
			addClass(root, cls.autoHeight);
		}

		if (options.sync) {
			parts.push(sync(api, options.sync, (node) => node && registry.get(node), (node) => {
				const index = nodes.findIndex((item) => item.contains(node));
				return index < 0 ? -1 : original(index);
			}, (index) => {
				followed = index;
			}));
		}

		if (options.slideChanges) {
			mutationObserver = new MutationObserver(onMutation);
			mutationObserver.observe(container, { childList: true });
		}
	}

	/**
	 * Remove what setup() added.
	 *
	 * @param {boolean} keep Keep the wrapper markup for a new setup().
	 */
	function teardown(keep) {
		waiting?.();
		waiting = null;
		registry.delete(element);
		unobserve();
		mutationObserver?.disconnect();
		queries.forEach((list) => list.removeEventListener('change', onQuery));
		queries = [];

		if (!cls) {
			return;
		}

		motion.stop();
		removeDrag();
		parts.forEach((remove) => remove());
		parts = [];
		followed = -1;
		delete api.autoplay;
		delete api.autoScroll;
		scroller = null;
		setStyle(viewport, 'height', '');
		setClones(0);
		container.removeEventListener('focusin', onFocus);
		viewport.removeEventListener('wheel', onWheel);
		clearTimeout(wheelTimer);
		wheelTimer = 0;
		viewport.removeEventListener('scroll', onScroll);
		removeEventListener('resize', onWindow);

		for (const node of nodes) {
			setStyle(node, 'translate', '');
			setClass(node, cls.active, false);
			setClass(node, cls.inView, false);
			cleanStyle(node);
		}

		setStyle(container, 'translate', '');
		setStyle(container, 'willChange', '');
		setStyle(viewport, 'touchAction', '');
		cleanStyle(container);
		cleanStyle(viewport);

		for (const name of ['horizontal', 'vertical', 'dynamic', 'autoHeight', 'dragging']) {
			setClass(root, cls[name], false);
		}

		added.forEach(([node, name]) => setClass(node, name, false));
		[root, container, ...slides].forEach(disown);
		added = [];

		for (const node of [root, viewport, container]) {
			registry.delete(node);
			if (node.getAttribute('class') === '') {
				node.removeAttribute('class');
			}
		}

		if (!keep && created) {
			root.before(container);
			root.remove();
			created = false;
		}

		cls = geo = null;
		ready = dragging = false;
		location = 0;
		visible = [];
		signature = '';
		written = { axis: '', container: 0, slides: [] };
	}

	/**
	 * Add a class and remember it for teardown(), if the element did not have it.
	 */
	function addClass(node, name) {
		if (name && !node.classList.contains(name)) {
			node.classList.add(name);
			added.push([node, name]);
		}
	}

	function readSlides() {
		return [...(options.slides ? container.querySelectorAll(options.slides) : container.children)].filter((node) => !ours.has(node) && !node.hasAttribute('data-carousel-clone'));
	}

	/**
	 * Make the clones: full copies of the slides, after the last slide.
	 *
	 * @param {number} count The number of copies.
	 */
	function setClones(count) {
		if (clones.length === count * slides.length) {
			return;
		}

		clones.forEach((node) => node.remove());
		clones = [];

		for (let copy = 0; copy < count; copy++) {
			for (const node of slides) {
				const clone = node.cloneNode(true);
				for (const item of [clone, ...clone.querySelectorAll('[id]')]) {
					item.removeAttribute('id');
				}
				clone.setAttribute('aria-hidden', 'true');
				clone.inert = true;
				clone.style.translate = '';
				setClass(clone, cls.clone, true);
				cleanStyle(clone);
				ours.add(clone);
				clones.push(clone);
			}
		}

		container.append(...clones);
		nodes = slides.concat(clones);
		written.slides.length = slides.length;
		mutationObserver?.takeRecords();
	}

	// The original slide index of a node
	function original(index) {
		return index % slides.length;
	}

	// The logical snap of a physical snap. They are different only when the carousel has clones.
	function logical(index) {
		return geo ? geo.map[index] ?? 0 : index;
	}

	// The next or the previous physical snap. In loop mode, the first snap follows the last snap.
	function wrap(index) {
		return geo.period ? (index + geo.snaps.length) % geo.snaps.length : index;
	}

	// The location now, also during a motion
	function current() {
		return scroll ? scrollAt() : motion.current() ?? location;
	}

	/**
	 * Find the physical snap of a logical snap that is nearest to the current location.
	 *
	 * @param {number} index The logical snap.
	 * @returns {number}
	 */
	function physical(index) {
		if (!geo) {
			return index;
		}

		let best = -1,
			gap = Infinity;

		geo.snaps.forEach((snap, item) => {
			const value = Math.abs(distance(snap.location, current(), geo.period));
			if (geo.map[item] === index && value < gap) {
				gap = value;
				best = item;
			}
		});

		return best < 0 ? Math.min(Math.max(index, 0), geo.snaps.length - 1) : best;
	}

	/**
	 * Get the original slides that show at a location.
	 *
	 * @param {number} at
	 * @param {number} threshold
	 * @returns {number[]}
	 */
	function seen(at, threshold) {
		return [...new Set(inView(geo.slides, at, geo.view, threshold, geo.period).map(original))].sort((a, b) => a - b);
	}

	function observe() {
		unobserve();
		observed = [viewport, container, ...nodes];
		for (const node of observed) {
			owners.set(node, owner);
			resizeObserver().observe(node);
		}
	}

	function unobserve() {
		for (const node of observed) {
			owners.delete(node);
			sharedObserver.unobserve(node);
		}
		observed = [];
	}

	/**
	 * Write the result of a measure pass and emit the events.
	 */
	function measured() {
		if (pending >= 0) {
			setClones(pending);
			pending = -1;
			signature = '';
			observe();
			return;
		}

		// The auto scroll starts again from its location with the new layout
		if (scroller?.isPlaying()) {
			halt();
		}

		// A motion goes on to the new location of its snap, for example when the selected slide changes its width. A drag keeps its location.
		const at = motion.current();
		if (at !== null && written.axis === geo.axis && !geo.fit && motion.retarget(location)) {
			place(at, location);
			render(true);
		} else {
			motion.stop();
			render(dragging);
		}
		label();

		// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page. Add it only where the wheel moves the carousel.
		const wheel = options.wheel && !geo.fit && (geo.axis === 'y' || options.wheel === 'both');
		viewport[wheel ? 'addEventListener' : 'removeEventListener']('wheel', onWheel, { passive: false });

		if (!options.resize) {
			unobserve();
		}

		if (!ready) {
			ready = true;
			events.emit(started ? 'reinit' : 'init');
			started = true;
		} else {
			events.emit('resize');
		}

		if (changed) {
			changed = false;
			events.emit('slideschanged');
		}

		if (scroller?.isPlaying()) {
			kick();
		}
	}

	/**
	 * Give each slide the slide role and a name such as "2 of 8". A slide with its own role, such as an article, keeps it.
	 */
	function label() {
		slides.forEach((node, index) => {
			if (!node.matches(controls) || marked.get(node)?.has('role')) {
				if (node.matches(generic)) {
					own(node, 'role', 'group');
				}
				own(node, 'aria-roledescription', 'slide');
				own(node, 'aria-label', options.labels.slide.replace('%d', index + 1).replace('%n', slides.length));
			}
		});
	}

	function onMutation() {
		slides = readSlides();
		setClones(0);
		nodes = slides;
		changed = true;
		observe();
	}

	/**
	 * Get the part of the main axis where the loop must show slides, relative to the viewport start.
	 * It is the viewport. With clones: 'fill', it is the window, so that the slides fill it when the viewport overflow shows.
	 *
	 * @param {{axis: string, rtl: boolean}} layout
	 * @param {number} view The viewport size.
	 * @returns {{start: number, size: number}}
	 */
	function visibleArea(layout, view) {
		if (!options.loop || options.clones !== 'fill') {
			return { start: 0, size: view };
		}

		const box = viewport.getBoundingClientRect(),
			x = layout.axis === 'x',
			size = windowSize(layout.axis),
			before = Math.max(0, Math.round(x ? (layout.rtl ? size - box.right : box.left) : box.top));

		lastWindow = size;

		return { start: -before, size: before + Math.max(view, Math.round(size - before)) };
	}

	function windowSize(axis) {
		return axis === 'x' ? document.documentElement.clientWidth : innerHeight;
	}

	// A change of the window size can change the visible area, and the viewport size can stay the same.
	// Mobile browsers send a resize when the address bar shows or hides. Measure only if the size on the main axis changes.
	function onWindow() {
		if (geo && windowSize(geo.axis) !== lastWindow && measure()) {
			measured();
		}
	}

	function onQuery() {
		reInit();
	}

	/**
	 * Read the layout and compute the geometry. This function does not write to the DOM.
	 *
	 * @returns {boolean} false if nothing changed.
	 */
	function measure() {
		const layout = readLayout(container, options),
			rects = readRects(viewport, nodes, layout, shown()),
			area = visibleArea(layout, rects.view),
			text = JSON.stringify([layout.axis, layout.rtl, typeof layout.align === 'string' && layout.align, rects, area]);

		if (text === signature && ready) {
			return false;
		}

		signature = text;

		const keep = ready ? selectedSlide() : requested,
			count = slides.length,
			own = bounds(rects.slides.slice(0, count)),
			fit = fits(rects.slides.slice(0, count), rects.view) && !(options.autoScroll && options.loop),
			from = location;

		let copies = 0,
			length = 0;

		if (options.loop && !fit && count) {
			const size = period(own.start, own.end, rects.gap),
				all = bounds(rects.slides);
			copies = /^(auto|fill)$/.test(options.clones) && !canLoop(size, area.size, own.max) ? cloneCount(size, area.size, own.max) : 0;
			length = period(all.start, all.end, rects.gap);
		}

		if (copies * count !== clones.length) {
			pending = copies;
			return true;
		}

		geo = { ...layout, ...rects, area, fit, period: length, min: 0, max: 0 };

		if (fit) {
			geo.snaps = [{ location: 0, slide: activeSlide(rects.slides, 0, rects.view, layout.align) }];
		} else {
			Object.assign(geo, snaps({ ...rects, align: layout.align, slidesToScroll: options.slidesToScroll, containScroll: options.containScroll, period: length }));
		}

		// With clones, a logical snap is a snap whose active slide is an original slide
		const list = geo.snaps.map((snap, index) => index).filter((index) => !clones.length || geo.snaps[index].slide < count);

		geo.logical = list;
		geo.map = geo.snaps.map((snap, index) => clones.length ? Math.max(0, list.findIndex((item) => original(geo.snaps[item].slide) === original(snap.slide))) : index);

		const total = geo.snaps.length;

		selected = keep >= 0 ? physical(api.snapOfSlide(keep)) : Math.min(total - 1, ready ? selected : physical(options.startSnap));
		previous = Math.min(previous, total - 1);
		requested = keep;
		if (!dragging) {
			location = targetLocation(geo.snaps[selected].location, from, length);
		}

		return true;
	}

	/**
	 * Write the location, the classes and the touch action.
	 *
	 * @param {boolean} [keep] Do not write the location, because a motion or a drag writes it.
	 */
	function render(keep) {
		const x = geo.axis === 'x';

		setClass(root, cls.horizontal, x);
		setClass(root, cls.vertical, !x);
		setClass(root, cls.dynamic, !geo.fit);
		setStyle(viewport, 'touchAction', geo.fit ? '' : x ? 'pan-y pinch-zoom' : 'pan-x pinch-zoom');
		setStyle(container, 'willChange', geo.fit ? '' : 'translate');

		if (!keep) {
			write(geo.fit ? 0 : location);
		}

		// Auto height: the height of the tallest slide in view at the target location
		if (options.autoHeight) {
			setStyle(viewport, 'height', x ? Math.max(...inView(geo.slides, location, geo.view, 0, geo.period).map((index) => geo.slides[index].cross)) + 'px' : '');
		}

		const active = selectedSlide(),
			list = seen(location, options.inViewThreshold);

		nodes.forEach((node, index) => setClass(node, cls.active, original(index) === active));

		if (list.join() !== visible.join()) {
			visible = list;
			nodes.forEach((node, index) => setClass(node, cls.inView, list.includes(original(index))));
			events.emit('slidesinview');
		}
	}

	/**
	 * Get the screen value of a location: rounded to device pixels, with the sign of the direction.
	 *
	 * @param {number} value
	 * @returns {number}
	 */
	function screen(value) {
		const scale = devicePixelRatio || 1;
		return Math.round(value * scale) / scale * (geo.rtl ? -1 : 1);
	}

	/**
	 * Write the location as the translate of the container.
	 *
	 * @param {number} value
	 */
	function write(value) {
		if (written.axis !== geo.axis) {
			nodes.forEach((node) => setStyle(node, 'translate', ''));
			written = { axis: geo.axis, container: 0, slides: [] };
		}

		written.container = screen(value);
		setStyle(container, 'translate', translate(geo.axis, written.container));
		place(value, value);
	}

	/**
	 * Write the loop shift of each slide for a motion from one location to another.
	 *
	 * @param {number} from
	 * @param {number} to
	 */
	function place(from, to) {
		const list = geo.period ? placement(geo.slides, from, to, geo.area.size, geo.period, geo.area.start) : [];

		nodes.forEach((node, index) => {
			const value = list.length ? screen(list[index] * geo.period) : 0;
			if ((written.slides[index] || 0) !== value) {
				written.slides[index] = value;
				setStyle(node, 'translate', translate(geo.axis, value));
			}
		});
	}

	/**
	 * Write a location during a motion or a drag.
	 *
	 * @param {number} value
	 */
	function frame(value) {
		write(value);
		events.emit('scroll');
	}

	/**
	 * End a motion.
	 */
	function settle() {
		if (geo.period) {
			location = normalize(location, geo.period);
		}
		render();
		events.emit('settle');
		if (scroller?.isPlaying() && !scroll) {
			wait();
		}
	}

	/**
	 * Change the selected snap.
	 *
	 * @param {number} index
	 * @returns {boolean} true if the snap changed.
	 */
	function select(index) {
		if (index === selected) {
			return false;
		}
		previous = selected;
		selected = index;
		return true;
	}

	/**
	 * Go to a snap.
	 *
	 * @param {number} index The snap index.
	 * @param {boolean} [instant]
	 * @param {number} [slide] The slide index, for goToSlide().
	 */
	function go(index, instant, slide = -1, direction = 0) {
		if (waiting) {
			reInit();
		}
		interrupt();
		if (!geo) {
			options.startSnap = index;
			requested = slide;
			return;
		}

		index = Math.min(geo.snaps.length - 1, Math.max(0, index));
		requested = slide;

		const target = targetLocation(geo.snaps[index].location, current(), geo.period, direction),
			step = Math.abs(index - selected),
			count = geo.period ? Math.min(step, geo.snaps.length - step) : step;

		move(index, target, instant ? 0 : goToDuration(options.duration, count), EASE);
	}

	/**
	 * Select a snap and move to a location.
	 *
	 * @param {number} index The snap index.
	 * @param {number} target The location.
	 * @param {number} duration ms. With 0, the carousel jumps.
	 * @param {number[]} curve
	 */
	function move(index, target, duration, curve) {
		const from = halt(),
			picked = select(index),
			jump = !duration || geo.fit || Math.abs(target - from) < 0.5;

		location = target;

		if (jump) {
			render();
		} else {
			const raf = events.has('scroll') || !!geo.period && !pathFits(geo.slides, from, target, geo.area.size, geo.period);
			render(true);
			if (!raf) {
				place(from, target);
			}
			motion.run(from, target, duration, curve, raf);
		}

		if (picked) {
			events.emit('select');
		}

		// settle() also starts the auto scroll again after a jump
		if (jump) {
			settle();
		}
	}

	// The CSS translate value of a location
	function css(value) {
		return translate(geo.axis, screen(value)) || '0px';
	}

	// The time in the auto scroll iteration, from 0 to 1
	function phase() {
		return (scroll.animations[0].currentTime || 0) % scroll.duration / scroll.duration;
	}

	// The location of the auto scroll now
	function scrollAt() {
		return scroll.from - scroll.direction * scroll.length * phase();
	}

	/**
	 * Get the translate values that show now: the written values, or the values of a motion or of the auto scroll.
	 *
	 * @returns {{axis: string, container: number, slides: number[]}}
	 */
	function shown() {
		const sign = geo?.rtl ? -1 : 1,
			moving = motion.current();

		if (scroll) {
			const time = phase();
			return { axis: written.axis, container: sign * scrollAt(), slides: scroll.list.map(({ k, offset }) => sign * (time >= offset ? k + scroll.direction : k) * scroll.length) };
		}

		return moving === null ? written : { ...written, container: sign * moving };
	}

	/**
	 * Stop the auto scroll and the motion where they are, and write that location.
	 *
	 * @returns {number} The location.
	 */
	function halt() {
		if (scroll) {
			location = scrollAt();
			scroll.animations.forEach((animation) => animation.cancel());
			scroll = null;
			write(location);
			if (select(nearestSnap(geo.snaps, location, geo.period))) {
				render(true);
				events.emit('select');
			}
		}
		return location = motion.stop() ?? location;
	}

	// A drag or a goTo() from the user stops the auto scroll, or makes it wait until the next "settle"
	function interrupt() {
		if (scroller?.isPlaying()) {
			wait(-1);
			if (scrollOptions.stopOnInteraction) {
				scroller.stop();
			}
		}
	}

	/**
	 * Start the auto scroll after its delay.
	 *
	 * @param {number} [cancel] With -1, only stop the timer.
	 */
	function wait(cancel) {
		clearTimeout(scrollTimer);
		scrollTimer = cancel ? 0 : setTimeout(run, scrollOptions.startDelay);
	}

	// Start the auto scroll now, if no delay runs
	function kick() {
		if (!scrollTimer) {
			run();
		}
	}

	/**
	 * Start the auto scroll. With loop, it runs on the compositor: the container moves by one period in each iteration,
	 * and each slide moves by one period at the time when it leaves the visible area. Without loop, it goes to the end.
	 */
	function run() {
		scrollTimer = 0;
		if (!geo || geo.fit || scroll || dragging || scroller.paused()) {
			return;
		}

		const direction = scrollOptions.direction === 'backward' ? -1 : 1,
			from = halt(),
			length = geo.period,
			speed = scrollOptions.speed / 1000;

		if (!length) {
			const to = direction > 0 ? geo.min : geo.max;
			if (Math.abs(to - from) > 1) {
				location = to;
				motion.run(from, to, Math.abs(to - from) / speed, [0, 0, 1, 1], events.has('scroll'));
			}
			return;
		}

		const list = steps(geo.slides, from, geo.area.size, length, direction, geo.area.start),
			timing = { duration: length / speed, iterations: Infinity },
			start = document.timeline.currentTime;

		write(from);
		scroll = {
			from,
			direction,
			length,
			list,
			duration: timing.duration,
			animations: [
				container.animate([{ translate: css(from) }, { translate: css(from - direction * length) }], timing),
				...nodes.map((node, index) => {
					const { k, offset } = list[index],
						before = css(k * length),
						after = css((k + direction) * length);
					return node.animate([{ translate: before }, { translate: before, offset }, { translate: after, offset }, { translate: after }], timing);
				})
			]
		};
		scroll.animations.forEach((animation) => animation.startTime = start);
	}

	/**
	 * Go to a slide that gets the keyboard focus, if it does not show fully.
	 *
	 * @param {FocusEvent} event
	 */
	function onFocus(event) {
		const index = slides.findIndex((node) => node.contains(event.target));
		if (!geo || index < 0 || performance.now() - lastDown < 600) {
			return;
		}
		if (options.focus && !seen(location, 1).includes(index)) {
			api.goToSlide(index);
		}
		events.emit('slidefocus');
	}

	/**
	 * Move the carousel with the wheel: in a vertical carousel, and with wheel: 'both' also in a horizontal carousel. The carousel follows the wheel distance
	 * with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last location, the page scrolls.
	 *
	 * @param {WheelEvent} event
	 */
	function onWheel(event) {
		const side = geo.axis === 'x' && Math.abs(event.deltaX) > Math.abs(event.deltaY),
			delta = side ? event.deltaX * (geo.rtl ? -1 : 1) : event.deltaY;

		if (event.ctrlKey || !delta || dragging) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - wheelTime < 200,
			base = scroll ? scrollAt() : location,
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = Math.min(geo.max, Math.max(geo.min, target));
		}

		wheelTime = now;

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (Math.abs(target - base) < 0.5) {
			if (gesture && now - wheelMoved < 1000) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		interrupt();

		if (!wheelTimer) {
			wheelSnap = selected;
		}
		wheelMoved = now;
		wheelDirection = path > 0 ? 1 : -1;
		requested = -1;
		move(nearestSnap(geo.snaps, target, geo.period), target, WHEEL, EASE);

		// With dragFree: true, the carousel stays where the wheel stops
		clearTimeout(wheelTimer);
		if (options.dragFree !== true) {
			wheelTimer = setTimeout(wheelEnd, 150);
		}
	}

	/**
	 * Go to a snap when the wheel stops. A short wheel motion goes to the next snap in its direction, so that one wheel step always changes the slide.
	 */
	function wheelEnd() {
		wheelTimer = 0;
		const at = current(),
			index = nearestSnap(geo.snaps, at, geo.period),
			away = Math.abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		if (index === wheelSnap && away) {
			go(wrap(index + wheelDirection), false, -1, wheelDirection);
		} else {
			go(index);
		}
	}

	/**
	 * The browser scrolls the viewport to a focused element, although its overflow is hidden. Scroll it back.
	 */
	function onScroll() {
		viewport.scrollLeft = viewport.scrollTop = 0;
	}

	function selectedSlide() {
		// A carousel with the sync option selects the slide of the other carousel, also after a drag
		if (followed > -1) {
			return followed;
		}
		if (!geo) {
			return Math.max(requested, 0);
		}
		return requested >= 0 && api.snapOfSlide(requested) === logical(selected) ? requested : original(geo.snaps[selected].slide);
	}

	/**
	 * Merge new options and set up the carousel again. The selected slide stays.
	 *
	 * @param {object} [newOptions]
	 */
	function reInit(newOptions) {
		if (newOptions) {
			userOptions = merge(userOptions, newOptions);
		}
		const keep = geo ? selectedSlide() : requested;
		teardown(true);
		setup();
		requested = keep;
	}

	/**
	 * Remove the carousel and restore the DOM.
	 */
	function destroy() {
		teardown(false);
		events.emit('destroy');
	}
}

// The site defaults. They merge over the library defaults.
BetterCarousel.defaults = {};

/**
 * Get the instance of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
BetterCarousel.get = (element) => registry.get(element);

/**
 * Make a carousel for each element that matches a selector and has no carousel.
 *
 * @param {string} selector
 * @param {object} [options]
 * @returns {object[]}
 */
BetterCarousel.initAll = (selector, options) => {
	const elements = [...document.querySelectorAll(selector)];
	// Read all boxes for the lazy option before the first setup() writes. Thus the reads cause one layout, not one for each carousel.
	if (merge(defaults, BetterCarousel.defaults, options).lazy) {
		elements.forEach((element) => boxes.set(element, element.getBoundingClientRect()));
	}
	return elements.map((element) => {
		const carousel = BetterCarousel(element, options);
		boxes.delete(element);
		return carousel;
	});
};

export { BetterCarousel as default };
