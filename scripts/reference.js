// The reference data of the docs. docs.mjs writes these tables into README.md and index.html, and the options into the types.
//
// Text format: `code` and [label](#anchor). An anchor that README.md does not have links to the docs site.
// "example" is the id of a live example on the docs site. "ts" is the TypeScript type, if the "type" text is not TypeScript.

export const site = 'https://twistedandy.github.io/better-carousel/';

export const options = [
	{ name: 'axis', type: "`'x'`, `'y'`, `'auto'`", default: 'auto', text: "The axis of the motion. With `'auto'`, the CSS of the container sets the axis.", example: 'switch' },
	{ name: 'align', ts: "'start' | 'center' | 'end' | 'auto' | ((viewSize: number, snapSize: number, index: number) => number)", type: "`'start'`, `'center'`, `'end'`, `'auto'`, `function`", default: 'auto', text: "The position of the selected snap in the viewport. A function gets `(viewSize, snapSize, index)` and returns the offset in px. With `'auto'`, `justify-content` sets the alignment.", example: 'center' },
	{ name: 'direction', type: "`'ltr'`, `'rtl'`, `'auto'`", default: 'auto', text: "The text direction. With `'auto'`, the CSS `direction` sets it." },
	{ name: 'loop', type: '`boolean`', default: false, text: 'The first slide comes after the last slide.', example: 'loop' },
	{ name: 'clones', type: "`'auto'`, `'fill'`, `false`", default: 'auto', text: "`'auto'`: add clones only if the loop needs them. `'fill'`: add clones that fill the window. `false`: add no clones.", example: 'clones' },
	{ name: 'dragFree', type: "`boolean`, `'snap'`", default: false, text: "`true`: glide after a drag and stop at any position. `'snap'`: glide and stop at the nearest snap.", example: 'free' },
	{ name: 'containScroll', type: "`'trimSnaps'`, `'keepSnaps'`, `false`", default: 'trimSnaps', text: "`'trimSnaps'`: no empty space at the ends. `'keepSnaps'`: no empty space, but keep a snap for each group. `false`: snaps can show empty space.", example: 'center' },
	{ name: 'slidesToScroll', type: "`number`, `'auto'`", default: 1, text: "The number of slides in one snap. `'auto'`: the slides that fit in the viewport." },
	{ name: 'skipSnaps', type: '`boolean`, `number`', default: true, text: 'A fast flick can move more than one snap. `false`: one snap. A number: the maximum number of snaps.', example: 'skip' },
	{ name: 'dragThreshold', type: '`number`', default: 10, text: 'The distance in px that the pointer moves before a drag starts.' },
	{ name: 'duration', type: '`number`', default: 400, text: 'The duration of a motion by one snap, in ms. A longer motion takes more time, to a maximum of 2 times this value.' },
	{ name: 'startSnap', type: '`number`', default: 0, text: 'The index of the snap at the start.' },
	{ name: 'lazy', type: '`boolean`, `number`', default: false, text: '`true`: start when the carousel comes within one screen of the view. A number: the distance in px.', example: 'lazy' },
	{ name: 'draggable', type: '`boolean`', default: true, text: 'Drag with the mouse, the pen and the finger.' },
	{ name: 'wheel', type: "`boolean`, `'both'`", default: true, text: "The mouse wheel moves a vertical carousel. `'both'`: also a horizontal carousel. `false`: the wheel does not move the carousel.", example: 'vertical' },
	{ name: 'resize', type: '`boolean`', default: true, text: 'Measure again when a size changes.' },
	{ name: 'slideChanges', type: '`boolean`', default: true, text: 'Measure again when the page adds or removes a slide.' },
	{ name: 'focus', type: '`boolean`', default: true, text: 'Go to a slide when it gets the keyboard focus.', example: 'controls' },
	{ name: 'inViewThreshold', type: '`number`', default: 0, text: 'The part of a slide, from 0 to 1, that must show for `slidesInView()`.' },
	{ name: 'active', type: '`boolean`', default: true, text: '`false`: do not start the carousel. Use it in `breakpoints`.' },
	{ name: 'breakpoints', ts: "Record<string, Options>", type: '`object`', default: {}, text: "The options for media queries: `{ '(min-width: 768px)': { loop: true } }`." },
	{ name: 'container', type: '`string`', default: null, text: 'The selector of the container, if the element is the root.' },
	{ name: 'slides', type: '`string`', default: null, text: 'The selector of the slides. With `null`, all children of the container are slides.' },
	{ name: 'wrap', type: '`boolean`', default: true, text: 'Add the root and the viewport if the page does not have them.' },
	{ name: 'arrows', type: '`boolean`, `Element`, `string`', default: true, text: 'Add the arrows to the root. `false`: no arrows. An element or a selector: add the arrows to that element.', example: 'heading' },
	{ name: 'dots', type: '`boolean`, `Element`, `string`', default: true, text: 'Add the dots. The values are the same as for `arrows`.', example: 'heading' },
	{
		name: 'labels',
		ts: "Labels",
		type: '`object`',
		default: { carousel: 'Carousel', slide: '%d of %n', prev: 'Previous slide', next: 'Next slide', dot: 'Go to slide %d', play: 'Start the slide show', pause: 'Stop the slide show' },
		shown: 'English',
		text: "The texts for screen readers: `carousel`, `slide` (`'%d of %n'`), `prev`, `next`, `dot` (`'Go to slide %d'`), `play`, `pause`. `%d` is the slide number, and `%n` is the number of slides."
	},
	{ name: 'classes', ts: "string | ClassNames | null", type: '`string`, `object`', default: null, text: "A class prefix such as `'embla'`, or an object with the names to change. The [Classes](#classes) table gives all names.", example: 'embla' },
	{ name: 'state', type: '`string`', default: '', text: "The prefix of the state classes, such as `'is_'`.", example: 'state' },
	{ name: 'sync', ts: "Carousel | Element | string | null", type: 'carousel, `Element`, `string`', default: null, text: 'Another carousel, its container or a selector. This carousel follows the selected slide of the other carousel. A click on a slide selects it in the other carousel.', example: 'product' },
	{ name: 'autoplay', ts: "boolean | number | AutoplayOptions", type: '`boolean`, `number`, `object`', default: false, text: 'Go to the next slide after a delay. `true`, a delay in ms, or an object.', example: 'autoplay' },
	{ name: 'autoScroll', ts: "boolean | number | AutoScrollOptions", type: '`boolean`, `number`, `object`', default: false, text: 'Move the slides at a constant speed. `true`, a speed in px/s, or an object.', example: 'logos' },
	{ name: 'autoHeight', type: '`boolean`', default: false, text: 'The viewport gets the height of the tallest slide in view.', example: 'height' },
	{ name: 'progress', ts: "boolean | ((state: ProgressState, carousel: Carousel) => void)", type: '`boolean`, `function`', default: false, text: 'Follow the progress, from 0 to 1. `true` sets `--better-progress` on the root. A function gets `{ progress, snap }` on each frame of a motion. See [Progress and offset](#progress-and-offset).' },
	{ name: 'offset', ts: "boolean | ((state: OffsetState, carousel: Carousel) => void)", type: '`boolean`, `function`', default: false, text: 'Follow the distance of each slide from its snap position, in slides. `true` sets `--better-offset` on each slide. A function gets `{ slide, index, offset, distance, size, visible }` for each slide on each frame of a motion.' }
];

