// Embla with the markup, the arrows and the dots of its vanilla examples, the ClassNames plugin for the state classes, and the autoplay plugin
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import ClassNames from 'embla-carousel-class-names';
import { slides } from '../harness.js';
import { addDotBtnsAndClickHandlers, addPrevNextBtnsClickHandlers } from './embla-controls.js';

// The left-to-right arrow icons of the Embla example markup
const prev = 'M355.66 11.354c13.793-13.805 36.208-13.805 50.001 0 13.785 13.804 13.785 36.238 0 50.034L201.22 266l204.442 204.61c13.785 13.805 13.785 36.239 0 50.044-13.793 13.796-36.208 13.796-50.002 0a5994246.277 5994246.277 0 0 0-229.332-229.454 35.065 35.065 0 0 1-10.326-25.126c0-9.2 3.393-18.26 10.326-25.2C172.192 194.973 332.731 34.31 355.66 11.354Z',
	next = 'M176.34 520.646c-13.793 13.805-36.208 13.805-50.001 0-13.785-13.804-13.785-36.238 0-50.034L330.78 266 126.34 61.391c-13.785-13.805-13.785-36.239 0-50.044 13.793-13.796 36.208-13.796 50.002 0 22.928 22.947 206.395 206.507 229.332 229.454a35.065 35.065 0 0 1 10.326 25.126c0 9.2-3.393 18.26-10.326 25.2-45.865 45.901-206.404 206.564-229.332 229.52Z',
	button = (name, path) => '<button class="embla__button embla__button--' + name + '" type="button"><svg class="embla__button__svg" viewBox="0 0 532 532"><path fill="currentColor" d="' + path + '"></path></svg></button>';

export function markup(root) {
	root.innerHTML = '<section class="embla"><div class="embla__viewport"><div class="embla__container">' + slides('div', 'embla__slide') + '</div></div>' +
		'<div class="embla__controls"><div class="embla__buttons">' + button('prev', prev) + button('next', next) + '</div><div class="embla__dots"></div></div></section>';
}

export function mount(root, config) {
	const element = root.firstElementChild,
		plugins = [ClassNames(), ...(config.autoplay ? [Autoplay({ delay: config.autoplay, stopOnInteraction: true })] : [])],
		embla = EmblaCarousel(element.querySelector('.embla__viewport'), { loop: true, duration: 25 }, plugins);
	addPrevNextBtnsClickHandlers(embla, element.querySelector('.embla__button--prev'), element.querySelector('.embla__button--next'));
	addDotBtnsAndClickHandlers(embla, element.querySelector('.embla__dots'));
	return {
		next: () => embla.scrollNext(),
		prev: () => embla.scrollPrev(),
		index: () => embla.selectedScrollSnap()
	};
}
