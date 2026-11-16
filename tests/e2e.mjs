// Browser checks against the demo page. Run: npm run e2e
import puppeteer from 'puppeteer-core';

const url = process.env.URL || 'http://better.test/';
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];

const check = (name, ok, detail = '') => {
	results.push({ name, ok });
	console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' (' + detail + ')' : ''));
};

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();

page.on('pageerror', (error) => check('no page errors', false, error.message));
page.on('console', (message) => message.type() === 'error' && check('no console errors', false, message.text()));

const frames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// Helpers in the page: the active slide box and the viewport box on the main axis
const helpers = () => page.evaluate(() => {
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
	window.byId = (id, index = 0) => window.carousels.filter((carousel) => carousel.rootNode().closest('#' + id))[index];
});

await page.setViewport({ width: 1200, height: 900 });
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => window.ready);
await helpers();

// Alignment at each snap
for (const [id, key, skip] of [['start', 'start', 'last'], ['center', 'center', ''], ['end', 'end', 'first']]) {
	const errors = await page.evaluate((id, key, skip) => {
		const carousel = window.byId(id),
			count = carousel.snapList().length,
			list = [];
		for (let index = 0; index < count; index++) {
			if ((skip === 'last' && index === count - 1) || (skip === 'first' && index === 0)) {
				continue;
			}
			carousel.goTo(index, true);
			list.push(Math.abs(window.box(carousel)[key]));
		}
		carousel.goTo(0, true);
		return list;
	}, id, key, skip);
	check(key + ' alignment at each snap', errors.length > 1 && errors.every((value) => value <= 0.5), errors.map((value) => value.toFixed(2)).join(', '));
}

// Center with trimSnaps: the snaps and the active slides
{
	const value = await page.evaluate(() => {
		const carousel = window.byId('center'),
			list = carousel.snapList().map((snap, index) => (carousel.goTo(index, true), carousel.selectedSlide()));
		carousel.goTo(0, true);
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
		carousel.goTo(0, true);
		return result;
	});
	check('goToSlide(0) in a merged snap', value === '0,0', value);
}

// Vertical start alignment
{
	const value = await page.evaluate(() => {
		const carousel = window.byId('vertical');
		carousel.goTo(2, true);
		const result = window.box(carousel);
		carousel.goTo(0, true);
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
			draggable: carousel.rootNode().classList.contains('better_dynamic'),
			left: first.left - view.left,
			right: view.right - last.right
		};
	}));
	const [start, center, end] = value;
	check('fit mode: no translate and no dynamic class', value.every((item) => item.fit && !item.moved && !item.draggable));
	check('fit mode: start, center and end follow the CSS', Math.abs(start.left) <= 0.5 && Math.abs(center.left - center.right) <= 0.5 && Math.abs(end.right) <= 0.5, JSON.stringify(value.map((item) => [item.left, item.right])));
}

// Dynamic widths after the images load
{
	await new Promise((resolve) => setTimeout(resolve, 1300));
	await frames();
	const value = await page.evaluate(() => {
		const carousel = window.byId('auto'),
			list = [];
		carousel.snapList().forEach((snap, index) => {
			carousel.goTo(index, true);
			const slide = carousel.slideNodes()[carousel.selectedSlide()];
			if (index > 0 && index < carousel.snapList().length - 1) {
				list.push(Math.abs(window.box(carousel).center));
			}
			return slide;
		});
		const widths = carousel.slideNodes().map((node) => Math.round(node.getBoundingClientRect().width));
		carousel.goTo(0, true);
		return { list, widths };
	});
	check('dynamic widths: images change the widths and the center stays exact', value.widths[3] > 400 && value.list.every((item) => item <= 0.5), JSON.stringify(value));
}

// Axis switch at 768 px
{
	const before = await page.evaluate(() => {
		const carousel = window.byId('switch');
		carousel.goTo(2, true);
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
		carousel.goTo(2, true);
		return window.box(carousel).center;
	});
	check('resize to 600 px: center alignment', Math.abs(center) <= 0.5, center.toFixed(2));
	await page.setViewport({ width: 1200, height: 900 });
	await frames();
}

