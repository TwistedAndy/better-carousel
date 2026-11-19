# Carousel benchmark results

Made by `bench/run.mjs` and `bench/report.mjs`. See `bench/README.md` for the method and the steps to run it again.

## Environment

| Item | Value |
| --- | ---: |
| Date | 2026-11-19T06:19:36.759Z |
| Browser | Chrome/157.0.8103.51, headless |
| OS | Windows_NT 10.0.26300 x64 |
| CPU | 12th Gen Intel(R) Core(TM) i9-12900HK, 20 threads |
| Memory | 64 GB |
| Node.js | v26.11.1 |
| puppeteer-core | 25.17.0 |
| esbuild | 0.28.2 |
| Better Carousel commit | cd56400 with changes that are not committed |
| Rounds, seed | 3, 1 |
| Libraries | Better Carousel 1.1.6, Swiper 14.4.0 (2026-10-30), Embla Carousel 8.6.0 (2025-04-04), Glide 3.7.1 (2024-11-22) |

## Summary

### Mobile: 412 × 823, CPU 4 times slower, 1 slide in view

| Library | Load ms | TBT ms | CLS | Idle CPU % | Navigate ms | Nav. paints | Autoplay CPU % | Drag ms | Drag paints | Busy bad frames % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 230 | 41 | 0.000 | 0.1 | 118 | 17 | 0.6 | 519 | 18 | 1.9 |
| Swiper | 251 | 65 | 0.000 | 0.2 | 128 | 12 | 16.7 | 619 | 10 | 3.0 |
| Embla Carousel | 217 | 42 | 0.000 | 0.2 | 866 | 12 | 16.9 | 1477 | 10 | 15.5 |
| Glide | 236 | 54 | 0.000 | 0.1 | 197 | 24 | 1.6 | 816 | 20 | 0.7 |
| No carousel | 126 | 0 | 0.000 | 0.1 | 15 | 0 | 0.1 | 193 | 0 | - |

### Desktop: 1350 × 940, no CPU throttling, 3 slides in view

| Library | Load ms | TBT ms | CLS | Idle CPU % | Navigate ms | Nav. paints | Autoplay CPU % | Drag ms | Drag paints | Busy bad frames % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 41 | 0 | 0.000 | 0.0 | 26 | 17 | 0.3 | 97 | 58 | 0.4 |
| Swiper | 51 | 0 | 0.000 | 0.1 | 26 | 12 | 2.6 | 108 | 16 | 1.6 |
| Embla Carousel | 39 | 0 | 0.000 | 0.0 | 189 | 12 | 3.8 | 352 | 60 | 15.3 |
| Glide | 51 | 0 | 0.000 | 0.1 | 31 | 24 | 0.5 | 199 | 22 | 0.7 |
| No carousel | 27 | 0 | 0.000 | 0.0 | 3 | 0 | 0.0 | 38 | 0 | - |

Load: main-thread time, Total Blocking Time (TBT) and Cumulative Layout Shift (CLS) of a page with 10 carousels. Navigate: 6 calls of next(). Drag: 5 drags. Busy: the frames that were dropped or late during navigate, while another script blocks the main thread. The values are the medians of all rounds. Less is better in all columns.

## Bundle size

KB after gzip (level 9), from esbuild 0.28.2 with the same settings for all libraries: iife, es2020, minified, tree shaken.

- **Core**: the smallest import that makes a carousel that the user can drag.
- **Typical**: loop, drag, arrows, dots, autoplay, and the accessibility module if the library has one. For Embla, the arrows and the dots are the script and the CSS of the Embla examples, and the ClassNames plugin gives the state classes.
- **Parity**: the typical set, with the mouse wheel, the auto scroll, the auto height, the free drag, the sync and the lazy load. For Embla, the sync and the lazy load are the scripts of the Embla examples. "no" means that the library does not have these features.
- **Shipped files**: the minified files that the package gives for a script tag, as they are, for all the features of the parity set. For Embla, the core file and the files of the Autoplay, ClassNames, AutoScroll, AutoHeight and WheelGestures plugins, each compressed separately.

