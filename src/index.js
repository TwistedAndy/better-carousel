/*
 * Entry point: the BetterCarousel function and its static members defaults, get() and initAll().
 */

import BetterCarousel, { find } from './scripts/carousel.js';
import { readBoxes } from './scripts/layout.js';
import { resolve } from './scripts/options.js';

// The site defaults. They merge over the library defaults. carousel.js reads them each time that it makes a carousel.
BetterCarousel.defaults = {};

/**
 * Get the instance of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
BetterCarousel.get = find;

/**
 * Make a carousel for each element that matches a selector and has no carousel.
 *
 * @param {string} selector
 * @param {object} [options]
 * @returns {object[]}
 */
BetterCarousel.initAll = (selector, options) => {
	const elements = [...document.querySelectorAll(selector)];
	// Read the boxes of the lazy carousels before the first setup() writes. Then the reads cause one layout, not one for each carousel.
	readBoxes(elements.filter((element) => !find(element) && resolve(element, BetterCarousel.defaults, options).lazy));
	return elements.map((element) => BetterCarousel(element, options));
};

export default BetterCarousel;
