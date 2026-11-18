/*
 * Entry point: the BetterCarousel function, its features, and its static members defaults, get() and initAll().
 */

import { autoplay, autoScroll } from './scripts/autoplay.js';
import carousel, { find } from './scripts/carousel.js';
import { drag, focus, keys, wheel } from './scripts/input.js';
import { nav, sync } from './scripts/navigation.js';

// The features. Their event handlers run in this order.
const features = [drag, wheel, keys, focus, nav, autoplay, autoScroll, sync];

/**
 * Make a carousel, or get the carousel of an element that has one.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} [options]
 * @returns {object} The carousel API.
 */
export default function BetterCarousel(element, options = {}) {
	return carousel(element, options, BetterCarousel.defaults, features);
}

// The site defaults. They merge over the library defaults.
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
BetterCarousel.initAll = (selector, options) => [...document.querySelectorAll(selector)].map((element) => BetterCarousel(element, options));
