# Carousel benchmark results

Made by `bench/run.mjs` and `bench/report.mjs`. See `bench/README.md` for the method and the steps to run it again.

## Environment

| Item | Value |
| --- | ---: |
| Date | 2026-11-17T17:51:07.090Z |
| Browser | Chrome/157.0.8103.51, headless |
| OS | Windows_NT 10.0.26300 x64 |
| CPU | 12th Gen Intel(R) Core(TM) i9-12900HK, 20 threads |
| Memory | 64 GB |
| Node.js | v26.11.1 |
| puppeteer-core | 25.17.0 |
| esbuild | 0.28.2 |
| Better Carousel commit | 084e03a with changes that are not committed |
| Rounds, seed | 3, 1 |
| Libraries | Better Carousel 1.0.0, Swiper 14.4.0 (2026-10-30), Embla Carousel 8.6.0 (2025-04-04), Glide 3.7.1 (2024-11-22) |

## Summary

### Mobile: 412 × 823, CPU 4 times slower, 1 slide in view

| Library | Load ms | TBT ms | CLS | Idle CPU % | Navigate ms | Nav. paints | Autoplay CPU % | Drag ms | Drag paints | Busy bad frames % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 198 | 28 | 0.000 | 0.2 | 180 | 12 | 0.9 | 1053 | 8 | 3.2 |
| Swiper | 239 | 61 | 0.000 | 0.1 | 221 | 12 | 24.4 | 1024 | 10 | 4.3 |
| Embla Carousel | 190 | 18 | 0.000 | 0.2 | 1584 | 12 | 32.2 | 3587 | 10 | 26.2 |
| Glide | 221 | 42 | 0.000 | 0.1 | 329 | 22 | 2.4 | 1732 | 20 | 1.3 |
| No carousel | 117 | 0 | 0.000 | 0.2 | 14 | 0 | 0.1 | 354 | 0 | - |

### Desktop: 1350 × 940, no CPU throttling, 3 slides in view

| Library | Load ms | TBT ms | CLS | Idle CPU % | Navigate ms | Nav. paints | Autoplay CPU % | Drag ms | Drag paints | Busy bad frames % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 40 | 0 | 0.000 | 0.0 | 37 | 12 | 0.4 | 174 | 30 | 1.5 |
| Swiper | 51 | 0 | 0.000 | 0.0 | 29 | 12 | 3.3 | 146 | 16 | 1.2 |
| Embla Carousel | 42 | 0 | 0.000 | 0.0 | 266 | 12 | 5.6 | 518 | 60 | 15.7 |
| Glide | 47 | 0 | 0.000 | 0.0 | 49 | 26 | 0.6 | 303 | 22 | 0.7 |
| No carousel | 30 | 0 | 0.000 | 0.1 | 3 | 0 | 0.0 | 45 | 0 | - |

Load: main-thread time, Total Blocking Time (TBT) and Cumulative Layout Shift (CLS) of a page with 10 carousels. Navigate: 6 calls of next(). Drag: 5 drags. Busy: the frames that were dropped or late during navigate, while another script blocks the main thread. The values are the medians of all rounds. Less is better in all columns.

## Bundle size

KB after gzip (level 9), from esbuild 0.28.2 with the same settings for all libraries: iife, es2020, minified, tree shaken.

- **Core**: the smallest import that makes a carousel that the user can drag.
- **Typical**: loop, drag, arrows, dots, autoplay, and the accessibility module if the library has one. For Embla, the arrows and the dots are the script and the CSS of the Embla examples, and the ClassNames plugin gives the state classes.
- **Parity**: the typical set, with the mouse wheel, the auto scroll, the auto height, the free drag and the sync. "no" means that the library does not have these features.
- **Shipped file**: the minified file that the package gives for a script tag, as it is. It can include more or fewer modules than the typical set.