// reInit() keeps the selected slide, and an added slide changes the snaps
{
	const value = await page.evaluate(async () => {
		const carousel = window.byId('start');
		carousel.goTo(3, true);
		carousel.reInit({ align: 'center' });
		await new Promise((resolve) => carousel.on('reinit', resolve));
		const slide = carousel.selectedSlide(),
			center = window.box(carousel).center,
			count = carousel.snapList().length,
			node = carousel.slideNodes()[0].cloneNode(true);
		carousel.containerNode().append(node);
		await new Promise((resolve) => carousel.on('slideschanged', resolve));
		const added = carousel.snapList().length - count;
		node.remove();
		await new Promise((resolve) => carousel.on('slideschanged', resolve));
		carousel.reInit({ align: 'auto' });
		await new Promise((resolve) => carousel.on('reinit', resolve));
		carousel.goTo(0, true);
		return { slide, center, added };
	});
	check('reInit() keeps the slide and applies the options', value.slide === 3 && Math.abs(value.center) <= 0.5, JSON.stringify(value));
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
		carousel.goTo(1, true);
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

// Motion and drag

// A change of isMobile or hasTouch reloads the page
const reload = async () => {
	await page.reload({ waitUntil: 'load' });
	await page.evaluate(() => window.ready);
	await helpers();
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The center of a viewport in page coordinates, and the state of its carousel
const state = (id) => page.evaluate((id) => {
	const carousel = window.byId(id),
		view = carousel.viewportNode().getBoundingClientRect(),
		slides = [...carousel.containerNode().children].map((node) => node.getBoundingClientRect().left - view.left);
	return { x: view.left + view.width / 2, y: view.top + view.height / 2, snap: carousel.selectedSnap(), first: slides[0], aligned: slides.some((left) => Math.abs(left) <= 0.5) };
}, id);

// Wait for the settle event of a carousel, or for a timeout
const settle = (id) => page.evaluate((id) => new Promise((resolve) => {
	const carousel = window.byId(id),
		done = () => {
			carousel.off('settle', done);
			resolve(true);
		};
	carousel.on('settle', done);
	setTimeout(() => resolve(false), 3000);
}), id);

const scrollTo = (id) => page.evaluate((id) => {
	document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' });
	window.byId(id).goTo(0, true);
}, id);

// A mouse drag: a slow drag ends with a stop, a flick ends at full speed
const mouseDrag = async (id, distance, flick) => {
	await scrollTo(id);
	const start = await state(id),
		done = settle(id);
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
	return state(id);
};

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

// Touch
{
	await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
	await reload();
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
	await page.setViewport({ width: 1200, height: 900 });
	await reload();
}

// Trace of 10 arrow clicks: the motion runs on the compositor
{
	const trace = async () => {
		// Wait for the late images of the demo, after a reload
		await wait(1500);
		await scrollTo('start');
		// No arrows and dots: their CSS transitions are not part of this check
		await page.evaluate(async () => {
			const carousel = window.byId('start');
			carousel.reInit({ arrows: false, dots: false });
			await new Promise((resolve) => carousel.on('reinit', resolve));
		});
		await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.animations'] });
		await page.evaluate(async () => {
			const carousel = window.byId('start');
			for (let index = 0; index < 10; index++) {
				if (index === 5) {
					carousel.goTo(0, true);
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
		return { animations: events.filter((event) => event.name === 'Animation' && event.ph === 'b').length, frames: count('FireAnimationFrame'), styles: count('UpdateLayoutTree'), layouts: count('Layout'), paints: count('Paint'), failed };
	};
	const waapi = await trace();
	check('10 arrow clicks: no JS per frame, and the animation is composited', waapi.frames === 0 && waapi.animations > 0 && !waapi.failed.length, JSON.stringify(waapi));
}

// Loop and clones

// The largest empty space in the viewport on the main axis, on each frame while a sampler runs
await page.evaluate(() => {
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

{
	const counts = await page.evaluate(() => ['loop', 'loopcenter', 'clones', 'gallery'].map((id) => {
		const carousel = window.byId(id);
		return [id, carousel.containerNode().children.length, carousel.slideNodes().length, carousel.snapList().length];
	}));
	const map = Object.fromEntries(counts.map(([id, ...rest]) => [id, rest]));
	check('clone counts: none for 10 and 6 slides and the grid, one copy for 3 wide slides', map.loop[0] === 10 && map.loopcenter[0] === 6 && map.gallery[0] === 20 && map.clones[0] === 6 && map.clones[2] === 3, JSON.stringify(map));
}

for (const [id, limit] of [['loop', 21], ['loopcenter', 21], ['clones', 21], ['gallery', 11]]) {
	await scrollTo(id);
	const value = await page.evaluate(async (id) => {
		const carousel = window.byId(id),
			stop = window.sample(carousel),
			slides = new Set(),
			snaps = new Set();
		for (let index = 0; index < 30; index++) {
			carousel[index < 20 ? 'goToNext' : 'goToPrev']();
			slides.add(carousel.selectedSlide());
			snaps.add(carousel.selectedSnap());
			await new Promise((resolve) => setTimeout(resolve, index % 3 ? 90 : 450));
		}
		await new Promise((resolve) => setTimeout(resolve, 900));
		const result = stop();
		return { ...result, slides: [...slides].sort((a, b) => a - b), snaps: [...snaps].sort((a, b) => a - b), count: carousel.slideNodes().length, dots: carousel.snapList().length, snap: carousel.selectedSnap() };
	}, id);
	check(id + ': 30 next and prev calls show no gap on any frame', value.gap <= limit && value.frames > 60, 'largest gap ' + value.gap.toFixed(1) + ' px in ' + value.frames + ' frames');
	check(id + ': snaps and slides are original indexes', value.slides.every((item) => item < value.count) && value.snaps.every((item) => item < value.dots), JSON.stringify(value));
}

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

// Navigation, classes, sync and accessibility

{
	const value = await page.evaluate(() => {
		const carousel = window.byId('embla'),
			root = carousel.rootNode(),
			names = (node) => node ? node.className : null;
		carousel.goTo(0, true);
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
	check('embla preset: the class names of the old wrapper', value.root === 'embla embla_horizontal embla_dynamic' && value.viewport === 'embla_viewport' && value.container && value.buttons.join() === 'embla_button embla_prev,embla_button embla_next' && value.dots === 'embla_dots' && value.dot.startsWith('embla_dot') && value.active === 'item active', JSON.stringify(value));
}

{
	await scrollTo('embla');
	const value = await page.evaluate(async () => {
		const carousel = window.byId('embla'),
			dots = [...carousel.rootNode().querySelectorAll('.embla_dot')];
		carousel.goTo(6, true);
		await new Promise((resolve) => setTimeout(resolve, 300));
		let changes = 0;
		const observer = new MutationObserver((list) => {
			changes += list.length;
		});
		dots.forEach((dot) => observer.observe(dot, { attributes: true, attributeFilter: ['class'] }));
		carousel.goToNext(true);
		await new Promise((resolve) => setTimeout(resolve, 300));
		observer.disconnect();
		const marked = dots.filter((dot) => /first|prev|current|next|last/.test(dot.className)),
			box = dots[0].parentElement.getBoundingClientRect(),
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
	check('dots: 5 dots around the current dot have state classes', value.count === 15 && value.marked === 'first,prev,current,next,last' && value.current === 7, JSON.stringify(value));
	check('dots: the 5 dots show in the window with the current dot in the center, and the other dots do not show and are out of the tab order', value.hidden && value.shown && value.centered && value.tabbable, JSON.stringify(value));
	check('dots: one select changes no more than 10 class lists', value.changes <= 10, value.changes + ' changes');
}

{
	const value = await page.evaluate(() => {
		const carousel = window.byId('state');
		carousel.goTo(1, true);
		const result = [carousel.slideNodes()[1].className, carousel.rootNode().querySelector('.is_current')?.className];
		carousel.goTo(0, true);
		return result;
	});
	check('state prefix: is_active and is_current', value[0] === 'item is_active' && value[1] === 'embla_dot is_current', JSON.stringify(value));
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
	await wait(900);
	const value = await page.evaluate(() => {
		const main = window.byId('product'),
			thumbs = window.byId('product', 1);
		return { main: main.selectedSlide(), thumbs: thumbs.selectedSlide(), active: thumbs.slideNodes().findIndex((node) => node.classList.contains('active')), mainBox: Math.abs(window.box(main).start) };
	});
	check('sync: a click on thumbnail 4 selects photo 4 and marks the thumbnail', value.main === 3 && value.thumbs === 3 && value.active === 3 && value.mainBox <= 0.5, JSON.stringify(value));

	await page.evaluate(() => window.byId('product').goToNext());
	await wait(900);
	const next = await page.evaluate(() => {
		const thumbs = window.byId('product', 1);
		return { thumbs: thumbs.selectedSlide(), active: thumbs.slideNodes().findIndex((node) => node.classList.contains('active')), center: Math.abs(window.box(thumbs).center) };
	});
	check('sync: the next photo moves the thumbnails to its centered thumbnail', next.thumbs === 4 && next.active === 4 && next.center <= 0.5, JSON.stringify(next));
}

{
	const value = await page.evaluate(() => {
		const carousel = window.byId('end'),
			root = carousel.rootNode(),
			slide = carousel.slideNodes()[1],
			link = window.byId('drag').slideNodes()[0],
			id = carousel.containerNode().id,
			buttons = [...root.querySelectorAll(':scope > button')];
		carousel.goTo(0, true);
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

// Centered slides with dynamic widths
{
	await page.setViewport({ width: 1200, height: 900 });
	await reload();
	await page.evaluate(() => window.byId('auto').goToSlide(3, true));
	await wait(1600);
	const late = await page.evaluate(() => {
		const carousel = window.byId('auto');
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
			let last = offset(),
				jump = 0;
			while (performance.now() - begin < 900) {
				await new Promise(requestAnimationFrame);
				const value = offset();
				jump = Math.max(jump, Math.abs(value - last));
				last = value;
			}
			rows.push({ target, center: Math.round(last), jump: Math.round(jump) });
		}
		return rows;
	});
	check('a selected slide that grows: the motion does not jump and ends in the center', grow.every((row) => Math.abs(row.center) <= 1 && row.jump < 60), JSON.stringify(grow));
}

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
	await page.setViewport({ width: 1200, height: 900 });
	await scrollTo('fill');
	const small = await empty();
	await page.setViewport({ width: 1920, height: 900 });
	await wait(300);
	const large = await empty();
	check("clones: 'fill': no empty space in the window during the motion, and a window resize adds clones", small.gap <= 20 && large.gap <= 20 && large.clones > small.clones && small.clones > 0, JSON.stringify({ small, large }));
	await page.setViewport({ width: 1200, height: 900 });
}

// skipSnaps as a number: one flick goes at most this number of snaps
{
	await page.setViewport({ width: 1200, height: 900 });
	await scrollTo('start');
	await page.evaluate(async () => {
		const carousel = window.byId('start');
		carousel.reInit({ skipSnaps: 1, arrows: true, dots: true });
		await new Promise((resolve) => carousel.on('reinit', resolve));
		carousel.goTo(0, true);
	});
	const limited = await mouseDrag('start', -500, true);
	check('skipSnaps: 1: a long flick goes one snap only', limited.snap === 1 && limited.aligned, JSON.stringify(limited));
	await page.evaluate(async () => {
		const carousel = window.byId('start');
		carousel.reInit({ skipSnaps: true });
		await new Promise((resolve) => carousel.on('reinit', resolve));
	});
}

// Mouse wheel
{
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
			return { snap: carousel.selectedSnap(), last: carousel.snapList().length - 1, scroll: Math.round(scrollY), aligned: Math.abs(carousel.scrollProgress() - carousel.snapList()[carousel.selectedSnap()]) < 0.002 };
		}, id);
	};
	const reset = (id, snap = 0) => page.evaluate((id, snap) => {
		document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' });
		window.byId(id).goTo(snap, true);
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
		carousel.reInit({ wheel: 'both' });
		await new Promise((resolve) => carousel.on('reinit', resolve));
	});
	top = await reset('start');
	const both = await wheel('start', [100]);
	check("wheel: 'both': the mouse wheel moves a horizontal carousel", both.snap === 1 && both.scroll === top, JSON.stringify({ top, both }));
}

// Autoplay, auto scroll, auto height

// Scroll to a carousel with no goTo(): a goTo() is an interaction, and it stops the autoplay and the auto scroll
const show = (id) => page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), id);

// Autoplay
{
	await page.setViewport({ width: 1200, height: 900 });
	await reload();
	await show('autoplay');
	const read = () => page.evaluate(() => {
		const carousel = window.byId('autoplay'),
			button = carousel.rootNode().querySelector('.better_play');
		return { slide: carousel.selectedSlide(), playing: carousel.autoplay.isPlaying(), live: carousel.containerNode().getAttribute('aria-live'), label: button.getAttribute('aria-label'), state: carousel.rootNode().classList.contains('playing') };
	});
	const first = await read();
	await wait(2600);
	const second = await read();
	check('autoplay: plays at init, goes to the next slide after the delay, aria-live is off', first.playing && first.live === 'off' && first.state && first.label === 'Stop the slide show' && second.slide === 1, JSON.stringify({ first, second }));

	// Slide 3 has data-delay 6000
	await page.evaluate(() => {
		window.byId('autoplay').goTo(2, true);
		window.byId('autoplay').autoplay.play();
	});
	await wait(2600);
	const slow = await read();
	check('autoplay: data-delay on a slide changes its delay', slow.slide === 2, JSON.stringify(slow));

	// Out of view: the autoplay pauses
	await page.evaluate(() => {
		window.byId('autoplay').goTo(0, true);
		window.byId('autoplay').autoplay.play();
		scrollTo(0, document.body.scrollHeight);
	});
	await wait(2600);
	const away = await read();
	await show('autoplay');
	await wait(2600);
	const back = await read();
	check('autoplay: pauses out of view and plays again in view', away.slide === 0 && back.slide === 1, JSON.stringify({ away, back }));

	// The keyboard focus in the root pauses it
	await page.evaluate(() => {
		window.byId('autoplay').goTo(0, true);
		window.byId('autoplay').autoplay.play();
		window.byId('autoplay').rootNode().querySelector('.better_next').focus({ focusVisible: true });
	});
	await wait(2600);
	const focused = await read();
	await page.evaluate(() => document.activeElement.blur());
	check('autoplay: the keyboard focus in the carousel pauses it', focused.slide === 0 && focused.playing, JSON.stringify(focused));

	// The stop button
	await page.evaluate(() => window.byId('autoplay').rootNode().querySelector('.better_play').click());
	const stopped = await read();
	await wait(2600);
	const still = await read();
	check('autoplay: the button stops it, aria-live is polite, and the button name changes', !stopped.playing && stopped.live === 'polite' && !stopped.state && stopped.label === 'Start the slide show' && still.slide === stopped.slide, JSON.stringify({ stopped, still }));

	// An arrow click stops it (stopOnInteraction)
	await page.evaluate(() => window.byId('autoplay').autoplay.play());
	await page.evaluate(() => window.byId('autoplay').rootNode().querySelector('.better_next').click());
	const clicked = await read();
	check('autoplay: an arrow click stops it', !clicked.playing, JSON.stringify(clicked));
}

// Auto scroll
{
	await show('logos');
	await wait(1500);
	const info = await page.evaluate(() => {
		const carousel = window.byId('logos');
		return { playing: carousel.autoScroll.isPlaying(), animations: carousel.containerNode().getAnimations().length, clones: carousel.containerNode().children.length - carousel.slideNodes().length };
	});
	check('auto scroll: plays after its delay, with clones for few logos', info.playing && info.animations === 1 && info.clones > 0, JSON.stringify(info));

	// The largest empty space in the viewport on each frame for 3 s
	const gap = await page.evaluate(async () => {
		const carousel = window.byId('logos'),
			view = carousel.viewportNode().getBoundingClientRect(),
			nodes = [...carousel.containerNode().children];
		let worst = 0;
		const begin = performance.now();
		while (performance.now() - begin < 3000) {
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
	check('auto scroll: no empty space and no jump on each frame for 3 s', gap <= 21, gap + ' px');

	// A trace: no script on each frame
	await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
	await wait(3000);
	const data = JSON.parse(new TextDecoder().decode(await page.tracing.stop()));
	const events = data.traceEvents,
		main = events.find((event) => event.name === 'thread_name' && event.args.name === 'CrRendererMain' && events.some((item) => item.pid === event.pid && item.name === 'ParseHTML' || item.pid === event.pid && item.name === 'Layout' || item.pid === event.pid && item.name === 'TimerFire')),
		list = events.filter((event) => event.pid === main?.pid && event.tid === main?.tid),
		count = (name) => list.filter((event) => event.name === name && event.ph !== 'E').length;
	const trace = { frames: count('FireAnimationFrame'), timers: count('TimerFire'), layouts: count('Layout'), scripts: count('FunctionCall') };
	check('auto scroll: a 3 s trace has no rAF frames, timers or layouts', trace.frames === 0 && trace.timers === 0 && trace.layouts === 0, JSON.stringify(trace));

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

	// With stopOnInteraction: false, an instant goTo() pauses it, and it plays again after startDelay
	const again = await page.evaluate(async () => {
		const carousel = window.byId('logos');
		carousel.reInit({ autoScroll: { speed: 60, stopOnInteraction: false, startDelay: 300 } });
		await new Promise((resolve) => carousel.on('reinit', resolve));
		await new Promise((resolve) => setTimeout(resolve, 500));
		carousel.goTo(2, true);
		const stopped = carousel.containerNode().getAnimations().length;
		await new Promise((resolve) => setTimeout(resolve, 600));
		return { stopped, playing: carousel.autoScroll.isPlaying(), animations: carousel.containerNode().getAnimations().length };
	});
	check('auto scroll: an instant goTo() with stopOnInteraction: false starts it again after startDelay', again.stopped === 0 && again.playing && again.animations === 1, JSON.stringify(again));
}

// Auto height
{
	await scrollTo('height');
	const value = await page.evaluate(async () => {
		const carousel = window.byId('height'),
			viewport = carousel.viewportNode(),
			first = viewport.style.height;
		carousel.goTo(2);
		await new Promise((resolve) => setTimeout(resolve, 100));
		const middle = viewport.getBoundingClientRect().height;
		await new Promise((resolve) => setTimeout(resolve, 600));
		return { first, last: viewport.style.height, middle, transition: getComputedStyle(viewport).transitionProperty };
	});
	check('auto height: the viewport gets the height of the tallest slide in view, with a transition', value.first === '220px' && value.last === '280px' && value.middle > 220 && value.middle < 280 && value.transition.includes('height'), JSON.stringify(value));
}

// Controls in slides
{
	await scrollTo('controls');
	await page.evaluate(() => {
		window.byId('controls').goTo(0, true);
		document.querySelector('#controls h2').setAttribute('tabindex', '-1');
		document.querySelector('#controls h2').focus();
	});
	const seen = [];
	for (let index = 0; index < 13; index++) {
		await page.keyboard.press('Tab');
		await wait(600);
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
	await page.evaluate(() => window.byId('controls').goTo(0, true));
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
	await wait(600);
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
	await wait(600);
	const dragged = await page.evaluate(() => ({ pressed: document.querySelector('#controls .demo_like').getAttribute('aria-pressed'), snap: window.byId('controls').selectedSnap() }));
	check('controls: a click on a button works, and a drag from it moves the carousel and does not click it', pressed === 'true' && dragged.pressed === 'true' && dragged.snap > 0, JSON.stringify({ pressed, dragged }));

	// Clones: hidden from screen readers and out of the tab order
	const clones = await page.evaluate(() => [...document.querySelectorAll('.clone')].map((node) => ({ inert: node.inert, hidden: node.getAttribute('aria-hidden'), ids: node.querySelectorAll('[id]').length + (node.id ? 1 : 0) })));
	check('clones: inert, aria-hidden and no ids', clones.length > 0 && clones.every((item) => item.inert && item.hidden === 'true' && !item.ids), JSON.stringify(clones.slice(0, 2)));
}

// Lazy start: 6 carousels at the top of a page and 6 at the end. Only the carousels near the screen start.
{
	await page.setViewport({ width: 390, height: 844 });
	await page.goto(url, { waitUntil: 'load' });
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
		carousel.goTo(2, true);
		carousel.on('init', () => resolve({ started: !!carousel.rootNode(), snap: carousel.selectedSnap() }));
	}));
	check('lazy: goTo() starts a waiting carousel at that snap', went.started && went.snap === 2, JSON.stringify(went));

	await page.evaluate(() => document.querySelectorAll('.lazy_test')[9].scrollIntoView({ block: 'center', behavior: 'instant' }));
	await frames();
	await frames();
	const scrolled = await page.evaluate(() => !!window.lazy.at(-3).rootNode());
	check('lazy: a carousel starts when it comes near the screen', scrolled);
}

await browser.close();

const failed = results.filter((item) => !item.ok).length;
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
