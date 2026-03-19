---
created: 2026-03-19T20:24:04.786Z
title: Declutter desktop upgrades panel layout
area: ui
files:
  - packages/client/src/components/UpgradePanel.tsx
  - packages/client/src/components/TitleShop.tsx
  - packages/client/src/components/PlayerSidebar.tsx
  - packages/client/src/pages/Game.tsx
---

## Problem

The desktop right sidebar (w-72) shows UpgradePanel + TitleShop + PlayerSidebar stacked vertically. User reported this feels cluttered. The sidebar has a lot of info competing for space in a narrow column.

## Solution

Options to investigate:
1. **Tabs within sidebar** — single panel with "Upgrades / Titles / Players" tabs, only one shown at a time
2. **Collapsible sections** — accordion-style, each panel can collapse to a header bar
3. **Prioritize and trim** — identify lowest-value info and remove/minimize it (e.g. PlayerSidebar could be a compact list)
4. **Widen the sidebar** — increase from w-72 to w-80 or w-96 at larger breakpoints

Audit what's actually in each panel and how much it's used during gameplay before deciding approach. The upgrade buttons are high-frequency; title shop and player list are lower-frequency and candidates for compression.
