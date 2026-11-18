// Browser checks against the demo page. Run: npm run e2e
// The checks run in groups, and the groups run at the same time. Each group has its own Chrome, so that its page has the keyboard focus.
import { availableParallelism } from 'node:os';
import puppeteer from 'puppeteer-core';

const url = process.env.URL || 'http://better.test/';
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// The number of Chromes at the same time. A Chrome uses about two CPU threads: with more Chromes, the frames come late and the motion checks fail.
const workers = +process.env.E2E_WORKERS || Math.max(1, Math.floor(availableParallelism() / 2));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Open the demo page in a new Chrome, and make the helpers of a group.
 *
 * @param {string[]} list The results of the group.
 * @param {object} viewport
 */
async function open(list, viewport) {
	const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars'] }),
		page = await browser.newPage(),
		check = (name, ok, detail = '') => list.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' (' + detail + ')' : ''));

	page.on('pageerror', (error) => check('no page errors', false, error.message));
	page.on('console', (message) => message.type() === 'error' && check('no console errors', false, message.text()));

	// Helpers in the page: the active slide box and the viewport box on the main axis, the carousel of a section,
	// and the largest empty space in the viewport on the main axis, on each frame while a sampler runs
	await page.evaluateOnNewDocument(() => {
		window.box = (carousel) => {
			const x = !carousel.rootNode().classList.contains('better_vertical'),
				view = carousel.viewportNode().getBoundingClientRect(),
				slide = carousel.slideNodes()[carousel.selectedSlide()].getBoundingClientRect(),
				start = x ? 'left' : 'top',
				end = x ? 'right' : 'bottom';
			return {
				x,
				start: slide[start] - view[start],
				end: view[end] - slide[end],
				center: (slide[start] + slide[end]) / 2 - (view[start] + view[end]) / 2
			};
		};
		window.byId = (id, index = 0) => window.carousels.filter((carousel) => carousel.rootNode()?.closest('#' + id))[index];
		window.coverage = (carousel) => {
			const view = carousel.viewportNode().getBoundingClientRect(),
				x = carousel.rootNode().classList.contains('better_horizontal'),
				size = x ? view.width : view.height,
				spans = [...carousel.containerNode().children].map((node) => node.getBoundingClientRect()).map((rect) => x ? [rect.left - view.left, rect.right - view.left] : [rect.top - view.top, rect.bottom - view.top]).filter((span) => span[1] > 0 && span[0] < size).sort((a, b) => a[0] - b[0]);
			let reach = 0,
				gap = 0;
			for (const [start, end] of spans) {
				gap = Math.max(gap, start - reach);
				reach = Math.max(reach, end);
			}
			return Math.max(gap, size - reach);
		};
		window.sample = (carousel) => {
			const result = { gap: 0, frames: 0 };
			let run = true;
			const tick = () => {
				result.gap = Math.max(result.gap, window.coverage(carousel));
				result.frames++;
				if (run) {
					requestAnimationFrame(tick);
				}
			};
			tick();
			return () => {
				run = false;
				return result;
			};
		};
	});

	const frames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

	// The demo gives the images with data-width their source 1 s after the start, and the new image widths change the slide widths.
	// Wait for these images, and for the measure pass of their carousels.
	const lateImages = async () => {
		await page.waitForFunction(() => [...document.querySelectorAll('img[data-width]')].every((image) => image.src.startsWith('data:') && image.complete));
		await frames();
	};

	// The center of a viewport in page coordinates, and the state of its carousel
	const state = (id, index = 0) => page.evaluate((id, index) => {
		const carousel = window.byId(id, index),
			view = carousel.viewportNode().getBoundingClientRect(),
			slides = [...carousel.containerNode().children].map((node) => node.getBoundingClientRect().left - view.left);
		return { x: view.left + view.width / 2, y: view.top + view.height / 2, snap: carousel.selectedSnap(), first: slides[0], aligned: slides.some((left) => Math.abs(left) <= 0.5) };
	}, id, index);

	// Wait for the settle event of a carousel, or for a timeout
	const settle = (id, index = 0) => page.evaluate((id, index) => new Promise((resolve) => {
		const carousel = window.byId(id, index),
			done = () => {
				carousel.off('settle', done);
				resolve(true);
			};
		carousel.on('settle', done);
		setTimeout(() => resolve(false), 3000);
	}), id, index);

	// Wait until no motion and no transition runs in a section, for two checks in a row, or for 3 s. A step that does not move a carousel has no "settle" event.
	const idle = async (id) => {
		for (let still = 0, tries = 0; still < 2 && tries < 60; tries++) {
			await wait(50);
			const moving = await page.evaluate((id) => document.getElementById(id).getAnimations({ subtree: true }).some((animation) => animation.playState === 'running' && animation.effect.getComputedTiming().endTime < Infinity), id);
			still = moving ? 0 : still + 1;
		}
	};

	const scrollTo = (id) => page.evaluate((id) => {
		document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' });
		window.byId(id).goToSnap(0, true);
	}, id);

	// A mouse drag: a slow drag ends with a stop, a flick ends at full speed. The index selects a carousel in a section with more than one.
	const mouseDrag = async (id, distance, flick, index = 0) => {
		await page.evaluate((id, index) => {
			const carousel = window.byId(id, index);
			carousel.rootNode().scrollIntoView({ block: 'center', behavior: 'instant' });
			carousel.goToSnap(0, true);
		}, id, index);
		const start = await state(id, index),
			done = settle(id, index);
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		const steps = flick ? 4 : 12;
		for (let index = 1; index <= steps; index++) {
			await page.mouse.move(start.x + distance * index / steps, start.y);
			await wait(flick ? 8 : 16);
		}
		if (!flick) {
			await wait(200);
		}
		await page.mouse.up();
		await done;
		return state(id, index);
	};

	// Scroll to a carousel with no goToSnap(): a goToSnap() is an interaction, and it stops the autoplay and the auto scroll
	const show = (id) => page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), id);

	await page.setViewport(viewport);
	await page.goto(url, { waitUntil: 'load' });
	await page.evaluate(() => window.ready);

	return { browser, page, check, frames, lateImages, state, settle, idle, scrollTo, mouseDrag, show };
}

/**
 * Make the helpers of the fixture groups. Each check makes its own carousel in a fixed box at the top left of the page:
 * 300 px slides with a 10 px gap in a 600 px viewport, with no arrows and no dots. The mouse, the touch and the keyboard of the page drive it.
 *
 * @param {import('puppeteer-core').Page} page
 */
function fixture(page) {
	/**
	 * Make the carousel in the fixed box, and wait for its init. It removes the carousel of the last call.
	 * setup.html is the content of each slide, with %i for the slide index. setup.css is more CSS for the container.
	 * setup.count is the number of slides (6), and setup.width is the width of the box (600 px).
	 * window.counts counts the events, and the clicks on the elements with data-click. window.clicked is the data-index of the last click.
	 */
	const make = (options = {}, setup = {}) => page.evaluate(async (options, setup) => {
		window.fixed?.destroy();
		document.getElementById('fixture')?.remove();

		const box = document.createElement('div'),
			container = document.createElement('div');
		box.id = 'fixture';
		box.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 99999; background: #fff; width: ' + (setup.width || 600) + 'px';
		container.style.cssText = 'display: flex; gap: 10px; ' + (setup.css || '');
		for (let index = 0; index < (setup.count || 6); index++) {
			const slide = document.createElement('div');
			slide.style.cssText = 'flex: 0 0 300px; height: 100px';
			slide.innerHTML = (setup.html || '<span>%i</span>').replaceAll('%i', index);
			container.append(slide);
		}
		box.append(container);
		document.body.append(box);

		const carousel = window.fixed = BetterCarousel(container, { arrows: false, dots: false, ...options });
		window.counts = { select: 0, settle: 0, dragstart: 0, slidesinview: 0, slideschanged: 0, click: 0 };
		window.clicked = null;
		['select', 'settle', 'dragstart', 'slidesinview', 'slideschanged'].forEach((name) => carousel.on(name, () => window.counts[name]++));
		container.addEventListener('click', (event) => {
			const target = event.target.closest('[data-click]');
			if (target) {
				window.counts.click++;
				window.clicked = target.dataset.index ?? '';
			}
		});
		await new Promise((resolve) => carousel.on('init', resolve));
	}, options, setup);

	// The center of the viewport, the translate of the container that shows now (also during a motion), and the counts
	const center = () => page.evaluate(() => {
		const rect = window.fixed.viewportNode().getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	});
	const shown = () => page.evaluate(() => parseFloat(getComputedStyle(window.fixed.containerNode()).translate) || 0);
	const counts = () => page.evaluate(() => window.counts);
	const settled = () => page.evaluate(() => new Promise((resolve) => {
		window.fixed.on('settle', resolve);
		setTimeout(resolve, 3000);
	}));
	// The center of an element in a slide
	const point = (slide, selector) => page.evaluate((slide, selector) => {
		const rect = window.fixed.slideNodes()[slide].querySelector(selector).getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}, slide, selector);
	// Move the mouse in steps of 16 ms
	const moveBy = async (from, distance, steps) => {
		for (let step = 1; step <= steps; step++) {
			await page.mouse.move(from.x + distance * step / steps, from.y);
			await wait(16);
		}
	};

	return { make, center, shown, counts, settled, point, moveBy };
}

