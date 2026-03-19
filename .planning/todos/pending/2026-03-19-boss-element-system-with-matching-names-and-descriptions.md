---
created: 2026-03-19T20:24:04.786Z
title: Boss element system with matching names and descriptions
area: ui
files:
  - packages/client/src/components/BossSprite.tsx
  - packages/server/src/game/bossManager.ts
---

## Problem

Bosses currently cycle through 5 SVG silhouettes (dragon/golem/wraith/spider/lich) keyed to `bossNumber % 5`. They have no elemental identity — names and descriptions don't reflect a theme. The game world would feel richer with elemental bosses that have cohesive identity across sprite glow, name, and flavor text.

## Solution

Assign each boss a random element on spawn from: fire, water, earth, lightning, dark, light (and optionally wind/ice). Each element should:

- **Influence CSS glow color** — override `--hp-bar-glow` and boss glow with element color (fire = orange/red, water = cyan/blue, lightning = yellow/white, etc.)
- **Drive boss name generation** — e.g. "Ignar the Flame Warden", "Thalor the Tidecaller", "Zek the Stormcaller" — either a name table or server-side generation
- **Add a flavor description** — 1 short sentence shown under the boss name during the encounter
- **Optionally tint the SVG silhouette** with an element color overlay

Element should be assigned server-side on boss spawn and broadcast to clients so all players see the same element. Store on the boss object in the game state.
