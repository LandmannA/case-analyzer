---
name: Salesforce Case Analyzer
description: A dark-glass command-center dashboard for reading support-case trends at a glance.
colors:
  canvas-deep: "#0B0E14"
  canvas-raised: "#12151D"
  glass-panel: "rgba(255,255,255,0.06)"
  glass-border: "rgba(255,255,255,0.10)"
  text-primary: "#F5F6FA"
  text-muted: "#9AA1B2"
  amber: "#F4B740"
  azure: "#4A90E2"
  teal: "#3DC9B0"
  lime: "#8FDD5E"
  coral: "#F4685D"
  violet: "#8B7FE8"
  rose: "#E8779E"
typography:
  display:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.03em"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  card:
    backgroundColor: "{colors.glass-panel}"
    rounded: "{rounded.lg}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.canvas-deep}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  badge-active:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.canvas-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: Salesforce Case Analyzer

## Overview

**Creative North Star: "The Late-Night Command Center"**

The dashboard reads like a mission-control briefing screen: a deep, near-black canvas holding softly glowing glass panels, each one a self-contained readout. Where most RevOps tools default to a flat white spreadsheet-with-charts look, this system commits to a premium, slightly cinematic dark surface — the kind of screen a recruiter scrolls past and stops on. Data does the coloring: category, sentiment, and urgency each get a distinct accent hue, so the eye reads pattern before it reads any label.