| Library | Core JS | Typical JS | Typical CSS | Typical JS + CSS | Typical, brotli | Parity JS + CSS | Shipped files JS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel 1.1.6 | 13.6 | 13.6 | 1.5 | **15.0** | 13.6 | 15.0 | 13.1 |
| Swiper 14.4.0 | 20.6 | 27.4 | 2.2 | **29.7** | 26.2 | 32.9 | 43.4 |
| Embla Carousel 8.6.0 | 7.4 | 9.1 | 0.6 | **9.7** | 8.7 | 13.7 | 13.4 |
| Glide 3.7.1 | 6.5 | 7.6 | 0.7 | **8.3** | 7.4 | no | 7.8 |

## Runtime

### Mobile: 412 × 823, CPU 4 times slower, 1 slide in view

#### Load

10 carousels on one page. The values are from the start of the page to 1 s after the load event. Main-thread time includes the parse of the page and the decode of the images: compare each library to "No carousel".

| Library | Main-thread time, ms | Total Blocking Time, ms | Mount call, ms | Layouts | Layout shift | DOM nodes | JS heap, KB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 230.0 (211.9–292.4) | 41 (40–57) | 20.1 (13.5–26.1) | 4 (3–5) | 0.000 | 823 | 1184 |
| Swiper | 251.4 (248.8–274.4) | 65 (64–89) | 102.1 (100.6–125.4) | 23 (23–24) | 0.000 | 740 | 1478 (1475–1478) |
| Embla Carousel | 217.4 (195.7–385.7) | 42 (24–83) | 76.1 (59.5–104.8) | 25 | 0.000 | 860 | 1217 |
| Glide | 235.5 (210.3–264.4) | 54 (43–80) | 87.0 (77.2–108.9) | 33 | 0.000 | 930 | 1120 |
| No carousel | 126.2 (122.2–130.4) | 0 | 0.3 (0.2–0.4) | 3 | 0.000 | 550 | 759 |

#### Idle

One carousel at rest for 2 s, after the page is at rest. A carousel that does nothing must cost nothing.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.1 | 0 | 0 | 0 | 0 | 2 (0–3) | - |
| Swiper | 0.2 | 0 | 0 | 0 | 0 | 0 (0–5) | - |
| Embla Carousel | 0.2 (0.2–0.3) | 0 | 0 | 0 | 0 | 0 | - |
| Glide | 0.1 (0.1–0.2) | 0 | 0 | 0 | 0 | 2 (0–2) | - |
| No carousel | 0.1 | 0 | 0 | 0 | 0 | 2 (1–3) | - |

#### Navigate

One carousel. The runner calls next() 6 times, one time each 700 ms. A motion takes 400 ms where the library has a duration option.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 2.8 (2.6–3.2) | 7 (5–8) | 5 | 34 (34–35) | 17 | 252 (249–253) | 0.4 (0.0–0.8) |
| Swiper | 3.0 (2.7–4.1) | 3 (3–6) | 6 | 35 (32–36) | 12 | 257 (250–274) | 1.2 (0.4–2.9) |
| Embla Carousel | 20.3 (20.0–27.7) | 160 (136–191) | 0 | 428 (426–429) | 12 | 427 (424–850) | 0.0 |
| Glide | 4.6 (4.2–14.9) | 4 (3–7) | 0 | 61 (57–64) | 24 (22–24) | 433 (408–438) | 0.0 |
| No carousel | 0.4 (0.3–0.5) | 0 | 0 | 0 | 0 | 4 (3–5) | - |

#### Autoplay