// The groups: [name, run, viewport]. The groups that take the longest come first, so that the workers stop at about the same time.
const groups = [
	['drag', async ({ page, check, state, scrollTo, mouseDrag }) => {
		{
			const slow = await mouseDrag('drag', -250, false);
			check('mouse drag: a slow drag past half a snap goes to the next snap and aligns', slow.snap === 1 && slow.aligned, JSON.stringify(slow));

			const back = await mouseDrag('drag', -12, false);
			check('mouse drag: a short slow drag goes back', back.snap === 0 && back.aligned, JSON.stringify(back));

			const normal = await mouseDrag('free', -400, true),
				snap = await mouseDrag('freesnap', -400, true),
				skip = await mouseDrag('skip', -400, true),
				one = await mouseDrag('start', -400, true);
			check('dragFree: a flick stops between the snaps', !normal.aligned && normal.first < -400, JSON.stringify(normal));

			// The same flick glides less with dragFriction: 3. The speed of a flick changes from run to run, so compare only the order.
			const slower = await mouseDrag('free', -400, true, 1);
			check('dragFriction: 3 makes the glide after the same flick shorter', slower.first > normal.first && slower.first < -400, JSON.stringify({ normal: normal.first, slower: slower.first }));
			check('dragFree snap: a flick stops at a snap after more than one snap', snap.aligned && snap.snap > 1, JSON.stringify(snap));
			check('skipSnaps false: a flick goes one snap only', skip.aligned && skip.snap === 1, JSON.stringify(skip));
			check('default skipSnaps true: a flick passes more than one snap', one.aligned && one.snap > 1, JSON.stringify(one));
		}

		// Clicks on links
		{
			await scrollTo('drag');
			await page.evaluate(() => history.replaceState(null, '', '#'));
			const start = await state('drag');
			await page.mouse.click(start.x, start.y);
			const clicked = await page.evaluate(() => location.hash);
			await page.evaluate(() => history.replaceState(null, '', '#'));
			await mouseDrag('drag', -250, false);
			const dragged = await page.evaluate(() => location.hash);
			check('a click opens a link in a slide', clicked === '#slide-2', clicked);
			check('a drag does not open the link', dragged === '', dragged);
		}

		// Keyboard focus
		{
			await scrollTo('drag');
			await page.evaluate(() => document.querySelector('#drag a.item').focus());
			for (let index = 0; index < 5; index++) {
				await page.keyboard.press('Tab');
			}
			await wait(700);
			const value = await page.evaluate(() => {
				const carousel = window.byId('drag');
				return { focused: document.activeElement.textContent, slide: carousel.selectedSlide(), scroll: carousel.viewportNode().scrollLeft, visible: carousel.slidesInView() };
			});
			check('Tab to a hidden slide: the carousel goes to it and the viewport does not scroll', value.focused === '6' && value.visible.includes(5) && value.scroll === 0, JSON.stringify(value));
		}
	}],
	['loop', async ({ page, check }) => {
		// The 4 carousels move at the same time
		const limits = { loop: 21, loopcenter: 21, clones: 21, gallery: 11 },
			values = await page.evaluate((ids) => Promise.all(ids.map(async (id) => {
				const carousel = window.byId(id),
					stop = window.sample(carousel),
					slides = new Set(),
					snaps = new Set();
				carousel.goToSnap(0, true);
				for (let index = 0; index < 30; index++) {
					carousel[index < 20 ? 'goToNext' : 'goToPrev']();
					slides.add(carousel.selectedSlide());
					snaps.add(carousel.selectedSnap());
					await new Promise((resolve) => setTimeout(resolve, index % 3 ? 90 : 450));
				}
				await new Promise((resolve) => setTimeout(resolve, 900));
				const result = stop();
				return { ...result, slides: [...slides].sort((a, b) => a - b), snaps: [...snaps].sort((a, b) => a - b), count: carousel.slideNodes().length, dots: carousel.snapProgress().length, snap: carousel.selectedSnap() };
			})), Object.keys(limits));
		Object.entries(limits).forEach(([id, limit], index) => {
			const value = values[index];
			check(id + ': 30 next and prev calls show no gap on any frame', value.gap <= limit && value.frames > 60, 'largest gap ' + value.gap.toFixed(1) + ' px in ' + value.frames + ' frames');
			check(id + ': snaps and slides are original indexes', value.slides.every((item) => item < value.count) && value.snaps.every((item) => item < value.dots), JSON.stringify(value));
		});
	}],
	['wheel', async ({ page, check, state }) => {
		// Send wheel events over a carousel, with a time between them, and get the snap and the page scroll
		const wheel = async (id, list, gap = 16) => {
			const start = await state(id);
			await page.mouse.move(start.x, start.y);
			for (const delta of list) {
				await page.mouse.wheel({ deltaY: delta });
				await wait(gap);
			}
			await wait(700);
			return page.evaluate((id) => {
				const carousel = window.byId(id);
				return { snap: carousel.selectedSnap(), last: carousel.snapProgress().length - 1, scroll: Math.round(scrollY), aligned: Math.abs(carousel.progress() - carousel.snapProgress()[carousel.selectedSnap()]) < 0.002 };
			}, id);
		};
		const reset = (id, snap = 0) => page.evaluate((id, snap) => {
			document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' });
			window.byId(id).goToSnap(snap, true);
			return Math.round(scrollY);
		}, id, snap);

		let top = await reset('vertical');
		const one = await wheel('vertical', [100]);
		check('wheel: one step over a vertical carousel goes to the next snap, and the page does not scroll', one.snap === 1 && one.aligned && one.scroll === top, JSON.stringify({ top, one }));

		// Three fast steps of a mouse wheel move the carousel by their distance, not by one snap
		top = await reset('vertical');
		const steps = await wheel('vertical', [100, 100, 100], 50);
		check('wheel: fast steps move more than one snap and stop at a snap', steps.snap >= 2 && steps.aligned && steps.scroll === top, JSON.stringify({ top, steps }));

		// Inertia of a trackpad: 20 events with a smaller delta each time. The carousel follows the distance, and the page does not scroll.
		top = await reset('vertical');
		const inertia = await wheel('vertical', Array.from({ length: 20 }, (item, index) => 60 - index * 3));
		check('wheel: a trackpad stream with inertia follows its distance and stops at a snap', inertia.snap >= 2 && inertia.aligned && inertia.scroll === top, JSON.stringify({ top, inertia }));

		top = await reset('vertical', 99);
		await wait(1100);
		const end = await wheel('vertical', [100]);
		check('wheel: at the last snap, the page scrolls', end.snap === end.last && end.scroll > top, JSON.stringify({ top, end }));

		top = await reset('start');
		const horizontal = await wheel('start', [100]);
		check('wheel: the default does not change a horizontal carousel', horizontal.snap === 0 && horizontal.scroll > top, JSON.stringify({ top, horizontal }));

		await page.evaluate(async () => {
			const carousel = window.byId('start');
			carousel.reinit({ wheel: 'both' });
			await new Promise((resolve) => carousel.on('reinit', resolve));
		});
		top = await reset('start');
		const both = await wheel('start', [100]);
		check("wheel: 'both': the mouse wheel moves a horizontal carousel", both.snap === 1 && both.scroll === top, JSON.stringify({ top, both }));
	}],
	['input fixtures', async ({ page, check }) => {
		const { make, center, shown, counts, settled, point, moveBy } = fixture(page);

		// The loop: the snap after the last snap is the first snap. At the end of each motion, the location goes back into the first period,
		// so that it does not grow: the translate of snap 5 is -5 * 310 px, also after the short way back from snap 0.
		await make({ loop: true });
		const last = await page.evaluate(() => {
			window.fixed.goToSnap(5, true);
			const result = { can: window.fixed.canGoToNext(), translate: parseFloat(window.fixed.containerNode().style.translate) || 0 };
			window.fixed.goToNext();
			return result;
		});
		await settled();
		const first = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), translate: parseFloat(window.fixed.containerNode().style.translate) || 0 }));
		check('loop: goToNext() at the last snap goes to the first snap, and the location stays in the first period', last.can && Math.abs(last.translate + 1550) < 1 && first.snap === 0 && Math.abs(first.translate) < 1, JSON.stringify({ last, first }));

		// A press during a motion: the motion stops, the release goes to the nearest snap, and the link under the pointer does not open
		await make({ duration: 1000 }, { html: '<a href="#press-%i" data-click style="display: block; height: 100%">%i</a>' });
		await page.evaluate(() => history.replaceState(null, '', '#'));
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await page.evaluate(() => window.fixed.goToSnap(3));
			await wait(150);
			await page.mouse.down();
			const pressed = await shown();
			await wait(150);
			const held = await shown();
			await page.mouse.up();
			await settled();
			const press = await page.evaluate(() => ({ hash: location.hash, clicks: window.counts.click, snap: window.fixed.selectedSnap(), translate: parseFloat(window.fixed.containerNode().style.translate) || 0 }));
			check('a press during a motion stops it, and the release goes to the nearest snap', pressed < 0 && Math.abs(held - pressed) < 1 && press.snap < 3 && Math.abs(press.translate + press.snap * 310) < 1, JSON.stringify({ pressed, held, ...press }));
			check('a press during a motion does not open the link under the pointer', press.hash === '' && press.clicks === 0, JSON.stringify(press));
		}

		// A motion that starts during a press, such as an autoplay step: the drag starts where the carousel shows, not at the end of the motion
		await make({ duration: 1000 });
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
			await page.evaluate(() => window.fixed.goToSnap(window.fixed.snapProgress().length - 1));
			await wait(150);
			const before = await shown();
			await moveBy(at, -60, 6);
			const during = await shown();
			await page.mouse.up();
			await settled();
			check('a drag that starts during a motion starts where the carousel shows', before < -50 && during < before && before - during < 300, JSON.stringify({ before, during }));
		}

		// dragThreshold: the pointer must move this distance before the drag starts
		await make({ dragThreshold: 50 });
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
			await moveBy(at, -30, 6);
			const short = { translate: await shown(), drags: (await counts()).dragstart };
			await moveBy({ x: at.x - 30, y: at.y }, -60, 6);
			const long = { translate: await shown(), drags: (await counts()).dragstart };
			await page.mouse.up();
			await settled();
			check('dragThreshold: 50: a 30 px move does not drag, and a 90 px move drags', short.drags === 0 && short.translate === 0 && long.drags === 1 && long.translate < 0, JSON.stringify({ short, long }));
		}

		// A drag that changes the selected snap emits select
		await make();
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
			await moveBy(at, -250, 12);
			await wait(200);
			await page.mouse.up();
			await settled();
			const dragged = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), selects: window.counts.select }));
			check('a drag to the next snap emits select', dragged.snap === 1 && dragged.selects === 1, JSON.stringify(dragged));
		}

		// slidesinview occurs when the slides in view change
		await make();
		const inView = await page.evaluate(() => {
			window.counts.slidesinview = 0;
			window.fixed.goToSnap(3, true);
			return { events: window.counts.slidesinview, list: window.fixed.slidesInView().join() };
		});
		check('slidesinview occurs when the slides in view change', inView.events === 1 && inView.list === '3,4', JSON.stringify(inView));

		// The arrow keys in a right-to-left carousel: the left arrow goes to the next slide
		await make({}, { css: 'direction: rtl', html: '<button type="button">%i</button>' });
		await page.evaluate(() => window.fixed.slideNodes()[0].querySelector('button').focus());
		await page.keyboard.press('ArrowLeft');
		const rtlKey = await page.evaluate(() => window.fixed.selectedSnap());
		check('right to left: the left arrow key goes to the next slide', rtlKey === 1, String(rtlKey));

		// An arrow key in a form field moves the caret, not the carousel
		await make({}, { html: '<input value="abc" aria-label="Field %i">' });
		await page.evaluate(() => {
			const input = window.fixed.slideNodes()[0].querySelector('input');
			input.focus();
			input.setSelectionRange(0, 0);
		});
		await page.keyboard.press('ArrowRight');
		const field = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), caret: document.activeElement.selectionStart }));
		check('an arrow key in a form field moves the caret, not the carousel', field.snap === 0 && field.caret === 1, JSON.stringify(field));

		// The wheel over an element in a slide that can scroll: the element scrolls, and the carousel stays
		await make({ wheel: 'both' }, { html: '<div data-inner style="height: 80px; overflow-y: auto"><div style="height: 400px">%i</div></div>' });
		{
			const at = await point(0, '[data-inner]');
			await page.mouse.move(at.x, at.y);
			await page.mouse.wheel({ deltaY: 100 });
			await wait(500);
			const inner = await page.evaluate(() => ({ top: window.fixed.slideNodes()[0].querySelector('[data-inner]').scrollTop, snap: window.fixed.selectedSnap(), translate: window.fixed.containerNode().style.translate }));
			check('wheel: an element in a slide that can scroll gets the wheel, and the carousel stays', inner.top > 0 && inner.snap === 0 && !inner.translate, JSON.stringify(inner));
		}

		// A wheel step is an interaction: it stops the autoplay. With dragFree, the wheel goes to no snap after the step, so only the step itself can stop it.
		await make({ autoplay: 5000, wheel: 'both', dragFree: true });
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await page.mouse.wheel({ deltaY: 100 });
			await wait(500);
			const wheeled = await page.evaluate(() => ({ playing: window.fixed.autoplay.isPlaying(), translate: parseFloat(window.fixed.containerNode().style.translate) || 0 }));
			check('wheel: a wheel step with dragFree moves the carousel and stops the autoplay', !wheeled.playing && wheeled.translate < -50, JSON.stringify(wheeled));
		}

		// A tap on a button in a slide that shows in part: the button gets the click and the focus, and the focus does not move the carousel.
		// A mouse press does not focus the button, because the drag cancels its default action.
		await make({}, { width: 700, html: '<button type="button" data-click data-index="%i" style="width: 60px">%i</button>' });
		{
			const at = await point(2, 'button');
			await page.touchscreen.tap(at.x, at.y);
			await wait(600);
			const partial = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), clicked: window.clicked, focused: document.activeElement.dataset.index }));
			check('a tap on a button in a slide that shows in part clicks and focuses it, and the carousel stays', partial.snap === 0 && partial.clicked === '2' && partial.focused === '2', JSON.stringify(partial));
		}

		// Nested carousels: an arrow key and a wheel step in the inner carousel move only the inner carousel
		await make({ wheel: 'both' });
		{
			await page.evaluate(async () => {
				const slot = window.fixed.slideNodes()[0];
				slot.innerHTML = '<div style="display: flex; gap: 10px">' + '<div style="flex: 0 0 140px; height: 80px"><button type="button">x</button></div>'.repeat(4) + '</div>';
				window.inner = BetterCarousel(slot.firstChild, { arrows: false, dots: false, wheel: 'both' });
				await new Promise((resolve) => window.inner.on('init', resolve));
				window.inner.slideNodes()[0].querySelector('button').focus();
			});
			const snaps = () => page.evaluate(() => ({ inner: window.inner.selectedSnap(), outer: window.fixed.selectedSnap() }));
			await page.keyboard.press('ArrowRight');
			const key = await snaps();
			const at = await page.evaluate(() => {
				const rect = window.inner.viewportNode().getBoundingClientRect();
				return { x: rect.left + 50, y: rect.top + 40 };
			});
			await page.mouse.move(at.x, at.y);
			await page.mouse.wheel({ deltaY: 100 });
			await wait(500);
			const wheel = await snaps();
			await page.evaluate(() => window.inner.destroy());
			check('nested carousels: an arrow key and a wheel step in the inner carousel do not move the outer carousel', key.inner === 1 && key.outer === 0 && wheel.inner === 2 && wheel.outer === 0, JSON.stringify({ key, wheel }));
		}

		// An input in a shadow root: the event target is the host, but the input keeps its keys and its pointer
		await make({}, { html: '<span data-host style="display: block; padding: 10px"></span>' });
		{
			await page.evaluate(() => {
				document.querySelectorAll('#fixture [data-host]').forEach((host) => (host.attachShadow({ mode: 'open' }).innerHTML = '<input value="abc">'));
				const input = window.fixed.slideNodes()[0].querySelector('[data-host]').shadowRoot.querySelector('input');
				input.focus();
				input.setSelectionRange(0, 0);
			});
			await page.keyboard.press('ArrowRight');
			const key = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), caret: window.fixed.slideNodes()[0].querySelector('[data-host]').shadowRoot.activeElement.selectionStart }));
			const at = await page.evaluate(() => {
				const rect = window.fixed.slideNodes()[1].querySelector('[data-host]').getBoundingClientRect();
				return { x: rect.left + 30, y: rect.top + rect.height / 2 };
			});
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
			await moveBy(at, -100, 6);
			await page.mouse.up();
			const drags = await page.evaluate(() => window.counts.dragstart);
			check('an input in a shadow root keeps the arrow keys and the press', key.snap === 0 && key.caret === 1 && drags === 0, JSON.stringify({ key, drags }));
		}

		// A touch on an element in a slide that scrolls across the axis: a move along the axis moves the carousel, and a move across it scrolls the element
		await make({}, { html: '<div data-inner style="height: 100px; overflow-y: auto"><div style="height: 400px">%i</div></div>' });
		{
			const at = await point(1, '[data-inner]'),
				swipe = async (dx, dy) => {
					await page.touchscreen.touchStart(at.x, at.y);
					for (let step = 1; step <= 10; step++) {
						await page.touchscreen.touchMove(at.x + dx * step, at.y + dy * step);
					}
					await page.touchscreen.touchEnd();
					await wait(600);
				};
			await swipe(0, -6);
			const across = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), top: window.fixed.slideNodes()[1].querySelector('[data-inner]').scrollTop }));
			await swipe(-25, 0);
			const along = await page.evaluate(() => window.fixed.selectedSnap());
			check('touch: on an element that scrolls across the axis, a move along the axis moves the carousel, and a move across it scrolls the element', across.snap === 0 && across.top > 0 && along > 0, JSON.stringify({ across, along }));
		}

		// A touch move more across the axis than along it. Chrome cancels such a touch before the carousel gets it, so the check sends the events.
		await make();
		const across = await page.evaluate(() => {
			const slide = window.fixed.slideNodes()[0],
				send = (type, step) => slide.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: 150 - 3 * step, clientY: 50 - 4 * step, bubbles: true }));
			send('pointerdown', 0);
			for (let step = 1; step <= 10; step++) {
				send('pointermove', step);
			}
			send('pointerup', 10);
			return { drags: window.counts.dragstart, snap: window.fixed.selectedSnap() };
		});
		check('touch: a move more across the axis than along it does not drag', across.drags === 0 && across.snap === 0, JSON.stringify(across));

		// After a touch swipe, the browser sends no click, so the next click can come from the keyboard
		await make({}, { html: '<button type="button" data-click data-index="%i">%i</button>' });
		{
			const at = await center();
			await page.touchscreen.touchStart(at.x, at.y);
			for (let step = 1; step <= 10; step++) {
				await page.touchscreen.touchMove(at.x - 25 * step, at.y);
			}
			await page.touchscreen.touchEnd();
			await settled();
			await page.evaluate(() => window.fixed.slideNodes()[1].querySelector('button').focus());
			await page.keyboard.press('Enter');
			const keyed = await page.evaluate(() => ({ snap: window.fixed.selectedSnap(), clicked: window.clicked }));
			check('touch: after a swipe, the Enter key clicks a button in a slide', keyed.snap === 1 && keyed.clicked === '1', JSON.stringify(keyed));
		}
	}, { width: 1200, height: 900, hasTouch: true }],
	['loop drags', async ({ page, check, state, settle, scrollTo }) => {
		for (const [id, limit] of [['loop', 21], ['clones', 21]]) {
			for (const distance of [-1100, 1100]) {
				await scrollTo(id);
				await page.evaluate((id) => {
					window.stopSample = window.sample(window.byId(id));
				}, id);
				const start = await state(id),
					done = settle(id);
				await page.mouse.move(start.x, start.y);
				await page.mouse.down();
				for (let index = 1; index <= 40; index++) {
					await page.mouse.move(start.x + distance * index / 40, start.y);
					await wait(16);
				}
				await wait(150);
				await page.mouse.up();
				await done;
				const value = await page.evaluate(() => window.stopSample()),
					end = await state(id);
				check(id + ': a long drag of ' + distance + ' px shows no gap and aligns', value.gap <= limit && end.aligned, 'largest gap ' + value.gap.toFixed(1) + ' px, ' + JSON.stringify(end));
			}
		}
	}],
	['fill and skipSnaps', async ({ page, check, scrollTo, mouseDrag }) => {
		// clones: 'fill': the slides fill the window when the viewport overflow shows
		{
			const empty = () => page.evaluate(async () => {
				const carousel = window.byId('fill'),
					gaps = () => {
						const list = [...carousel.containerNode().children].map((node) => node.getBoundingClientRect()).sort((a, b) => a.left - b.left);
						let at = 0,
							gap = 0;
						for (const rect of list) {
							gap = Math.max(gap, rect.left - at);
							at = Math.max(at, rect.right);
						}
						return Math.round(Math.max(gap, document.documentElement.clientWidth - at));
					};
				let gap = gaps();
				for (let step = 0; step < 4; step++) {
					carousel.goToNext();
					const begin = performance.now();
					while (performance.now() - begin < 600) {
						await new Promise(requestAnimationFrame);
						gap = Math.max(gap, gaps());
					}
				}
				return { clones: carousel.containerNode().children.length - carousel.slideNodes().length, gap };
			});
			await scrollTo('fill');
			const small = await empty();
			await page.setViewport({ width: 1920, height: 900 });
			await wait(300);
			const large = await empty();
			check("clones: 'fill': no empty space in the window during the motion, and a window resize adds clones", small.gap <= 20 && large.gap <= 20 && large.clones > small.clones && small.clones > 0, JSON.stringify({ small, large }));
		}

		// skipSnaps as a number: one flick goes at most this number of snaps
		{
			await scrollTo('start');
			await page.evaluate(async () => {
				const carousel = window.byId('start');
				carousel.reinit({ skipSnaps: 1, arrows: true, dots: true });
				await new Promise((resolve) => carousel.on('reinit', resolve));
				carousel.goToSnap(0, true);
			});
			const limited = await mouseDrag('start', -500, true);
			check('skipSnaps: 1: a long flick goes one snap only', limited.snap === 1 && limited.aligned, JSON.stringify(limited));
			await page.evaluate(async () => {
				const carousel = window.byId('start');
				carousel.reinit({ skipSnaps: true });
				await new Promise((resolve) => carousel.on('reinit', resolve));
			});
		}

	}],
	['loop trace', async ({ page, check, lateImages, scrollTo }) => {
		// Trace of 10 arrow clicks: the motion runs on the compositor
		{
			await scrollTo('start');
			// No arrows and dots: their CSS transitions are not part of this check
			await page.evaluate(async () => {
				const carousel = window.byId('start');
				carousel.reinit({ arrows: false, dots: false });
				await new Promise((resolve) => carousel.on('reinit', resolve));
			});
			await lateImages();
			await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.animations'] });
			await page.evaluate(async () => {
				const carousel = window.byId('start');
				for (let index = 0; index < 10; index++) {
					if (index === 5) {
						carousel.goToSnap(0, true);
					}
					carousel.goToNext();
					await new Promise((resolve) => setTimeout(resolve, 450));
				}
			});
			const data = JSON.parse(new TextDecoder().decode(await page.tracing.stop()));
			const events = data.traceEvents,
				main = events.find((event) => event.name === 'thread_name' && event.args.name === 'CrRendererMain' && events.some((item) => item.pid === event.pid && item.name === 'FireAnimationFrame' || item.pid === event.pid && item.name === 'TimerFire')),
				list = events.filter((event) => event.pid === main?.pid && event.tid === main?.tid),
				count = (name) => list.filter((event) => event.name === name && event.ph !== 'E').length,
				failed = events.filter((event) => event.name === 'Animation' && event.args?.data?.compositeFailed).map((event) => (event.args.data.name || '(none)') + ':' + event.args.data.compositeFailed);
			const waapi = { animations: events.filter((event) => event.name === 'Animation' && event.ph === 'b').length, frames: count('FireAnimationFrame'), styles: count('UpdateLayoutTree'), layouts: count('Layout'), paints: count('Paint'), failed };
			check('10 arrow clicks: no JS per frame, and the animation is composited', waapi.frames === 0 && waapi.animations > 0 && !waapi.failed.length, JSON.stringify(waapi));
		}

		{
			const counts = await page.evaluate(() => ['loop', 'loopcenter', 'clones', 'gallery'].map((id) => {
				const carousel = window.byId(id);
				return [id, carousel.containerNode().children.length, carousel.slideNodes().length, carousel.snapProgress().length];
			}));
			const map = Object.fromEntries(counts.map(([id, ...rest]) => [id, rest]));
			check('clone counts: none for 10 and 8 slides and the grid, one copy for 3 wide slides', map.loop[0] === 10 && map.loopcenter[0] === 8 && map.gallery[0] === 20 && map.clones[0] === 6 && map.clones[2] === 3, JSON.stringify(map));
		}

		{
			const value = await page.evaluate(async () => {
				const carousel = window.byId('clones'),
					container = carousel.containerNode();
				container.style.setProperty('--columns-count', '3');
				await new Promise((resolve) => setTimeout(resolve, 300));
				const fit = [container.children.length, carousel.isFit()];
				container.style.removeProperty('--columns-count');
				await new Promise((resolve) => setTimeout(resolve, 300));
				return { fit, back: [container.children.length, carousel.isFit()] };
			});
			check('clones go away when the slides fit, and come back', value.fit[0] === 3 && value.fit[1] && value.back[0] === 6 && !value.back[1], JSON.stringify(value));
		}
	}],
	['auto scroll and height', async ({ page, check, state, scrollTo, show }) => {
		// Auto scroll
		{
			await show('logos');
			// The auto scroll starts 1 s after the carousel comes into view
			await page.waitForFunction(() => window.byId('logos').containerNode().getAnimations().length, { timeout: 3000 }).catch(() => {});
			const info = await page.evaluate(() => {
				const carousel = window.byId('logos');
				return { playing: carousel.autoScroll.isPlaying(), animations: carousel.containerNode().getAnimations().length, clones: carousel.containerNode().children.length - carousel.slideNodes().length };
			});
			check('auto scroll: plays after its delay, with clones for few logos', info.playing && info.animations === 1 && info.clones > 0, JSON.stringify(info));

			// The largest empty space in the viewport on each frame for 1 s
			const gap = await page.evaluate(async () => {
				const carousel = window.byId('logos'),
					view = carousel.viewportNode().getBoundingClientRect(),
					nodes = [...carousel.containerNode().children];
				let worst = 0;
				const begin = performance.now();
				while (performance.now() - begin < 1000) {
					await new Promise(requestAnimationFrame);
					const list = nodes.map((node) => node.getBoundingClientRect()).filter((rect) => rect.right > view.left && rect.left < view.right).sort((a, b) => a.left - b.left);
					let at = view.left;
					for (const rect of list) {
						worst = Math.max(worst, rect.left - at);
						at = Math.max(at, rect.right);
					}
					worst = Math.max(worst, view.right - at);
				}
				return Math.round(worst);
			});
			check('auto scroll: no empty space and no jump on each frame for 1 s', gap <= 21, gap + ' px');

			// A trace: no script on each frame
			await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
			await wait(1000);
			const data = JSON.parse(new TextDecoder().decode(await page.tracing.stop()));
			const events = data.traceEvents,
				main = events.find((event) => event.name === 'thread_name' && event.args.name === 'CrRendererMain' && events.some((item) => item.pid === event.pid && item.name === 'ParseHTML' || item.pid === event.pid && item.name === 'Layout' || item.pid === event.pid && item.name === 'TimerFire')),
				list = events.filter((event) => event.pid === main?.pid && event.tid === main?.tid),
				count = (name) => list.filter((event) => event.name === name && event.ph !== 'E').length;
			const trace = { frames: count('FireAnimationFrame'), timers: count('TimerFire'), layouts: count('Layout'), scripts: count('FunctionCall') };
			check('auto scroll: a 1 s trace has no rAF frames, timers or layouts', trace.frames === 0 && trace.timers === 0 && trace.layouts === 0, JSON.stringify(trace));

			// A drag during the auto scroll starts from the location that shows, with no jump
			const start = await state('logos');
			const before = await page.evaluate(() => window.byId('logos').containerNode().children[0].getBoundingClientRect().left);
			await page.mouse.move(start.x, start.y);
			await page.mouse.down();
			await page.mouse.move(start.x - 12, start.y);
			await wait(50);
			const during = await page.evaluate(() => ({ left: window.byId('logos').containerNode().children[0].getBoundingClientRect().left, animations: window.byId('logos').containerNode().getAnimations().length }));
			await page.mouse.up();
			await wait(600);
			check('auto scroll: a drag stops it at the location that shows, with no jump', during.animations === 0 && Math.abs(during.left - before) < 40, JSON.stringify({ before, during }));
			const after = await page.evaluate(() => window.byId('logos').autoScroll.isPlaying());
			check('auto scroll: a drag stops it (stopOnInteraction)', !after, String(after));

			// With stopOnInteraction: false, an instant goToSnap() pauses it, and it plays again after startDelay
			const again = await page.evaluate(async () => {
				const carousel = window.byId('logos');
				carousel.reinit({ autoScroll: { speed: 60, stopOnInteraction: false, startDelay: 300 } });
				await new Promise((resolve) => carousel.on('reinit', resolve));
				await new Promise((resolve) => setTimeout(resolve, 500));
				carousel.goToSnap(2, true);
				const stopped = carousel.containerNode().getAnimations().length;
				await new Promise((resolve) => setTimeout(resolve, 600));
				return { stopped, playing: carousel.autoScroll.isPlaying(), animations: carousel.containerNode().getAnimations().length };
			});
			check('auto scroll: an instant goToSnap() with stopOnInteraction: false starts it again after startDelay', again.stopped === 0 && again.playing && again.animations === 1, JSON.stringify(again));
		}

		// Auto height
		{
			await scrollTo('height');
			const value = await page.evaluate(async () => {
				const carousel = window.byId('height'),
					viewport = carousel.viewportNode(),
					slide = (index) => Math.round(carousel.slideNodes()[index].getBoundingClientRect().height),
					first = Math.round(parseFloat(viewport.style.height));
				// The height transition runs during the motion. Each frame of it calls the ResizeObserver, and measure() reads the rects of the moving slides.
				let resized = 0;
				const count = () => resized++;
				carousel.on('resize', count);
				carousel.goToSnap(1);
				await new Promise((resolve) => setTimeout(resolve, 100));
				const middle = viewport.getBoundingClientRect().height;
				await new Promise((resolve) => setTimeout(resolve, 600));
				const last = Math.round(parseFloat(viewport.style.height));
				carousel.goToSnap(0);
				await new Promise((resolve) => setTimeout(resolve, 700));
				carousel.off('resize', count);
				return { first, wide: slide(0), last, square: slide(1), middle, resized, transition: getComputedStyle(viewport).transitionProperty };
			});
			check('auto height: the viewport gets the height of the slide in view, with a transition', value.first === value.wide && value.last === value.square && value.wide < value.square && value.middle > value.wide && value.middle < value.square && value.transition.includes('height'), JSON.stringify(value));
			check('auto height: the height transition during a motion causes no measure pass', value.resized === 0, JSON.stringify(value));
		}
	}],
	['navigation', async ({ page, check, idle, scrollTo }) => {
		// Navigation, classes, sync and accessibility

		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('embla'),
					root = carousel.rootNode(),
					names = (node) => node ? node.className : null;
				carousel.goToSnap(0, true);
				return {
					root: names(root),
					viewport: names(carousel.viewportNode()),
					container: carousel.containerNode().classList.contains('embla_container'),
					buttons: [...root.querySelectorAll(':scope > button')].map(names),
					dots: names(root.querySelector(':scope > .embla_dots')),
					dot: names(root.querySelector('.embla_dot')),
					active: names(carousel.slideNodes()[0])
				};
			});
			check('embla preset: the class names of the old wrapper', value.root === 'embla embla_horizontal' && value.viewport === 'embla_viewport' && value.container && value.buttons.join() === 'embla_button embla_prev,embla_button embla_next' && value.dots === 'embla_dots' && value.dot.startsWith('embla_dot') && value.active === 'item is_selected', JSON.stringify(value));
		}

		{
			await scrollTo('embla');
			const value = await page.evaluate(async () => {
				const carousel = window.byId('embla'),
					dots = [...carousel.rootNode().querySelectorAll('.embla_dot')];
				carousel.goToSnap(6, true);
				await new Promise((resolve) => setTimeout(resolve, 500));
				let changes = 0;
				const observer = new MutationObserver((list) => {
					changes += list.length;
				});
				dots.forEach((dot) => observer.observe(dot, { attributes: true, attributeFilter: ['class'] }));
				carousel.goToNext(true);
				await new Promise((resolve) => setTimeout(resolve, 500));
				observer.disconnect();
				const marked = dots.filter((dot) => /first|prev|current|next|last/.test(dot.className)),
					box = carousel.rootNode().querySelector('.embla_dots').getBoundingClientRect(),
					inside = (dot) => {
						const rect = dot.getBoundingClientRect();
						return rect.left >= box.left - 1 && rect.right <= box.right + 1;
					},
					current = dots.find((dot) => dot.getAttribute('aria-current') === 'true').getBoundingClientRect();
				return {
					count: dots.length,
					marked: marked.map((dot) => dot.className.replace('embla_dot ', '')).join(),
					hidden: dots.filter((dot) => !marked.includes(dot)).every((dot) => dot.tabIndex === -1 && (!inside(dot) || getComputedStyle(dot, ':before').transform === 'matrix(0, 0, 0, 0, 0, 0)')),
					shown: marked.every(inside),
					centered: Math.abs((current.left + current.right) / 2 - (box.left + box.right) / 2) < 1,
					tabbable: marked.every((dot) => dot.tabIndex === 0),
					current: dots.findIndex((dot) => dot.getAttribute('aria-current') === 'true'),
					changes
				};
			});
			check('dots: 5 dots around the current dot have state classes', value.count === 15 && value.marked === 'is_first,is_prev,is_current,is_next,is_last' && value.current === 7, JSON.stringify(value));
			check('dots: the 5 dots show in the window with the current dot in the center, and the other dots do not show and are out of the tab order', value.hidden && value.shown && value.centered && value.tabbable, JSON.stringify(value));
			check('dots: one select changes no more than 10 class lists', value.changes <= 10, value.changes + ' changes');
		}

		// The arrow keys: the right arrow goes to the next slide and the left arrow back, while the focus is in the carousel
		{
			await page.evaluate(() => {
				const carousel = window.byId('embla');
				carousel.goToSnap(2, true);
				carousel.rootNode().querySelector('.embla_next').focus();
			});
			await page.keyboard.press('ArrowRight');
			const next = await page.evaluate(() => window.byId('embla').selectedSnap());
			await page.keyboard.press('ArrowLeft');
			await page.keyboard.press('ArrowLeft');
			const prev = await page.evaluate(() => window.byId('embla').selectedSnap());
			await page.evaluate(() => document.activeElement.blur());
			check('arrow keys: the right arrow goes to the next slide, the left arrow to the previous slide', next === 3 && prev === 1, JSON.stringify({ next, prev }));
		}

		// dotsStyle: 'all'
		{
			const value = await page.evaluate(async () => {
				const carousel = window.byId('embla');
				carousel.reinit({ dotsStyle: 'all' });
				carousel.goToSnap(6, true);
				await new Promise((resolve) => setTimeout(resolve, 500));
				const root = carousel.rootNode(),
					box = root.querySelector('.embla_dots').getBoundingClientRect(),
					dots = [...root.querySelectorAll('.embla_dot')],
					marker = root.querySelector('.embla_dots_marker').getBoundingClientRect(),
					current = dots.find((dot) => dot.getAttribute('aria-current') === 'true').getBoundingClientRect(),
					result = {
						all: root.querySelector('.embla_dots').classList.contains('embla_dots_all'),
						inside: dots.every((dot) => {
							const rect = dot.getBoundingClientRect();
							return rect.left >= box.left - 1 && rect.right <= box.right + 1;
						}),
						sizes: [...new Set(dots.map((dot) => getComputedStyle(dot, ':before').transform))].length,
						marker: Math.abs((marker.left + marker.right) / 2 - (current.left + current.right) / 2) < 1,
						tabbable: dots.every((dot) => dot.tabIndex === 0)
					};
				carousel.reinit({ dotsStyle: 'zoom' });
				await new Promise((resolve) => setTimeout(resolve, 100));
				return result;
			});
			check("dotsStyle 'all': all dots show in the window with one size, the marker is on the current dot, and all dots are in the tab order", value.all && value.inside && value.sizes === 1 && value.marker && value.tabbable, JSON.stringify(value));
		}

		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('embla');
				carousel.goToSnap(1, true);
				const result = [carousel.slideNodes()[1].className, carousel.rootNode().querySelector('.is_current')?.className];
				carousel.goToSnap(0, true);
				return result;
			});
			check('state prefix: is_selected and is_current', value[0] === 'item is_selected' && value[1] === 'embla_dot is_current', JSON.stringify(value));
		}

		{
			const value = await page.evaluate(() => document.querySelectorAll('#heading .heading > .better_button').length);
			check('arrows go into the heading outside the carousel', value === 2, value + ' buttons');
		}

		{
			await scrollTo('product');
			await page.evaluate(() => document.querySelector('#product').scrollIntoView({ block: 'start', behavior: 'instant' }));
			const thumb = await page.evaluate(() => {
				const rect = window.byId('product', 1).slideNodes()[3].getBoundingClientRect();
				return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
			});
			await page.mouse.click(thumb.x, thumb.y);
			await idle('product');
			const value = await page.evaluate(() => {
				const main = window.byId('product'),
					thumbs = window.byId('product', 1);
				return { main: main.selectedSlide(), thumbs: thumbs.selectedSlide(), active: thumbs.slideNodes().findIndex((node) => node.classList.contains('selected')), mainBox: Math.abs(window.box(main).start) };
			});
			check('sync: a click on thumbnail 4 selects photo 4 and marks the thumbnail', value.main === 3 && value.thumbs === 3 && value.active === 3 && value.mainBox <= 0.5, JSON.stringify(value));

			await page.evaluate(() => window.byId('product').goToNext());
			await idle('product');
			const next = await page.evaluate(() => {
				const thumbs = window.byId('product', 1);
				return { thumbs: thumbs.selectedSlide(), active: thumbs.slideNodes().findIndex((node) => node.classList.contains('selected')), center: Math.abs(window.box(thumbs).center) };
			});
			check('sync: the next photo moves the thumbnails to its centered thumbnail', next.thumbs === 4 && next.active === 4 && next.center <= 0.5, JSON.stringify(next));

			// A drag on the thumbnails moves only the thumbnails: the photo and the marked thumbnail stay
			await page.evaluate(() => window.byId('product', 1).viewportNode().scrollIntoView({ block: 'center', behavior: 'instant' }));
			const strip = await page.evaluate(() => {
				const rect = window.byId('product', 1).viewportNode().getBoundingClientRect();
				return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
			});
			await page.mouse.move(strip.x, strip.y);
			await page.mouse.down();
			for (let step = 1; step <= 20; step++) {
				await page.mouse.move(strip.x + step * 20, strip.y);
				await wait(16);
			}
			await page.mouse.up();
			await idle('product');
			const dragged = await page.evaluate(() => {
				const main = window.byId('product'),
					thumbs = window.byId('product', 1);
				return { main: main.selectedSlide(), thumbs: thumbs.selectedSlide(), snap: thumbs.selectedSnap(), active: thumbs.slideNodes().findIndex((node) => node.classList.contains('selected')) };
			});
			check('sync: a drag on the thumbnails does not change the photo or the marked thumbnail', dragged.main === 4 && dragged.thumbs === 4 && dragged.active === 4 && dragged.snap === 0, JSON.stringify(dragged));
		}

		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('end'),
					root = carousel.rootNode(),
					slide = carousel.slideNodes()[1],
					link = window.byId('drag').slideNodes()[0],
					id = carousel.containerNode().id,
					buttons = [...root.querySelectorAll(':scope > button')];
				carousel.goToSnap(0, true);
				return {
					root: [root.getAttribute('role'), root.getAttribute('aria-roledescription'), root.getAttribute('aria-label')].join(),
					slide: [slide.getAttribute('role'), slide.getAttribute('aria-roledescription'), slide.getAttribute('aria-label')].join(),
					link: link.hasAttribute('role') || link.hasAttribute('aria-roledescription'),
					live: carousel.containerNode().getAttribute('aria-live'),
					controls: buttons.every((button) => button.getAttribute('aria-controls') === id && !!document.getElementById(id) && button.getAttribute('aria-label')),
					disabled: buttons.map((button) => button.disabled).join()
				};
			});
			check('a11y: the carousel region, the slide groups and their names', value.root === 'region,carousel,Carousel' && value.slide === 'group,slide,2 of 8' && !value.link && value.live === 'polite', JSON.stringify(value));
			check('a11y: the buttons have names, control the container, and the prev button is disabled at the start', value.controls && value.disabled === 'true,false', JSON.stringify(value));
		}
	}],
	['callbacks', async ({ page, check }) => {
		// Callbacks that stop a motion, auto height with dragFree, and the auto scroll location after pauses. Each carousel has 300 px slides
		// with a 10 px gap in a 600 px viewport.

		const value = await page.evaluate(async () => {
			const errors = [],
				wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
				make = (heights, options) => {
					const box = document.createElement('div'),
						container = document.createElement('div');
					box.style.width = '600px';
					container.style.cssText = 'display: flex; gap: 10px; align-items: flex-start';
					heights.forEach((height) => {
						const slide = document.createElement('div');
						slide.style.cssText = 'flex: 0 0 300px; height: ' + height + 'px';
						container.append(slide);
					});
					box.append(container);
					document.body.prepend(box);
					return BetterCarousel(container, options);
				};

			// The auto height sets the viewport height in the ResizeObserver callback, and the browser sends a notice about it. It is not an error.
			addEventListener('error', (event) => event.message.startsWith('ResizeObserver loop') || errors.push(event.message));

			// A "progress" callback that destroys the carousel during a motion on the compositor
			let calls = 0;
			const destroyed = make(Array(6).fill(100), {
				progress: () => {
					if (++calls === 4) {
						destroyed.destroy();
					}
				}
			});
			await wait(300);
			destroyed.goToSnap(2);

			// A "scroll" handler that jumps during a motion
			const jumped = make(Array(6).fill(100), {});
			await wait(300);
			jumped.on('scroll', () => jumped.selectedSnap() && jumped.goToSnap(0, true));
			jumped.goToSnap(2);
			await wait(800);

			// A wheel move of 100 px brings the 300 px slide into view, and the nearest snap stays 0
			const tall = make([100, 100, 300, 100, 100, 100], { autoHeight: true, dragFree: true, wheel: 'both' });
			await wait(300);
			tall.viewportNode().dispatchEvent(new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true }));
			await wait(700);

			// Six pauses of a loop auto scroll. The period is 6 * 310 px.
			const looped = make(Array(6).fill(100), { loop: true, autoScroll: { speed: 2000, startDelay: 0, pauseOnHover: true } }),
				root = looped.rootNode(),
				translates = [];
			await wait(500);
			for (let index = 0; index < 6; index++) {
				root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
				await wait(100);
				translates.push(parseFloat(looped.containerNode().style.translate));
				root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
				await wait(400);
			}

			return { errors, calls, jumped: jumped.selectedSnap(), height: tall.viewportNode().style.height, snap: tall.selectedSnap(), translates };
		});

		check('callbacks: a "progress" callback that destroys the carousel, and a "scroll" handler that jumps, cause no errors', !value.errors.length && value.calls === 4 && value.jumped === 0, JSON.stringify(value));
		check('auto height: a dragFree wheel move that keeps the snap changes the height to the slides in view', value.height === '300px' && value.snap === 0, JSON.stringify(value));
		check('auto scroll: the location stays in the first two periods after each pause', value.translates.every((translate) => translate > -2 * 1860 && translate <= 0), JSON.stringify(value.translates));
	}],
	['autoplay', async ({ page, check, show }) => {
		await show('autoplay');
		const read = () => page.evaluate(() => {
			const carousel = window.byId('autoplay'),
				button = carousel.rootNode().querySelector('.better_play');
			return { slide: carousel.selectedSlide(), playing: carousel.autoplay.isPlaying(), live: carousel.containerNode().getAttribute('aria-live'), label: button.getAttribute('aria-label'), state: carousel.rootNode().classList.contains('playing') };
		});
		const first = await read();
		// A short delay, so that the checks do not wait for the 2 s delay of the demo. The timer starts at "settle", and a motion takes 400 ms,
		// so the slide changes at 300 ms and again at 1000 ms. A read at 700 ms is between them.
		await page.evaluate(() => {
			const carousel = window.byId('autoplay');
			window.autoplayOptions = carousel.options().autoplay;
			carousel.reinit({ autoplay: { ...window.autoplayOptions, delay: 300 } });
			return new Promise((resolve) => carousel.on('reinit', resolve));
		});
		await wait(700);
		const second = await read();
		check('autoplay: plays at init, goes to the next slide after the delay, aria-live is off', first.playing && first.live === 'off' && first.state && first.label === 'Stop the slide show' && second.slide === 1, JSON.stringify({ first, second }));

		// Slide 3 has data-delay 6000
		await page.evaluate(() => {
			window.byId('autoplay').goToSnap(2, true);
			window.byId('autoplay').autoplay.play();
		});
		await wait(700);
		const slow = await read();
		check('autoplay: data-delay on a slide changes its delay', slow.slide === 2, JSON.stringify(slow));

		// Out of view: the autoplay pauses
		await page.evaluate(() => {
			window.byId('autoplay').goToSnap(0, true);
			window.byId('autoplay').autoplay.play();
			// The page has scroll-behavior: smooth, and a smooth scroll can still run when the test scrolls back
			scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
		});
		await wait(700);
		const away = await read();
		await show('autoplay');
		await wait(700);
		const back = await read();
		check('autoplay: pauses out of view and plays again in view', away.slide === 0 && back.slide === 1, JSON.stringify({ away, back }));

		// The keyboard focus in the root pauses it
		await page.evaluate(() => {
			window.byId('autoplay').goToSnap(0, true);
			window.byId('autoplay').autoplay.play();
			window.byId('autoplay').rootNode().querySelector('.better_next').focus({ focusVisible: true });
		});
		await wait(700);
		const focused = await read();
		await page.evaluate(() => document.activeElement.blur());
		check('autoplay: the keyboard focus in the carousel pauses it', focused.slide === 0 && focused.playing, JSON.stringify(focused));

		// The stop button
		await page.evaluate(() => window.byId('autoplay').rootNode().querySelector('.better_play').click());
		const stopped = await read();
		await wait(700);
		const still = await read();
		check('autoplay: the button stops it, aria-live is polite, and the button name changes', !stopped.playing && stopped.live === 'polite' && !stopped.state && stopped.label === 'Start the slide show' && still.slide === stopped.slide, JSON.stringify({ stopped, still }));

		// An arrow click stops it (stopOnInteraction)
		await page.evaluate(() => window.byId('autoplay').autoplay.play());
		await page.evaluate(() => window.byId('autoplay').rootNode().querySelector('.better_next').click());
		const clicked = await read();
		check('autoplay: an arrow click stops it', !clicked.playing, JSON.stringify(clicked));

		// The demo options again, for the timer bar check in the examples
		await page.evaluate(() => {
			const carousel = window.byId('autoplay');
			carousel.reinit({ autoplay: window.autoplayOptions });
			return new Promise((resolve) => carousel.on('reinit', resolve));
		});

		// The timer callback gets the delay of each timer. Its cleanup function runs when the timer ends and when the autoplay stops.
		const calls = await page.evaluate(async () => {
			const element = document.createElement('div'),
				list = [];
			element.style.display = 'flex';
			element.innerHTML = '<div style="flex: 0 0 50%">1</div><div style="flex: 0 0 50%">2</div><div style="flex: 0 0 50%">3</div>';
			window.byId('autoplay').rootNode().after(element);
			const carousel = BetterCarousel(element, { autoplay: { delay: 300, timer: (delay) => {
				list.push(delay);
				return () => list.push('end');
			} } });
			await new Promise((resolve) => setTimeout(resolve, 1000));
			carousel.autoplay.stop();
			carousel.destroy();
			element.remove();
			return list;
		});
		check('autoplay: the timer callback gets the delay, and its cleanup runs at the end of each timer and at the stop', calls.length >= 4 && calls.every((item, index) => item === (index % 2 ? 'end' : 300)) && calls.length % 2 === 0, JSON.stringify(calls));
	}],
	['widths', async ({ page, check, lateImages, scrollTo }) => {
		// Centered slides with dynamic widths
		await page.evaluate(() => window.byId('autocenter').goToSlide(3, true));
		await lateImages();
		const late = await page.evaluate(() => {
			const carousel = window.byId('autocenter');
			return { slide: carousel.selectedSlide(), center: Math.round(window.box(carousel).center), width: Math.round(carousel.slideNodes()[3].getBoundingClientRect().width) };
		});
		check('dynamic widths: the selected slide stays in the center when late images change the widths', late.slide === 3 && Math.abs(late.center) <= 1 && late.width > 400, JSON.stringify(late));

		await scrollTo('grow');
		const grow = await page.evaluate(async () => {
			const carousel = window.byId('grow'),
				rows = [];
			for (let step = 0; step < 3; step++) {
				carousel.goToNext();
				const target = carousel.selectedSlide(),
					begin = performance.now(),
					node = carousel.slideNodes()[target],
					offset = () => {
						const view = carousel.viewportNode().getBoundingClientRect(),
							rect = node.getBoundingClientRect();
						return rect.left + rect.width / 2 - view.left - view.width / 2;
					};
				// The largest speed between two frames, in px/ms, so that a dropped frame is not a jump
				let last = offset(),
					time = begin,
					jump = 0;
				while (performance.now() - begin < 900) {
					const now = await new Promise(requestAnimationFrame),
						value = offset();
					jump = Math.max(jump, Math.abs(value - last) / (now - time));
					last = value;
					time = now;
				}
				rows.push({ target, center: Math.round(last), jump: +jump.toFixed(2) });
			}
			return rows;
		});
		check('a selected slide that grows: the motion does not jump and ends in the center', grow.every((row) => Math.abs(row.center) <= 1 && row.jump < 4), JSON.stringify(grow));
	}],
	['touch', async ({ page, check, state, settle, scrollTo }) => {
		await scrollTo('drag');
		const touch = async (dx, dy) => {
			const start = await state('drag');
			await page.touchscreen.touchStart(start.x, start.y);
			for (let index = 1; index <= 10; index++) {
				await page.touchscreen.touchMove(start.x + dx * index / 10, start.y + dy * index / 10);
				await wait(16);
			}
			await wait(150);
			await page.touchscreen.touchEnd();
		};
		const done = settle('drag');
		await touch(-250, 0);
		await done;
		const horizontal = await state('drag');
		check('touch drag: a swipe past half a snap goes to the next snap', horizontal.snap === 1 && horizontal.aligned, JSON.stringify(horizontal));

		const before = await page.evaluate(() => scrollY);
		await touch(0, -200);
		await wait(400);
		const after = await page.evaluate(() => scrollY),
			vertical = await state('drag');
		check('touch move across the axis scrolls the page', after > before && vertical.snap === 1, before + ' to ' + after);
	}, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
	['controls', async ({ page, check, idle, scrollTo }) => {
		// Controls in slides
		await scrollTo('controls');
		await page.evaluate(() => {
			window.byId('controls').goToSnap(0, true);
			document.querySelector('#controls h2').setAttribute('tabindex', '-1');
			document.querySelector('#controls h2').focus();
		});
		const seen = [];
		for (let index = 0; index < 13; index++) {
			await page.keyboard.press('Tab');
			await idle('controls');
			seen.push(await page.evaluate(() => {
				const carousel = window.byId('controls'),
					view = carousel.viewportNode().getBoundingClientRect(),
					node = document.activeElement,
					rect = node.getBoundingClientRect();
				return { name: node.textContent.trim() || node.getAttribute('aria-label') || node.name, inside: carousel.rootNode().contains(node), shown: rect.left >= view.left - 1 && rect.right <= view.right + 1, scroll: carousel.viewportNode().scrollLeft };
			}));
		}
		const slides = seen.filter((item) => item.inside && !/slide/.test(item.name));
		check('controls: Tab reaches each control in the slides, and the carousel shows it', slides.length >= 12 && slides.every((item) => item.shown && item.scroll === 0), JSON.stringify(seen.filter((item) => !item.shown || item.scroll)));

		const names = await page.evaluate(() => [...document.querySelectorAll('#controls a, #controls button, #controls input')].filter((node) => !node.closest('.clone')).every((node) => (node.textContent.trim() || node.getAttribute('aria-label') || node.labels?.[0]?.textContent.trim() || '').length > 0));
		check('controls: each link, button and field has a name', names, String(names));

		// An article does not permit the "group" role. It keeps its own role and gets the slide description and the name.
		const article = await page.evaluate(() => {
			const node = window.byId('controls').slideNodes()[1];
			return [node.tagName, node.getAttribute('role'), node.getAttribute('aria-roledescription'), node.getAttribute('aria-label')].join();
		});
		check('controls: an article slide keeps its own role', article === 'ARTICLE,,slide,2 of 6', article);

		// A click on the field focuses it, and a drag that starts on it does not move the carousel
		await page.evaluate(() => window.byId('controls').goToSnap(0, true));
		const field = await page.evaluate(() => {
			const rect = document.querySelector('#controls input').getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		});
		await page.mouse.click(field.x, field.y);
		await page.keyboard.type('a@b.c');
		await page.mouse.move(field.x, field.y);
		await page.mouse.down();
		await page.mouse.move(field.x - 200, field.y, { steps: 8 });
		await page.mouse.up();
		await idle('controls');
		const typed = await page.evaluate(() => ({ focused: document.activeElement === document.querySelector('#controls input'), value: document.querySelector('#controls input').value, snap: window.byId('controls').selectedSnap() }));
		check('controls: a click focuses the field, typing works, and a drag on the field does not move the carousel', typed.focused && typed.value === 'a@b.c' && typed.snap === 0, JSON.stringify(typed));

		// A click on a button works, and a drag that starts on a button does not click it
		const like = await page.evaluate(() => {
			const rect = document.querySelector('#controls .demo_like').getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		});
		await page.mouse.click(like.x, like.y);
		const pressed = await page.evaluate(() => document.querySelector('#controls .demo_like').getAttribute('aria-pressed'));
		await page.mouse.move(like.x, like.y);
		await page.mouse.down();
		await page.mouse.move(like.x - 200, like.y, { steps: 8 });
		await page.mouse.up();
		await idle('controls');
		const dragged = await page.evaluate(() => ({ pressed: document.querySelector('#controls .demo_like').getAttribute('aria-pressed'), snap: window.byId('controls').selectedSnap() }));
		check('controls: a click on a button works, and a drag from it moves the carousel and does not click it', pressed === 'true' && dragged.pressed === 'true' && dragged.snap > 0, JSON.stringify({ pressed, dragged }));

		// Clones: hidden from screen readers and out of the tab order
		const clones = await page.evaluate(() => [...document.querySelectorAll('.clone')].map((node) => ({ inert: node.inert, hidden: node.getAttribute('aria-hidden'), ids: node.querySelectorAll('[id]').length + (node.id ? 1 : 0) })));
		check('clones: inert, aria-hidden and no ids', clones.length > 0 && clones.every((item) => item.inert && item.hidden === 'true' && !item.ids), JSON.stringify(clones.slice(0, 2)));
	}],
	['other', async ({ page, check, scrollTo }) => {
		// The other cases: right to left, several slides per snap, empty space at the ends, hidden at the start, slide changes, custom controls,
		// lazy images and responsive options
		await scrollTo('rtl');
		const rtl = await page.evaluate(async () => {
			const carousel = window.byId('rtl'),
				root = carousel.rootNode(),
				box = carousel.viewportNode().getBoundingClientRect(),
				right = (index) => Math.round(box.right - carousel.slideNodes()[index].getBoundingClientRect().right),
				first = right(0),
				prev = root.querySelector('.better_prev').getBoundingClientRect(),
				next = root.querySelector('.better_next');
			next.click();
			await new Promise((resolve) => carousel.on('settle', resolve));
			const second = right(1);
			carousel.goToSnap(3, true);
			// The dots move with a transition of 0.4 s
			await new Promise((resolve) => setTimeout(resolve, 600));
			const dots = root.querySelector('.better_dots').getBoundingClientRect(),
				current = root.querySelector('.better_dot[aria-current="true"]').getBoundingClientRect();
			carousel.goToSnap(0, true);
			return { first, second, prev: prev.left > next.getBoundingClientRect().left, dot: Math.round((current.left + current.right) / 2 - (dots.left + dots.right) / 2) };
		});
		check('right to left: the first slide is at the right, the next button shows the next slide there, the previous button is at the right, and the current dot is in the center', Math.abs(rtl.first) <= 1 && Math.abs(rtl.second) <= 1 && rtl.prev && Math.abs(rtl.dot) <= 1, JSON.stringify(rtl));

		await scrollTo('groups');
		const groups = await page.evaluate(() => {
			const carousel = window.byId('groups'),
				count = carousel.snapProgress().length;
			carousel.goToNext(true);
			const slide = carousel.selectedSlide();
			carousel.goToSnap(0, true);
			return { count, slide };
		});
		check('slidesPerSnap: auto: one snap for each page of 4 slides', groups.count === 3 && groups.slide === 4, JSON.stringify(groups));

		await scrollTo('contain');
		const contain = await page.evaluate(() => {
			const free = window.byId('contain', 0),
				keep = window.byId('contain', 1),
				box = free.viewportNode().getBoundingClientRect(),
				slide = free.slideNodes()[0].getBoundingClientRect();
			return { center: Math.round((slide.left + slide.right) / 2 - (box.left + box.right) / 2), snaps: [free.snapProgress().length, keep.snapProgress().length], same: keep.snapProgress()[0] === keep.snapProgress()[1] };
		});
		check('containScroll: false centers the first slide, and keepSnaps keeps a snap for each slide', Math.abs(contain.center) <= 1 && contain.snaps.join() === '7,7' && contain.same, JSON.stringify(contain));

		await scrollTo('hidden');
		const hidden = await page.evaluate(async () => {
			const carousel = window.byId('hidden'),
				before = carousel.isFit();
			document.getElementById('tab-photos').click();
			await new Promise((resolve) => setTimeout(resolve, 300));
			const after = { fit: carousel.isFit(), snaps: carousel.snapProgress().length, buttons: carousel.rootNode().querySelectorAll('.better_button').length };
			document.getElementById('tab-text').click();
			return { before, ...after };
		});
		check('hidden at the start: the carousel starts to move when its tab shows', hidden.before && !hidden.fit && hidden.snaps > 1 && hidden.buttons === 2, JSON.stringify(hidden));

		await scrollTo('changes');
		const changes = await page.evaluate(async () => {
			const carousel = window.byId('changes'),
				box = carousel.rootNode().closest('.demo'),
				start = carousel.slideNodes().length;
			let events = 0;
			const count = () => events++;
			carousel.on('slideschanged', count);
			box.querySelector('[data-add]').click();
			await new Promise((resolve) => setTimeout(resolve, 300));
			const added = carousel.slideNodes().length,
				label = carousel.slideNodes()[added - 1].getAttribute('aria-label');
			box.querySelector('[data-remove]').click();
			await new Promise((resolve) => setTimeout(resolve, 300));
			carousel.off('slideschanged', count);
			return { start, added, label, removed: carousel.slideNodes().length, events };
		});
		check('slide changes: a new slide gets its name, and each change emits slideschanged', changes.added === changes.start + 1 && changes.label === changes.added + ' of ' + changes.added && changes.removed === changes.start && changes.events === 2, JSON.stringify(changes));

		await scrollTo('custom');
		const custom = await page.evaluate(() => {
			const carousel = window.byId('custom'),
				box = carousel.rootNode().closest('.demo'),
				prev = box.querySelector('[data-prev]'),
				next = box.querySelector('[data-next]'),
				counter = box.querySelector('.demo_counter'),
				count = carousel.snapProgress().length,
				first = [counter.textContent, prev.disabled, next.disabled];
			next.click();
			const second = [counter.textContent, prev.disabled];
			carousel.goToSnap(count - 1, true);
			const last = [counter.textContent, next.disabled];
			carousel.goToSnap(0, true);
			return { count, first, second, last, arrows: carousel.rootNode().querySelectorAll('.better_button').length };
		});
		check('custom controls: the counter and the disabled buttons follow the carousel', custom.first.join() === '1 / ' + custom.count + ',true,false' && custom.second.join() === '2 / ' + custom.count + ',false' && custom.last.join() === custom.count + ' / ' + custom.count + ',true' && custom.arrows === 0, JSON.stringify(custom));

		await scrollTo('images');
		const images = await page.evaluate(async () => {
			const carousel = window.byId('images'),
				photos = carousel.slideNodes().map((slide) => slide.querySelector('img')),
				loaded = (index) => photos[index].complete && photos[index].naturalWidth > 0,
				// Wait until the images of the slides in view load, for 3 s at most
				inView = async () => {
					for (let time = 0; time < 3000 && !carousel.slidesInView().every(loaded); time += 100) {
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
					return carousel.slidesInView().every(loaded);
				},
				first = await inView(),
				far = loaded(photos.length - 1);
			carousel.goToSnap(carousel.snapProgress().length - 1, true);
			const last = await inView();
			carousel.goToSnap(0, true);
			return { lazy: photos.every((image) => image.loading === 'lazy'), first, far, last };
		});
		check('lazy images: loading="lazy" loads the images in view, and the last image only when it comes near', images.lazy && images.first && !images.far && images.last, JSON.stringify(images));

		// Responsive options: a grid from 769 px, and a carousel under it
		await page.evaluate(() => document.getElementById('breakpoints').scrollIntoView({ block: 'center', behavior: 'instant' }));
		const container = () => page.evaluate(() => document.querySelector('#breakpoints .items').classList.contains('better_container'));
		const wide = await container();
		await page.setViewport({ width: 600, height: 900 });
		await wait(500);
		const narrow = await container();
		await page.setViewport({ width: 1200, height: 900 });
		await wait(500);
		const back = await container();
		check('responsive options: active: false in a breakpoint stops the carousel, and it starts again under the breakpoint', !wide && narrow && !back, JSON.stringify({ wide, narrow, back }));
	}],
	['progress', async ({ page, check, scrollTo }) => {
		// Progress and offset
		// Go to snap 1, and read the values at rest, during the motion and after it
		const motion = (id, read) => page.evaluate(async (id, read) => {
			const carousel = window.byId(id),
				get = new Function('carousel', 'return (' + read + ')(carousel)'),
				rest = get(carousel);
			carousel.goToSnap(1);
			// The first frames of a motion can show its start: read the first change, in 1 s or less
			let middle = rest;
			for (const begin = performance.now(); JSON.stringify(middle) === JSON.stringify(rest) && performance.now() - begin < 1000;) {
				await new Promise(requestAnimationFrame);
				middle = get(carousel);
			}
			await new Promise((resolve) => carousel.on('settle', resolve));
			const end = get(carousel);
			carousel.goToSnap(carousel.snapProgress().length - 1, true);
			const last = get(carousel);
			carousel.goToSnap(0, true);
			return { count: carousel.slideNodes().length, snap: carousel.snapProgress()[1], rest, middle, end, last };
		}, id, read.toString());

		await scrollTo('progress-and-offset');
		const bar = await motion('progress-and-offset', (carousel) => carousel.rootNode().style.getPropertyValue('--better-progress'));
		check('progress: --better-progress is 0 at the start, changes during a motion, and is 1 at the last snap', bar.rest === '0' && +bar.middle > 0 && +bar.middle < bar.snap && Math.abs(bar.end - bar.snap) < 0.001 && +bar.last === 1, JSON.stringify(bar));

		await scrollTo('parallax');
		const offsets = await motion('parallax', (carousel) => carousel.slideNodes().map((slide) => Math.round(slide.style.getPropertyValue('--better-offset') * 100) / 100));
		check('offset: --better-offset is 0 for the selected slide, 1 for the next and -1 for the previous', offsets.rest[0] === 0 && offsets.rest[1] === 1 && offsets.rest[offsets.count - 1] === -1, JSON.stringify(offsets.rest));
		check('offset: --better-offset changes on each frame of a motion', offsets.middle[1] > 0 && offsets.middle[1] < 1 && offsets.end[1] === 0 && offsets.end[0] === -1, JSON.stringify([offsets.middle, offsets.end]));

		// The examples: the timer bar animates while the autoplay plays, the photos far from the center are smaller, and the counter shows the snap
		await scrollTo('autoplay');
		await page.evaluate(() => window.byId('autoplay').autoplay.play());
		await wait(300);
		const timer = await page.evaluate(() => document.querySelector('#autoplay .demo_bar').getAnimations().length);
		await scrollTo('scale');
		const scaled = await page.evaluate(() => [...document.querySelectorAll('#scale .item > img')].map((image) => +getComputedStyle(image).opacity));
		await scrollTo('callbacks');
		const counter = await page.evaluate(async () => {
			const carousel = window.byId('callbacks'),
				text = document.querySelector('#callbacks .demo_counter');
			carousel.goToSnap(1, true);
			const after = text.textContent;
			carousel.goToSnap(0, true);
			return [after, text.textContent, carousel.slideNodes().map((slide) => +slide.style.opacity)];
		});
		check('examples: the timer bar animates, the scale example fades the side photos, and the callbacks example writes the counter', timer === 1 && scaled[0] > 0.99 && scaled[1] < 0.5 && counter[0] === 'Snap 2.0, 14%' && counter[1] === 'Snap 1.0, 0%' && counter[2][0] === 1 && counter[2].some((value) => value > 0.3 && value < 1), JSON.stringify({ timer, scaled, counter }));

		// The callbacks get the state on each frame. destroy() removes the CSS variables.
		const calls = await page.evaluate(async () => {
			const element = document.createElement('div'),
				result = { snaps: [], progress: [], indexes: new Set(), visible: [] };
			element.style.display = 'flex';
			element.innerHTML = '<div style="flex: 0 0 50%">1</div><div style="flex: 0 0 50%">2</div><div style="flex: 0 0 50%">3</div><div style="flex: 0 0 50%">4</div>';
			window.byId('callbacks').rootNode().after(element);
			const carousel = BetterCarousel(element, {
				duration: 400,
				progress: (state, api) => {
					result.snaps.push(state.snap);
					result.progress.push(state.progress);
					result.api = api === carousel;
				},
				offset: (state) => {
					result.indexes.add(state.index);
					result.visible.push(state.visible);
					result.slide = result.slide || state.node.parentNode === carousel.containerNode();
				}
			});
			await new Promise((resolve) => carousel.on('init', resolve));
			carousel.goToSnap(2);
			await new Promise((resolve) => carousel.on('settle', resolve));
			const settled = result.snaps.length;
			await new Promise((resolve) => setTimeout(resolve, 200));
			result.idle = result.snaps.length - settled;
			carousel.destroy();
			const plain = BetterCarousel(element, { progress: true, offset: true });
			await new Promise((resolve) => plain.on('init', resolve));
			const root = plain.rootNode(),
				set = root.style.getPropertyValue('--better-progress') !== '' && plain.slideNodes()[1].style.getPropertyValue('--better-offset') !== '';
			plain.destroy();
			const removed = root.style.getPropertyValue('--better-progress') === '' && !element.querySelector('[style*="--better-"]');
			element.remove();
			return {
				api: result.api,
				slide: result.slide,
				last: result.snaps[result.snaps.length - 1],
				fraction: result.snaps.some((snap) => snap > 0 && snap < 2 && snap % 1),
				progress: result.progress[result.progress.length - 1],
				indexes: [...result.indexes],
				visible: result.visible.every((item) => item >= 0 && item <= 1),
				frames: result.snaps.length,
				idle: result.idle,
				set,
				removed
			};
		});
		check('progress and offset: the callbacks get the state on each frame, and the last snap gives progress 1, and no calls at rest', calls.api && calls.slide && calls.last === 2 && calls.fraction && calls.progress === 1 && calls.indexes.length === 4 && calls.visible && calls.frames > 3 && calls.idle === 0, JSON.stringify(calls));
		check('progress and offset: destroy() removes the CSS variables', calls.set && calls.removed, JSON.stringify(calls));

		// The auto scroll in loop mode calls the callbacks on each frame while it plays, and not after the stop
		const scroll = await page.evaluate(async () => {
			const element = document.createElement('div'),
				list = [];
			element.style.display = 'flex';
			element.innerHTML = '<div style="flex: 0 0 40%">1</div><div style="flex: 0 0 40%">2</div><div style="flex: 0 0 40%">3</div><div style="flex: 0 0 40%">4</div>';
			window.byId('callbacks').rootNode().after(element);
			const carousel = BetterCarousel(element, { loop: true, autoScroll: { speed: 600, startDelay: 0 }, progress: ({ progress }) => list.push(progress) });
			await new Promise((resolve) => setTimeout(resolve, 600));
			carousel.autoScroll.stop();
			const stopped = list.length;
			await new Promise((resolve) => setTimeout(resolve, 200));
			const after = list.length - stopped;
			carousel.destroy();
			element.remove();
			return { frames: stopped, after, moved: list.some((value) => value > 0.05) };
		});
		check('progress and offset: the auto scroll calls the callback on each frame, and not after the stop', scroll.frames > 10 && scroll.moved && scroll.after === 0, JSON.stringify(scroll));
	}],
	['slide fixtures', async ({ page, check, frames }) => {
		const { make, center } = fixture(page);

		// Clones: a click on a button in a clone clicks the same button in its slide, and a change in a slide goes to its clones
		await make({ loop: true }, { count: 2, html: '<button type="button" data-click data-index="%i">Slide %i</button>' });
		{
			// At the second snap, the clone of the first slide shows after the second slide
			const clone = await page.evaluate(() => {
				window.fixed.goToSnap(1, true);
				const rect = window.fixed.containerNode().querySelector('.clone button').getBoundingClientRect();
				return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
			});
			await page.mouse.click(clone.x, clone.y);
			const clicked = await page.evaluate(() => ({ clicks: window.counts.click, clicked: window.clicked }));
			check('clones: a click on a button in a clone clicks the button in its slide', clicked.clicks === 1 && clicked.clicked === '0', JSON.stringify({ clone, ...clicked }));

			const copied = await page.evaluate(async () => {
				window.fixed.slideNodes()[0].querySelector('button').textContent = 'Changed';
				await new Promise((resolve) => requestAnimationFrame(resolve));
				return [...window.fixed.containerNode().querySelectorAll('.clone button')].map((node) => node.textContent);
			});
			check('clones: a change in a slide goes to its clones', copied.includes('Changed'), JSON.stringify(copied));
		}

		// Slide changes in a loop: the slides stay in one row with the same gap, also when the changed slide has a loop shift
		await make({ loop: true });
		const changes = await page.evaluate(async () => {
			const frames = (count) => new Promise((resolve) => {
					const step = () => (count-- ? requestAnimationFrame(step) : resolve());
					step();
				}),
				container = window.fixed.containerNode(),
				row = () => {
					const list = [...container.children].map((node) => node.getBoundingClientRect().left).sort((a, b) => a - b);
					return list.every((left, index) => !index || Math.abs(left - list[index - 1] - 310) <= 1);
				},
				slide = () => {
					const node = document.createElement('div');
					node.style.cssText = 'flex: 0 0 300px; height: 100px';
					return node;
				},
				result = { rest: row() };
			container.prepend(slide());
			await frames(3);
			result.prepended = row();
			window.fixed.goToPrev(true);
			await frames(2);
			window.fixed.slideNodes()[0].remove();
			await frames(3);
			result.removed = row();
			const shifted = window.fixed.slideNodes().find((node) => node.style.translate);
			result.shifted = !!shifted;
			shifted?.replaceWith(slide());
			await frames(3);
			result.replaced = row();
			return result;
		});
		check('loop: the slides stay in one row after the page adds, removes and replaces a slide', Object.values(changes).every(Boolean), JSON.stringify(changes));

		// A new slide with the same size as the selected slide that it replaces
		await make();
		const replaced = await page.evaluate(async () => {
			window.fixed.goToSnap(1, true);
			window.counts.slideschanged = 0;
			const node = document.createElement('div');
			node.style.cssText = 'flex: 0 0 300px; height: 100px';
			window.fixed.slideNodes()[1].replaceWith(node);
			await new Promise((resolve) => setTimeout(resolve, 100));
			return { selected: node.classList.contains('selected'), label: node.getAttribute('aria-label'), events: window.counts.slideschanged };
		});
		check('a slide that replaces the selected slide with the same size gets the selected class and a name, and slideschanged occurs', replaced.selected && replaced.label === '2 of 6' && replaced.events === 1, JSON.stringify(replaced));

		// An effect that scales the slides: the measure after a resize uses the slide sizes without the scale
		await make();
		{
			await page.evaluate(async () => {
				window.fixed.reinit({ offset: ({ node, offset }) => (node.style.scale = String(1 - 0.4 * Math.min(1, Math.abs(offset)))) });
				await new Promise((resolve) => window.fixed.on('reinit', resolve));
				window.fixed.goToSnap(2, true);
			});
			await frames();
			await page.evaluate(() => (document.getElementById('fixture').style.width = '640px'));
			await frames();
			const scaled = await page.evaluate(() => {
				window.fixed.goToSnap(3, true);
				const view = window.fixed.viewportNode().getBoundingClientRect();
				return { snaps: window.fixed.snapProgress().length, start: Math.round(window.fixed.slideNodes()[3].getBoundingClientRect().left - view.left) };
			});
			check('an effect that scales the slides: after a resize, the snaps come from the slide sizes without the scale', scaled.snaps === 5 && scaled.start === 0, JSON.stringify(scaled));
		}

		// The pause reasons of the autoplay: the mouse with pauseOnHover, a hidden browser tab, and reduced motion
		await page.mouse.move(1100, 850);
		await make({ autoplay: { delay: 300, pauseOnHover: true } });
		{
			const at = await center();
			await page.mouse.move(at.x, at.y);
			await wait(800);
			const hovered = await page.evaluate(() => window.fixed.selectedSnap());
			await page.mouse.move(1100, 850);
			await wait(800);
			const left = await page.evaluate(() => window.fixed.selectedSnap());
			check('autoplay: pauseOnHover pauses it while the mouse is on the carousel', hovered === 0 && left > 0, JSON.stringify({ hovered, left }));
		}

		await make({ autoplay: 300 });
		{
			await page.evaluate(() => {
				Object.defineProperty(document, 'hidden', { value: true, configurable: true });
				document.dispatchEvent(new Event('visibilitychange'));
			});
			await wait(800);
			const hidden = await page.evaluate(() => window.fixed.selectedSnap());
			await page.evaluate(() => {
				delete document.hidden;
				document.dispatchEvent(new Event('visibilitychange'));
			});
			await wait(800);
			const visible = await page.evaluate(() => window.fixed.selectedSnap());
			check('autoplay: a hidden browser tab pauses it', hidden === 0 && visible > 0, JSON.stringify({ hidden, visible }));
		}

		await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
		await make({ autoplay: 300 });
		const reduced = await page.evaluate(() => window.fixed.autoplay.isPlaying());
		await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: '' }]);
		check('autoplay: it does not start if the user prefers reduced motion', !reduced, String(reduced));
	}],
	['layout', async ({ page, check, frames }) => {
		// Alignment at each snap
		// The trimmed snaps at the ends do not align: the carousel stops at the edge
		for (const [id, key, skip] of [['start', 'start', 'last'], ['center', 'center', 'both'], ['end', 'end', 'first']]) {
			const errors = await page.evaluate((id, key, skip) => {
				const carousel = window.byId(id),
					count = carousel.snapProgress().length,
					list = [];
				for (let index = 0; index < count; index++) {
					if ((skip !== 'first' && skip && index === count - 1) || (skip !== 'last' && skip && index === 0)) {
						continue;
					}
					carousel.goToSnap(index, true);
					list.push(Math.abs(window.box(carousel)[key]));
				}
				carousel.goToSnap(0, true);
				return list;
			}, id, key, skip);
			check(key + ' alignment at each snap', errors.length > 1 && errors.every((value) => value <= 0.5), errors.map((value) => value.toFixed(2)).join(', '));
		}

		// Center with trimSnaps: the snaps and the active slides
		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('center'),
					list = carousel.snapProgress().map((snap, index) => (carousel.goToSnap(index, true), carousel.selectedSlide()));
				carousel.goToSnap(0, true);
				return list.join();
			});
			check('center trimSnaps: active slides 1 to 6', value === '1,2,3,4,5,6', value);
		}

		// goToSlide() remembers the slide in a merged snap
		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('center');
				carousel.goToSlide(0, true);
				const result = [carousel.selectedSnap(), carousel.selectedSlide()].join();
				carousel.goToSnap(0, true);
				return result;
			});
			check('goToSlide(0) in a merged snap', value === '0,0', value);
		}

		// Vertical start alignment
		{
			const value = await page.evaluate(() => {
				const carousel = window.byId('vertical');
				carousel.goToSnap(2, true);
				const result = window.box(carousel);
				carousel.goToSnap(0, true);
				return result;
			});
			check('vertical: axis y and start alignment', !value.x && Math.abs(value.start) <= 0.5, JSON.stringify(value));
		}

		// Fit mode
		{
			const value = await page.evaluate(() => [0, 1, 2].map((index) => {
				const carousel = window.byId('fit', index),
					view = carousel.viewportNode().getBoundingClientRect(),
					nodes = carousel.slideNodes(),
					first = nodes[0].getBoundingClientRect(),
					last = nodes[nodes.length - 1].getBoundingClientRect();
				return {
					fit: carousel.isFit(),
					moved: carousel.containerNode().style.translate + nodes.map((node) => node.style.translate).join(''),
					fitClass: carousel.rootNode().classList.contains('better_fit'),
					left: first.left - view.left,
					right: view.right - last.right
				};
			}));
			const [start, center, end] = value;
			check('fit mode: no translate and the fit class', value.every((item) => item.fit && !item.moved && item.fitClass));
			check('fit mode: start, center and end follow the CSS', Math.abs(start.left) <= 0.5 && Math.abs(center.left - center.right) <= 0.5 && Math.abs(end.right) <= 0.5, JSON.stringify(value.map((item) => [item.left, item.right])));
		}

		// Dynamic widths after the images load
		{
			await new Promise((resolve) => setTimeout(resolve, 1300));
			await frames();
			const value = await page.evaluate(() => {
				const carousel = window.byId('autocenter'),
					list = [];
				carousel.snapProgress().forEach((snap, index) => {
					carousel.goToSnap(index, true);
					const slide = carousel.slideNodes()[carousel.selectedSlide()];
					if (index > 0 && index < carousel.snapProgress().length - 1) {
						list.push(Math.abs(window.box(carousel).center));
					}
					return slide;
				});
				const widths = carousel.slideNodes().map((node) => Math.round(node.getBoundingClientRect().width));
				carousel.goToSnap(0, true);
				return { list, widths };
			});
			check('dynamic widths: images change the widths and the center stays exact', value.widths[3] > 400 && value.list.every((item) => item <= 0.5), JSON.stringify(value));
		}

		// Axis switch at 768 px
		{
			const before = await page.evaluate(() => {
				const carousel = window.byId('switch');
				carousel.goToSnap(2, true);
				return window.box(carousel);
			});
			await page.setViewport({ width: 600, height: 900 });
			await frames();
			await frames();
			const after = await page.evaluate(() => window.box(window.byId('switch')));
			check('axis switch: vertical at 1200 px, horizontal at 600 px', !before.x && after.x, JSON.stringify({ before, after }));
			check('axis switch: the slide stays centered', Math.abs(before.center) <= 0.5 && Math.abs(after.center) <= 0.5);

			const center = await page.evaluate(() => {
				const carousel = window.byId('center');
				carousel.goToSnap(2, true);
				return window.box(carousel).center;
			});
			check('resize to 600 px: center alignment', Math.abs(center) <= 0.5, center.toFixed(2));
			await page.setViewport({ width: 1200, height: 900 });
			await frames();
		}

		// reinit() keeps the selected slide, and an added slide changes the snaps
		{
			const value = await page.evaluate(async () => {
				const carousel = window.byId('start');
				carousel.goToSnap(3, true);
				carousel.reinit({ align: 'center' });
				await new Promise((resolve) => carousel.on('reinit', resolve));
				const slide = carousel.selectedSlide(),
					center = window.box(carousel).center,
					count = carousel.snapProgress().length,
					node = carousel.slideNodes()[0].cloneNode(true);
				carousel.containerNode().append(node);
				await new Promise((resolve) => carousel.on('slideschanged', resolve));
				const added = carousel.snapProgress().length - count;
				node.remove();
				await new Promise((resolve) => carousel.on('slideschanged', resolve));
				carousel.reinit({ align: 'auto' });
				await new Promise((resolve) => carousel.on('reinit', resolve));
				carousel.goToSnap(0, true);
				return { slide, center, added };
			});
			check('reinit() keeps the slide and applies the options', value.slide === 3 && Math.abs(value.center) <= 0.5, JSON.stringify(value));
			check('an added slide adds a snap', value.added === 1);
		}

		// destroy() restores the DOM
		{
			const value = await page.evaluate(async () => {
				const host = document.createElement('div');
				host.innerHTML = '<div class="items items_3 carousel" data-x="1"><div class="item">1</div><div class="item">2</div><div class="item">3</div><div class="item">4</div></div>';
				document.body.append(host);
				const before = host.innerHTML,
					carousel = window.BetterCarousel(host.firstElementChild);
				await new Promise((resolve) => carousel.on('init', resolve));
				carousel.goToSnap(1, true);
				const during = host.innerHTML;
				carousel.destroy();
				const after = host.innerHTML;
				host.remove();
				return { same: before === after, changed: before !== during, after };
			});
			check('destroy() restores the DOM', value.same && value.changed, value.same ? '' : value.after);
		}

		// 10 new carousels: the first measure passes share the layout
		{
			const value = await page.evaluate(async () => {
				const host = document.createElement('div');
				host.innerHTML = Array.from({ length: 10 }, () => '<div class="items items_3 carousel">' + '<div class="item">x</div>'.repeat(6) + '</div>').join('');
				document.body.append(host);
				await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				window.layoutHost = host;
			});
			const before = await page.metrics();
			await page.evaluate(async () => {
				const list = [...window.layoutHost.children].map((element) => window.BetterCarousel(element));
				await Promise.all(list.map((carousel) => new Promise((resolve) => carousel.on('init', resolve))));
				await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				window.layoutList = list;
			});
			const after = await page.metrics();
			const layouts = after.LayoutCount - before.LayoutCount,
				styles = after.RecalcStyleCount - before.RecalcStyleCount;
			check('10 carousels: no layout for each carousel', layouts <= 4, layouts + ' layouts, ' + styles + ' style recalcs');
			await page.evaluate(() => {
				window.layoutList.forEach((carousel) => carousel.destroy());
				window.layoutHost.remove();
			});
			void value;
		}
	}],
	['lazy', async ({ page, check, frames, scrollTo }) => {
		// Lazy start: 6 carousels at the top of a page and 6 at the end. Only the carousels near the screen start.
		await page.evaluate(() => {
			const make = () => {
				const section = document.createElement('section');
				section.style.overflowX = 'clip';
				section.innerHTML = '<div class="items items_3 carousel lazy_test">' + '<div class="item"><div style="height: 200px">Slide</div></div>'.repeat(8) + '</div>';
				return section;
			};
			for (let index = 0; index < 6; index++) {
				document.body.prepend(make());
				document.body.append(make());
			}
			scrollTo(0, 0);
			window.lazy = BetterCarousel.initAll('.lazy_test', { lazy: true });
		});
		await frames();
		const start = await page.evaluate(() => [...document.querySelectorAll('.lazy_test')].map((node) => (node.closest('.better') ? 1 : 0)).join(''));
		check('lazy: the carousels near the screen start, the others wait', start.startsWith('11') && start.endsWith('000000'), start);

		const waiting = await page.evaluate(() => {
			const element = [...document.querySelectorAll('.lazy_test')].pop(),
				carousel = BetterCarousel.get(element);
			return { api: carousel === window.lazy.at(-1), root: carousel.rootNode() === undefined, again: BetterCarousel(element) === carousel };
		});
		check('lazy: a waiting carousel has the API, and a second constructor call gives the same API', waiting.api && waiting.root && waiting.again, JSON.stringify(waiting));

		const went = await page.evaluate(() => new Promise((resolve) => {
			setTimeout(() => resolve({ timeout: true }), 3000);
			const carousel = window.lazy.at(-1);
			carousel.goToSnap(2, true);
			carousel.on('init', () => resolve({ started: !!carousel.rootNode(), snap: carousel.selectedSnap() }));
		}));
		check('lazy: goToSnap() starts a waiting carousel at that snap', went.started && went.snap === 2, JSON.stringify(went));

		await page.evaluate(() => document.querySelectorAll('.lazy_test')[9].scrollIntoView({ block: 'center', behavior: 'instant' }));
		await frames();
		await frames();
		const scrolled = await page.evaluate(() => !!window.lazy.at(-3).rootNode());
		check('lazy: a carousel starts when it comes near the screen', scrolled);
	}, { width: 390, height: 844 }]
];

const start = performance.now();

// Each worker runs the next group from the queue
const queue = groups.entries(),
	reports = [];
await Promise.all(Array.from({ length: workers }, async () => {
	for (const [index, [name, run, viewport = { width: 1200, height: 900 }]] of queue) {
		const list = [],
			time = performance.now(),
			tools = await open(list, viewport);
		try {
			await run(tools);
		} catch (error) {
			tools.check(name + ': the group runs to the end', false, error.message);
		}
		await tools.browser.close();
		reports[index] = ['== ' + name + ', ' + ((performance.now() - time) / 1000).toFixed(1) + ' s', ...list];
	}
}));

const lines = reports.flat(),
	failed = lines.filter((line) => line.startsWith('FAIL')).length,
	passed = lines.filter((line) => line.startsWith('PASS')).length;

console.log(lines.join('\n'));
console.log('\n' + passed + ' passed, ' + failed + ' failed in ' + ((performance.now() - start) / 1000).toFixed(1) + ' s');
process.exit(failed ? 1 : 0);
