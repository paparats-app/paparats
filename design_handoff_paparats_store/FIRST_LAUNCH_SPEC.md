# First launch — animation & onboarding spec

Applies to `Paparats Prototype.dc.html` (phase logic in `startIntro / finishIntro`, markup in the
`hasIntro` block). Timings are authored for a 1440 × 920 window; scale positions with the window,
keep durations as-is.

## Story
Kupalle night. Two walls of fern lean into the frame and slowly part; in the dark path between them
a spark appears and blooms into the fern flower (brand coral `#e8613f`, warm light on the leaves,
fireflies). The flower rises and becomes the star in the Paparats mark. Onboarding steps (language →
appearance → account) follow on the same night scene. On finish the flower’s light travels to the
Home hero, blooms there and fades — the app is “lit” by what the user found.

## Timeline (auto-advancing phases)

| # | Phase   | Starts at | What changes |
|---|---------|-----------|--------------|
| 0 | `seed`  | 0 ms      | Scene mounted, ferns 90 px low and transparent, flower at scale 0.1 / opacity 0. |
| 1 | `fern`  | 120 ms    | Ferns rise to rest (translateY 90 → 0, opacity 0 → 1). |
| 2 | `part`  | 1400 ms   | Ferns part: left group translateX −360 px, rotate −9°; right group mirrored; opacity .95. Flower spark: scale 0.28, opacity .75. Fireflies .3. |
| 3 | `bloom` | 2800 ms   | Flower scale 1, opacity 1; shock ring (80 px, scale .4 → 7, 1.9 s); fireflies 1. Ferns −390 px / −10°, opacity .9. |
| 4 | `logo`  | 4300 ms   | Flower moves to (−7, −265) px from centre at scale .32 and its star fades (opacity 0) as the logo block fades/slides in (24 px → 0). Ferns −450 px / −12°, opacity .72. |
| 5 | `lang`  | 5400 ms   | Language step panel fades/slides in (28 px → 0). Ferns −540 px / −15°, opacity .5; fireflies .55. Scene stops advancing. |
| 6 | `theme` | on Continue | Appearance step (same panel slot, `pp-step` 450 ms enter). |
| 7 | `signin`| on Continue | Account step. |
| 8 | `done`  | on Sign in / Later | See “Exit transition”. Overlay unmounts after 1500 ms. |

Phases 0–4 auto-advance; the user can skip (click anywhere on the scene or the `››` button)
straight to `lang`. Skip is disabled once a step panel is showing.

## Layers (back → front)
1. **Backdrop** — radial gradient `#0b1d19 → #06120e → #03090a` (ellipse 72 % × 64 % at 50 % 58 %).
2. **Fern groups, two mirrored** — four frond silhouettes each (`paparats-fern-watermark.png`, 560–900 px tall),
   blurred .5–3 px and darkened by depth, each with its own 5–8 s alternating sway (−1.5° → 1.3°).
   Left group transform-origin bottom-left, right group is the same set mirrored (`scaleX(-1)`) with
   origin bottom-right. Parting = translateX ± the phase value, rotate ± the phase angle.
3. **Vignette** — `transparent 45 % → rgba(0,0,0,.6) 100 %`.
4. **Fireflies** — 11 dots 2–3 px, `#ffc9a8` with coral glow, each with its own drift (5.5–8 s) and twinkle (1.9–3.4 s).
5. **Flower** — position wrapper (translate) → scale wrapper (scale + opacity) → glow disc 600 px,
   rotating ray disc 480 px (80 s), shock ring, 80 px star SVG (`#e8613f` outer, `#ffe6d6` inner) with 3.4 s pulse.
6. **Logo block** — mark 147 × 150, “Paparats” 34/700, “Папараць” 15px `#9aa8aa`. Top 150 px, centred.
7. **Step panel** — top 430 px, 720 px wide, centred. Step indicator (dots + labels) bottom 30 px.

## Easing & durations
- Ferns: `transform 1.9s cubic-bezier(.55,0,.2,1)`, `opacity 1.4s ease`.
- Flower move: `transform 1.4s cubic-bezier(.5,0,.15,1)`; flower scale: `transform 1.5s cubic-bezier(.2,.8,.2,1)`, `opacity 1s ease`.
- Fireflies: `opacity 1.6s ease`.
- Logo: `opacity 1.1s ease, transform 1.1s cubic-bezier(.2,.7,.2,1)`.
- Panel: `opacity .9s ease .15s, transform .9s cubic-bezier(.2,.7,.2,1) .15s`; step content enters with `pp-step` 450 ms (14 px rise + fade).
- Overlay fade-out: `opacity 1.1s ease .4s` (only in `done`).

## Exit transition (`done`)
1. Flower position wrapper moves to the Home hero centre — (+122, −173) px from window centre at
   1440 × 920 — over 1.2 s (`cubic-bezier(.5,0,.15,1)`); scale wrapper goes to 2.6 and fades
   (`opacity .8s ease .55s`).
2. Ferns leave: translateX −820 / +820, rotate ±19°, translateY +40, opacity 0.
3. Overlay fades after a .4 s delay (1.1 s).
4. In the Home hero a coral radial glow (`mix-blend-mode: screen`, centred) goes 0 → 1 with
   `opacity .9s ease .35s`, then 1 → 0 over 2 s once the overlay is gone (~1.7 s after finish).
5. Navigation lands on Home. Reduced-motion users skip the scene entirely and start at `lang`.

## Onboarding steps
- **Language** — three cards (English / Беларуская / Русский) with the brand tagline in each language.
  Selection re-renders the whole panel in that language immediately.
- **Appearance** — Light / Dark / System with a miniature shell preview per option (sidebar, mint
  nav pip, cards). System shows a split light|dark preview.
- **Account** — email + password, primary **Sign in**, secondary **Later**, “No account? Create one” link.
  Sign in with a typed email sets the profile email and shows the toast “Signed in as …” 1.6 s later.
- Back button appears on steps 2–3. Step indicator: filled mint dot for current and past steps.

## Persistence
`localStorage["paparats.firstRun"] = { seen: true, locale, theme, at }` written on finish.
On launch: if `seen`, the scene is skipped and locale/theme are restored (unless overridden by
props). The `firstRun` prop is `auto | always | never`; the toolbar’s “Replay first launch” always plays.

## Assets
- `assets/paparats-fern-watermark.png` — frond silhouette (all eight fronds are this one image at different sizes, blur and rotation).
- `assets/paparats-mark-light.png` — logo mark.
