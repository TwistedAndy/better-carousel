// DOM helpers. Each helper writes only when the value changes.

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
 * Get the CSS translate value for one axis.
 *
 * @param {string} axis 'x' or 'y'.
 * @param {number} value px
 * @returns {string}
 */
export function translate(axis, value) {
	return value ? (axis === 'x' ? value + 'px' : '0 ' + value + 'px') : '';
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