export const methods = [
	{ name: '`BetterCarousel(element, options)`', returns: 'carousel', text: 'Start a carousel on a container or on its viewport. If the element has a carousel, return that carousel.' },
	{ name: '`goTo(index, instant)`', returns: '', text: 'Go to a snap. `index` is a snap index. With `instant` set to `true`, jump with no motion.' },
	{ name: '`goToNext(instant)`, `goToPrev(instant)`', returns: '', text: 'Go to the next or the previous snap.' },
	{ name: '`goToSlide(index, instant)`', returns: '', text: 'Go to the snap that shows a slide. `index` is a slide index. This slide becomes the selected slide.' },
	{ name: '`canGoToNext()`, `canGoToPrev()`', returns: '`boolean`', text: '`true` if a next or a previous snap exists. In a loop, `true` if not all slides fit.' },
	{ name: '`selectedSnap()`, `previousSnap()`', returns: '`number`', text: 'The index of the selected snap, or of the snap before it.' },
	{ name: '`selectedSlide()`', returns: '`number`', text: 'The index of the selected slide. With `sync`, the slide that is selected in the other carousel.' },
	{ name: '`snapOfSlide(index)`', returns: '`number`', text: 'The index of the snap that shows a slide.' },
	{ name: '`snapList()`', returns: '`number[]`', text: 'The progress of each snap, from 0 to 1.' },
	{ name: '`scrollProgress()`', returns: '`number`', text: 'The progress now, from 0 to 1, also during a motion.' },
	{ name: '`slidesInView()`', returns: '`number[]`', text: 'The indexes of the slides in view.' },
	{ name: '`slideNodes()`', returns: '`HTMLElement[]`', text: 'The slides. The list does not include the clones.' },
	{ name: '`rootNode()`, `viewportNode()`, `containerNode()`', returns: '`HTMLElement`', text: 'The root, the viewport and the container.' },
	{ name: '`isFit()`', returns: '`boolean`', text: '`true` if all slides fit in the viewport.' },
	{ name: '`options()`', returns: '`object`', text: 'The options that apply now, after the breakpoints.' },
	{ name: '`reInit(options)`', returns: '', text: 'Merge new options and start again. The selected slide stays.' },
	{ name: '`destroy()`', returns: '', text: 'Stop the carousel and restore the markup.' },
	{ name: '`on(name, handler)`, `off(name, handler)`', returns: 'carousel', text: 'Add or remove an event handler. The handler gets `(carousel, name)`.' },
	{ name: '`autoplay`', returns: '`object`', text: 'Only with the `autoplay` option: `play()`, `stop()`, `reset()` and `isPlaying()`.' },
	{ name: '`autoScroll`', returns: '`object`', text: 'Only with the `autoScroll` option: `play()`, `stop()` and `isPlaying()`.' },
	{ name: '`BetterCarousel.get(element)`', returns: 'carousel, `undefined`', text: 'The carousel of a root, a viewport or a container.' },
	{ name: '`BetterCarousel.initAll(selector, options)`', returns: 'carousel[]', text: 'Start a carousel on each element that matches the selector.' },
	{ name: '`BetterCarousel.defaults`', returns: '`object`', text: 'The options for all carousels. Set it before you start the carousels.' }
];

