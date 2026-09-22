# Handoff: Paparats — curated Windows app store (desktop client)

## Overview
Paparats is a curated desktop app store for Windows, focused on utilities and professional
software rather than games ("Steam for tools"). The catalog is hand-checked; every app has a
useful free tier; no ads; no telemetry. One platform-wide subscription — **Paparats Pro** —
unlocks advanced features across participating apps.

This package contains a complete, clickable high-fidelity prototype of the desktop client:
13 screens, a shared application shell, a first-launch onboarding, 3 UI languages
(English / Беларуская / Русский), and light + dark themes. Beyond the store itself it covers
distribution **channels** (official / verified / community sources) and an **Ideas** board where
users propose and vote and developers pick ideas up.

The name refers to the fern flower of Belarusian folklore (*paparać-kvetka*), said to bloom for
one night and reveal hidden things. This is the conceptual story behind the brand only — the UI
carries **no folkloric or national ornamentation**, per the brand brief.

## About the design files
The files in this bundle are **design references authored in HTML** — prototypes that show the
intended look, copy and behavior. They are **not production code to copy**.

There is no codebase yet. The chosen stack — see **`STACK.md`** — is **Tauri 2: a Rust core
with a TypeScript/React UI rendered in WebView2**. Each screen maps to a route component, each
repeated element to a React component, and the token tables below to CSS custom properties in
one `tokens.css`. The brief's earlier C++ / Qt 6 / QML mention is superseded.
`REPO_CLAUDE.md` is the conventions file to drop into the new repository as `CLAUDE.md`.

`Paparats Prototype.dc.html` is a single-file prototype: markup in a template plus a logic
class, with all content in `paparats-proto-data.js`. Read it as a specification of layout,
tokens and behavior — not as an architecture to imitate.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, states and copy are final and
should be reproduced precisely. The palette was sampled from the approved visual references.

