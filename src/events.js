/**
 * Make an event emitter. A handler gets (api, name), as in Embla.
 *
 * @param {object} api
 * @returns {{on: Function, off: Function, emit: Function, has: Function}}
 */
export function emitter(api) {
	const map = {};

	return {
		on(name, handler) {
			(map[name] ||= new Set()).add(handler);
			return api;
		},
		off(name, handler) {
			map[name]?.delete(handler);
			return api;
		},
		emit(name) {
			map[name]?.forEach((handler) => handler(api, name));
		},
		has(name) {
			return !!map[name]?.size;
		}
	};
}