| Library | Core JS | Typical JS | Typical CSS | Typical JS + CSS | Typical, brotli | Parity JS + CSS | Shipped file JS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel 1.0.0 | 12.0 | 12.0 | 1.4 | **13.3** | 12.1 | 13.3 | 11.6 |
| Swiper 14.4.0 | 20.6 | 27.4 | 2.2 | **29.7** | 26.2 | 32.9 | 43.4 |
| Embla Carousel 8.6.0 | 7.4 | 9.1 | 0.6 | **9.7** | 8.7 | 13.5 | 7.0 |
| Glide 3.7.1 | 6.5 | 7.6 | 0.7 | **8.3** | 7.4 | no | 7.8 |

## Runtime

### Mobile: 412 × 823, CPU 4 times slower, 1 slide in view

#### Load

10 carousels on one page. The values are from the start of the page to 1 s after the load event. Main-thread time includes the parse of the page and the decode of the images: compare each library to "No carousel".

| Library | Main-thread time, ms | Total Blocking Time, ms | Mount call, ms | Layouts | Layout shift | DOM nodes | JS heap, KB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 198.2 (184.9–202.1) | 28 (27–32) | 12.7 (10.1–12.8) | 5 (4–5) | 0.000 | 843 | 1137 |
| Swiper | 238.8 (234.6–259.1) | 61 (61–75) | 100.6 (98.3–114.4) | 24 (23–24) | 0.000 | 740 | 1475 (1474–1476) |
| Embla Carousel | 189.7 (183.9–190.2) | 18 (15–20) | 56.8 (52.3–57.0) | 24 (24–25) | 0.000 | 860 | 1217 |
| Glide | 221.0 (200.9–226.0) | 42 (39–59) | 79.8 (75.9–92.4) | 34 (33–43) | 0.000 | 930 | 1120 (1120–1131) |
| No carousel | 116.5 (108.9–121.7) | 0 | 0.2 (0.1–0.4) | 4 | 0.000 | 550 | 759 |

#### Idle

One carousel at rest for 2 s, after the page is at rest. A carousel that does nothing must cost nothing.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.2 (0.1–0.2) | 0 | 0 | 0 | 0 | 0 (0–2) | - |
| Swiper | 0.1 (0.1–0.2) | 0 | 0 | 0 | 0 | 3 (0–3) | - |
| Embla Carousel | 0.2 (0.1–0.2) | 0 | 0 | 0 | 0 | 0 (0–3) | - |
| Glide | 0.1 (0.1–0.2) | 0 | 0 | 0 | 0 | 0 (0–3) | - |
| No carousel | 0.2 | 0 | 0 | 0 | 0 | 4 (3–6) | - |

#### Navigate

One carousel. The runner calls next() 6 times, one time each 700 ms. A motion takes 400 ms where the library has a duration option.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 4.2 (4.1–5.5) | 7 (6–7) | 6 | 36 (35–37) | 12 | 261 (256–271) | 1.2 (0.4–1.8) |
| Swiper | 5.1 (3.6–5.6) | 5 (4–7) | 6 | 35 (34–37) | 12 | 264 (264–269) | 2.2 (1.9–3.0) |
| Embla Carousel | 36.9 (27.7–41.6) | 242 (182–262) | 0 | 428 (428–429) | 12 | 673 (667–850) | 0.3 (0.0–0.3) |
| Glide | 7.6 (3.1–8.1) | 4 (3–9) | 0 | 61 (58–61) | 22 (22–24) | 448 (437–452) | 0.0 (0.0–0.2) |
| No carousel | 0.3 (0.3–0.9) | 0 | 0 | 0 | 0 | 3 (1–5) | - |

#### Autoplay

