---
repo: pantheon
source: VISION.md
generated: 2025-01-06
status: draft
---

# Tasks: Pantheon

Comprehensive task breakdown for building the persistent world deity game.

---

## Overview

This task list implements Pantheon from zero to playable MVP. The focus is Phase 1 (Core Loop) and Phase 2 (Combat & Miracles) — enough to validate the game feel before investing in full multiplayer infrastructure. Tasks are ordered for a solo developer or small team working sequentially.

---

## Horizon 1: Quick Wins

### 1.1 Single Shard Playable World

**Goal:** A working hex map where AI-controlled factions expand, clash, and capture territory in real-time.

#### Foundation

- [x] Initialize monorepo with Turborepo — `pnpm dlx create-turbo@latest`, configure `apps/web`, `apps/server`, `packages/shared`
- [x] Set up Next.js app in `apps/web` — `pnpm create next-app`, configure TypeScript, Tailwind
- [x] Set up Node.js server in `apps/server` — basic Express + ts-node, health check endpoint
- [x] Create `packages/shared` — export TypeScript types for Territory, Faction, GameState
- [x] Configure Supabase project — create new project, save credentials to `.env.local`

#### Hex Map System

- [x] Define hex coordinate system in `packages/shared/src/hex.ts` — use axial coordinates (q, r), implement `hexDistance()`, `hexNeighbors()`, `hexToPixel()`, `pixelToHex()`
- [x] Create `Territory` type — `{ id, q, r, owner: factionId | null, population, food, production }`
- [x] Build hex map generator in `apps/server/src/world/mapgen.ts` — generate 61-hex map (radius 4), assign random starting resources
- [x] Create React hex renderer in `apps/web/src/components/map/HexGrid.tsx` — render hexes using Canvas or SVG, color by faction owner
- [x] Implement pan and zoom on hex map — mouse drag to pan, scroll to zoom, clamp to map bounds
- [x] Add territory click handler — clicking hex shows territory detail panel with stats

#### Faction System

- [x] Define `Faction` type in `packages/shared` — `{ id, name, color, deityId, policies, territories[], resources }`
- [x] Define `Policy` type — `{ expansion: 0-100, aggression: 0-100, resourceFocus: 'food' | 'production' | 'balanced' }`
- [ ] Create faction factory in `apps/server/src/world/faction.ts` — `createFaction(name, color, startingTerritory)`
- [ ] Implement starting position selection — place factions at maximum distance from each other on map

#### World Tick System

- [ ] Create game loop in `apps/server/src/simulation/ticker.ts` — `setInterval` every 1000ms, increment `worldTick` counter
- [ ] Define tick phases: 1) Resource production, 2) Population growth, 3) AI decisions, 4) Combat resolution, 5) Broadcast state
- [ ] Implement resource production — each territory generates food and production based on terrain type
- [ ] Implement population growth — population grows if food surplus, shrinks if deficit, caps at territory limit
- [ ] Create `GameState` type — `{ tick, territories: Map<id, Territory>, factions: Map<id, Faction>, pendingBattles[] }`

#### Faction AI

- [ ] Create AI decision maker in `apps/server/src/simulation/ai.ts` — runs once per faction per tick
- [ ] Implement expansion logic — if `policy.expansion > 50` and adjacent unclaimed territory exists, claim it (costs production)
- [ ] Implement aggression logic — if `policy.aggression > 50` and adjacent enemy territory, queue attack
- [ ] Implement defense logic — if own territory under threat, move armies to defend
- [ ] Add randomness factor — AI decisions have ±20% variance to prevent deterministic outcomes

#### Real-Time Sync (Local First)

- [ ] Create WebSocket server in `apps/server/src/net/socket.ts` — use `ws` package, handle connect/disconnect
- [ ] Broadcast game state diff on each tick — send only changed territories and factions
- [ ] Create WebSocket hook in `apps/web/src/hooks/useGameSocket.ts` — connect, receive state updates, expose `gameState`
- [ ] Update hex map on state change — re-render only changed territories for performance
- [ ] Add connection status indicator — show "Connected" / "Reconnecting" in UI corner

**Acceptance Criteria:**
- Hex map renders with 61 territories
- Two AI factions spawn at opposite ends
- Territories change color as factions expand
- World ticks visibly update the map every second
- Browser console shows no errors

