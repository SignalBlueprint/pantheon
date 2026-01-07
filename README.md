# Pantheon

A persistent world deity game. Guide your civilization through policy and miracles. Compete with rival gods. Your world lives on while you sleep.

## Status

Initialized — awaiting first vision scan

## Quick Start
```bash
pnpm install
pnpm dev
```

## Development Loop

This project uses the Signal Blueprint development loop:

1. `vision-scan` — Analyze repo, generate docs/VISION.md
2. `task-breakdown` — Convert vision to docs/TASKS.md
3. `task-worker` — Execute tasks until complete
4. Repeat

## Structure

- `apps/web/` — Next.js frontend
- `apps/server/` — Game simulation server
- `packages/shared/` — Shared types and logic
- `supabase/` — Database migrations
- `docs/` — Vision, tasks, and work logs

## Core Concepts

- **Deity:** The player. Sets policy, spends divine power, watches over their people.
- **Faction:** A civilization following a deity. Grows, fights, trades autonomously.
- **Territory:** Hex on the map. Produces resources, holds population.
- **Policy:** Settings that guide your faction's AI behavior.
- **Miracle:** Divine interventions that cost power (bless, smite, inspire).
- **Shard:** A self-contained world instance with its own map and history.

## History

| Date | Cycle | Summary |
|------|-------|---------|
| 2026-01-06 | 0 | Project initialized |
