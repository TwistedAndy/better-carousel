// The baseline: the same slides in a row, with no carousel script. It shows the work of the browser and of the benchmark itself.
import { slides } from '../harness.js';

export function markup(root) {
	root.innerHTML = '<div class="items" style="overflow:hidden">' + slides('div', 'item') + '</div>';
}

export function mount() {
	return { next() {}, prev() {}, index: () => 0 };
}