Confirmed visual rejections: no photographic/blurred background (chosen deliberately over the reference's photo backdrop, to keep charts and text crisp for screen recording); no flat white SaaS-dashboard look; no single-accent minimalism (superseded by the multi-color data palette).

**Key Characteristics:**
- Near-black canvas with translucent "glass" panels, not solid opaque cards
- Multi-color data accents (amber, azure, teal, lime, coral) carrying meaning, not decoration
- Generous rounded corners throughout (16–24px), pill-shaped badges and buttons
- Calm, confident type — no display serif, no ornament; Inter carries the whole system
- One consistent world across every screen: upload, table, dashboard, article generator

## Colors

A dark, restrained neutral base with a committed multi-color data palette layered on top — the neutrals disappear into the background so the accent colors read as the content.

### Primary
- **Amber Signal** (`#F4B740`): the "hero" accent — primary buttons, the top-ranked category or headline stat, active-state highlights.

### Secondary
- **Azure** (`#4A90E2`): secondary data series (e.g. a specific category or the volume-trend line), links, informational badges.
- **Teal Current** (`#3DC9B0`): tertiary data series and progress/completion indicators.

### Tertiary
- **Lime** (`#8FDD5E`): positive/success states — "Complete" badges, positive sentiment.
- **Coral** (`#F4685D`): negative/urgent states — Angry sentiment, High urgency, error states.
- **Violet** (`#8B7FE8`) / **Rose** (`#E8779E`): extended chart-only qualitative hues, used solely to keep 7-way category charts distinguishable once the five semantic accents are already assigned; carry no standalone meaning of their own.

### Neutral
- **Deep Canvas** (`#0B0E14`): page background.
- **Raised Canvas** (`#12151D`): header bar and any flat (non-glass) surface that needs to sit slightly above the page background.
- **Glass Panel** (`rgba(255,255,255,0.06)`): card/panel fill — a faint white wash over the dark canvas, not a separate solid color.
- **Glass Border** (`rgba(255,255,255,0.10)`): 1px hairline on every panel edge; the only thing separating a panel from the canvas at rest.
- **Primary Text** (`#F5F6FA`): headings, primary data labels.
- **Muted Text** (`#9AA1B2`): secondary labels, timestamps, helper copy.

### Text Tints (on tinted glass)
When a badge, pill, or chip sits on a tinted glass background (e.g. a coral-tinted "High urgency" pill), body text uses a lightened tint of that same accent rather than the base accent or a gray, so it reads clearly against the tint while staying visibly "the same color family" as the badge:
- **Amber Text Tint** (`#F8C766`) on amber-tinted surfaces.
- **Coral Text Tint** (`#FF9891`) on coral-tinted surfaces.
- **Lime Text Tint** (`#A8E880`) on lime-tinted surfaces.
- **Azure Text Tint** (`#8FC0F2`) on azure-tinted surfaces.
- **Amber Hover** (`#F7C667`): the amber primary button's hover state, a touch lighter than the base amber.

### Named Rules
**The Meaning-Not-Decoration Rule.** Every accent color maps to a specific data role (category, sentiment, urgency, status) and that mapping stays fixed across every chart and badge in the app. Never use an accent purely for visual variety.

**The Glass-Not-Solid Rule.** Panels are never opaque. Their fill is always a translucent wash over the canvas (`glass-panel` + `glass-border`), so the dark canvas is faintly visible through every card.

**The Tinted-Text Rule.** Text on a tinted glass surface always uses that surface's own hue, lightened for contrast — never gray, and never the raw saturated accent (which fails contrast at body-text sizes on a dark tint).

## Typography

**Display Font:** Inter (with -apple-system, sans-serif fallback)
**Body Font:** Inter (with -apple-system, sans-serif fallback)

**Character:** One geometric, highly legible grotesk carries the entire system — no serif, no mono. It reads as precise and technical without feeling cold, matching a data tool used by non-technical business leaders.

### Hierarchy
- **Display** (600, clamp(1.75rem, 2.5vw, 2.25rem) / 34px page hero, 1.15): page/section titles ("Case Analyzer", "Dashboard").
- **Headline** (700, 24–26px): dashboard section titles, donut center value, KPI values (34px, largest number on screen).
- **Title** (600, 1.0625rem / 17–18px, 1.3): card headers ("Cases by category", "Top Emerging Issues"), hero tagline (16px).
- **Body** (400–600, 13–15px, 1.5): case descriptions, table cells, article body copy, buttons, filters.
- **Label** (500–700, 11.5–13px, letter-spacing 0.03–0.08em): chart axis labels, badge text, table column headers, eyebrows — often uppercase.

### Named Rules
**The One Voice Rule.** Every screen uses Inter exclusively. Weight and size carry hierarchy; a second typeface is never introduced to add "personality."

**The Dense-Surface Rule.** This is an Operate-mode data dashboard, not a marketing page: tables, chips, chart legends, and KPI tiles legitimately need more granular size steps than a 4-role hierarchy allows. Sizes stay within the documented bands above (11.5–15px body/label range, 17–26px title/headline range, ~34px display) rather than introducing a fifth unrelated scale.

## Layout

A 12-column responsive grid, optimized first for the 1280–1920px desktop range this app is screen-recorded at. Cards sit in a loose masonry-like arrangement (large cards spanning 6–8 columns, supporting cards 3–4 columns), matching the reference's asymmetric card sizing rather than a uniform grid of equal boxes. Spacing rhythm: 32px between major sections, 20px between cards in the same row, 24px internal card padding. Mobile collapses to a single column, cards stacking full-width in priority order (top emerging issues and category chart first).

## Elevation & Depth

No drop shadows. Depth comes entirely from the glass-panel/glass-border treatment layered on the deep canvas — a translucent panel against a near-black ground reads as "raised" without needing a shadow. On hover/focus, a panel's border brightens slightly (glass-border moving toward ~18% opacity) rather than gaining a shadow.

### Named Rules
**The No-Shadow Rule.** Depth is conveyed by translucency and border brightness, never `box-shadow`. A shadow on a dark canvas reads as a smudge, not elevation.

## Shapes

Generously rounded throughout: cards and major containers use 24px corners, smaller elements (stat tiles, chart containers) use 16px, and any pill-shaped element (buttons, status badges, filter chips) uses full pill radius (999px). No sharp corners anywhere in the system — the rounded language is what gives the dark surface its "friendly command center" feel rather than reading as a stark terminal.

## Components

### Buttons
- **Shape:** full pill (999px radius)
- **Primary:** amber background (`#F4B740`), deep-canvas text (`#0B0E14`) for maximum contrast, 12px/24px padding, 600 weight label
- **Secondary/Ghost:** transparent background, glass-border outline, primary text color; used for "Load demo data" style secondary actions
- **Hover/Focus:** primary brightens ~8%; ghost buttons gain a glass-panel fill on hover

### Status Badges (chips)
- **Style:** pill-shaped, small (4px/12px padding), label-weight text
- **State mapping:** Lime fill = positive/complete/on-going-healthy; Coral fill = urgent/angry/failed; Azure/Teal = neutral in-progress states

### Cards / Containers
- **Corner Style:** 24px radius
- **Background:** glass-panel translucent fill over deep canvas
- **Shadow Strategy:** none — see Elevation & Depth
- **Border:** 1px glass-border hairline
- **Internal Padding:** 24px

### Charts (signature component)
Charts sit directly inside cards with no additional chrome — no boxed legend, no gridlines beyond faint muted-text-colored baselines. Each data series uses its assigned accent color from the Colors section consistently across every chart type (bar, line, donut) so a recruiter learns the color code once (e.g. "coral = urgent/angry") and it holds everywhere.

### Case Table
- **Style:** rows on transparent/glass background, 1px glass-border row dividers (no full cell borders), generous row height for scanability, hover state = faint glass-panel highlight on the row.

### Navigation / Header
- **Style:** raised-canvas flat bar (not glass) pinned to the top, app name in Display type on the left, primary actions (Load demo data / Analyze) as pill buttons on the right.

## Do's and Don'ts

### Do:
- **Do** keep every panel translucent (glass-panel + glass-border); a solid opaque card breaks the system.
- **Do** map each accent color to the same data meaning everywhere it appears (category, sentiment, urgency, status).
- **Do** use full-pill radius on every button and badge; use 16–24px radius on every card and container.
- **Do** keep typography to Inter only, varying weight and size for hierarchy.

### Don't:
- **Don't** introduce a photographic or image background — the deep canvas is solid/gradient only, for legibility during screen recording.
- **Don't** add drop shadows anywhere; depth comes from translucency and border brightness only.
- **Don't** use sharp (0px) corners on any component.
- **Don't** let an accent color drift roles between charts (e.g. coral meaning "urgent" on one chart and "category X" on another).