export const events = [
	{ name: '`init`', text: 'The carousel measured the layout for the first time.' },
	{ name: '`reinit`', text: 'A `reInit()` call or a breakpoint started the carousel again.' },
	{ name: '`resize`', text: 'The layout changed.' },
	{ name: '`select`', text: 'The selected snap changed.' },
	{ name: '`scroll`', text: 'The position changed during a motion or a drag.' },
	{ name: '`settle`', text: 'A motion stopped.' },
	{ name: '`pointerdown`, `pointerup`', text: 'A drag started or stopped.' },
	{ name: '`slidesinview`', text: 'The slides in view changed.' },
	{ name: '`slideschanged`', text: 'The page added or removed a slide.' },
	{ name: '`slidefocus`', text: 'A slide got the keyboard focus.' },
	{ name: '`autoplay:play`, `autoplay:stop`', text: 'The autoplay started or stopped.' },
	{ name: '`autoscroll:play`, `autoscroll:stop`', text: 'The auto scroll started or stopped.' },
	{ name: '`destroy`', text: 'The carousel stopped and restored the markup.' }
];

export const classes = [
	{ name: '`better`', text: 'The root' },
	{ name: '`better_viewport`', text: 'The viewport' },
	{ name: '`better_container`', text: 'The container' },
	{ name: '`better_horizontal`, `better_vertical`', text: 'The axis, on the root' },
	{ name: '`better_dynamic`', text: 'On the root, if not all slides fit' },
	{ name: '`better_auto_height`', text: 'On the root, with `autoHeight`' },
	{ name: '`better_button`, `better_prev`, `better_next`, `better_play`', text: 'The buttons' },
	{ name: '`better_dots`, `better_dot`', text: 'The dots' },
	{ name: '`active`', text: 'The selected slide' },
	{ name: '`clone`', text: 'A clone of a slide' },
	{ name: '`dragging`', text: 'On the root, during a drag' },
	{ name: '`playing`', text: 'On the root, while the autoplay or the auto scroll plays' },
	{ name: '`current`, `prev`, `next`, `first`, `last`', text: 'The selected dot and the four dots around it' }
];

// The differences from Embla 9 and Embla 8. "version" is the Embla version that has the name.
export const embla = [
	{ version: '9', name: 'Handler `(api, event)`', text: 'Handler `(carousel, name)`. The events have no `detail`.' },
	{ version: '9', name: 'Autoplay `delay` as a function that gives one delay for each snap', text: 'Autoplay `delay` as an array with one delay for each snap' },
	{ version: '8', name: 'Option `startIndex`', text: '`startSnap`' },
	{ version: '8', name: 'Options `watchDrag`, `watchResize`, `watchSlides`, `watchFocus`', text: '`draggable`, `resize`, `slideChanges`, `focus`' },
	{ version: '8', name: '`scrollTo(index, jump)`', text: '`goTo(index, instant)`' },
	{ version: '8', name: '`scrollNext()`, `scrollPrev()`', text: '`goToNext()`, `goToPrev()`' },
	{ version: '8', name: '`canScrollNext()`, `canScrollPrev()`', text: '`canGoToNext()`, `canGoToPrev()`' },
	{ version: '8', name: '`selectedScrollSnap()`, `previousScrollSnap()`', text: '`selectedSnap()`, `previousSnap()`' },
	{ version: '8', name: '`scrollSnapList()`', text: '`snapList()`' },
	{ version: '8', name: 'Events `reInit`, `slidesInView`, `slidesChanged`, `slideFocus`', text: '`reinit`, `slidesinview`, `slideschanged`, `slidefocus`' },
	{ version: '8', name: 'Events `pointerDown`, `pointerUp`', text: '`pointerdown`, `pointerup`' },
	{ version: '8, 9', name: 'Plugins `Autoplay`, `AutoScroll`, `AutoHeight`', text: 'The options `autoplay`, `autoScroll`, `autoHeight`' },
	{ version: '8, 9', name: '`plugins().autoplay`, `plugins().autoScroll`', text: '`carousel.autoplay`, `carousel.autoScroll`' },
	{ version: '8, 9', name: 'Plugin `ClassNames`', text: 'The options `classes` and `state`' },
	{ version: '8, 9', name: 'Plugin `WheelGestures` (a separate package)', text: 'The option `wheel`' }
];
