/*
 * The libraries of the benchmark: the packages, the entries for the size table, and the feature table.
 * All paths are relative to this folder.
 */

const modules = 'node_modules/';

// The entry of the "typical" size: the mount function of the adapter, without the markup function
const typical = (id) => "import { mount } from './adapters/" + id + ".js'; window.x = mount;";

/*
 * Each library has these keys:
 * - package: the npm package that gives the version. Better Carousel uses the package of the project.
 * - core: the smallest import that makes a carousel that the user can drag.
 * - typical: loop, drag, arrows, dots, autoplay and the accessibility module, if the library has one.
 * - parity: the typical set, with the mouse wheel, the auto scroll, the auto height, the free drag and the sync. null if the library does not have them.
 * - cdn: the minified files that the package ships for a script tag.
 * - css: the CSS files for each set.
 */
export const libs = [
	{
		id: 'better',
		name: 'Better Carousel',
		package: '../package.json',
		core: typical('better'),
		typical: typical('better'),
		parity: typical('better'),
		css: { core: ['../dist/better-carousel.css', 'adapters/better.css'], typical: ['../dist/better-carousel.css', 'adapters/better.css'] },
		cdn: { js: '../dist/better-carousel.min.js', css: ['../dist/better-carousel.css'] }
	},
	{
		id: 'swiper',
		name: 'Swiper',
		package: modules + 'swiper/package.json',
		released: '2026-10-30',
		core: "import Swiper from 'swiper'; window.x = Swiper;",
		typical: typical('swiper'),
		parity: "import { mount } from './adapters/swiper.js'; import { FreeMode, Mousewheel, Thumbs } from 'swiper/modules'; window.x = [mount, FreeMode, Mousewheel, Thumbs];",
		css: {
			core: [modules + 'swiper/swiper.css'],
			typical: [modules + 'swiper/swiper.css', modules + 'swiper/modules/navigation.css', modules + 'swiper/modules/pagination.css', modules + 'swiper/modules/a11y.css']
		},
		cdn: { js: modules + 'swiper/swiper-bundle.min.js', css: [modules + 'swiper/swiper-bundle.min.css'] }
	},
	{
		id: 'embla',
		name: 'Embla Carousel',
		package: modules + 'embla-carousel/package.json',
		released: '2025-04-04',
		core: "import EmblaCarousel from 'embla-carousel'; window.x = EmblaCarousel;",
		typical: typical('embla'),
		parity: "import { mount } from './adapters/embla.js'; import AutoScroll from 'embla-carousel-auto-scroll'; import AutoHeight from 'embla-carousel-auto-height'; import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'; window.x = [mount, AutoScroll, AutoHeight, WheelGesturesPlugin];",
		css: { core: ['adapters/embla-core.css'], typical: ['adapters/embla-core.css', 'adapters/embla-controls.css'] },
		cdn: { js: modules + 'embla-carousel/embla-carousel.umd.js', css: [] }
	},
	{
		id: 'glide',
		name: 'Glide',
		package: modules + '@glidejs/glide/package.json',
		released: '2024-11-22',
		core: "import Glide, { Swipe } from '@glidejs/glide/dist/glide.modular.esm.js'; window.x = (element, options) => new Glide(element, options).mount({ Swipe });",
		typical: typical('glide'),
		parity: null,
		css: {
			core: [modules + '@glidejs/glide/dist/css/glide.core.css'],
			typical: [modules + '@glidejs/glide/dist/css/glide.core.css', modules + '@glidejs/glide/dist/css/glide.theme.css']
		},
		cdn: { js: modules + '@glidejs/glide/dist/glide.min.js', css: [modules + '@glidejs/glide/dist/css/glide.core.min.css', modules + '@glidejs/glide/dist/css/glide.theme.min.css'] }
	}
];

// The page with no carousel. Its values show the work of the browser and of the benchmark itself.
export const baseline = { id: 'none', name: 'No carousel', css: { typical: ['adapters/better.css'] } };

/*
 * The feature table, from the documentation of each library at the version in package.json.
 * The values are in the order of the libraries above.
 */
export const features = [
	['Slide sizes and gaps from CSS', 'yes', "partly (`slidesPerView: 'auto'`)", 'yes', 'no'],
	['Loop without clones', 'yes', 'yes', 'yes', 'no'],
	['Vertical', 'yes', 'yes', 'yes', 'no'],
	['Right-to-left', 'yes', 'yes', 'yes', 'yes'],
	['Breakpoints', 'yes', 'yes', 'yes', 'yes'],
	['Free drag with momentum', 'yes', 'module', 'yes', 'no'],
	['Arrows and dots', 'yes', 'modules', 'no', 'your markup'],
	['Autoplay', 'yes', 'module', 'plugin', 'yes'],
	['Auto scroll without stops', 'yes', 'partly (autoplay with delay 0)', 'plugin', 'no'],
	['Auto height', 'yes', 'yes', 'plugin', 'no'],
	['Sync of two carousels', 'yes', 'module', 'no', 'no'],
	['Mouse wheel', 'yes', 'module', 'plugin of a third party', 'no'],
	['Arrow keys', 'yes', 'module', 'no', 'yes'],
	['Names for screen readers', 'yes', 'module', 'no', 'no'],
	['Start only when near the screen', 'yes', 'no', 'no', 'no'],
	['Fade and other effects', 'no', 'modules (fade, cube, flip, coverflow, cards, creative)', 'plugin (fade)', 'no'],
	['TypeScript types', 'yes', 'yes', 'yes', 'separate package'],
];