Two intentional placeholders remain:
1. **App icons** are letter monograms on colored rounded tiles (e.g. "Ob" on #6f5bd8). The real
   product ships each publisher's own icon — wire these to real icon assets from the catalog API.
2. **Screenshot slots** on the app detail page are dashed placeholders — wire to catalog imagery.

## Application shell
Fixed design size **1440 × 920** (the brief targets 1280–1600 px windows; the sidebar stays
visible and the main content reflows — it never becomes a narrow mobile layout).

Root grid: `grid-template-columns: 244px minmax(0,1fr)`, window radius 10px, 1px border
`--frame`, shadow `0 30px 80px rgba(0,0,0,.6)`.

### Left sidebar (244px, `--side` gradient, 1px right border `--line`, padding 22px 14px 20px)
- **Brand block** (click → Home): 50×50 logo mark + "Paparats" 22px/700 with "Папараць"
  12.5px `--text2` underneath. Margin-bottom 22px.
- **Primary nav**: Home, Browse, Categories, Updates, Library, Ideas.
- **Divider**: 1px `--line`, margin 12px 6px 16px.
- **Secondary nav**: Subscription, Settings.
- **Nav item**: height 42px, radius 8px, padding 0 14px, gap 12px, icon 20px, label 15px/500.
  Idle `color: --text2`; hover `background: --hover; color: --text`; active
  `background: --nav` + `color: --text` + a 3px × (height − 24px) mint bar pinned to the left
  edge, radius 3px. The active item follows the *section*, so an app detail page keeps the
  section it was opened from highlighted.
- **Updates badge**: count pill, min-width 22px, height 22px, radius 11px, `background: --mint`,
  `color: --ink`, 12px/700. Shown only when updates exist.
- **Subscription "Pro" pill** (when subscribed): `--mint-soft` bg, `--mint2` text, 11px/600.
- **Watermark**: tall fern frond, 202px wide, `left: -6px; bottom: 106px`, opacity .5 (dark) /
  .18 (light), `pointer-events: none`. Asset `assets/paparats-fern-watermark.png`.
- **Footer**: "Paparats" 14px/600 + tagline 13px `--text2`, max-width 170px.

### Top bar (inside the content column, padding 20px 30px 0)
- **Search field**: 466 × 40px, radius 20px, `background: --input`, 1px `--line2`,
  padding-left 44px, 18px search icon at left 15px / top 11px. Focus: border `--mint`.
  Typing anything switches the content area to the search-results view on every screen.
- **Avatar button** (click → Profile): 36px circle, `--card2` bg, 1px `--line2`, initials
  13px/600, followed by a 14px chevron.
- **Window controls**: absolutely positioned top-right, three 46 × 32px cells; minimize and
  maximize hover `--hover`, close hovers `#c42b1c` with white glyph; top-right radius 10px.

### Page banner (used by Browse, Categories, Updates, Library, Subscription, Profile)
Full-bleed strip: `margin: -24px -30px 22px; padding: 26px 30px 22px`, min-height 124px
(150px on Updates, 200px on Subscription), `background #0a1a1d`, `color #eef3f2`,
bottom border 1px `--line`. A fern photograph covers the right 58% and is masked with
`linear-gradient(90deg, transparent 0%, #000 45%)`. Left: H1 34px/600, letter-spacing -.02em,
plus a 15px `#c3cbc6` subtitle. Right: an uppercase motto, 11px, letter-spacing .22em,
`#d6ded9`, text-shadow `0 1px 10px rgba(0,0,0,.7)` — and, where the screen has one, the
primary action button.

## Screens

### 1. Home
Discovery dashboard. Sections top to bottom:
- **Hero carousel**, height 326px, radius 12px, gradient
  `linear-gradient(100deg,#0a2620 0%,#0e3026 45%,#081b18 100%)`; fern photo on the right 66%
  masked `linear-gradient(90deg,transparent 0%,#000 42%)`. Content at left 44px / top 40px:
  kicker 11px uppercase letter-spacing .24em `#a9c9b8`; H1 42px/1.1 in two nowrap lines;
  body 15px/1.55 `#c9d2cd`, max-width 400px; CTA pill height 40px, radius 20px, `#5fd39a` bg,
  `#06231a` text, 15px/600, trailing arrow (hover `#79dfae`). A right-aligned pull quote sits
  at right 40px / top 160px, max-width 250px. Controls bottom-right: prev/next chevrons plus
  dots — 6px inactive, 18px active (`--mint`), height 6px, radius 3px, `transition: width .2s`.
  4 slides: Discover · Tools for real life · Curated for Windows · Paparats Pro. Each slide's CTA
  navigates somewhere different (Browse / Library / Categories / Subscription).
- **Featured apps** — 6-column grid of AppCards, gap 12px.
- **Collections** — 4-column grid of CollectionCards.
- **New and notable** — 4-column grid of wide icon+text cards (56px icon tile, radius 13px).
- **Recently updated** — 3-column grid of compact rows (44px tile + name + version · relative
  date + action button).
Section headers: H2 20px/600 letter-spacing -.01em, with a "See all" ghost link on the right
(13px `--text2`, hover `--text`, trailing 14px arrow).

### 2. Browse
Two columns: `minmax(0,1fr)` content + 220px sticky filter panel, gap 24px.

Content in its default (unfiltered) state:
- **Featured app hero**, height 250px, radius 12px,
  `radial-gradient(ellipse at 78% 50%, <app tint> 0%, #101c20 62%)`; kicker + H2 34px in two
  nowrap lines + body + "Get <App>" pill; a 140px rounded-32px app tile at right 150px with
  `box-shadow: 0 30px 60px rgba(0,0,0,.45)`; an italic 15px note column at right 30px; dots
  bottom-right. 3 slides (Obsidian / Krita / RustDesk).
- **Featured apps** — 5-column AppCard grid.
- **New and notable** — 2-column wide rows with a 34px "Get" button.
- **Top categories** — 6-column compact tiles (22px icon + label + count).

Applying any filter (or opening a collection) replaces all of that with a single 5-column result
grid, preceded by a result count and a "Clear all" link.

**Filter panel** (`--card`, 1px `--line`, radius 12px, padding 16px 18px 18px, sticky top 0):
header "Filters" 16px/600 + "Clear all" (`--mint2` 12px/500); a 32px "Search filters…" input
that live-filters the category list; then **Category** (9 checkboxes, multi-select),
**Price** (Free — always on, disabled at .6 opacity; Pro features — toggles),
**Platform** (Windows — always on; Portable build — toggles),
**Sort by** (radio: Featured / Newest / A–Z / Size). Checkbox: 16px, radius 4px, 1px `--line2`,
checked `--mint` fill with an `--ink` 11px check. Radio: 16px circle with an 8px `--mint` dot.
Group labels 13px/600; options 13px `--text2`, hover `--text`; 1px `--line` dividers between
groups.

### 3. Categories
9 photographic tiles in a 3-column grid, gap 12px. Tile: min-height 172px, radius 12px,
`background #0d1a1e`, 1px `--line`, padding 16px 18px, hover border `--line2`. A category
photograph covers the right 66%, masked `linear-gradient(90deg,transparent 0%,#000 52%)`.
Above it: a 26px outline icon; then label 19px/600 and description 13px `#c9d2cd`
(both with `text-shadow: 0 1px 10px rgba(0,0,0,.6)`); footer row with the catalog count 12px
`#b5bfb9` and a 16px arrow.

Categories and catalog counts: Productivity 142, Development 118, Design 93, Media 87,
Utilities 164, System 76, Lifestyle 54, Games 38, Education 47.

Below the grid: **"Featured in Productivity"** — 6-column AppCard grid — then a closing brand
line: italic 15px `--text2` quote on the left, "— Paparats" 12.5px `--text3` on the right,
separated by a 1px `--line` top border.

### 4. Updates
Operational, not promotional. Banner carries the count line (16px/500) + total download size
(14px `#a9b3ad`) and the **Update all** button (height 42px, radius 10px, `#5fd39a`/`#06231a`,
15px/600, leading download icon).

Two columns: `minmax(0,1fr)` + 340px, gap 24px.

**Update row** (`--card`, 1px `--line`, radius 10px, overflow hidden):
grid `48px minmax(0,1fr) 80px 130px 36px`, gap 16px, padding 12px 14px 12px 16px.
48px icon tile (radius 11px) → name 15px/600 with `1.92.2 → 1.93.0` 13px `--text2` beneath →
size right-aligned → **Update** button (height 34px, radius 8px, `--mint` bg, `--ink` text) →
36px expand chevron. Expanded panel: 1px `--line` top border, `--bg` ground, padding
14px 16px 14px 80px, "WHAT'S NEW" label (12px uppercase, letter-spacing .08em, `--text3`, 600),
bullet list 14px `--text2` with 5px round bullets, then a "View details →" link to the app page.
Two rows (VS Code, Obsidian) start expanded.

Right column: **Automatic updates** card with a toggle; **Update settings** card (navigates to
Settings › Updates); **Update history** card that expands into a list of past updates;
a 330px promo card with artwork and the headline "Better tools every day."

**Update-all flow**: each row animates a simulated download (progress every 110ms, +4–12%),
the button label becomes "Installing… NN%" in `--mint2`, then the row settles to a disabled
"Updated just now" state, the sidebar badge disappears, and a toast confirms "All updates
installed". Empty state: 56px mint check circle, "Everything is up to date" 18px/600 + hint.

### 5. Library
Two columns: `minmax(0,1fr)` + 250px, gap 24px. Banner action: **Install app** (→ Browse).

Toolbar: tab strip (`--card`, 1px `--line`, radius 10px, padding 3px) with
**Installed / Favorites / Collections**, each 34px tall with a count pill
(`--mint-soft` bg, `--mint2` text); right side: "Sort by" `<select>` (Recently used / A–Z /
Size) and a list/grid toggle (two 32×30px buttons, active `--card2`).

**List row**: grid `44px minmax(0,1fr) 240px 118px 92px 32px`, gap 14px, `--card`, radius 10px,
padding 10px 12px 10px 14px. 44px icon tile → name 14px/600 (with a 12px mint star when
favorited) + tagline 12.5px `--text2` → two tag chips (category + Pro/Portable/license; 11px/500,
radius 10px, `--card2`) → installed version + "Updated N ago" (`--text3`) → **Open** button →
⋯ overflow menu (220px popover: Add/Remove favorite, Open install folder, divider, Uninstall in
`#e07a6a`). Grid view: 4-column cards with the same action pair.

Right column: **Library stats** (installed apps, favorites, collections, total size — 20px icon +
16px/600 value + 12px `--text2` label); **Collections** list with a + button and a
"New collection" row; **Quick filters** (All apps / Updates available / Favorites, each with a
count pill); a closing brand quote card.

Collections tab shows 2-column collection cards; opening one switches to its filtered list with a
breadcrumb back-link.

### 6. Subscription
Banner: H1 + lead "One subscription. More possibilities." (18px), body 14px/1.55 max-width 560px,
then **Get Paparats Pro** (mint) + **Learn more** (1px `rgba(255,255,255,.2)` on
`rgba(255,255,255,.06)`). When subscribed the first button is replaced by a status chip
(mint check + plan name + "Active"). Hero art: laptop-in-ferns photograph, right 58%.

Two columns: `minmax(0,1fr)` + 250px.
- **Benefit strip**: 4 equal cells in one bordered card, each centered with a 26px `--mint2`
  icon, 15px/600 title, 12.5px `--text2` subtitle, separated by 1px `--line` verticals.
- **Plans**: 3 equal cards, stretch to equal height, padding 22px 22px 20px.
  Header: name 19px/600 + subtitle; badge pill right ("Most popular" / "Save 18%" in
  `--mint-soft`/`--mint2`, or "Current plan" in `--card2`/`--text2`). Price block: 32px/600
  figure + period, 1px `--line` bottom border. Feature list: 16px mint checks + 13.5px rows.
  Footer button height 40px. Free = $0 forever · Monthly = $4.99/month (border
  `rgba(95,211,154,.45)`, mint button) · Yearly = $49/year. The current plan's card gets a
  `--mint` border and a disabled button.
- **Popular apps with Pro features**: 5-column cards, each with a "Pro" pill pinned
  bottom-right (`--mint` on `--ink`).
Right column: **Your impact** (logo + copy), a customer quote card, and an ecosystem stat list
(50+ independent developers · 200+ apps and counting · 10,000+ Pro members).

**Purchase flow**: "Choose plan" → modal (440px, radius 12px, `rgba(0,0,0,.55)` backdrop;
36px app icon + title, body naming the exact charge and renewal date, Cancel + Confirm) →
on confirm the plan becomes current, the sidebar shows the Pro pill, and a toast says
"Welcome to Paparats Pro".

### 7. Settings
H1 34px + subtitle, then two columns: 250px secondary nav + `minmax(0,1fr)` panel, gap 20px.

Nav card (`--card`, radius 12px, padding 8px): 10 items — General, Updates, Downloads, Apps,
Sources, Notifications, Privacy, Account, Advanced, About — each 44px, radius 8px, 18px icon,
14px/500, active `--card2` + 3px mint left bar. Sources and About render their own panels
(screens 12 and 8); the other eight use the row card below.

Panel: H2 20px section title, then one bordered card whose rows are separated by 1px `--line`
(padding 16px 20px). Row types:
- **theme** — label + hint on the left, a 3-way segmented control (Light / Dark / System) on the
  right: `--bg` track, 1px `--line2`, radius 8px, 2px padding, 30px options, active `--card2`.
- **language** — label + hint, then a 3-column grid of 40px option buttons (native language name,
  mint check when selected, otherwise the ISO code in `--text3`); selected gets a `--mint`
  border and `--mint-soft` fill.
- **toggle** — 44 × 24px switch, radius 12px, `--mint` on / `--knob-off` off, 18px white knob at
  left 3px → 23px, `transition: .15s`.
- **select** — 34px `<select>`, radius 8px, 1px `--line2`, `--bg` ground, custom chevron.
- **path** — value in a monospace face, plus a "Change…" secondary button.
- **action** — secondary button (Clear / Configure… / Sign out).
- **link** — whole row is a button; right side shows a `--mint2` label + chevron (→ Profile,
  → Subscription).
- **note** — 20px mint shield icon + title + body (used for "Paparats sends nothing home").

Section contents: General (theme, language, start on Windows login, minimize to tray, app
recommendations, subtle animations) · Updates (automatic updates, check frequency, metered
networks, notify when ready) · Downloads (install location, parallel downloads, keep installers) ·
Apps (per-user install, desktop shortcuts, open after install) · Notifications (updates
installed, new apps, sound) · Privacy (telemetry note, crash reports, clear search history) ·
Account (profile link, subscription link, sign out) · Advanced (developer mode, network proxy,
prefer portable builds).

### 8. Settings › About
One card. Top block: a 290px dark panel with the fern photograph on the right 60%; 76px logo +
"Paparats" 36px/700 + tagline 17px; `Version 1.2.3 (Build 20260915)` 15px; an 18px mint check
circle with "You're up to date!"; then **Check for updates** (min-width 190px, shows "Checking…"
for 1.2s then toasts) and **What's new** (outline, external-link icon, → Updates).
Lower block (padding 26px 40px 24px): product statement 17px/1.5 (two lines); a 4-column
principles row between two 1px `--line` rules — 30px mint icons with 15px balanced labels
(Curated quality apps · No ads. No telemetry · Support independent developers · A brighter
tomorrow); a link row (Website, Documentation, Get support, Report an issue — `--mint2` 14px/500
with external-link icons); a footer row with the copyright left and Terms / Privacy Policy /
Licenses right (13px `--text2`).

### 9. Profile
Two columns: `minmax(0,1fr)` + 400px, gap 24px.

**Header card** (padding 24px): 96px avatar circle (`--card2`, 1px `--line2`, 34px initials)
with a 30px mint camera badge at its bottom-right; name 26px/600; email 14px `--text2`;
"Member since September 2024" with a 15px clock icon; **Edit profile** outline button.
In edit mode the identity block becomes two labelled 38px inputs (Name, Email) with stacked
Save (mint) / Cancel buttons; Save commits the draft, exits edit mode and toasts "Profile saved".

**Tab strip** under it (1px `--line` bottom border): Account, Preferences, Security, Devices,
Data & Privacy — 42px tall, 16px icons, active `--text` with a 2px mint underline inset 10px.
- **Account** — "Account information" H2, then a card of 5 rows
  (grid `20px 170px minmax(0,1fr) 16px`, padding 14px 20px, hover `--hover`, whole row opens
  edit mode): Name, Email, Country, Language, Time zone. Below it a 172px promo card with the
  robot artwork on the right 54% and the headline "Your ideas make a brighter tomorrow."
- **Preferences** — theme segmented control + the language grid.
- **Security** — password row (Change…), two-factor toggle, active sessions (Sign out everywhere).
- **Devices** — one row per device: 44px monitor tile, name + "This device" pill for the current
  one, OS + last-active line, Remove button on the others.
- **Data & Privacy** — Export your data (Export…) and Delete account (Delete… in
  `#e07a6a` on a `rgba(224,91,60,.5)` border).

Right column: **Pro status card** (mint-tinted gradient, crown icon, plan name, "Active" pill,
price, renewal date, Manage/Upgrade button); **Usage stats** — 3 tiles on `--bg`
(Apps installed, Updates installed, Time saved 320 h); **Recent activity** — 5 rows of
34px tile + "Updated <App>" / "Installed <App>" + version + relative time, with a "See all" link.

### 10. Ideas
Sidebar item after Library. Page banner (H1 + subtitle, fern photo) with the primary action
**Suggest an idea** (height 42px, radius 10px, `#5fd39a`/`#06231a`, leading lightbulb icon) and,
in developer view, a pill showing the channel you act as (22px tile + "Developer view · Nilesoft").

Optional **released-idea note** under the banner (when one of the user's ideas shipped and has
not been dismissed): gradient card `linear-gradient(160deg, --mint-soft 0%, --card 70%)`,
44px app tile, title "Your idea became an app" + body naming the app and developer, buttons
**Open <App>** (secondary) and **Activate 3 months of Pro** (mint, crown icon), × to dismiss.
Activating grants Pro (`plan` stays `free`, `proGift` shown as the plan name everywhere) and
toasts "Paparats Pro is active until <date>".

Two columns: `minmax(0,1fr)` + 290px, gap 24px.
- **Toolbar**: tab strip (`--card`, 1px `--line`, radius 10px, padding 3px; 34px tabs with count
  pills) — user: All / New apps / Existing apps / My ideas; developer: All / New apps / For my apps /
  My work. Right: status chips (Open / In work / Released — 32px pills, 7px status dot, toggle to
  filter) and a Sort `<select>` (Top / Newest). An app filter chip ("For <App>" with ×) appears when
  the board was opened from an app page.
- **Idea card**: grid `56px minmax(0,1fr)`, gap 16px, padding 16px 18px 14px, radius 12px,
  `--card`, hover border `--line2`. Left: 56px **vote button** (chevron-up + count, 14px/700 tabular;
  idle `--card2`/`--text`/border `--line2`, voted `--mint`/`--ink`). Right: title 15.5px/600,
  excerpt 13px `--text2` (150 chars), then a meta row 12.5px `--text3`: kind chip ("For <App>" with a
  16px app tile, or "New app · <Category>"), status pill, developer line (8px tinted dot +
  "<Dev> is on it" / "Released as <App> <version>"), then author · relative date · comment count.
  Developer view adds a 30px **Take** button on open ideas the developer may take.
- **Status pills**: Open `--card2`/`--text2` · In work `--warn-soft`/`--warn` · Released
  `--mint-soft`/`--mint2` (11px/600, radius 10px).
- Right column: developer panel (dev view only: 40px tile, name, hint, 3 stat tiles — In work /
  Released / For your apps); **How it works** (4 numbered 24px mint circles: Propose · Vote ·
  A developer takes it · A thank-you: 3 months of Pro); **Your ideas** (user view: rows with status
  pill; empty text; an "Activate 3 months of Pro" rail when a released idea's bonus is unclaimed).
- Empty state card: "Nothing here yet" / "Be the first to suggest something."

**Suggest an idea dialog** (560px, radius 12px, `rgba(0,0,0,.55)` backdrop): kind toggle
**New app / Improve an app**; Title (min 6 characters — inline error otherwise); Description;
"Which app?" `<select>` (Improve) or Category (New); footer note about the 3-month Pro thank-you;
Cancel + **Publish** → toast "Idea published — developers can see it now"; the idea appears at the
top as `mine`, status Open.

### 11. Idea detail
Back link "Ideas". Header grid `72px minmax(0,1fr) 300px`, gap 24px, 1px `--line` bottom border:
72×76px vote button (radius 14px, 20px count, uppercase 10px "Vote/Voted"); meta row (kind chip,
status pill, "by <author>" · date); H1 28px/700; body 15.5px/1.6 `--text2`, max-width 680px.
Right: **status card** — status pill + developer line, status hint ("Open to developers…" /
"<Dev> has been on it since <date>." / "Shipped as <App> on <date>."), released-app row (36px tile,
name, version, Open) with the "author received 3 months of Pro" note; developer view: **Take this
idea** (mint, full width, hint below) or **Mark as released**; "In work at <other dev>" otherwise.

**Timeline**: 3 equal columns (Proposed · In work · Released) — 14px dots (`--mint` filled for
reached steps, `--card2` with `--line2` border otherwise), 2px connectors, 13.5px/600 labels,
12.5px `--text3` dates ("Not yet").

**Discussion** (max-width 760px): H2 16px + count; comment rows separated by 1px `--line`: 34px
initials avatar, author 13px/600, badges "Developer · <Channel>" (`--mint-soft`/`--mint2`) or
"Author" (`--card2`), date `--text3`; text 14px/1.55 `--text2`. Composer: avatar + textarea
(3 rows, radius 9px, `--input`, focus border `--mint`) + **Post** (mint when text is non-empty).

**Release the idea dialog** (480px; developer view): "Which app implements it?" `<select>`,
Version field pre-filled with the next patch version, note "<Author> and N voters will be
notified. The author gets 3 months of Paparats Pro.", Cancel + **Release** → status Released,
toast "Released · N people notified".

### 12. Settings › Sources
Panel header: H2 "Sources" + subtitle "Channels Paparats installs apps and updates from." and
**Add channel** (36px mint button with plus icon). One bordered card lists subscribed channels
(rows separated by 1px `--line`, padding 14px 20px): 44px monogram tile (radius 11px, channel
tint) → name 15px/600 + **trust badge** → meta 13px `--text2` ("Developer · by Nilesoft · 12 apps")
→ sync text 12.5px ("Synced 2 days ago" / "Not synced yet" / "Unreachable for 16 days" in `--warn`)
→ "Always on" (official) or a 44×24 pause toggle → 32px chevron button opening the channel page.
Paused rows render at reduced opacity.

**Trust badges** (11px/600, radius 10px, 11px icon): Official — shield, `--mint-soft`/`--mint2` ·
Verified — badge-check, `--card2`/`--text` · Community — users, `--warn-soft`/`--warn`.

**Stale callout** under a row (channel unreachable ≥ 14 days, not yet acknowledged): `--warn-soft`
ground, radius 9px, margin `-4px 20px 14px 78px`, triangle-alert icon in `--warn`, "<Channel>
hasn't answered for N days. Installed apps keep working. Updates from this channel are paused until
it responds again.", buttons **Keep** and **Unsubscribe** (30px, secondary; Unsubscribe hovers
`#e07a6a`).

Below: overline "TRUST LEVELS" and three cards (26px tinted icon circle + label + hint) explaining
Official / Verified / Community.

**Add channel dialog** (560px): "Channel address" input (placeholder `https://… or @name`, hint
"Paste a link from the author or a short code like @winaero."), **Add** (Enter submits). Lookup
matches address, host or @handle; errors inline: "No channel at this address. Check the link or ask
the author for a short code." / "You already follow this channel." Below the field, the **Channel
catalog**: channels not yet followed (same row anatomy + **Subscribe**), or "You follow every
channel in the catalog." Subscribing to a **community** channel first shows a **trust confirmation**
("Add <Channel>?" + the community warning, Cancel / Confirm). Success toasts "Subscribed to <Channel>".

### 13. Channel page
Back link. Header grid `96px minmax(0,1fr) 280px`, gap 24px, 1px `--line` bottom border:
96px monogram tile (radius 22px, 34px/700) · H1 30px/700 + trust badge + kind chip (Catalog /
Developer / Curated) · meta line "by <author> · @handle (monospace) · N subscribers" · description
16px/1.5 `--text2`, max-width 620px · action row (38px buttons, radius 9px): **Subscribe** (mint) or
"Subscribed" chip (`--mint-soft`/`--mint2`) + Enabled/Paused mini-toggle button + **Unsubscribe**
(outline, hovers `#e07a6a`); then **Copy address**, **Report a problem**, **Sync now** (outline).
Warnings: the stale callout (as above) when unreachable; "Apps from this channel are not covered by
Paparats Pro." (info icon) for non-official channels; "Your default source. It cannot be removed."
(shield) for the official catalog.

Right: **Details** card — Source, Address, Trust, Type, Author, Files (Paparats CDN / Author +
Paparats mirror / Author's server), Review ("Paparats team, <date>" / "Not reviewed"), Support,
Last sync — 13px key/value rows with 1px `--line` rules; community channels add the warning box.

Below: "Apps in this channel" + count, 5-column AppCards (with the split Get/Open + chevron
button), or the empty card "Nothing here yet / The author hasn't published any apps yet."

**Report a problem dialog**: title "Report a problem with <App or Channel>", routing line ("Your
report goes to <author>, the author of <channel>. Paparats receives a copy…" / "Your report goes to
the Paparats team."), textarea "What went wrong?", Cancel + **Send** → toast "Sent to <Channel> ·
copy to Paparats" / "Sent to Paparats".

**Source rule on app pages**: an app offered by several channels installs from the most trusted
one; the app page shows the source note ("From <Channel>, a verified channel. Paparats reviewed the
author and mirrors the files; the app itself is the author's." / community variant) and "Also
offered by <channels>. Paparats installs and updates from the most trusted channel that offers an
app." Browse's filter panel gains a **Source** group when more than one channel is followed.

### Global: search results
Typing in the top-bar search replaces the content area on any screen: H1 "Results for “query”",
a result count, then a 6-column AppCard grid. Empty state: 72px logo at .25 opacity,
"Nothing found" 18px/600 and a hint. Matching runs over name, publisher, tagline and category.

### Global: toast
Bottom-right, `right: 24px; bottom: 22px`, `--card` ground, 1px `--line2`, radius 10px,
padding 12px 16px, shadow `0 12px 40px rgba(0,0,0,.45)`, 22px mint check circle + 14px/500
message. Auto-dismisses after 2.8s. Used for: install/open, uninstall, all updates installed,
plan confirmed, profile saved, search history cleared, up-to-date check.

## Components to build
| Component | Variants / states |
| --- | --- |
| `AppCard` | 6-col / 5-col grid; default, hover, Get / Open / Update / Installing NN%, Pro pill |
| `AppListItem` | library list row, update row, compact "recently updated" row, grid-card variant |
| `CategoryCard` | photographic tile; compact top-category tile |
| `CollectionCard` | store collection; library collection |
| `HeroBanner` | home carousel, browse featured carousel, page banner, promo card |
| `SidebarNavigation` | idle / hover / active, count badge, Pro pill |
| `SearchBox` | top-bar (pill) and filter-panel (compact) |
| `FilterPanel` | checkbox group, radio group, live filter search |
| `Badge` / `Tag` | mint count pill, neutral chip, mint Pro pill, "Active" pill |
| `Button` | primary (mint), secondary (`--card2` + border), ghost, icon, split (action + chevron), destructive |
| `Toggle` | on / off, 44×24 |
| `Dropdown` | native select with custom chevron |
| `SettingsRow` | theme, language, toggle, select, path, action, link, note |
| `StatCard` | library stats row, usage tile, ecosystem row |
| `SubscriptionPlan` | free / monthly / yearly; current, recommended |
| `ProfileHeader` | view / edit |
| `SectionHeader` | title + optional "See all" |
| `EmptyState` | no results, everything up to date |
| `Toast` | success |
| `Modal` | confirmation (title, body, cancel, confirm); form dialogs 480–560px (add channel, suggest idea, release idea, report) |
| `TrustBadge` | official / verified / community |
| `ChannelRow` | settings list row, catalog row (Subscribe), paused state, stale callout |
| `WarnCallout` | `--warn-soft` ground, triangle-alert, optional action pair |
| `VoteButton` | 56px card size, 72×76 detail size; idle / voted |
| `StatusPill` | open / in work / released |
| `IdeaCard` | list card; user vs developer view (Take) |
| `Timeline` | 3-step proposed → in work → released |
| `CommentThread` | rows with Developer / Author badges + composer |

## Interactions & behavior
- **Navigation**: sidebar works on every screen; opening an app detail page from a section keeps
  that section active and "Back" returns to it. Search clears on navigation.
- **Install / update simulation**: 110ms ticks, +4–12% each, label "Installing… NN%"; on
  completion the app is recorded as installed at the catalog version. Updating an already
  installed app marks it "Updated just now" until you leave the screen.
- **Update all**: starts every pending download in parallel; the last one to finish fires the
  toast.
- **Favorites / uninstall**: mutate library state immediately; uninstalling also clears the
  "just updated" marker and removes the row from Updates.
- **Filters**: categories are multi-select; any active filter switches Browse to result mode;
  "Clear all" restores the curated view.
- **Plan purchase**: modal-gated; the confirmed plan drives the sidebar Pro pill, the
  subscription status card and the profile status card.
- **Theme**: Light / Dark / System, applied instantly via a `data-theme` attribute on the root.
- **Language**: switches all UI copy, and re-formats dates, relative times, file sizes
  (`18.4 MB` / `18,4 МБ`) and plural forms (Slavic 1 / 2–4 / 5+ rules) accordingly.
- **Transitions**: toggle knob and hero dots .15–.2s; hover states are instantaneous.
  All motion is subtle — respect the "Subtle animations" setting when implementing.
- **States to implement per component**: default, hover, pressed, focus-visible, disabled,
  selected, loading/installing, installed, update available, Pro.

## State model
```
screen            'home' | 'browse' | 'categories' | 'updates' | 'library'
                  | 'subscription' | 'settings' | 'profile' | 'app'
from              section to return to from an app page
appId             app shown on the detail page
locale            'en' | 'be' | 'ru'
theme             'dark' | 'light' | 'system'
query             top-bar search text
hero, browseHero  carousel indices
fCats[], fPro, fPortable, fSort, collection, filterQuery     browse filters
installs{}, removed{}, progress{}, justUpdated{}, expanded{} catalog/install state
favorites[]                                                  library favorites
libTab, libSort, libView, libCollection, libFilter           library view state
plan, pendingPlan                                            subscription
subs[], pausedCh{}, staleAck{}, fSources[]                   channels followed, paused, stale acknowledged, browse filter
chDialog, chAddr, chError, chPending                         add-channel dialog + trust confirmation
channelId, report{appId,channelId}, reportText              channel page, report dialog
ideas[], ideaTab, ideaSort, ideaApp, ideaId                  ideas board (list state, app filter, open idea)
ideaDialog{kind,appId,cat,title,body}, releaseDialog{ideaId,appId,version}
commentText, releaseSeen{}, bonusClaimed, viewAs             composer, released-note dismissal, Pro gift, user | developer
downloads{} (queued | downloading | paused | installing), batch   download engine (see v2 behaviours)
offline, searching                                           connectivity, search skeleton
section, settings{}, checking                                settings
profileTab, editing, profile{}, draft{}, twoFactor           profile
toast                                                        transient message
```
Data requirements for a real implementation: catalog list (app metadata, icons, screenshots,
categories, collections, Pro feature notes), installed-app inventory with versions and last-used
timestamps, update manifests with release notes and download sizes, subscription status, account
profile and device list, activity history.

## Design tokens

### Dark theme (default)
| Token | Value |
| --- | --- |
| `--bg` | `#0b171b` |
| `--side` | `linear-gradient(180deg,#0c191d 0%,#081215 100%)` |
| `--card` | `#101d22` |
| `--card2` | `#18272c` |
| `--hover` | `rgba(255,255,255,.05)` |
| `--line` | `rgba(255,255,255,.07)` |
| `--line2` | `rgba(255,255,255,.12)` |
| `--nav` | `#1c3433` |
| `--text` | `#e6ecec` |
| `--text2` | `#9aa8aa` |
| `--text3` | `#6d7b7d` |
| `--mint` | `#5fd39a` |
| `--mint2` | `#79dfae` |
| `--mint-soft` | `rgba(95,211,154,.12)` |
| `--ink` (on mint) | `#06231a` |
| `--input` | `#142127` |
| `--knob-off` | `#2b3a3f` |
| `--frame` | `rgba(255,255,255,.09)` |
| `--warn` | `#e0b25a` |
| `--warn-soft` | `rgba(224,178,90,.14)` |

### Light theme
`--bg #eef2f1` · `--side linear-gradient(180deg,#e6ecea,#dde5e3)` · `--card #ffffff` ·
`--card2 #e5ecea` · `--hover rgba(0,0,0,.05)` · `--line rgba(0,0,0,.08)` ·
`--line2 rgba(0,0,0,.13)` · `--nav rgba(31,138,98,.14)` · `--text #101c1f` ·
`--text2 #55666a` · `--text3 #87979a` · `--mint #1f8a62` · `--mint2 #26996e` ·
`--mint-soft rgba(31,138,98,.12)` · `--ink #ffffff` · `--input #ffffff` ·
`--knob-off #c2ccc9` · `--frame rgba(0,0,0,.12)` · `--warn #8a6414` · `--warn-soft rgba(184,134,43,.14)`

`--warn` is the third semantic color: community trust, "In work" status, unreachable channels.
Channel tints (monogram tiles): Paparats `#1f6f52`, Nilesoft `#3b6fd1`, FOSS Friends `#7a52c9`,
Winaero `#c27a2f`, mpv builds `#5a3f9a`, Софт па-беларуску `#b8432f`.

### Brand
Deep forest `#0F3D2E` · warm accent `#E05B3C` (the fern flower / star only) ·
off-white `#F6F7F4`. Dark banner ground `#0a1a1d`; hero gradient
`#0a2620 → #0e3026 → #081b18`; on-image text `#eef3f2` with secondary `#c3cbc6`.
Destructive `#e07a6a`; window-close hover `#c42b1c`.

App tint colors (icon tiles): Obsidian `#6f5bd8`, ShareX `#2f7de1`, VLC `#e8842e`,
PowerToys `#3d7fd4`, Notepad++ `#6faa55`, Everything `#d9782c`, VS Code `#2f7fd6`,
Files `#3f74c9`, Flow Launcher `#2f86d6`, LocalSend `#2fa48a`, Krita `#c94f8a`,
RustDesk `#2a6fd6`, 7-Zip `#5b6b7a`, OBS `#4a5560`, KeePassXC `#4c9a3c`,
Audacity `#3865c9`, Bitwarden `#2a63d4`, Inkscape `#4a6b8a`, f.lux `#d87a3a`,
Anki `#3b7dd8`, Stellarium `#3c4f8a`, Mindustry `#c9a23a`, Joplin `#1e6fc0`,
Ditto `#3a8f6a`, SuperTuxKart `#d64a3a`.

### Typography
**Onest** (Google Fonts, weights 400/500/600/700), falling back to
`'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif`. In a Qt build, ship Onest or
substitute Segoe UI Variable. Tabular figures on throughout
(`font-feature-settings: 'tnum'`).

| Role | Size / weight / spacing |
| --- | --- |
| Hero H1 | 42px / 600 / -.02em / line-height 1.1 |
| Page H1 | 34px / 600 / -.02em / 1.1 |
| App detail H1 | 30px / 700 / -.02em |
| Section H2 | 20px / 600 / -.01em |
| Card / row title | 14–16px / 600 |
| Body | 14px / 1.4 (long copy 15px / 1.5–1.6) |
| Secondary | 12.5–13px, `--text2` |
| Meta | 11–12px, `--text3` |
| Chip / pill | 11px / 500 (counts 700) |
| Uppercase kicker | 11px, letter-spacing .22–.24em |
| Overline label | 12px uppercase, letter-spacing .08em, 600 |

### Spacing, radius, shadow
Spacing scale: 2 / 3 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 26 / 30 px.
Content padding 24px 30px 40px; grid gap 12px; aside gap 10–12px.
Radius: 6 (small control) · 7–8 (button, chip group) · 10 (card, row) · 11–13 (icon tile) ·
12 (large card, banner) · 16–20 (pill) · 22 (96px app icon) · 999 (circle).
Shadows: toast `0 12px 40px rgba(0,0,0,.45)` · popover `0 16px 40px rgba(0,0,0,.45)` ·
modal & window `0 30px 80px rgba(0,0,0,.6)` · floating app tile
`0 30px 60px rgba(0,0,0,.45)`.

### Accessibility
Body text meets 4.5:1 on its ground; `--mint` is used for large text, icons and chrome, with
`--ink` for text on mint fills. Keyboard focus must be visible — use a 2px `--mint` ring with
2px offset; never leave the browser/platform default. Hit targets ≥ 32px (nav 42px, primary
actions 40px).

## Assets
All in `assets/` in this bundle.
| File | What it is | Provenance |
| --- | --- | --- |
| `paparats-mark-light.png` | Logo mark, off-white frond + terracotta star | keyed out of the supplied brand sheet |
| `paparats-icon.png` | App icon, rounded square on deep forest | supplied brand sheet |
| `paparats-fern-watermark.png` | Tall fern frond, sidebar watermark, alpha + `#2e4a3d` tint | extracted from the supplied Library reference |
| `hero-fern.png` | Fern-with-star photograph, hero and page banners | supplied home reference |
| `sub-hero.png` | Laptop in ferns, subscription banner | supplied subscription reference |
| `promo-updates.png` | Glowing laptop, updates promo card | supplied updates reference |
| `promo-profile.png` | Robot, profile promo card | supplied profile reference |
| `cat-*.png` (9) | Category photographs | cropped from the supplied categories reference |

The photographic assets are crops of the concept renders supplied with the brief — treat them as
**placeholders for production imagery**. The logo mark and app icon should be replaced with the
final vector artwork; the brief requires the mark to stay legible at **16 × 16 px monochrome**,
with no gradients, glow, 3D or thin internal detail.

**Icons**: outline set, 24 × 24 grid, 1.75px stroke, round caps and joins (2–2.2px for small
glyphs, 2.4–3px for checks and window controls) — matching Lucide. Replace the inlined set with
the target platform's icon library.

## Files in this bundle
| File | Role |
| --- | --- |
| `STACK.md` | Technology stack decision and architecture (Tauri 2 · Rust core · React/TS UI) |
| `REPO_CLAUDE.md` | Conventions file for the new repository — copy to its root as `CLAUDE.md` |
| `Paparats Prototype.dc.html` | The clickable prototype — all 13 screens, first-launch onboarding, both themes, 3 languages |
| `paparats-proto-data.js` | All content: UI strings (en/be/ru), catalog, categories, collections, plans, settings schema, profile, activity, review pool |
| `FIRST_LAUNCH_SPEC.md` | Frame-by-frame spec of the first-launch animation and onboarding steps (timings, layers, easing, persistence) |
| `assets/` | Logo, watermark and photographic assets listed above |

Open `Paparats Prototype.dc.html` directly in a browser. Language switches sit above the window
frame; theme lives in Settings › General (and Profile › Preferences). The toolbar above the frame
also offers **Simulate offline**, **View as user / developer** and **Replay first launch**; the
same switches exist as Tweaks (`offline`, `viewAs`, `firstRun`, `skeletons`, `outageDemo` — the last
one makes the FOSS Friends channel unreachable since 2026-08-30 to show the stale flow).

## Behaviours added in v2
- **First launch** — fern-flower scene → language → appearance → sign in / later; plays once
  (`localStorage` flag), then the chosen locale and theme are restored. See `FIRST_LAUNCH_SPEC.md`.
- **Downloads** — at most *Parallel downloads* (Settings › Downloads, default 2) run at once, the
  rest sit in a queue. Per item: `queued → downloading (0–100 %, pausable, cancellable) → installing → installed`.
  Row status text: “Downloading… 43 % · 12 MB of 87 MB”, “Paused · 43 %”, “Queued”, “Installing…”.
  Progress bars: 3 px under an update row, 2 px along the bottom of a library row/card, 4 px under
  the app-page action button.
- **Update all** — creates a batch; the Updates hero shows “Updating 2 of 5 · 43 %” with a 6 px bar,
  plus *Pause all / Resume all* and *Cancel all*. “All apps updated” toast when the last one lands.
- **App page** — screenshot viewer (main frame + 4 thumbnails, prev/next), ratings block (average,
  count, 5–1 histogram, tap-to-rate), three reviews, version history (2 shown, expandable).
  Screenshot frames are abstract placeholders — wire to catalog imagery.
- **Search** — 340 ms “searching” skeleton while typing; empty state offers four featured apps as
  chips and a link to Categories.
- **Screen transitions** — content enters with a 340 ms fade + 10 px rise; a shimmer skeleton shows
  for 420 ms on navigation (toolbar/tweak `skeletons` turns it off). Scroll resets to top.
- **Empty states** — Library: empty library (CTA to Browse), no favorites, no active downloads,
  no pending updates. Search: nothing found / offline.
- **Offline** — toggle in the toolbar (“Simulate offline”) or the `offline` tweak. Red banner under
  the header with *Retry*; Get/Update buttons read “Offline” and are inert; active downloads pause
  and resume automatically; search shows the offline state; Updates hero says it can’t check.

## Behaviours added in v3
- **Sources / channels** — Settings › Sources lists followed channels with trust badges, sync state
  and pause toggles; Add channel looks a channel up by address or @handle and shows the catalog of
  channels not yet followed; community channels require a trust confirmation. Channel page with
  actions, details and its apps. Unsubscribing also clears the channel from the Browse source filter.
- **Trust and source rule** — an app offered by several channels installs from the most trusted one
  (official › verified › community); the app page explains the source and lists alternatives.
  Pro does not cover apps from non-official channels.
- **Outage** — a followed channel that has not answered for ≥ 14 days shows the stale callout
  (Keep / Unsubscribe) in Sources and on its page; sync text turns `--warn`.
- **Report a problem** — from an app page or a channel page; goes to the channel author with a copy
  to Paparats (official catalog: Paparats only).
- **Ideas board** — propose (new app or improvement to an installed/catalog app), vote/unvote,
  filter by tab, status and app, sort Top/Newest, discuss. Status flow open → in work → released.
- **Developer view** (`viewAs = developer`, acting as the Nilesoft channel) — Take open ideas (pinned
  to the channel, author notified), post comments with the Developer badge, Mark as released with
  app + version (voters notified).
- **Thank-you** — the author of a released idea gets 3 months of Paparats Pro: released note on the
  Ideas page, Activate button, Pro state everywhere with the plan name "Paparats Pro · gift" and
  "Idea bonus · active until <date>" on the status cards.

## Out of scope
No backend. Installs, updates, purchases and the account are simulated in local state with
realistic mock data and timing.
