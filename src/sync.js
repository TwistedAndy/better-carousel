import { place } from './nav.js';

/**
 * Connect a carousel to another carousel with the same slides, such as thumbnails to a main gallery. This carousel follows the slide
 * that the other carousel selects. Only a click on a slide of this carousel selects that slide in the other carousel: a drag does not.
 *
 * @param {object} api This carousel.
 * @param {object|string|Element} target The other carousel, its container or a selector.
 * @param {(element: Element) => object} find Get the carousel of an element.
 * @param {(node: Element) => number} slideOf Get the original slide index of a node in this carousel, or -1.
 * @param {(index: number) => void} follow Set the selected slide of this carousel.
 * @returns {() => void} A function that disconnects the carousels.
 */
export function sync(api, target, find, slideOf, follow) {
	let other = null;

	// Show the slide that the other carousel selects
	function show(instant) {
		const index = other.selectedSlide();
		follow(index);
		api.goToSlide(index, instant === true);
	}

	function click(event) {
		const index = slideOf(event.target);
		if (other && index > -1) {
			other.goToSlide(index);
		}
	}

	// The other carousel can come later than this one, so find it at the init
	function connect() {
		if (other) {
			return;
		}
		other = target && target.goTo ? target : find(typeof target === 'string' ? place(target, api.rootNode()) : target);
		if (other) {
			other.on('select', show);
			show(true);
		}
	}

	api.on('init', connect);
	api.on('reinit', connect);
	api.containerNode().addEventListener('click', click);

	return () => {
		api.off('init', connect);
		api.off('reinit', connect);
		other?.off('select', show);
		api.containerNode().removeEventListener('click', click);
	};
}
