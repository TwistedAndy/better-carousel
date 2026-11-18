<div align="center">

<a href="https://twistedandy.github.io/better-carousel/"><img src="demo/assets/logo.svg" alt="Better Carousel" width="560" /></a>

<p>A small, fast and accessible JavaScript carousel.<br />The CSS sets the layout, and the motion runs on the compositor, also on slow phones.</p>

[![Gzip size](https://flat.badgen.net/static/gzip/12.3%20KB/green)](dist/better-carousel.min.js)
[![MIT license](https://flat.badgen.net/static/license/MIT/purple)](LICENSE)
[![No dependencies](https://flat.badgen.net/static/dependencies/0/blue)](package.json)

**[Documentation and live examples](https://twistedandy.github.io/better-carousel/)** · [Issues](https://github.com/TwistedAndy/better-carousel/issues)

</div>

## Features

- **Layout from CSS** - Your CSS sets the sizes of the slides, the space between them, the axis and the alignment. One carousel can show 1 slide on a phone and 4 slides on a desktop.
- **Smooth** - Each motion is a Web Animations API animation of `translate`. No script runs on each frame, also during the auto scroll.
- **Small** - <!-- generated:gzip -->12.3 KB<!-- /generated --> gzip with loop, autoplay, auto scroll, auto height, sync and the mouse wheel.
- **Loop** - The loop moves the original slides. It adds clones only if the slides are too few.
- **Vertical and grid** - A column layout makes a vertical carousel. A CSS grid with more rows also works.
- **Accessible** - WCAG 2.1 AA: names for the carousel, the slides and the buttons, the keyboard focus, a live region and reduced motion.
- **Lazy start** - With the `lazy` option, a carousel out of view starts when it comes near the screen.

## Install

Load the minified script and the stylesheet from jsDelivr. The script adds the global `BetterCarousel` function.

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/TwistedAndy/better-carousel@v1.1.1/dist/better-carousel.css"
  integrity="sha384-3ROtqpAC1ZPhSpDul73SGiTOv1L5kTr/08sUr6FPY6S79RIDi7mpI22ttbuxI/w8"
  crossorigin="anonymous"
/>
<script
  src="https://cdn.jsdelivr.net/gh/TwistedAndy/better-carousel@v1.1.1/dist/better-carousel.min.js"
  integrity="sha384-iAm/5iXDxHA5oHmRJqH1xjWnZzqQsmfklYM5v0iVGvJx/3cWrzFZ67xjIHyTVIz1"
  crossorigin="anonymous"
></script>
```

Or install the package from npm, and import the script and the stylesheet with a bundler:

```sh
npm install @twistedandy/better-carousel
```

```js
import BetterCarousel from '@twistedandy/better-carousel'
import '@twistedandy/better-carousel/css'
```

| File | Format | Use |
| --- | --- | --- |
| `dist/better-carousel.min.js` | IIFE, minified | For a `script` tag. It adds the global `BetterCarousel` function. |
| `dist/better-carousel.js` | ES module | For a bundler: `import BetterCarousel from '@twistedandy/better-carousel'`. |
| `dist/better-carousel.css` | CSS | The styles with the default class names. |
| `src/types/better-carousel.d.ts` | TypeScript | The types. TypeScript and the editors find them automatically. |
| `src/styles/better-carousel.scss` | SCSS | The styles with your class names: `@twistedandy/better-carousel/scss`. See [Styling](#styling). |

## Quick start

1. Put the slides into a container.
2. Give the container a flex row with CSS.
3. Give each slide a width and a right margin.
4. Start the carousel.

```html
<div class="items carousel">
  <div class="item"><img src="photo-1.jpg" alt="Photo 1" /></div>
  <div class="item"><img src="photo-2.jpg" alt="Photo 2" /></div>
  <div class="item"><img src="photo-3.jpg" alt="Photo 3" /></div>
  <div class="item"><img src="photo-4.jpg" alt="Photo 4" /></div>
</div>
```

```css
/* The negative margin of the container cancels the margin of the last slide in the row */
.items {
  --gap: 20px;
  display: flex;
  width: calc(100% + var(--gap));
  margin-right: calc(-1 * var(--gap));
}

.items .item {
  flex: none;
  width: calc(100% / 3 - var(--gap));
  margin-right: var(--gap);
}
```

```js
// One carousel
const carousel = BetterCarousel(document.querySelector('.items'))

// All carousels on the page
const carousels = BetterCarousel.initAll('.items.carousel')
```

The [documentation](https://twistedandy.github.io/better-carousel/) has live examples: alignment, vertical carousels, grids, free drag, thumbnails, autoplay, auto scroll and auto height.

## Concepts

The library puts the container into a viewport and a root. Then it adds the arrows and the dots to the root:

```html
<div class="better" role="region" aria-roledescription="carousel" aria-label="Carousel">
  <div class="better_viewport">
    <div class="items carousel better_container">
      <div class="item">...</div>
    </div>
  </div>
  <button class="better_button better_prev" aria-label="Previous slide"></button>
  <button class="better_button better_next" aria-label="Next slide"></button>
  <div class="better_dots">...</div>
</div>
```

| Term | Meaning |
| --- | --- |
| Root | The outer element. It holds the viewport, the arrows and the dots. The library adds it if the page does not have it. |
| Viewport | The element that clips the slides. Its size is the visible area. |
| Container | The element that moves. Your CSS sets its layout, and the library sets its `translate`. |
| Slide | A child of the container, or an element that matches the `slides` selector. |
| Snap | A position where the carousel can stop. A snap shows one slide or a group of slides. |
| Selected snap | The snap that shows now. `selectedSnap()` gives its index. |
| Selected slide | The slide at the selected snap. It gets the `selected` class. `selectedSlide()` gives its index. |
| Clone | A copy of a slide that the loop adds when the slides are too few. Clones are not in `slideNodes()`, and they have no index. A change in the content of a slide also changes its clones. |
| Motion | A change of position with an animation. When a motion stops, the `settle` event occurs. |
| Fit | All slides show in the viewport. The carousel does not move, and it does not show the arrows and the dots. |

A carousel can have fewer snaps than slides. For example, `slidesPerSnap: 2` puts two slides into each snap. Also, `containScroll: 'trimSnaps'` removes the snaps that show empty space at the ends. For this reason, the methods use two types of index:

- `goToSnap()`, `selectedSnap()` and `snapProgress()` use a snap index.
- `goToSlide()`, `selectedSlide()`, `slidesInView()` and `slideNodes()` use a slide index.
- `snapOfSlide(index)` gives the snap index of a slide.

## CSS layout

The library does not set the size of the slides or the space between them. It reads these values from the CSS and moves only the container.

| The CSS of the container | The result |
| --- | --- |
| `display: flex`, a row | A horizontal carousel |
| `flex-direction: column` | A vertical carousel |
| `display: grid` with `grid-auto-flow: column` | A horizontal carousel with more rows |
| `justify-content: center` | The selected slide is in the center |
| `justify-content: flex-end` | The selected slide is at the end |
| The margins of the slides and a negative margin of the container | The space between the slides. In a loop, also the space between the last slide and the first slide. |
| `direction: rtl` | A right-to-left carousel |
| The padding of the viewport | The snaps align to the inner edge of the padding. The padding shows parts of the slides next to the selected slide. |

The carousel measures again when the CSS changes, when the page adds or removes a slide, and when an image loads. A slide with `display: none` gets no snap. The `template`, `script` and `style` elements in the container are not slides. A CSS `scale` or `rotate` on a parent, such as the open animation of a modal window, does not change the snaps. To add or remove a slide, change the elements in the container.

A carousel can start in a hidden element, such as a tab, an accordion or a modal window. It has no size, so it shows no arrows and no dots. When the element shows, the carousel measures and starts to move.

## Frameworks

1. Render the root and the viewport in the component.
2. When the component mounts, start the carousel on the viewport. The library finds the container in the viewport and adds no wrapper.
3. Before the component unmounts, destroy the carousel.

The library does not move the elements that the framework controls.

### React

In Strict Mode, React runs each effect two times in development. The cleanup function destroys the first carousel, and the second carousel replaces it.

```jsx
import { useEffect, useRef } from 'react'
import BetterCarousel from '@twistedandy/better-carousel'
import '@twistedandy/better-carousel/css'

export default function Carousel({ slides, options }) {
  const viewport = useRef(null)
  const carousel = useRef(null)

  useEffect(() => {
    carousel.current = BetterCarousel(viewport.current, options)
    return () => carousel.current.destroy()
  }, [])

  return (
    <>
      <div className="better">
        <div className="better_viewport" ref={viewport}>
          <div className="items">
            {slides.map((slide) => (
              <div className="item" key={slide.id}>
                <img src={slide.src} alt={slide.alt} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <button type="button" onClick={() => carousel.current.goToNext()}>Next slide</button>
    </>
  )
}
```

### Vue

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import BetterCarousel from '@twistedandy/better-carousel'
import '@twistedandy/better-carousel/css'

const props = defineProps({ slides: Array, options: Object })
const viewport = ref(null)
let carousel = null

onMounted(() => {
  carousel = BetterCarousel(viewport.value, props.options)
})

onBeforeUnmount(() => carousel?.destroy())
</script>

<template>
  <div class="better">
    <div ref="viewport" class="better_viewport">
      <div class="items">
        <div v-for="slide in slides" :key="slide.id" class="item">
          <img :src="slide.src" :alt="slide.alt" />
        </div>
      </div>
    </div>
  </div>
</template>
```

### Svelte

This example is for Svelte 5. For Svelte 4, use `export let slides` and `export let options` in place of `$props()`.

```svelte
<script>
  import { onMount } from 'svelte'
  import BetterCarousel from '@twistedandy/better-carousel'
  import '@twistedandy/better-carousel/css'

  let { slides, options } = $props()
  let viewport

  onMount(() => {
    const carousel = BetterCarousel(viewport, options)
    return () => carousel.destroy()
  })
</script>

<div class="better">
  <div class="better_viewport" bind:this={viewport}>
    <div class="items">
      {#each slides as slide (slide.id)}
        <div class="item"><img src={slide.src} alt={slide.alt} /></div>
      {/each}
    </div>
  </div>
</div>
```

### Solid

```jsx
import { onMount, onCleanup, For } from 'solid-js'
import BetterCarousel from '@twistedandy/better-carousel'
import '@twistedandy/better-carousel/css'

export default function Carousel(props) {
  let viewport

  onMount(() => {
    const carousel = BetterCarousel(viewport, props.options)
    onCleanup(() => carousel.destroy())
  })

  return (
    <div class="better">
      <div class="better_viewport" ref={viewport}>
        <div class="items">
          <For each={props.slides}>
            {(slide) => <div class="item"><img src={slide.src} alt={slide.alt} /></div>}
          </For>
        </div>
      </div>
    </div>
  )
}
```

### Rules for frameworks

- Do not render other elements after the viewport in the root. The library adds the arrows and the dots at the end of the root. To put them in a different element, set the [`arrows`](#options) and [`dots`](#options) options.
- To change the options, call `reinit(newOptions)`. The selected slide stays.
- With server-side rendering, start the carousel only in the browser: in `useEffect`, `onMounted` or `onMount`. The library needs the DOM.

NOTE: When the framework adds or removes a slide, the carousel measures again. A `reinit()` call is not necessary.

## Options

Set the options in one of these places:

- In the call: `BetterCarousel(element, options)`.
- In the `data-carousel` attribute, as JSON.
- In `BetterCarousel.defaults`, for all carousels.

If the call and the attribute set the same option, the value of the attribute applies.

```html
<div class="items carousel" data-carousel='{"loop":true,"autoplay":3000}'>...</div>
```

```js
// All carousels of the site
BetterCarousel.defaults = { dragThreshold: 2 }

// One carousel, with different options for a media query
BetterCarousel(element, {
  align: 'center',
  breakpoints: {
    '(min-width: 1024px)': { drag: false },
  },
})

// The options that need no example of their own
BetterCarousel(element, {
  startSnap: 2,          // Start at the third snap
  duration: 600,         // The duration of a motion by one snap, in ms
  inViewThreshold: 0.5,  // A slide is in view when half of it shows
  resize: false,         // Do not measure again when a size changes
  slideChanges: false,   // Do not watch for added and removed slides
  wrapper: false,        // Add no root and viewport: the page has them
})
```

<!-- generated:options -->
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `axis` | `'x'`, `'y'`, `'auto'` | `'auto'` | The axis of the motion. With `'auto'`, the CSS of the container sets the axis. ([example](https://twistedandy.github.io/better-carousel/#switch)) |
| `align` | `'start'`, `'center'`, `'end'`, `'auto'`, `function` | `'auto'` | The position of the selected snap in the viewport. A function gets `(viewSize, snapSize, index)` and returns the offset in px. With `'auto'`, `justify-content` sets the alignment. ([example](https://twistedandy.github.io/better-carousel/#center)) |
| `dir` | `'ltr'`, `'rtl'`, `'auto'` | `'auto'` | The text direction. With `'auto'`, the CSS `direction` sets it. ([example](https://twistedandy.github.io/better-carousel/#rtl)) |
| `loop` | `boolean` | `false` | The first slide comes after the last slide. ([example](https://twistedandy.github.io/better-carousel/#loop)) |
| `clones` | `'auto'`, `'fill'`, `false` | `'auto'` | `'auto'`: add clones only if the loop needs them. `'fill'`: add clones that fill the window. `false`: add no clones. ([example](https://twistedandy.github.io/better-carousel/#clones)) |
| `dragFree` | `boolean`, `'snap'` | `false` | `true`: glide after a drag and stop at any position. `'snap'`: glide and stop at the nearest snap. ([example](https://twistedandy.github.io/better-carousel/#free)) |
| `dragFriction` | `number` | `1` | The length of the glide after a fast drag: the glide distance is divided by this number. `2`: half the distance. `0.5`: 2 times the distance. It also changes how many snaps a flick moves. The value must be more than 0. ([example](https://twistedandy.github.io/better-carousel/#free)) |
| `containScroll` | `'trimSnaps'`, `'keepSnaps'`, `false` | `'trimSnaps'` | `'trimSnaps'`: no empty space at the ends. `'keepSnaps'`: no empty space, but keep a snap for each group. `false`: snaps can show empty space. ([example](https://twistedandy.github.io/better-carousel/#contain)) |
| `slidesPerSnap` | `number`, `'auto'` | `1` | The number of slides in one snap. `'auto'`: the slides that fit in the viewport. ([example](https://twistedandy.github.io/better-carousel/#groups)) |
| `skipSnaps` | `boolean`, `number` | `true` | A fast flick can move more than one snap. `false`: one snap. A number: the maximum number of snaps. ([example](https://twistedandy.github.io/better-carousel/#skip)) |
| `dragThreshold` | `number` | `10` | The distance in px that the pointer moves before a drag starts. |
| `duration` | `number` | `400` | The duration of a motion by one snap, in ms. A longer motion takes more time, to a maximum of 2 times this value. ([example](https://twistedandy.github.io/better-carousel/#options-usage)) |
| `startSnap` | `number` | `0` | The index of the snap at the start. ([example](https://twistedandy.github.io/better-carousel/#options-usage)) |
| `lazy` | `boolean`, `number` | `false` | `true`: start when the carousel comes within one screen of the view. A number: the distance in px. ([example](https://twistedandy.github.io/better-carousel/#lazy)) |
| `drag` | `boolean` | `true` | Drag with the mouse, the pen and the finger. |
| `wheel` | `boolean`, `'both'` | `true` | The mouse wheel moves a vertical carousel. `'both'`: also a horizontal carousel. `false`: the wheel does not move the carousel. ([example](https://twistedandy.github.io/better-carousel/#vertical)) |
| `keys` | `boolean` | `true` | The arrow keys move the carousel while the keyboard focus is in it: left and right in a horizontal carousel, up and down in a vertical carousel. A key in a form field does not move the carousel. |
| `resize` | `boolean` | `true` | Measure again when a size changes. ([example](https://twistedandy.github.io/better-carousel/#options-usage)) |
| `slideChanges` | `boolean` | `true` | Measure again when the page adds or removes a slide. ([example](https://twistedandy.github.io/better-carousel/#changes)) |
| `focus` | `boolean` | `true` | Go to a slide when it gets the keyboard focus. ([example](https://twistedandy.github.io/better-carousel/#controls)) |
| `inViewThreshold` | `number` | `0` | The part of a slide, from 0 to 1, that must show for `slidesInView()`. ([example](https://twistedandy.github.io/better-carousel/#options-usage)) |
| `active` | `boolean` | `true` | `false`: do not start the carousel. Use it in `breakpoints`. ([example](https://twistedandy.github.io/better-carousel/#breakpoints)) |
| `breakpoints` | `object` | `{}` | The options for media queries: `{ '(min-width: 768px)': { loop: true } }`. ([example](https://twistedandy.github.io/better-carousel/#breakpoints)) |
| `container` | `string` | `null` | The selector of the container, if the element is the root. |
| `slides` | `string` | `null` | The selector of the slides. With `null`, all children of the container are slides. |
| `wrapper` | `boolean` | `true` | Add the root and the viewport if the page does not have them. ([example](https://twistedandy.github.io/better-carousel/#options-usage)) |
| `arrows` | `boolean`, `Element`, `string` | `true` | Add the arrows to the root. `false`: no arrows. An element or a selector: add the arrows to that element. ([example](https://twistedandy.github.io/better-carousel/#heading)) |
| `dots` | `boolean`, `Element`, `string` | `true` | Add the dots. The values are the same as for `arrows`. ([example](https://twistedandy.github.io/better-carousel/#heading)) |
| `dotsStyle` | `'zoom'`, `'all'` | `'zoom'` | The style of the dots. `'zoom'`: a window of 5 dots that slides, with smaller dots at the ends. `'all'`: all dots with the same size. |
| `labels` | `object` | English | The texts for screen readers: `carousel`, `slide` (`'%d of %n'`), `prev`, `next`, `dot` (`'Go to slide %d'`), `play`, `pause`. `%d` is the slide number, and `%n` is the number of slides. ([example](#accessibility)) |
| `classes` | `string`, `object` | `null` | A class prefix such as `'embla'`, or an object with the names to change. The [Classes](#classes) table gives all names. ([example](https://twistedandy.github.io/better-carousel/#embla)) |
| `state` | `string` | `''` | The prefix of the state classes, such as `'is_'`. ([example](https://twistedandy.github.io/better-carousel/#embla)) |
| `sync` | carousel, `Element`, `string` | `null` | Another carousel, its container or a selector. This carousel follows the selected slide of the other carousel. A click on a slide selects it in the other carousel. ([example](https://twistedandy.github.io/better-carousel/#product)) |
| `autoplay` | `boolean`, `number`, `object` | `false` | Go to the next slide after a delay. `true`, a delay in ms, or an object. ([example](#autoplay)) |
| `autoScroll` | `boolean`, `number`, `object` | `false` | Move the slides at a constant speed. `true`, a speed in px/s, or an object. ([example](https://twistedandy.github.io/better-carousel/#logos)) |
| `autoHeight` | `boolean` | `false` | The viewport gets the height of the tallest slide in view. ([example](https://twistedandy.github.io/better-carousel/#height)) |
| `progress` | `boolean`, `function` | `false` | Follow the progress, from 0 to 1. `true` sets `--better-progress` on the root. A function gets `{ progress, snap }` on each frame of a motion. See [Progress and offset](#progress-and-offset). |
| `offset` | `boolean`, `function` | `false` | Follow the distance of each slide from its snap position, in slides. `true` sets `--better-offset` on each slide. A function gets `{ node, index, offset, distance, size, visible }` for each slide on each frame of a motion. |
<!-- /generated -->

### autoplay

The value is `true`, a delay in ms, or an object. In the object, `delay` can also be an array with one delay for each snap. A `data-delay` attribute on a slide sets the delay of that slide, and it has priority over `delay`.

The autoplay pauses in these conditions:

- The keyboard focus is in the carousel.
- The tab is hidden.
- The carousel is out of view.

If the user prefers reduced motion, the autoplay does not start. A breakpoint change keeps the play state: a stopped autoplay stays stopped. These are the default values:

```js
BetterCarousel(element, {
  autoplay: {
    delay: 4000,               // ms on each slide, or an array with ms for each snap
    stopOnInteraction: true,   // A drag, an arrow or a dot stops the autoplay
    pauseOnHover: false,   // Pause while the mouse is on the carousel
    pauseOnFocus: true,       // Pause while the keyboard focus is in the carousel
    stopOnLastSnap: false,     // Stop at the last snap, if loop is false
    playOnInit: true,
    instant: false,            // Jump to the next slide with no motion
    timer: null,               // A function that shows the time to the next slide
  },
})
```

To show the time to the next slide, set `timer` to a function. The carousel calls it when the timer starts, with the delay in ms and the carousel. The function can return a cleanup function. The carousel calls the cleanup function when this timer ends or stops, for example at a pause. The library has no styles for a progress indicator.

```js
const bar = document.querySelector('.progress')

BetterCarousel(element, {
  autoplay: {
    timer: (delay) => {
      const animation = bar.animate([{ scale: '0 1' }, { scale: '1 1' }], delay)
      return () => animation.cancel()
    },
  },
})
```

An animation of `scale`, `translate` or `opacity` runs on the compositor: no script runs for each frame.

### autoScroll

The value is `true`, a speed in px/s, or an object. The motion is one animation on the compositor. The pause conditions are the same as for the autoplay. A press on the slides also stops them. If the pointer does not drag, the motion starts again after `startDelay`. These are the default values:

```js
BetterCarousel(element, {
  loop: true,
  autoScroll: {
    speed: 120,                // px per second
    direction: 'next',         // or 'prev'
    startDelay: 1000,          // ms before the start, and after an interaction
    stopOnInteraction: true,
    pauseOnHover: false,
    pauseOnFocus: true,
    playOnInit: true,
  },
})
```

### sync

The `sync` option links two carousels, for example a gallery and its thumbnails:

1. Put the same slides into the two carousels, in the same order.
2. Use buttons for the thumbnails, so that the keyboard can select them.
3. Set `sync` on the thumbnails carousel.

The thumbnails follow the main gallery, and a click on a thumbnail selects its photo. A drag moves only the thumbnails. The thumbnail of the selected photo gets the `selected` class. In this example, the `arrows` option puts the arrows of the main gallery next to the thumbnails.

```html
<div class="items carousel gallery_main" data-carousel='{"dots":false,"arrows":".gallery_nav"}'>...</div>
<div class="gallery_nav">
  <div class="items carousel gallery_thumbs" data-carousel='{"sync":".gallery_main","arrows":false,"dots":false}'>
    <button type="button" class="item"><img src="thumb-1.jpg" alt="Show photo 1" /></button>
    ...
  </div>
</div>
```

The value of `sync` can be a selector, a container or a carousel. The library searches for a selector in the root of the carousel first, and then in each parent of the root. A carousel can follow only one other carousel.

### progress and offset

The `progress` and `offset` options give the position of the carousel on each frame of a motion. Use them for a progress bar, a parallax effect, or a fade. They are off by default, because a script runs on each frame while they are on.

With `true`, the carousel sets CSS variables:

- `--better-progress` on the root: the progress, from 0 to 1;
- `--better-offset` on each slide: the distance from the snap position of the slide, in slides. The value is 0 at the snap position, 1 for the next slide and -1 for the previous slide.

```html
<div class="items carousel" data-carousel='{"progress":true,"offset":true}'>...</div>
```

A progress bar at the bottom of the slides:

```css
.better_viewport::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  z-index: 3;
  height: 4px;
  background: currentColor;
  transform-origin: left;
  scale: var(--better-progress, 0) 1;
}
```

Parallax: each photo is larger than its slide, and it moves slower than the slide.

```css
.better .item {
  overflow: hidden;
}

.better .item img {
  scale: 1.3;
  translate: calc(clamp(-1, var(--better-offset, 0), 1) * -10%) 0;
}
```

Scale and fade: the photos far from the selected snap are smaller and lighter.

```css
.better .item {
  --distance: min(1, max(var(--better-offset, 0), -1 * var(--better-offset, 0)));
}

.better .item img {
  scale: calc(1 - 0.25 * var(--distance));
  opacity: calc(1 - 0.6 * var(--distance));
}
```

Change an element in the slide, not the slide. The carousel measures the slides, and a `scale` on a slide changes its size for the carousel.

A function gets a state object and the carousel. The carousel uses the same object for each call, so read the values during the call:

```js
BetterCarousel(element, {
  // { progress, snap }: snap is the position between the snaps, for example 2.4
  progress: ({ progress, snap }) => {
    bar.style.scale = progress + ' 1';
  },
  // { node, index, offset, distance, size, visible }, one call for each slide
  offset: ({ node, offset, visible }) => {
    node.style.opacity = 0.4 + 0.6 * visible;
  },
})
```

- `distance` is the same distance as `offset`, in px on the screen. A positive value is to the right or down.
- `size` is the size of the slide on the main axis, in px.
- `visible` is the part of the slide in the viewport, from 0 to 1.
- `index` is the index of the slide. A clone gives the index of its slide.

In loop mode, the progress goes from 1 back to 0. The auto scroll is a motion that does not stop: with these options, a script runs on each frame while it plays.

## Methods

`BetterCarousel(element, options)` returns the carousel. The methods below are the methods of the carousel, and of the `BetterCarousel` function.

<!-- generated:methods -->
| Method | Returns | Description |
| --- | --- | --- |
| `BetterCarousel(element, options)` | carousel | Start a carousel on a container or on its viewport. If the element has a carousel, return that carousel. |
| `goToSnap(index, instant)` | - | Go to a snap. `index` is a snap index. With `instant` set to `true`, jump with no motion. |
| `goToNext(instant)`, `goToPrev(instant)` | - | Go to the next or the previous snap. |
| `goToSlide(index, instant)` | - | Go to the snap that shows a slide. `index` is a slide index. This slide becomes the selected slide. |
| `canGoToNext()`, `canGoToPrev()` | `boolean` | `true` if a next or a previous snap exists. In a loop, `true` if not all slides fit. |
| `selectedSnap()`, `previousSnap()` | `number` | The index of the selected snap, or of the snap before it. |
| `selectedSlide()` | `number` | The index of the selected slide. With `sync`, the slide that is selected in the other carousel. |
| `snapOfSlide(index)` | `number` | The index of the snap that shows a slide. |
| `snapProgress()` | `number[]` | The progress of each snap, from 0 to 1. |
| `progress()` | `number` | The progress now, from 0 to 1, also during a motion. |
| `slidesInView()` | `number[]` | The indexes of the slides in view. |
| `slideNodes()` | `HTMLElement[]` | The slides. The list does not include the clones. |
| `rootNode()`, `viewportNode()`, `containerNode()` | `HTMLElement` | The root, the viewport and the container. |
| `isFit()` | `boolean` | `true` if all slides fit in the viewport. |
| `options()` | `object` | The options that apply now, after the breakpoints. |
| `reinit(options)` | - | Merge new options and start again. The selected slide stays. |
| `destroy()` | - | Stop the carousel and restore the markup. |
| `on(name, handler)`, `off(name, handler)` | carousel | Add or remove an event handler. The handler gets `(carousel, name)`. |
| `autoplay` | `object` | Only with the `autoplay` option: `play()`, `stop()`, `reset()` and `isPlaying()`. |
| `autoScroll` | `object` | Only with the `autoScroll` option: `play()`, `stop()` and `isPlaying()`. |
| `BetterCarousel.get(element)` | carousel, `undefined` | The carousel of a root, a viewport or a container. |
| `BetterCarousel.initAll(selector, options)` | carousel[] | Start a carousel on each element that matches the selector. |
| `BetterCarousel.defaults` | `object` | The options for all carousels. Set it before you start the carousels. |
<!-- /generated -->

```js
const carousel = BetterCarousel(element, { loop: true })

carousel.on('select', (carousel) => {
  console.log('Slide', carousel.selectedSlide())
})

document.querySelector('.next').addEventListener('click', () => carousel.goToNext())
```

## Events

Add a handler with `on(name, handler)`, and remove it with `off(name, handler)`. The handler gets `(carousel, name)`.

<!-- generated:events -->
| Event | When |
| --- | --- |
| `init` | The carousel measured the layout for the first time. |
| `reinit` | A `reinit()` call or a breakpoint started the carousel again. |
| `resize` | The layout changed. |
| `select` | The selected snap changed. |
| `scroll` | The position changed during a motion or a drag. |
| `settle` | A motion stopped. |
| `dragstart`, `dragend` | A drag started or stopped. |
| `slidesinview` | The slides in view changed. |
| `slideschanged` | The page added or removed a slide. |
| `slidefocus` | A slide got the keyboard focus. |
| `autoplay:play`, `autoplay:stop` | The autoplay started or stopped. |
| `autoscroll:play`, `autoscroll:stop` | The auto scroll started or stopped. |
| `destroy` | The carousel stopped and restored the markup. |
<!-- /generated -->

CAUTION: Add a `scroll` handler only if you need it. With this handler, each motion runs in a `requestAnimationFrame` loop on the main thread.

## Styling

The stylesheet has the rules that the carousel needs. It also has the look of the arrows, the dots and the play button.

- To change the colors, set the CSS variables.
- To change the class names, compile the SCSS file.

### CSS variables

The buttons and the dots use the button variables of the theme. The arrow icon is an inline SVG in the stylesheet. To use a different icon, set `--button-arrow`.

```css
:root {
  --height-button: 2.5rem;         /* The size of the buttons */
  --button-arrow: url(arrow.svg);  /* Optional: the default is a chevron */
  --button-border: #7c3aed;
  --button-base: #7c3aed;          /* Also the selected dot */
  --button-text: #fff;
  --button-border-active: #6d28d9;
  --button-base-active: #6d28d9;
  --button-text-active: #fff;
  --button-border-disabled: #e8e8e8;
  --button-base-disabled: #f5f5f5;
  --button-text-disabled: #74787d; /* Also the dots */
}
```

### SCSS

The SCSS file uses `@import` and global variables, so it compiles with Dart Sass and with node-sass. Set the variables before the import:

```scss
$better: 'embla';              // The class prefix: .embla, .embla_viewport, .embla_button
$better-state: 'is_';          // The prefix of the state classes: .is_selected, .is_current
$better-look: false;           // Only the rules that the carousel needs
$better-arrow: url(arrow.svg); // The default icon of the arrows. The --button-arrow variable comes first.

@import 'better-carousel';
```

Then set the same names in the options: `{ classes: 'embla', state: 'is_' }`.

### Classes

These are the default class names. A prefix in `classes` changes the first part of the names. The `state` prefix changes the state classes: `selected`, `dragging`, `playing` and the classes of the dots.

<!-- generated:classes -->
| Class | Element |
| --- | --- |
| `better` | The root |
| `better_viewport` | The viewport |
| `better_container` | The container |
| `better_horizontal`, `better_vertical` | The axis, on the root |
| `better_fit` | On the root, if all slides fit |
| `better_auto_height` | On the root, with `autoHeight` |
| `better_button`, `better_prev`, `better_next`, `better_play` | The buttons |
| `better_dots`, `better_dots_track`, `better_dot` | The window of the dots, the row that slides in it, and the dots |
| `better_dots_marker` | The marker of the selected dot |
| `better_dots_all` | On the window of the dots, with `dotsStyle: 'all'` |
| `selected` | The selected slide |
| `clone` | A clone of a slide |
| `dragging` | On the root, during a drag |
| `playing` | On the root, while the autoplay or the auto scroll plays |
| `current`, `prev`, `next`, `first`, `last` | The selected dot and the four dots around it |
<!-- /generated -->

```js
// .embla, .embla_viewport, .embla_button, .is_selected
BetterCarousel(element, { classes: 'embla', state: 'is_' })

// Change one name
BetterCarousel(element, { classes: { selected: 'snapped' } })
```

## Accessibility

The carousel follows the carousel pattern of the WAI-ARIA Authoring Practices and WCAG 2.1 AA.

- The root is a region with the name "Carousel". Each slide has a name such as "2 of 8". A slide that is an `article` or a list item keeps its own role.
- The arrows and the dots are buttons with names. A screen reader reads each new slide (`aria-live`), but not during the autoplay.
- Tab moves the focus through the links and the fields in the slides. The carousel moves to show the focused element.
- While the focus is in the carousel, the arrow keys go to the previous and the next slide. To turn them off, set `keys: false`.
- Clones are `inert` and hidden from screen readers.
- The autoplay and the auto scroll have a play and pause button (WCAG 2.2.2). The keyboard focus pauses them. If the user prefers reduced motion, they do not start.
- A drag across the axis scrolls the page. A link opens on a click, but not after a drag.

To translate the labels, set `labels`. In the texts, `%d` is the slide number, and `%n` is the number of slides:

```js
BetterCarousel.defaults = {
  labels: {
    carousel: 'Karussell',
    slide: '%d von %n',
    prev: 'Vorheriges Bild',
    next: 'Nächstes Bild',
    dot: 'Zu Bild %d',
    play: 'Diashow starten',
    pause: 'Diashow anhalten',
  },
}
```

## Performance

The library is made for slow phones. A motion runs on the compositor, and a carousel at rest uses no CPU.

<!-- generated:sizes -->
| File | Minified | Gzip | Brotli |
| --- | --- | --- | --- |
| `better-carousel.min.js` | 29.9 KB | 12.3 KB | 11.2 KB |
| `better-carousel.css` | 4.7 KB | 1.3 KB | 1.1 KB |
| Total | 34.6 KB | 13.7 KB | 12.4 KB |
<!-- /generated -->

The [Comparison](#comparison) section gives the sizes and the runtime costs of other carousel libraries.

| Measure, on a phone with a CPU 4 times slower | Better Carousel |
| --- | --- |
| CPU load during 10 s of auto scroll | 0.5% |
| CPU load during 10 s of autoplay | 1.1% |
| Total Blocking Time added at page load | 0 ms |
| Layout shift | 0 |

- A motion is a Web Animations API animation of `translate`. No script runs on each frame.
- The auto scroll is one animation that does not stop. During the motion, the browser does no script, style, layout or paint work.
- One `ResizeObserver` serves all carousels. It reads the layout of all carousels first, and then it writes. For this reason, the browser calculates the layout only one time.
- Only two elements of the dots animate: the row of the dots and the marker of the selected dot. Both move with `translate`. A click on a dot causes no layout work.
- The listeners for the autoplay and the mouse wheel exist only while they can do something.
- The `progress` and `offset` options run a script on each frame of a motion. For this reason, they are off by default.

## Comparison

This benchmark compares Better Carousel with Swiper, Embla Carousel and Glide in Chrome. All libraries make the same carousel: 10 slides, the loop, the drag, the arrows, the dots and a motion of 400 ms. Embla uses the arrows, the dots and the CSS of its own examples, and the plugins for the same features. [bench/README.md](bench/README.md) gives the method, the metrics, the profiles and the steps to run the benchmark on your computer.

On a phone with a CPU 4 times slower:

- With all features, Better Carousel is 13.3 KB gzip. Embla is 13.5 KB and Swiper 32.9 KB with the same features. Embla still has no names for screen readers and no arrow keys. Glide does not have all of these features.
- 6 slide changes take 180 ms of main-thread time. Swiper takes 221 ms, Glide 329 ms and Embla 1584 ms.
- The autoplay uses 0.9% of the CPU. Glide uses 2.4%, Swiper 24.4% and Embla 32.2%.
- 5 drags take 1053 ms, about the same as Swiper (1024 ms). Glide takes 1732 ms and Embla 3587 ms. A drag causes the fewest paints of all libraries, and no layout shift.
- A page with 10 carousels has 28 ms of Total Blocking Time. Swiper has 61 ms and Glide 42 ms. Embla has 18 ms.

Measured with Chrome 157.0.8103.51 (headless) on 12th Gen Intel(R) Core(TM) i9-12900HK, 20 threads, 64 GB of memory, 2026-11-17. Each value is the median of 3 rounds.

### Bundle size

![Typical setup, JS + CSS, gzip](bench/results/charts/size.svg)

| Library | Core | Typical | Typical, brotli | All features | Shipped files |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Better Carousel 1.0.0** | 13.3 | **13.3** | 12.1 | 13.3 | 12.9 |
| Swiper 14.4.0 | 21.7 | **29.7** | 26.2 | 32.9 | 46.2 |
| Embla Carousel 8.6.0 | 7.6 | **9.7** | 8.7 | 13.5 | 7.0 |
| Glide 3.7.1 | 6.9 | **8.3** | 7.4 | not available | 8.7 |

KB after gzip, JS and CSS. Core: the smallest setup that the user can drag. Typical: the setup of the tests below, with the loop, the arrows, the dots, the autoplay and the accessibility module. All features: the typical setup, the mouse wheel, the auto scroll, the auto height, the free drag and the sync. Shipped files: the minified JS and CSS files of the package, as they are.

### Mobile, CPU 4 times slower

![Mobile: main-thread time, 6 slide changes](bench/results/charts/navigate.svg)

![Mobile: main-thread time, 5 drags](bench/results/charts/drag.svg)

![Mobile: CPU load of the autoplay](bench/results/charts/autoplay.svg)

![Mobile: Total Blocking Time, page with 10 carousels](bench/results/charts/blocking.svg)

| Library | Load, ms | Blocking, ms | Layout shift | Idle CPU, % | Navigate, ms | Navigate paints | Autoplay CPU, % | Drag, ms | Drag paints | Busy: bad frames, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Better Carousel** | 198 | 28 | 0.000 | 0.2 | 180 | 12 | 0.9 | 1053 | 8 | 3.2 |
| Swiper | 239 | 61 | 0.000 | 0.1 | 221 | 12 | 24.4 | 1024 | 10 | 4.3 |
| Embla Carousel | 190 | 18 | 0.000 | 0.2 | 1584 | 12 | 32.2 | 3587 | 10 | 26.2 |
| Glide | 221 | 42 | 0.000 | 0.1 | 329 | 22 | 2.4 | 1732 | 20 | 1.3 |
| No carousel | 117 | 0 | 0.000 | 0.2 | 14 | 0 | 0.1 | 354 | 0 | - |

### Desktop

| Library | Load, ms | Blocking, ms | Layout shift | Idle CPU, % | Navigate, ms | Navigate paints | Autoplay CPU, % | Drag, ms | Drag paints | Busy: bad frames, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Better Carousel** | 40 | 0 | 0.000 | 0.0 | 37 | 12 | 0.4 | 174 | 30 | 1.5 |
| Swiper | 51 | 0 | 0.000 | 0.0 | 29 | 12 | 3.3 | 146 | 16 | 1.2 |
| Embla Carousel | 42 | 0 | 0.000 | 0.0 | 266 | 12 | 5.6 | 518 | 60 | 15.7 |
| Glide | 47 | 0 | 0.000 | 0.0 | 49 | 26 | 0.6 | 303 | 22 | 0.7 |
| No carousel | 30 | 0 | 0.000 | 0.1 | 3 | 0 | 0.0 | 45 | 0 | - |

Load: the main-thread time and the Total Blocking Time of a page with 10 carousels. Navigate: 6 calls of `next()`. Drag: 5 drags. Busy: the share of frames that were dropped or late during navigate, while another script blocks the main thread. Less is better in all columns.

### Features

| Feature | Better | Swiper | Embla | Glide |
| --- | ---: | ---: | ---: | ---: |
| Slide sizes and gaps from CSS | yes | partly (`slidesPerView: 'auto'`) | yes | no |
| Loop without clones | yes | yes | yes | no |
| Vertical | yes | yes | yes | no |
| Right-to-left | yes | yes | yes | yes |
| Breakpoints | yes | yes | yes | yes |
| Free drag with momentum | yes | module | yes | no |
| Arrows and dots | yes | modules | no | your markup |
| Autoplay | yes | module | plugin | yes |
| Auto scroll without stops | yes | partly (autoplay with delay 0) | plugin | no |
| Auto height | yes | yes | plugin | no |
| Sync of two carousels | yes | module | no | no |
| Mouse wheel | yes | module | plugin of a third party | no |
| Arrow keys | yes | module | no | yes |
| Names for screen readers | yes | module | no | no |
| Start only when near the screen | yes | no | no | no |
| Fade and other effects | no | modules (fade, cube, flip, coverflow, cards, creative) | plugin (fade) | no |
| TypeScript types | yes | yes | yes | separate package |

Run the benchmark: `npm run bench`. The [bench/README.md](bench/README.md) file gives the method and the options.

## Development

```sh
npm install
npm run dev     # build again after each change
npm run build   # build dist/ and demo/demo.css, then update the docs
npm run docs    # update the generated parts of README.md and index.html
npm test        # unit tests
npm run e2e     # browser tests in Chrome
```

The browser tests open `http://better.test/` in Chrome. To use a different address or a different Chrome, set `URL` and `CHROME`.

The docs page is [`index.html`](index.html). Its scripts and styles are in [`demo/`](demo). The reference tables and the file sizes in README.md and index.html, and the `Options` interface in [`src/types/better-carousel.d.ts`](src/types/better-carousel.d.ts), come from [`scripts/reference.js`](scripts/reference.js). Do not edit the parts in the `generated` HTML comments. Edit `scripts/reference.js`, and then run `npm run docs`.

## License

[MIT](LICENSE)