One carousel with the autoplay at 1500 ms, for 4.5 s.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.9 (0.6–2.1) | 6 (4–11) | 1 (1–2) | 9 (6–13) | 2 (2–4) | 67 (43–86) | 0.0 (0.0–1.2) |
| Swiper | 24.4 (16.9–25.4) | 182 (136–210) | 3 | 106 (105–108) | 6 | 105 (103–110) | 1.0 (0.0–1.8) |
| Embla Carousel | 32.2 (17.0–35.5) | 241 (152–289) | 0 | 298 (298–300) | 6 | 450 (419–496) | 0.8 (0.0–1.1) |
| Glide | 2.4 (1.0–2.7) | 9 (4–9) | 0 | 25 (16–26) | 8 (4–8) | 151 (113–156) | 0.0 |
| No carousel | 0.1 (0.0–0.1) | 0 | 0 | 0 | 0 | 2 (2–3) | - |

#### Drag

One carousel. 5 drags of 70% of the width, in 18 moves of about 16 ms each, then a release and a wait of 700 ms. Mobile uses touch events, desktop uses the mouse.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 16.0 (9.8–19.3) | 90 (62–122) | 4 | 159 (157–163) | 8 | 539 (516–551) | 1.9 (0.6–3.3) |
| Swiper | 14.2 (6.6–16.0) | 129 (69–156) | 5 | 109 (109–112) | 10 | 317 (290–341) | 4.1 (0.7–7.9) |
| Embla Carousel | 46.4 (27.3–48.2) | 499 (266–549) | 0 | 734 (693–748) | 10 | 1170 (694–1256) | 0.4 (0.0–0.6) |
| Glide | 26.5 (11.1–26.8) | 199 (100–207) | 0 | 218 (216–221) | 20 | 335 (297–349) | 3.6 (0.0–5.4) |
| No carousel | 5.1 (2.2–5.7) | 0 | 0 | 0 | 0 | 9 (2–10) | - |

#### Busy

The navigate scenario while another script blocks the main thread for 35 ms of each 50 ms. A motion that needs the main thread on each frame drops frames here.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 70.5 (67.1–73.5) | 2925 (2789–3071) | 6 | 29 (26–29) | 12 | 274 (272–284) | 3.2 (2.6–3.6) |
| Swiper | 72.5 (70.7–75.1) | 3069 (2928–3143) | 6 | 27 (26–27) | 12 | 280 (278–283) | 4.3 (4.2–5.0) |
| Embla Carousel | 90.3 (88.9–90.5) | 3247 (3232–3253) | 0 | 263 (262–281) | 12 | 707 (703–723) | 26.2 (23.1–26.2) |
| Glide | 75.7 (75.2–76.7) | 3116 (3110–3120) | 0 | 44 (42–45) | 22 | 455 (455–457) | 1.3 (0.7–1.5) |
| No carousel | 62.8 (56.5–63.4) | 2741 (2469–2749) | 0 | 0 | 0 | 2 (1–2) | - |

### Desktop: 1350 × 940, no CPU throttling, 3 slides in view

#### Load

10 carousels on one page. The values are from the start of the page to 1 s after the load event. Main-thread time includes the parse of the page and the decode of the images: compare each library to "No carousel".

| Library | Main-thread time, ms | Total Blocking Time, ms | Mount call, ms | Layouts | Layout shift | DOM nodes | JS heap, KB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 39.7 (38.6–40.4) | 0 | 2.0 (1.7–2.1) | 4 | 0.000 | 843 | 1096 |
| Swiper | 50.8 (50.4–57.4) | 0 | 18.2 (17.2–23.0) | 23 | 0.000 | 740 | 1494 (1493–1494) |
| Embla Carousel | 41.9 (41.5–44.4) | 0 | 10.9 (9.7–11.1) | 24 | 0.000 | 860 | 1193 |
| Glide | 46.5 (46.3–48.3) | 0 | 16.3 (15.9–17.7) | 33 | 0.000 | 1230 | 1126 |
| No carousel | 30.0 (26.3–36.7) | 0 | 0.1 (0.0–0.1) | 3 (3–4) | 0.000 | 550 | 719 |

#### Idle

One carousel at rest for 2 s, after the page is at rest. A carousel that does nothing must cost nothing.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Swiper | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Embla Carousel | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| Glide | 0.0 (0.0–0.1) | 0 | 0 | 0 | 0 | 0 | - |
| No carousel | 0.1 | 0 | 0 | 0 | 0 | 0 | - |

