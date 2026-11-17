// Swiper with the modules for the typical set: navigation, pagination, autoplay and a11y
import Swiper from 'swiper';
import { A11y, Autoplay, Navigation, Pagination } from 'swiper/modules';
import { slides } from '../harness.js';

export function markup(root) {
	root.innerHTML = '<div class="swiper"><div class="swiper-wrapper">' + slides('div', 'swiper-slide') + '</div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div><div class="swiper-pagination"></div></div>';
}

export function mount(root, config) {
	const element = root.firstElementChild,
		swiper = new Swiper(element, {
			modules: [Navigation, Pagination, Autoplay, A11y],
			slidesPerView: config.per,
			spaceBetween: config.gap,
			loop: true,
			speed: config.speed,
			autoplay: config.autoplay ? { delay: config.autoplay, disableOnInteraction: true } : false,
			navigation: { prevEl: element.querySelector('.swiper-button-prev'), nextEl: element.querySelector('.swiper-button-next') },
			pagination: { el: element.querySelector('.swiper-pagination'), clickable: true }
		});
	return {
		next: () => swiper.slideNext(),
		prev: () => swiper.slidePrev(),
		index: () => swiper.realIndex
	};
}
