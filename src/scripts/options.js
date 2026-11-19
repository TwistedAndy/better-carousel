/*
 * Options: the defaults, the class names, the merge of the option sources, and the breakpoints.
 */

export const defaults = {
	axis: 'auto',
	align: 'auto',
	dir: 'auto',
	loop: false,
	dragFree: false,
	dragFriction: 1,
	containScroll: 'trimSnaps',
	slidesPerSnap: 1,
	skipSnaps: true,
	dragThreshold: 10,
	duration: 500,
	startSnap: 0,
	lazy: false,
	drag: true,
	wheel: true,
	keys: true,
	resize: true,
	slideChanges: true,
	focus: true,
	inViewThreshold: 0,
	active: true,
	breakpoints: {},
	container: null,
	slides: null,
	wrapper: true,
	arrows: true,
	dots: true,
	dotsStyle: 'glide',
	labels: { carousel: 'Carousel', slide: '%d of %n', prev: 'Previous slide', next: 'Next slide', dot: 'Go to slide %d', play: 'Start the slide show', pause: 'Stop the slide show' },
	classes: null,
	state: '',
	sync: null,
	clones: 'auto',
	autoplay: false,
	autoScroll: false,
	autoHeight: false,
	progress: false,
	offset: false
};

// The class names of a prefix. The root class is the prefix, such as "better" or "embla".
const names = (prefix) => ({
	root: prefix,
	viewport: prefix + '_viewport',
	container: prefix + '_container',
	fit: prefix + '_fit',
	horizontal: prefix + '_horizontal',
	vertical: prefix + '_vertical',
	autoHeight: prefix + '_auto_height',
	button: prefix + '_button',
	prevButton: prefix + '_prev',
	nextButton: prefix + '_next',
	dots: prefix + '_dots',
	dotsTrack: prefix + '_dots_track',
	dotsMarker: prefix + '_dots_marker',
	dotsGlide: prefix + '_dots_glide',
	dotsAll: prefix + '_dots_all',
	dot: prefix + '_dot',
	playButton: prefix + '_play',
	clone: 'clone',
	selected: 'selected',
	inView: '',
	dragging: 'dragging',
	playing: 'playing',
	first: 'first',
	prev: 'prev',
	current: 'current',
	next: 'next',
	last: 'last'
});

// The state classes get the "state" prefix
const states = ['selected', 'inView', 'dragging', 'playing', 'first', 'prev', 'current', 'next', 'last'];

/**
 * Get the class names from the "classes" and "state" options.
 *
 * @param {string|object|null} classes A prefix, such as 'embla', or an object with the names to change. The default prefix is 'better'.
 * The object can have a "prefix" key for the names that it does not change: { prefix: 'embla', selected: 'snapped' }.
 * @param {string} state The prefix of the state classes.
 * @returns {object}
 */
export function classNames(classes, state) {
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
export function merge(...sources) {
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
 * Get the options of an element: the library defaults, then the sources, then the JSON options of the data-carousel attribute.
 *
 * @param {HTMLElement} element
 * @param {...object} sources The site defaults and the options of the call.
 * @returns {object}
 */
export function resolve(element, ...sources) {
	let data = {};
	try {
		data = JSON.parse(element.dataset.carousel || '{}');
	} catch {
		// The library ignores an attribute that is not valid JSON
	}
	return merge(defaults, ...sources, data);
}

/**
 * Merge the options of the breakpoints whose media query matches, and watch the media queries.
 *
 * @param {object} base The options, with the "breakpoints" option.
 * @param {() => void} change Called when a media query starts or stops to match.
 * @returns {{options: object, remove: () => void}} The options, and a function that stops the watch.
 */
export function breakpoints(base, change) {
	// Keep the key of each query: the browser can write MediaQueryList.media in a different form.
	const list = Object.entries(base.breakpoints || {}).map(([query, value]) => [matchMedia(query), value]);

	list.forEach(([query]) => query.addEventListener('change', change));

	return {
		options: merge(base, ...list.filter(([query]) => query.matches).map(([, value]) => value)),
		remove: () => list.forEach(([query]) => query.removeEventListener('change', change))
	};
}
