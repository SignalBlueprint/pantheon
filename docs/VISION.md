---
repo: pantheon
scan_date: 2025-01-06
status: mature
progress: 99%
last_sync: 2026-01-09
---

# Vision: Pantheon

A persistent world deity game where players shape civilizations through policy and divine intervention.

---

## Foundation Read

Pantheon is a real-time persistent multiplayer game. Players are minor deities guiding autonomous civilizations on a shared hex map. You set policies, cast miracles, and watch your people thrive or fall — even while you sleep. The core loop is: configure your faction's behavior, spend divine power at critical moments, and compete with rival deities for territorial and spiritual dominance.

---

## Architecture Snapshot

**Stack:**
- Frontend: Next.js, React, Pixi.js/Canvas
- Backend: Node.js game server with WebSockets
- Database: Supabase (Postgres + Auth + Realtime)
- Payments: Stripe
- Monorepo: Turborepo

**Data:**
- Hex-based world map per shard
- Factions, territories, armies, resources
- Event log for battle replays and history
- Player accounts, purchases, cosmetics

**Patterns:**
- Game tick system (server advances world state every N seconds)
- Client subscribes to relevant territories via WebSocket
- Deterministic simulation for replay consistency
- Policy = AI behavior configuration

**Gaps (to build):**
- Everything — greenfield project

---

## Latent Potential

N/A — project not yet built. This vision defines the initial build.

---

## Idea Generation

### Horizon 1: Quick Wins (V1 MVP)

**1. Single Shard Playable World**
You open the game and see a hex map with 50-100 territories. You claim a starting region, name your faction, and set three basic policies: expansion tendency, military aggression, and resource focus. Your civilization immediately begins operating — villagers farm, scouts explore borders, soldiers muster. You watch the world tick forward in real-time. Other deities' factions appear as rival colors spreading across the map. Within minutes, you understand the game without a tutorial.

**2. Divine Intervention System**
A notification pulses: your faction's army is clashing with a neighbor at the border. You open the battle viewer and see simplified units colliding in real-time. You have enough divine power to cast "Blessing of Valor" — your troops glow, their strength multiplied for 30 seconds. You watch them push through and capture the territory. The miracle cost depletes your power bar, which slowly regenerates over hours. Every intervention feels precious and impactful.

**3. Offline Persistence with Slow Sieges**
You close the app and go to bed. Eight hours later, you return to find your faction expanded into two new territories automatically (your expansion policy was high). But a rival deity declared war — their army is besieging your eastern temple. The siege progress bar shows 18 hours remaining before it falls. You have time to respond: redirect your armies, cast a protective miracle, or negotiate peace. The game never punishes you for sleeping, but it rewards you for showing up.

---

### Horizon 2: System Expansions

**1. Diplomacy and Deity Alliances**
You open the pantheon view and see all active deities ranked by power. You select a rival and send a message: "Truce on the northern border?" They respond with a counter-offer: military alliance against the dominant faction in the east. You accept, and your factions' borders turn from hostile red to allied blue. Your civilizations begin trading automatically, boosting both economies. Betrayal is possible — but breaking an alliance angers your own people and costs divine power.

**2. Seasonal Resets with Legacy**
The world has run for 11 weeks. A notification appears: "The Age is Ending. 5 days remain." Factions scramble for final positioning. When the season ends, the top deity "ascends" — their name permanently etched in the Pantheon Hall, their avatar available as a rare cosmetic. All players receive rewards based on final standing. The world resets: fresh map, new start, but your legacy persists. Veterans return with titles and skins that newcomers recognize and covet.

**3. Faction Specialization Trees**
After your faction survives its first major war, you unlock specialization choices. You select "Maritime Dominion" — your coastal territories now produce ships, and your people can settle islands. Other paths exist: "Mountain Fortress" (defensive bonuses, mining), "Fertile Plains" (population growth, food export), "Nomadic Horde" (fast armies, no permanent cities). Each playthrough becomes distinct based on geography and choices.

---

### Horizon 3: Blue Sky

**1. Emergent Mythology System**
Your faction's history generates its own mythology. When your deity cast "Smite" and destroyed an enemy army at the Battle of Redwater, the game generated a myth: "The Crimson Tide, when the Wrathful One turned the river to blood." These myths appear in your faction's temples, are visible to other players, and persist into future seasons as world lore. Players don't just win — they write history. The oldest shards become rich tapestries of player-generated legend.

**2. Mortal Champions**
Occasionally, a mortal hero emerges in your faction — an exceptional general, prophet, or inventor. You can invest divine power to elevate them: grant visions, extend their lifespan, make them a saint. Champions become semi-controllable agents who can lead armies, spark rebellions in enemy territory, or found new cities. When they die, they become part of your faction's mythology. Players grow attached to these emergent characters, sharing stories of their exploits.

---

## Moonshot

**The Living World Archive**

Every shard's complete history is recorded and explorable. After a season ends, the world becomes a "frozen age" — a playable museum where anyone can scrub through time, watching empires rise and fall at 1000x speed. Players can drop into any moment and spectate pivotal battles. The greatest moments get community-voted into the "Eternal Canon" — a curated highlight reel of the most dramatic wars, betrayals, and comebacks across all shards. Pantheon becomes not just a game but a generator of infinite alternate histories, each one collaboratively authored by its players.

---

## Next Move

**Most promising idea:** Single Shard Playable World (Horizon 1, #1)

This is the foundation everything else builds on. Without a working world tick, hex map, faction AI, and basic territory control, nothing else matters. It's also the riskiest — if the core loop isn't satisfying, no amount of features saves it.

**First experiment (< 1 day):**
Build a local-only prototype: 
- 7-hex map (one center, six surrounding)
- Two factions with hardcoded policies
- World ticks every second
- Territories change color when captured
- No backend, no auth, just the loop

This validates: Is it fun to watch factions expand and clash? If not, redesign before building infrastructure.

**Question to sharpen the vision:**
What's the core fantasy — being a god who *watches* their people, or one who *intervenes* constantly? The answer determines whether miracles are rare and powerful or frequent and tactical.

---

## Tools to Build (Summary)

### Phase 1: Core Loop
- Hex map renderer
- Territory data model
- Faction AI with policy inputs
- World tick system
- Basic resource model (food, production, population)

### Phase 2: Combat & Miracles
- Army composition and movement
- Battle resolution engine
- Real-time battle playback
- Divine power + miracle system

### Phase 3: Multiplayer
- Supabase schema and auth
- WebSocket server for real-time sync
- Shard management (create, join, spectate)
- Basic diplomacy (war, peace, alliance)

### Phase 4: Monetization & Polish
- Cosmetic shop (deity avatars, faction skins)
- Stripe integration
- Push notifications
- Seasonal reset and legacy system

---

*This vision document will be archived and regenerated as the project evolves.*