One carousel with the autoplay at 1500 ms, for 4.5 s.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.6 (0.4–1.3) | 7 (4–8) | 0 (0–1) | 7 (6–13) | 5 (2–5) | 44 (40–86) | 0.0 (0.0–2.3) |
| Swiper | 16.7 (15.6–18.8) | 138 (120–154) | 3 | 105 (104–106) | 6 | 103 (102–104) | 0.0 |
| Embla Carousel | 16.9 (16.3–19.9) | 162 (149–182) | 0 | 305 (299–341) | 6 | 303 (298–342) | 0.0 |
| Glide | 1.6 (1.1–1.7) | 4 | 0 | 25 (17–27) | 8 (4–8) | 146 (122–151) | 0.0 |
| No carousel | 0.1 | 0 | 0 | 0 | 0 | 3 | - |

#### Drag

One carousel. 5 drags of 70% of the width, in 18 moves of about 16 ms each, then a release and a wait of 700 ms. Mobile uses touch events, desktop uses the mouse.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 8.1 (7.8–8.4) | 72 (64–76) | 4 | 108 | 18 | 457 (449–458) | 0.0 |
| Swiper | 8.7 (8.5–9.1) | 86 (85–87) | 5 | 110 (109–111) | 10 | 291 (291–292) | 1.0 (0.3–1.4) |
| Embla Carousel | 20.9 (20.4–26.6) | 229 (228–266) | 0 | 674 (669–688) | 10 | 672 (671–730) | 0.0 (0.0–1.2) |
| Glide | 12.7 (11.5–14.1) | 130 (102–137) | 0 | 215 (215–219) | 20 | 302 (299–309) | 0.3 (0.0–1.0) |
| No carousel | 2.8 (2.3–2.9) | 0 | 0 | 0 | 0 | 2 (1–4) | - |

#### Busy

The navigate scenario while another script blocks the main thread for 35 ms of each 50 ms. A motion that needs the main thread on each frame drops frames here.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 68.9 (68.0–69.0) | 2919 | 5 | 26 (25–27) | 17 | 261 (252–266) | 1.9 (0.4–4.2) |
| Swiper | 69.8 (67.1–70.4) | 2954 (2883–2994) | 6 | 25 (23–27) | 12 | 266 (262–280) | 3.0 (1.9–5.4) |
| Embla Carousel | 83.1 (82.5–85.1) | 3168 (3162–3169) | 0 | 325 (302–338) | 12 | 762 (737–778) | 15.5 (13.8–19.3) |
| Glide | 72.3 (72.1–73.1) | 3030 (3022–3095) | 0 | 43 (40–46) | 22 (22–24) | 444 (441–454) | 0.7 (0.7–1.1) |
| No carousel | 61.5 (57.3–62.6) | 2704 (2533–2736) | 0 | 0 | 0 | 3 (0–4) | - |

### Desktop: 1350 × 940, no CPU throttling, 3 slides in view

#### Load

10 carousels on one page. The values are from the start of the page to 1 s after the load event. Main-thread time includes the parse of the page and the decode of the images: compare each library to "No carousel".

| Library | Main-thread time, ms | Total Blocking Time, ms | Mount call, ms | Layouts | Layout shift | DOM nodes | JS heap, KB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 41.4 (41.0–44.9) | 0 | 2.2 (2.2–2.3) | 4 | 0.000 | 823 | 1132 |
| Swiper | 51.3 (50.5–53.0) | 0 | 18.7 (18.0–19.2) | 23 | 0.000 | 740 | 1493 (1493–1494) |
| Embla Carousel | 39.2 (38.9–39.9) | 0 | 10.8 (10.6–11.0) | 24 | 0.000 | 860 | 1193 |
| Glide | 50.8 (48.7–50.9) | 0 | 16.6 (16.5–16.8) | 33 (33–34) | 0.000 | 1230 | 1126 |
| No carousel | 26.9 (24.0–27.8) | 0 | 0.0 (0.0–0.1) | 3 (2–3) | 0.000 | 550 | 719 |

#### Idle

