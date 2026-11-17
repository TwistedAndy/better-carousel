/* global BetterCarousel */
(() => {
	'use strict';

	// The examples with function options, which data-carousel cannot hold. The key is the data-demo value.
	const demos = {
		autoplay(element) {
			const bar = element.closest('.demo').querySelector('.demo_bar');
			return { autoplay: { delay: 2000, timer: (delay) => {
				const animation = bar.animate([{ scale: '0 1' }, { scale: '1 1' }], delay);
				return () => animation.cancel();
			} } };
		},
		callbacks(element) {
			const counter = element.closest('.demo').querySelector('.demo_counter');
			return {
				progress: ({ progress, snap }) => {
					counter.textContent = 'Snap ' + (snap + 1).toFixed(1) + ', ' + Math.round(progress * 100) + '%';
				},
				offset: ({ slide, visible }) => {
					slide.style.opacity = 0.3 + 0.7 * visible;
				}
			};
		}
	};

	// The examples that use the API after the start. The key is the data-demo value.
	const starts = {
		// Load the images of the slides in view, and of one slide on each side
		images(carousel) {
			const load = () => {
				const slides = carousel.slideNodes(),
					list = carousel.slidesInView();
				[list[0] - 1, ...list, list[list.length - 1] + 1].forEach((index) => {
					const image = slides[index]?.querySelector('img[data-src]');
					if (image) {
						image.src = image.dataset.src;
						image.removeAttribute('data-src');
					}
				});
			};
			carousel.on('init', load);
			carousel.on('slidesinview', load);
		},
		// The buttons and the counter outside the carousel
		custom(carousel, element) {
			const box = element.closest('.demo'),
				prev = box.querySelector('[data-prev]'),
				next = box.querySelector('[data-next]'),
				counter = box.querySelector('.demo_counter'),
				update = () => {
					prev.disabled = !carousel.canGoToPrev();
					next.disabled = !carousel.canGoToNext();
					counter.textContent = (carousel.selectedSnap() + 1) + ' / ' + carousel.snapList().length;
				};
			prev.addEventListener('click', () => carousel.goToPrev());
			next.addEventListener('click', () => carousel.goToNext());
			['init', 'reinit', 'resize', 'select'].forEach((name) => carousel.on(name, update));
		},
		// Add a new slide with the next number, or remove the last slide. A copy of a slide would also copy the attributes that the library added.
		changes(carousel, element) {
			const box = element.closest('.demo'),
				images = [...element.querySelectorAll('img')].map((image) => image.getAttribute('src'));
			box.querySelector('[data-add]').addEventListener('click', () => {
				const count = carousel.slideNodes().length,
					slide = document.createElement('div');
				slide.className = 'item';
				slide.innerHTML = '<img src="' + images[count % images.length] + '" alt="" width="400" height="400"><span class="number">' + (count + 1) + '</span>';
				element.append(slide);
			});
			box.querySelector('[data-remove]').addEventListener('click', () => {
				const slides = carousel.slideNodes();
				if (slides.length > 1) {
					slides.pop().remove();
				}
			});
		}
	};

	const carousels = window.carousels = [
		...BetterCarousel.initAll('.items.carousel:not([data-demo])'),
		...[...document.querySelectorAll('.items.carousel[data-demo]')].map((element) => {
			const name = element.dataset.demo,
				carousel = BetterCarousel(element, demos[name]?.(element));
			starts[name]?.(carousel, element);
			return carousel;
		})
	];

	// All carousels are ready after their first measure pass. A carousel that a breakpoint stops does not start.
	window.ready = Promise.all(carousels.map((carousel) => carousel.options()?.active !== false && new Promise((resolve) => carousel.on('init', resolve))));

	// The state of each example carousel under it
	carousels.filter((carousel) => carousel.rootNode()?.closest('.demo')).forEach((carousel) => {
		const info = document.createElement('p');
		info.className = 'demo_info';
		// After the thumbnails and the arrows in #product, so that the arrows stay in the middle of the thumbnails
		(carousel.rootNode().closest('.gallery_nav') || carousel.rootNode()).after(info);

		const update = () => {
			info.textContent = 'snap ' + carousel.selectedSnap() + ' of ' + carousel.snapList().length + ', slide ' + carousel.selectedSlide() + (carousel.isFit() ? ', fit' : '');
		};

		['init', 'reinit', 'select', 'resize'].forEach((name) => carousel.on(name, update));
	});

	// The like buttons in the controls demo, the tabs, and the copy buttons of the code samples
	document.addEventListener('click', (event) => {
		const like = event.target.closest('.demo_like'),
			tab = event.target.closest('[role="tab"]'),
			copy = event.target.closest('[data-copy]');
		if (tab) {
			tab.parentElement.querySelectorAll('[role="tab"]').forEach((item) => {
				item.setAttribute('aria-selected', item === tab);
				document.getElementById(item.getAttribute('aria-controls')).hidden = item !== tab;
			});
		}
		if (like) {
			like.setAttribute('aria-pressed', like.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
		}
		if (copy) {
			navigator.clipboard?.writeText(copy.closest('.code').querySelector('code').textContent).then(() => {
				copy.textContent = 'Copied';
				setTimeout(() => (copy.textContent = 'Copy'), 1500);
			});
		}
	});

	// The table of contents: mark the section in view
	const toc = document.querySelector('.wrapper_box .sidebar'),
		links = new Map([...toc.querySelectorAll('a')].map((link) => [link.hash.slice(1), link])),
		// The menu at the top: a link marks its section and the sections after it, until the next link
		top = [...document.querySelectorAll('.header_box .menu a')],
		parts = new Map(),
		observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const link = entry.isIntersecting && links.get(entry.target.id);
				if (!link) {
					return;
				}
				links.forEach((item) => item.parentElement.classList.toggle('active', item === link));
				top.forEach((item) => item.parentElement.classList.toggle('active', item === parts.get(entry.target.id)));
				if (link.offsetTop < toc.scrollTop || link.offsetTop + link.offsetHeight > toc.scrollTop + toc.clientHeight) {
					toc.scrollTo({ top: link.offsetTop - toc.clientHeight / 2, behavior: 'smooth' });
				}
			});
		}, { rootMargin: '-80px 0px -65% 0px' });

	let part = null;
	document.querySelectorAll('.wrapper_box .section').forEach((section) => {
		part = top.find((link) => link.hash === '#' + section.id) || part;
		parts.set(section.id, part);
		observer.observe(section);
	});

	// Prism loads with "defer", after this script
	document.addEventListener('DOMContentLoaded', () => window.Prism?.highlightAll());

	// Images that load late change the slide widths
	setTimeout(() => {
		document.querySelectorAll('img[data-width]').forEach((image) => {
			const width = image.dataset.width;
			image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="120"><rect width="100%" height="100%" fill="#dbe6ff"/></svg>');
		});
	}, 1000);

})();
