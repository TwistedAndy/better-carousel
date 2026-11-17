// Glide with the components for the typical set: swipe, controls, autoplay, and the anchor and image guards for the drag
import Glide, { Anchors, Autoplay, Controls, Images, Swipe } from '@glidejs/glide/dist/glide.modular.esm.js';
import { config, slides } from '../harness.js';

export function markup(root) {
	let bullets = '';
	for (let index = 0; index < config.slides; index++) {
		bullets += '<button class="glide__bullet" data-glide-dir="=' + index + '" aria-label="Go to slide ' + (index + 1) + '"></button>';
	}
	root.innerHTML = '<div class="glide"><div class="glide__track" data-glide-el="track"><ul class="glide__slides">' + slides('li', 'glide__slide') + '</ul></div>' +
		'<div class="glide__arrows" data-glide-el="controls"><button class="glide__arrow glide__arrow--left" data-glide-dir="<" aria-label="Previous slide">&lsaquo;</button><button class="glide__arrow glide__arrow--right" data-glide-dir=">" aria-label="Next slide">&rsaquo;</button></div>' +
		'<div class="glide__bullets" data-glide-el="controls[nav]">' + bullets + '</div></div>';
}

export function mount(root, config) {
	const glide = new Glide(root.firstElementChild, {
		type: 'carousel',
		perView: config.per,
		gap: config.gap,
		animationDuration: config.speed,
		autoplay: config.autoplay || false
	}).mount({ Swipe, Controls, Autoplay, Anchors, Images });
	return {
		next: () => glide.go('>'),
		prev: () => glide.go('<'),
		index: () => glide.index
	};
}