**Estimated Effort:** 20-30 hours

**Dependencies:** None — this is the foundation

---

### 1.2 Divine Intervention System

**Goal:** Players can spend divine power to cast miracles that affect the game world.

#### Divine Power

- [ ] Add `divinePower` field to Faction — starts at 100, caps at 200
- [ ] Implement divine power regeneration — +1 per tick per temple (territory with temple building)
- [ ] Create divine power UI in `apps/web/src/components/ui/DivinePowerBar.tsx` — show current/max, regen rate

#### Miracle System

- [ ] Define `Miracle` type in `packages/shared` — `{ id, name, cost, targetType: 'territory' | 'army' | 'faction', effect }`
- [ ] Create miracle catalog in `packages/shared/src/miracles.ts`:
  - [ ] "Bountiful Harvest" — cost 30, target territory, +50% food production for 10 ticks
  - [ ] "Blessing of Valor" — cost 40, target army, +30% combat strength for next battle
  - [ ] "Divine Shield" — cost 50, target territory, immune to capture for 20 ticks
  - [ ] "Smite" — cost 60, target enemy army, deal 25% casualties instantly
  - [ ] "Inspire" — cost 35, target territory, +100% production for 5 ticks
- [ ] Create miracle execution in `apps/server/src/systems/miracles.ts` — validate cost, apply effect, deduct power
- [ ] Add active effects tracking — `territory.activeEffects[]` with expiration tick
- [ ] Process effect expiration in tick loop — remove effects when `currentTick >= effect.expiresTick`

#### Miracle UI

- [ ] Create miracle panel in `apps/web/src/components/ui/MiraclePanel.tsx` — list available miracles with costs
- [ ] Implement miracle targeting mode — click miracle, then click valid target on map
- [ ] Add visual feedback for miracle cast — particle effect or flash on target territory
- [ ] Show active effects on territory — icons or border glow indicating buffs/debuffs
- [ ] Add cooldown display — show time until miracle can be cast again (if implementing cooldowns)

#### WebSocket Integration

- [ ] Add `CAST_MIRACLE` message type — `{ miracleId, targetId }`
- [ ] Validate miracle cast on server — check power, target validity, apply effect
- [ ] Broadcast miracle events to all clients — show other players' miracles on the map

**Acceptance Criteria:**
- Divine power bar shows and updates in real-time
- All 5 miracles can be cast on valid targets
- Effects visibly change gameplay (buffed territory produces more, etc.)
- Miracles fail gracefully if insufficient power

**Estimated Effort:** 12-16 hours

**Dependencies:** 1.1 Single Shard Playable World

---

### 1.3 Offline Persistence with Slow Sieges

**Goal:** The game continues while players are offline, with sieges taking real-time hours to complete.

#### Persistence Layer

- [ ] Create Supabase tables:
  - [ ] `shards` — `{ id, name, created_at, current_tick, status }`
  - [ ] `factions` — `{ id, shard_id, deity_id, name, color, policies, divine_power }`
  - [ ] `territories` — `{ id, shard_id, q, r, owner_id, population, food, production, active_effects }`
  - [ ] `sieges` — `{ id, attacker_id, territory_id, started_at, progress, required_progress }`
- [ ] Implement state save on tick — batch update changed records every 10 ticks
- [ ] Implement state load on server start — query Supabase, reconstruct GameState
- [ ] Add server graceful shutdown — save full state before exit

#### Siege System

- [ ] Replace instant capture with siege mechanic — attacking army starts siege instead of capturing
- [ ] Define siege progress — accumulates based on attacker army strength vs defender strength
- [ ] Set siege duration — minimum 24 hours for undefended, 48+ hours for defended territories
- [ ] Implement siege tick in `apps/server/src/simulation/siege.ts` — increment progress each tick
- [ ] Complete siege when progress reaches threshold — transfer territory ownership, reset siege
- [ ] Allow siege breaking — if defender army arrives, siege can be contested or lifted

#### Notification System

