// Better Carousel, built from the source of this repository with the same bundler as the other libraries
import BetterCarousel from '../../src/index.js';
import { slides } from '../harness.js';

export function markup(root) {
	root.innerHTML = '<div class="items">' + slides('div', 'item') + '</div>';
}

export function mount(root, config) {
	const carousel = BetterCarousel(root.firstElementChild, {
		loop: true,
		duration: config.speed,
		// All dots with the same size, as the dots of the other libraries. The default 'zoom' style animates a window of 5 dots.
		dotsStyle: 'all',
		autoplay: config.autoplay ? { delay: config.autoplay, stopOnInteraction: true } : false
	});
	return {
		next: () => carousel.goToNext(),
		prev: () => carousel.goToPrev(),
		index: () => carousel.selectedSlide()
	};
}
