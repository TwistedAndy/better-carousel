/*
 * Markup: the wrapper, the slides, the clones, the ARIA attributes, and the helpers that write to the DOM.
 *
 * The helpers that set a value write only when the value changes. restore() removes all that the library added.
 */

/**
 * Add or remove a class.
 *
 * @param {Element} element
 * @param {string} name An empty name does nothing.
 * @param {boolean} on
 */
export function setClass(element, name, on) {
	if (name && element.classList.contains(name) !== !!on) {
		element.classList.toggle(name, !!on);
	}
}

/**
 * Set an attribute, or remove it if the value is null or false.
 *
 * @param {Element} element
 * @param {string} name
 * @param {string|boolean|null} value
 */
export function setAttribute(element, name, value) {
	const text = value === true ? '' : value === false || value == null ? null : String(value);
	if (element.getAttribute(name) !== text) {
		if (text === null) {
			element.removeAttribute(name);
		} else {
			element.setAttribute(name, text);
		}
	}
}

/**
 * Set an inline style property.
 *
 * @param {HTMLElement} element
 * @param {string} name
 * @param {string} value An empty string removes the property.
 */
export function setStyle(element, name, value) {
	if (element.style[name] !== value) {
		element.style[name] = value;
	}
}

/**
 * Remove an empty style attribute that the library left.
 *
 * @param {Element} element
 */
export function cleanStyle(element) {
	if (element.getAttribute('style') === '') {
		element.removeAttribute('style');
	}
}

/**
 * Make an element.
 *
 * @param {string} tag
 * @param {string} className
 * @returns {HTMLElement}
 */
export function create(tag, className) {
	const element = document.createElement(tag);
	if (className) {
		element.className = className;
	}
	return element;
}

/**
 * Find the element of an option, such as "arrows", "dots" or "sync". true gives the root, and false gives null.
 * The library searches for a selector in the root and then in each parent of the root, so that it finds a heading in the section of the carousel.
 *
 * @param {boolean|string|Element} value The option value.
 * @param {HTMLElement} root
 * @returns {Element|null}
 */
export function optionElement(value, root) {
	if (typeof value === 'string') {
		for (let node = root; node; node = node.parentElement) {
			const found = node.querySelector(value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	return value === true ? root : value || null;
}

// The attributes and the classes that the library added: element => names
const marked = new WeakMap(),
	added = new WeakMap();

/**
 * Set an attribute that the page did not set. restore() removes it.
 *
 * @param {Element} node
 * @param {string} name
 * @param {string} value
 */
export function own(node, name, value) {
	const list = marked.get(node) || new Set();
	if (list.has(name) || !node.hasAttribute(name)) {
		list.add(name);
		marked.set(node, list);
		if (node.getAttribute(name) !== value) {
			node.setAttribute(name, value);
		}
	}
}

/**
 * Add a class that the element does not have. restore() removes it.
 *
 * @param {Element} node
 * @param {string} name An empty name does nothing.
 */
export function addClass(node, name) {
	if (name && !node.classList.contains(name)) {
		const list = added.get(node) || new Set();
		node.classList.add(name);
		list.add(name);
		added.set(node, list);
	}
}

// The elements that the library made: the wrapper and the clones
const made = new WeakSet();

// A counter for container ids
let uid = 0;

/**
 * Find or make the root, the viewport and the container of a carousel. Then add their classes and the ARIA attributes of the
 * carousel pattern of the WAI-ARIA Authoring Practices. A new setup after reInit() uses the wrapper that the library made before.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} options
 * @param {object} cls The class names.
 * @returns {{root: HTMLElement, viewport: HTMLElement, container: HTMLElement}}
 */
export function build(element, options, cls) {
	let container = options.container ? element.querySelector(options.container) : element;

	if (container.classList.contains(cls.viewport)) {
		container = container.firstElementChild;
	}

	let viewport = container.parentElement,
		root = viewport.parentElement;

	if (!made.has(viewport) && !viewport.classList.contains(cls.viewport) && options.wrap) {
		root = create('div');
		viewport = create('div');
		made.add(root).add(viewport);
		container.before(root);
		root.append(viewport);
		viewport.append(container);
	}

	addClass(root, cls.root);
	addClass(viewport, cls.viewport);
	addClass(container, cls.container);

	own(root, 'role', 'region');
	own(root, 'aria-roledescription', 'carousel');
	if (!root.hasAttribute('aria-labelledby')) {
		own(root, 'aria-label', options.labels.carousel);
	}
	own(container, 'id', container.id || 'carousel-' + ++uid);
	own(container, 'aria-live', 'polite');

	return { root, viewport, container };
}

/**
 * Remove the classes and the attributes that own() and addClass() added, an empty class attribute, and the wrapper that build() made.
 *
 * @param {HTMLElement} root
 * @param {HTMLElement} viewport
 * @param {HTMLElement} container
 * @param {HTMLElement[]} slides
 * @param {boolean} keep Keep the wrapper for a new setup.
 */
export function restore(root, viewport, container, slides, keep) {
	for (const node of [root, viewport, container, ...slides]) {
		marked.get(node)?.forEach((name) => node.removeAttribute(name));
		added.get(node)?.forEach((name) => node.classList.remove(name));
		marked.delete(node);
		added.delete(node);
		if (node.getAttribute('class') === '') {
			node.removeAttribute('class');
		}
	}

	if (!keep && made.has(root)) {
		root.before(container);
		root.remove();
	}
}

// Slides that are a control keep their own role and name
const controls = 'a[href],button,input,select,textarea,[tabindex],[role]';

// The slides that can get the "group" role. An element with its own role, such as an article or a list item, does not permit "group".
const generic = 'div,span,section';

/**
 * Get the slides of a container. The clones that the library made are not slides.
 *
 * @param {HTMLElement} container
 * @param {string} [selector] The "slides" option.
 * @returns {HTMLElement[]}
 */
export function readSlides(container, selector) {
	return [...(selector ? container.querySelectorAll(selector) : container.children)].filter((node) => !made.has(node));
}

/**
 * Make the clones: full copies of the slides, which the screen reader and the keyboard do not see.
 *
 * @param {HTMLElement[]} slides
 * @param {number} count The number of copies of all slides.
 * @param {string} className The class of a clone.
 * @returns {HTMLElement[]}
 */
export function copySlides(slides, count, className) {
	const list = [];

	for (let copy = 0; copy < count; copy++) {
		for (const node of slides) {
			const clone = node.cloneNode(true);
			for (const item of [clone, ...clone.querySelectorAll('[id]')]) {
				item.removeAttribute('id');
			}
			clone.setAttribute('aria-hidden', 'true');
			clone.inert = true;
			clone.style.translate = '';
			setClass(clone, className, true);
			cleanStyle(clone);
			made.add(clone);
			list.push(clone);
		}
	}

	return list;
}

/**
 * Give each slide the slide role and a name such as "2 of 8". A slide with its own role, such as an article, keeps it.
 *
 * @param {HTMLElement[]} slides
 * @param {string} text The "slide" label, with %d for the slide number and %n for the number of slides.
 */
export function labelSlides(slides, text) {
	slides.forEach((node, index) => {
		if (!node.matches(controls) || marked.get(node)?.has('role')) {
			if (node.matches(generic)) {
				own(node, 'role', 'group');
			}
			own(node, 'aria-roledescription', 'slide');
			own(node, 'aria-label', text.replace('%d', index + 1).replace('%n', slides.length));
		}
	});
}