- [ ] Add `notifications` table — `{ id, deity_id, type, message, data, read, created_at }`
- [ ] Generate notifications for: siege started, siege at 50%, siege at 90%, siege complete, territory lost
- [ ] Create notification API endpoint — GET `/api/notifications` returns unread notifications
- [ ] Build notification UI in `apps/web/src/components/ui/NotificationBell.tsx` — badge count, dropdown list
- [ ] Add push notification integration (future) — placeholder for FCM or web push

#### Offline AI Enhancement

- [ ] Improve AI to handle sieges — AI defends sieged territories, breaks enemy sieges
- [ ] Add AI retreat logic — if siege is hopeless, AI may abandon territory to save army
- [ ] Implement AI notifications — AI deity gets same notifications, may respond automatically

**Acceptance Criteria:**
- Server can restart and resume game state from database
- Sieges take minimum 24 hours of real time
- Players receive notifications when their territory is under siege
- AI factions continue operating when no human is online

**Estimated Effort:** 16-20 hours

**Dependencies:** 1.1, 1.2

---

## Horizon 2: System Expansions

### 2.1 Diplomacy and Deity Alliances

**Goal:** Players can form alliances, declare wars, and negotiate with rival deities.

#### Diplomatic Relations

- [ ] Create `relations` table — `{ faction_a, faction_b, status: 'neutral' | 'war' | 'alliance' | 'truce', since_tick }`
- [ ] Default all factions to neutral — can pass through but not attack without declaring war
- [ ] Implement war declaration — costs divine power, enables attacks, notifies target
- [ ] Implement peace offer — sender proposes, receiver accepts/rejects
- [ ] Implement alliance — shared vision, can't attack each other, trade bonus

#### Alliance Benefits

- [ ] Shared map vision — see allied faction's territories and armies
- [ ] Trade routes — allied factions automatically trade surplus resources
- [ ] Combined defense — allied armies can defend each other's territories
- [ ] Alliance breaking — costs divine power, reputation penalty, cooldown before new alliance

#### Diplomacy UI

- [ ] Create diplomacy panel in `apps/web/src/components/ui/DiplomacyPanel.tsx` — list all factions with current relation
- [ ] Add relation action buttons — "Declare War", "Propose Alliance", "Offer Peace"
- [ ] Create message system — simple text messages between deities
- [ ] Show diplomatic history — "X declared war on Y", "A and B formed alliance"

#### AI Diplomacy

- [ ] AI evaluates alliance value — considers shared enemies, relative power, border length
- [ ] AI accepts/rejects proposals — based on policy settings and strategic situation
- [ ] AI declares wars — when aggression high and target is weak
- [ ] AI breaks losing alliances — if ally is dragging them into unwinnable war

**New Infrastructure Required:**
- `relations` table in Supabase
- `messages` table for deity-to-deity communication
- Diplomatic event log for history

**Migration Notes:**
- Existing factions default to neutral relations
- No breaking changes to core game state

**Acceptance Criteria:**
- Players can declare war, make peace, form alliances
- AI responds to diplomatic proposals intelligently
- Allied factions visibly cooperate
- Diplomatic actions cost divine power appropriately

**Estimated Effort:** 20-24 hours

**Dependencies:** Horizon 1 complete

---

### 2.2 Seasonal Resets with Legacy

**Goal:** Worlds run for 2-3 months, then reset with rewards for top players.

#### Season System

- [ ] Add `seasons` table — `{ id, shard_id, started_at, ends_at, status, winner_id }`
- [ ] Configure season duration — default 8 weeks, adjustable per shard
- [ ] Create end-of-season countdown — show days/hours remaining in UI
- [ ] Implement season end trigger — when time expires or dominance threshold reached

#### Victory Conditions

- [ ] Define dominance victory — control 60%+ of territories for 48 continuous hours
- [ ] Define power victory — accumulate most total divine power over season
- [ ] Define survival victory — last faction standing (all others eliminated or abandoned)
- [ ] Calculate final rankings — score based on territories, population, divine power, wars won

#### Legacy Rewards

- [ ] Create `legacy` table — `{ deity_id, season_id, rank, title, rewards }`
- [ ] Design reward tiers:
  - [ ] 1st place: "Ascended" title, unique deity avatar, 500 premium currency
  - [ ] 2nd-3rd: "Exalted" title, rare avatar frame, 200 premium currency
  - [ ] Top 10: "Blessed" title, uncommon cosmetic, 50 premium currency
  - [ ] Participation: Season badge, 10 premium currency