#### Navigate

One carousel. The runner calls next() 6 times, one time each 700 ms. A motion takes 400 ms where the library has a duration option.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.9 (0.8–1.0) | 1 | 6 | 37 (34–38) | 12 | 256 (250–260) | 0.8 (0.4–1.2) |
| Swiper | 0.7 (0.6–0.8) | 1 | 6 | 37 (37–38) | 12 | 252 (250–259) | 0.4 (0.0–1.5) |
| Embla Carousel | 6.2 (6.1–6.4) | 31 (28–32) | 0 | 428 (428–430) | 12 | 428 (426–851) | 0.0 |
| Glide | 1.1 (0.8–1.2) | 1 | 0 | 66 (63–68) | 26 | 436 (434–437) | 0.0 |
| No carousel | 0.1 | 0 | 0 | 0 | 0 | 0 | - |

#### Autoplay

One carousel with the autoplay at 1500 ms, for 4.5 s.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 0.4 (0.4–0.5) | 3 (3–5) | 2 | 14 (12–15) | 4 | 103 (102–104) | 0.0 |
| Swiper | 3.3 (3.3–3.7) | 24 (23–26) | 3 | 105 | 6 | 108 (104–108) | 4.6 (1.0–4.6) |
| Embla Carousel | 5.6 (5.4–5.7) | 32 (31–33) | 0 | 354 (353–355) | 6 | 353 (352–471) | 0.3 (0.2–0.3) |
| Glide | 0.6 (0.5–0.7) | 2 | 0 | 37 (35–39) | 14 | 224 (223–225) | 0.0 |
| No carousel | 0.0 | 0 | 0 | 0 | 0 | 0 | - |

#### Drag

One carousel. 5 drags of 70% of the width, in 18 moves of about 16 ms each, then a release and a wait of 700 ms. Mobile uses touch events, desktop uses the mouse.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 2.7 (2.5–3.1) | 17 (14–17) | 13 | 221 (220–221) | 30 | 601 (601–602) | 0.7 (0.5–1.0) |
| Swiper | 2.3 (2.1–2.7) | 23 (21–28) | 8 | 117 | 16 | 292 (292–298) | 0.0 (0.0–1.3) |
| Embla Carousel | 8.1 (7.5–8.6) | 51 (51–55) | 0 | 633 (629–637) | 60 | 876 (755–886) | 0.1 |
| Glide | 4.7 (4.7–4.9) | 29 (29–31) | 0 | 246 (243–247) | 22 | 315 (311–315) | 1.9 (1.6–2.2) |
| No carousel | 0.7 (0.7–0.8) | 0 | 0 | 0 | 0 | 0 | - |

#### Busy

The navigate scenario while another script blocks the main thread for 35 ms of each 50 ms. A motion that needs the main thread on each frame drops frames here.

| Library | CPU, % | Script, ms | Layouts | Style recalcs | Paints | Frames shown | Frames dropped or late, % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Better Carousel | 70.0 (70.0–70.1) | 3079 (3045–3114) | 6 | 29 (25–29) | 12 | 259 (247–270) | 1.5 (0.0–1.9) |
| Swiper | 69.9 (69.8–70.1) | 3043 (3043–3078) | 6 | 26 (23–26) | 12 | 251 (248–252) | 1.2 (0.0–1.2) |
| Embla Carousel | 72.9 (72.7–72.9) | 3058 (3024–3093) | 0 | 324 (323–342) | 12 | 756 (749–765) | 15.7 (11.9–15.9) |
| Glide | 70.3 (70.0–70.3) | 3045 (3044–3080) | 0 | 50 (48–51) | 26 | 442 (435–442) | 0.7 (0.5–0.9) |
| No carousel | 69.5 (69.5–69.6) | 3078 (3043–3079) | 0 | 0 | 0 | 0 | - |

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
