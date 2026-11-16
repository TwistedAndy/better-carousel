import { place } from './nav.js';

/**
 * Connect two carousels with the same slides, such as thumbnails and a main gallery. Each carousel follows the slide that the other selects.
 * A click on a slide of this carousel selects that slide in the other carousel.
 *
 * @param {object} api This carousel.
 * @param {object|string|Element} target The other carousel, its container or a selector.
 * @param {(element: Element) => object} find Get the carousel of an element.
 * @param {(node: Element) => number} slideOf Get the original slide index of a node in this carousel, or -1.
 * @returns {() => void} A function that disconnects the carousels.
 */
export function sync(api, target, find, slideOf) {
	let other = null,
		lock = false;

	// Select the slide of one carousel in the other carousel. The lock stops the select event of the other carousel from coming back.
	function copy(from, to) {
		if (to && !lock) {
			lock = true;
			to.goToSlide(from.selectedSlide());
			lock = false;
		}
	}

	const mine = () => copy(api, other),
		theirs = () => copy(other, api);

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
			other.on('select', theirs);
			api.goToSlide(other.selectedSlide(), true);
		}
	}

	api.on('init', connect);
	api.on('reinit', connect);
	api.on('select', mine);
	api.containerNode().addEventListener('click', click);

	return () => {
		api.off('init', connect);
		api.off('reinit', connect);
		api.off('select', mine);
		other?.off('select', theirs);
		api.containerNode().removeEventListener('click', click);
	};
}