- [ ] Implement Pantheon Hall — permanent display of all season winners with their faction history
- [ ] Show legacy titles in-game — winner's title displays next to their name

#### Season Transition

- [ ] Archive completed season data — snapshot final state for history viewing
- [ ] Generate new map for next season — fresh terrain, new starting positions
- [ ] Reset faction progress — all players start equal, only cosmetics persist
- [ ] Allow early registration — players can claim starting spots before season begins

**New Infrastructure Required:**
- `seasons` table
- `legacy` table
- `season_archives` table or blob storage for historical snapshots
- Premium currency system

**Migration Notes:**
- First season starts immediately after implementation
- Existing shard becomes "Season 1"

**Acceptance Criteria:**
- Season countdown visible to all players
- Victory conditions trigger season end correctly
- Rewards distributed automatically
- Pantheon Hall displays all past winners

**Estimated Effort:** 24-30 hours

**Dependencies:** Horizon 1 complete

---

### 2.3 Faction Specialization Trees

**Goal:** Factions unlock unique abilities based on geography and choices.

#### Specialization Framework

- [ ] Define specialization unlock trigger — survive 100 ticks, control 5+ territories
- [ ] Create `specializations` in `packages/shared` — each with passive bonuses and unique abilities
- [ ] Design four initial paths:
  - [ ] **Maritime Dominion** — coastal territories produce ships, can settle islands, naval combat bonus
  - [ ] **Mountain Fortress** — mountain territories have defense bonus, mining produces rare resources
  - [ ] **Fertile Plains** — flat territories have 2x population cap, food export generates gold
  - [ ] **Nomadic Horde** — no permanent cities, armies move 2x speed, can raid without siege

#### Specialization Implementation

- [ ] Add `specialization` field to Faction — null until unlocked, then one of four types
- [ ] Implement Maritime abilities — ship unit type, overseas movement, island colonization
- [ ] Implement Fortress abilities — defense multiplier, mineshaft building, rare resource type
- [ ] Implement Plains abilities — population modifier, trade route bonuses, granary building
- [ ] Implement Nomadic abilities — camp instead of city, raid action, movement speed bonus

#### UI for Specialization

- [ ] Create specialization selection modal — appears when unlock triggered, shows all four paths
- [ ] Add specialization indicator to faction panel — icon and description of chosen path
- [ ] Show specialization-specific buildings — only available after path chosen
- [ ] Display locked paths — show what you didn't choose, can't be changed

**New Infrastructure Required:**
- `specialization` column on factions table
- New building types per specialization
- Ship unit type and naval movement logic

**Migration Notes:**
- Existing factions can choose specialization on next login
- Default to no specialization for backwards compatibility

**Acceptance Criteria:**
- Specialization choice appears at correct trigger
- Each path provides distinct gameplay advantages
- Specialization persists across sessions
- AI factions choose specializations intelligently

**Estimated Effort:** 28-32 hours

**Dependencies:** Horizon 1 complete

---

## Horizon 3: Blue Sky

### 3.1 Emergent Mythology System

**Goal:** Significant events automatically generate myths that become permanent faction lore.

**Open Questions:**
- How much narrative should be AI-generated vs templated?
- Should myths affect gameplay or be purely cosmetic?
- How to handle inappropriate/offensive generated content?

**Proof of Concept Scope:**
- Template-based myth generation for 5 event types (great battle, divine intervention, hero death, city founding, betrayal)
- Myths stored in database and displayed in faction temple view
- No AI generation in PoC — use mad-libs style templates

**Tasks:**

- [ ] Define `myths` table — `{ id, faction_id, event_type, event_data, generated_text, tick_created }`
- [ ] Create myth templates for each event type — "The [adjective] [noun] of [location], when [event description]"
- [ ] Implement myth trigger detection — large battle (100+ casualties), miracle cast, etc.
- [ ] Build myth generation service — select template, fill variables, save to database
- [ ] Create temple view UI — scrollable list of faction's myths
- [ ] Display myths to other players — visible when viewing rival faction's temples
- [ ] Add myth sharing — players can share myths to external platforms

**Acceptance Criteria:**
- At least 5 event types generate myths
- Myths appear in temple view within one tick of event
- Myths persist across seasons in faction legacy
- Generated text is coherent and thematic