One carousel at rest for 2 s, after the page is at rest. A carousel that does nothing must cost nothing.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Swiper | 0.1 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Embla Carousel | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Glide | 0.1 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| No carousel | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |

#### Navigate

One carousel. The runner calls next() 6 times, one time each 700 ms. A motion takes 400 ms where the library has a duration option.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.6 (0.5–0.6) | 1 | 5 | 37 (36–39) | 17 | 249 (248–251) | 0.0 (0.0–0.4) |
| Swiper | 0.6 (0.5–0.7) | 1 (0–1) | 6 | 37 (36–38) | 12 | 248 (247–249) | 0.0 |
| Embla Carousel | 4.4 | 23 (22–23) | 0 | 427 (427–428) | 12 | 425 (425–426) | 0.0 |
| Glide | 0.7 (0.7–0.9) | 1 | 0 | 64 (62–65) | 24 | 432 (431–433) | 0.0 |
| No carousel | 0.1 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |

#### Autoplay

One carousel with the autoplay at 1500 ms, for 4.5 s.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.3 (0.2–0.4) | 3 (2–4) | 2 | 14 (14–15) | 8 | 105 (103–106) | 1.0 (0.0–1.9) |
| Swiper | 2.6 (1.9–5.4) | 18 (13–21) | 3 | 103 (102–103) | 6 | 101 (100–101) | 0.0 |
| Embla Carousel | 3.8 (3.4–4.2) | 22 (20–24) | 0 | 354 (353–356) | 6 | 352 (351–354) | 0.3 (0.0–0.6) |
| Glide | 0.5 (0.3–0.5) | 2 (1–2) | 0 | 37 (37–38) | 14 | 220 | 0.0 |
| No carousel | 0.0 | 0 | 0 | 0 | 0 | 0 | - |

#### Drag

One carousel. 5 drags of 70% of the width, in 18 moves of about 16 ms each, then a release and a wait of 700 ms. Mobile uses touch events, desktop uses the mouse.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 1.5 (1.2–2.0) | 12 (9–15) | 13 | 108 | 58 | 452 (451–454) | 0.4 (0.2–0.7) |
| Swiper | 1.7 (1.3–2.0) | 19 (15–23) | 8 | 118 (117–118) | 16 | 297 (293–298) | 1.0 (0.3–1.3) |
| Embla Carousel | 5.5 (4.4–6.8) | 38 (32–47) | 0 | 634 (634–636) | 60 | 627 (627–629) | 0.0 |
| Glide | 3.1 (3.1–4.1) | 22 (19–24) | 0 | 243 (239–246) | 22 | 317 (316–318) | 3.1 (2.5–3.2) |
| No carousel | 0.6 (0.4–0.7) | 0 | 0 | 0 | 0 | 1 (0–1) | - |

#### Busy

The navigate scenario while another script blocks the main thread for 35 ms of each 50 ms. A motion that needs the main thread on each frame drops frames here.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 69.9 (69.6–69.9) | 3113 (3043–3113) | 5 | 29 | 17 | 252 (251–259) | 0.4 (0.0–0.8) |
| Swiper | 69.8 | 3077 (3042–3113) | 6 | 26 (26–29) | 12 | 252 (251–258) | 1.6 (0.8–1.9) |
| Embla Carousel | 71.9 (71.4–72.2) | 3089 (3017–3106) | 0 | 323 (323–325) | 12 | 755 (746–764) | 15.3 (14.9–16.0) |
| Glide | 69.9 (69.8–70.0) | 3008 (3007–3043) | 0 | 48 (47–49) | 24 (24–26) | 430 (428–441) | 0.7 (0.7–1.1) |
| No carousel | 69.5 | 3042 | 0 | 0 | 0 | 0 | - |

Each cell is the median of 3 rounds, with the lowest and the highest value in parentheses.

## Features

From the documentation and the type files of each package, at the versions above.

| Feature | Better Carousel | Swiper | Embla Carousel | Glide |
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
