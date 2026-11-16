/* global BetterCarousel */
(() => {
	'use strict';

	const carousels = window.carousels = BetterCarousel.initAll('.items.carousel');

	// All carousels are ready after their first measure pass
	window.ready = Promise.all(carousels.map((carousel) => new Promise((resolve) => carousel.on('init', resolve))));

	// The state of each example carousel under it
	carousels.filter((carousel) => carousel.rootNode().closest('.demo')).forEach((carousel) => {
		const info = document.createElement('p');
		info.className = 'demo_info';
		carousel.rootNode().after(info);

		const update = () => {
			info.textContent = 'snap ' + carousel.selectedSnap() + ' of ' + carousel.snapList().length + ', slide ' + carousel.selectedSlide() + (carousel.isFit() ? ', fit' : '');
		};

		['init', 'reinit', 'select', 'resize'].forEach((name) => carousel.on(name, update));
	});

	// The like buttons in the controls demo, and the copy buttons of the code samples
	document.addEventListener('click', (event) => {
		const like = event.target.closest('.demo_like'),
			copy = event.target.closest('[data-copy]');
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
		observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const link = entry.isIntersecting && links.get(entry.target.id);
				if (!link) {
					return;
				}
				links.forEach((item) => item.parentElement.classList.toggle('active', item === link));
				if (link.offsetTop < toc.scrollTop || link.offsetTop + link.offsetHeight > toc.scrollTop + toc.clientHeight) {
					toc.scrollTo({ top: link.offsetTop - toc.clientHeight / 2, behavior: 'smooth' });
				}
			});
		}, { rootMargin: '-80px 0px -65% 0px' });

	document.querySelectorAll('.wrapper_box .section').forEach((section) => observer.observe(section));

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