**Estimated Effort:** 16-20 hours

**Dependencies:** Horizon 2 complete (seasons for legacy persistence)

---

### 3.2 Mortal Champions

**Goal:** Exceptional mortal heroes emerge and can be elevated by the deity.

**Open Questions:**
- How much control does the deity have over champion actions?
- What happens when a champion dies — always becomes myth, or only if notable?
- Can champions defect to other factions?

**Proof of Concept Scope:**
- Champions spawn randomly in high-population territories
- One champion type: General (leads armies, combat bonus)
- Deity can spend divine power to "bless" champion (stat boost, lifespan extension)
- Champions die of old age or in battle, generate myth on death

**Tasks:**

- [ ] Define `champions` table — `{ id, faction_id, name, type, stats, age, blessed, territory_id }`
- [ ] Implement champion spawn logic — 1% chance per tick per territory with 1000+ population
- [ ] Generate champion names — use name generator appropriate to faction culture
- [ ] Create General champion type — leads army, provides combat bonus, can be assigned to armies
- [ ] Implement champion aging — age increases each tick, death when age > lifespan
- [ ] Add "Bless Champion" miracle — costs 80 divine power, +50% stats, +50% lifespan
- [ ] Create champion death handling — generate myth, remove from game, notify deity
- [ ] Build champion UI panel — list of faction's champions with stats and location
- [ ] Add champion to army assignment — dropdown to attach champion to army

**Acceptance Criteria:**
- Champions spawn organically in successful factions
- General provides measurable combat advantage
- Blessing a champion is meaningful and costly
- Champion deaths generate appropriate myths

**Estimated Effort:** 20-24 hours

**Dependencies:** 3.1 Mythology System (for death myths)

---

## Moonshot: The Living World Archive

**Goal:** Every shard's complete history is recorded and explorable as a time-scrubbing spectator mode.

### Phase 1: Foundation

**Goal:** Record all game events in replayable format.

- [ ] Design event log schema — `{ tick, event_type, data, shard_id }`
- [ ] Implement event recording — log all state changes (territory capture, battle, miracle, etc.)
- [ ] Create event compression — batch events, compress for storage
- [ ] Estimate storage requirements — calculate bytes per tick, project season cost
- [ ] Set up archive storage — S3 or Supabase Storage for completed seasons

**Estimated Effort:** 12-16 hours

### Phase 2: Core Feature

**Goal:** Playback recorded history with time controls.

- [ ] Build replay loader — fetch archived season data, decompress
- [ ] Create replay state machine — reconstruct game state at any tick from events
- [ ] Implement time scrubbing — slider to jump to any point in season
- [ ] Add playback speed controls — 1x, 10x, 100x, 1000x speed
- [ ] Build replay viewer UI — same map view but read-only, with timeline controls
- [ ] Implement smooth interpolation — animate between ticks for visual clarity

**Estimated Effort:** 24-30 hours

### Phase 3: Full Vision

**Goal:** Curated highlights and community features.

- [ ] Create highlight detection — algorithm identifies "interesting" moments (large battles, dramatic reversals)
- [ ] Build highlight reel generator — compile top 10 moments from a season
- [ ] Implement community voting — players upvote best moments
- [ ] Create "Eternal Canon" view — curated hall of fame moments across all shards/seasons
- [ ] Add social sharing — export clips as video or GIF
- [ ] Enable spectator links — shareable URLs that open replay at specific moment

**Estimated Effort:** 30-40 hours

---

## Suggested Starting Point

**Pick up first:** Task 1.1 Foundation — Initialize monorepo with Turborepo

**Why:** Everything else depends on the project structure existing. This is 30 minutes of setup that unblocks all other work.

**What it unblocks:**
- All frontend tasks (need Next.js app)
- All backend tasks (need server app)
- All shared type tasks (need shared package)
- Database setup (need project to connect to)

**After foundation, the critical path is:**
1. Hex coordinate system + map generator
2. Territory and faction types
3. Hex renderer (see something on screen)
4. World tick system
5. Basic faction AI
6. WebSocket sync

This gets you to "two factions fighting on a map" — the core loop validation.

---

*This task document will be archived when a new vision scan generates updated priorities.*