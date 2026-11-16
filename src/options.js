// Default options, class presets and the option merge

export const defaults = {
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
 * Read the JSON options of the data-carousel attribute.
 *
 * @param {HTMLElement} element
 * @returns {object}
 */
export function dataOptions(element) {
	try {
		return JSON.parse(element.dataset.carousel || '{}');
	} catch (error) {
		return {};
	}
}
