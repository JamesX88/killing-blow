# Pitfalls Research

**Domain:** Browser-based multiplayer idle-incremental game (global shared boss fight)
**Researched:** 2026-03-18
**Confidence:** HIGH (architecture/concurrency), MEDIUM (balance/retention), HIGH (security/cheating)

---

## Critical Pitfalls

### Pitfall 1: Boss HP Race Condition — Multiple Kills, Negative HP, or Missed Kill Credit

**What goes wrong:**
Two or more player damage events arrive at the server within microseconds of each other while the boss is at low HP. Both events read the current HP (e.g., 50), both apply their damage independently (30 and 40), and both write back a result that should kill the boss. The boss dies twice, kills are double-credited, or the HP is written as a negative value (-20) which breaks subsequent boss state logic. The killing blow award is granted to both players, or — worse — to neither because the write-back ordering places a non-killing event as the final commit.

**Why it happens:**
Developers implement damage as a read-modify-write sequence (GET hp → subtract damage → SET hp). Without atomicity guarantees, concurrent requests racing through this sequence produce inconsistent results. This is the textbook TOCTOU (time-of-check to time-of-use) race condition. It is especially severe when using a non-transactional data store or when the damage pathway is distributed across multiple server instances without a shared lock.

**How to avoid:**
Use atomic decrement operations exclusively for the boss HP counter. In Redis, `DECRBY boss:hp <damage>` is atomic and returns the new value in a single operation — no separate read required. Use a Lua script when the decrement and kill-detection must happen together as one unit:

```lua
-- Atomic: decrement AND detect kill in one server-side script
local newHP = redis.call('DECRBY', KEYS[1], ARGV[1])
if newHP <= 0 then
  -- Claim the kill atomically
  local claimed = redis.call('SETNX', KEYS[2], ARGV[2])  -- KEYS[2] = kill_claim:{bossId}
  return {newHP, claimed}
end
return {newHP, 0}
```

The `SETNX` (set if not exists) ensures only the first player whose damage crosses zero claims the killing blow, regardless of how many concurrent requests arrive. Clamp the stored HP to 0 — never let it go negative in storage. In the application layer, if the returned new HP is <= 0 and the claim flag is 0 (someone else already claimed), the player still gets participation rewards but not the killing blow.

**Warning signs:**
- Boss occasionally dies but no killing blow announcement fires
- Boss HP bar goes negative in the client UI (shows "-1,234 HP")
- Two players simultaneously receive killing blow notifications for the same boss
- Boss respawns but the old boss's kill state is unresolved (second spawn also claims a kill)
- Load testing shows HP values diverge under concurrent connections

**Phase to address:** Boss core loop implementation (earliest phase where real-time boss HP is built). Do not defer — this is architectural, not a polish fix.

---

### Pitfall 2: Client-Trusted Damage — Players Sending Arbitrary Damage Values

**What goes wrong:**
The client calculates damage locally and sends a `dealDamage(amount)` message to the server. A player opens dev tools, intercepts the WebSocket message, and modifies the payload to send `dealDamage(999999999)`. The server accepts it because it only checks "is this a valid number?" not "is this number achievable by this player's current stats?". The player single-handedly kills every boss instantly and dominates the killing blow leaderboard permanently.

**Why it happens:**
Developers mirror the damage calculation in the client for responsive UI (showing floating damage numbers immediately) and then trust that same value when it arrives at the server. The client is a browser — it is fully inspectable and modifiable by any user. There is no technical barrier to WebSocket message forgery in a browser context.

**How to avoid:**
The server must be the authoritative source of damage calculation. The canonical pattern: the client sends a "tick" or "attack intent" signal (not a damage value). The server looks up the player's current stats (attack, crit chance, equipment), calculates the damage value itself, applies it to the boss, and broadcasts the result. Client-side damage numbers shown in the UI are cosmetic predictions only. On the server, validate every incoming tick against rate limits (a player with 1 attack per second cannot send 10 ticks per second). Store computed DPS per player and flag any session whose cumulative damage over a rolling window exceeds their theoretical maximum by more than a tolerance factor (e.g., 2x to allow for lag burst catch-up).

```
Client sends:  { type: "attack", sessionToken: "..." }
Server does:   lookupPlayerStats(sessionToken) → calculateDamage(stats) → applyToBossHP() → broadcast
Server rejects: any message containing a damage value (treat as protocol violation)
```

**Warning signs:**
- A single player kills a boss that normally takes minutes in under a second
- A new account immediately tops the leaderboard
- Server logs show damage values far exceeding any equipment tier's theoretical maximum
- Players report feeling powerless next to others who have "impossibly high DPS"

**Phase to address:** Core server architecture (before any leaderboard is built). If the leaderboard is built on client-trusted damage, retrofitting server authority requires rewriting the entire damage pipeline.

---

### Pitfall 3: Offline Progress Using Client Timestamp — Time Manipulation Exploit

**What goes wrong:**
The server calculates offline idle earnings using the client-reported "last seen" timestamp or trusts `Date.now()` from the client payload. A player sets their computer clock back 30 days, reconnects, and claims 30 days of offline gold accumulation at once. Alternatively, the server stores `last_online` in a cookie or localStorage that the client can modify.

**Why it happens:**
Developers use the client's reported timestamp for convenience during development ("it was easier to pass the time in the request"). The mistake is subtle: the server appears to be doing the calculation (subtracting timestamps), but it is trusting a client-supplied input for one of the values.

**How to avoid:**
`last_online` must only ever be written by the server and stored server-side (database, not cookie). When a player reconnects, the server computes: `elapsed = server_now - db.last_online_timestamp`. The client sends nothing about time. Cap offline accumulation at a maximum (24-48 hours is standard for idle games — Melvor Idle uses 18 hours). This cap also prevents the exploitation of legitimate clock drift or server downtime causing runaway accumulation. Never store the last-seen timestamp in anything the client can write.

Additionally, enforce a hard ceiling on a single offline catch-up calculation: if `elapsed > MAX_OFFLINE_SECONDS`, clamp it. Log when the elapsed value is suspiciously large (> 7 days) as a potential integrity flag.

**Warning signs:**
- Players with suspiciously large gold amounts immediately on reconnect
- `last_online` column in database showing dates in the distant past for active accounts
- Offline earnings calculations producing gold values orders of magnitude above the daily active-player average
- Support tickets claiming "I only went offline for an hour but got 0 gold"

**Phase to address:** Offline progress system implementation. Must be server-authoritative from day one.

---

### Pitfall 4: Single-Instance WebSocket Server — Global Shared State Doesn't Scale Horizontally

**What goes wrong:**
The game works perfectly with one server process holding the boss HP in memory. At launch, traffic spikes beyond what a single Node.js process can handle. A load balancer is added, spinning up two server instances — but now Player A's attack on Instance 1 and Player B's attack on Instance 2 each hold a separate in-memory boss HP counter. The boss HP diverges. Players on different instances see different HP values. Some players are effectively fighting a ghost boss.

**Why it happens:**
In-memory shared state is the simplest implementation. It works for a single process and a single boss. But WebSockets require stateful connections, and horizontal scaling requires distributing those connections across multiple server instances. Without a shared external state store, each instance is isolated.

**How to avoid:**
Externalise the boss state to Redis from the very first commit. The boss HP, current boss ID, spawn timestamp, and kill state live in Redis — not in any server's memory. All server instances read and write the same Redis keys. WebSocket broadcast for boss updates uses Redis Pub/Sub: when Instance 1 applies damage and gets a new HP from Redis, it publishes a `boss_update` event to a Redis channel. All instances subscribe to that channel and fan out to their locally connected WebSocket clients.

```
[Client on Instance 1] → ATTACK → [Instance 1] → Redis DECRBY → pub boss_update
                                                                    ↓
                                                 [Instance 1 sub] → broadcast to local clients
                                                 [Instance 2 sub] → broadcast to local clients
                                                 [Instance N sub] → broadcast to local clients
```

This architecture allows arbitrary horizontal scaling with no in-process shared state.

**Warning signs:**
- Boss HP is inconsistent between browser tabs refreshed on different connections
- Deploying a second server process causes HP desync complaints
- WebSocket sticky sessions are required in the load balancer config (hides the problem, doesn't fix it)
- Integration tests pass but manual multi-tab testing shows divergent boss state

**Phase to address:** Server architecture and infrastructure setup — before any WebSocket logic is written.

---

### Pitfall 5: setInterval-Based Game Tick Breaks in Background Tabs

**What goes wrong:**
The client uses `setInterval` to drive the local game loop: ticking animations, accumulating idle gold display, sending attack ticks. The browser throttles `setInterval` to approximately 1-minute intervals for background tabs (Chrome behaviour since version 88). Players leave the game open in a background tab (a core idle game use case). The client's tick rate drops from 1/sec to 1/min. Attack ticks stop being sent to the server. The client's gold counter freezes. When the player returns to the tab, there is a jarring jump or the player finds they have contributed zero damage while "idle" in the background.

**Why it happens:**
Developers build the game loop around `setInterval` because it is simple and works correctly in the foreground. The browser throttling behaviour is not obvious during development where the game is always the active tab.

**How to avoid:**
Decouple client-side cosmetics from server-side progress. The server must tick offline progress independently of the client (see Pitfall 3). For the client display, use `requestAnimationFrame` for visible animations (only fires when the tab is active — appropriate for visual effects). For the background tick that sends attack signals, use a Web Worker — worker timers are not throttled by Chrome's background tab policy. The Web Worker sends a message to the main thread on each tick, which forwards the attack signal to the server.

For the boss HP display, use a server-push model: the server broadcasts the current boss HP every N seconds regardless of client ticks. The client only renders whatever the server tells it, so background throttling does not affect the authoritative state.

**Warning signs:**
- Players report "my DPS dropped to zero when I switched tabs"
- Performance tests show attack tick frequency dropping by 60x under background conditions
- iOS Safari or mobile Chrome users report no idle progress
- CPU usage spikes when a player returns to the tab (catching up on accumulated throttled intervals)

**Phase to address:** Client game loop architecture (early, before idle mechanics are tuned).

---

### Pitfall 6: JavaScript Number Overflow at e308 — NaN / Infinity Crashes

**What goes wrong:**
The game uses regular JavaScript `number` (IEEE 754 double) for gold, damage, and boss HP. After players have been playing long enough, gold values reach 1.79e308 — the JavaScript double maximum. The next arithmetic operation returns `Infinity`. Any comparison (`gold > upgradeCost`) involving `Infinity` behaves unexpectedly. Numbers displayed in the UI become "Infinity" or "NaN". Calculations that produce NaN propagate silently through the entire game state — every stat contaminated with NaN produces NaN, making the game unplayable. This has shipped in released idle games (notably Idle Skilling) and requires emergency patches.

**Why it happens:**
Early development uses small numbers. The overflow limit (1.79e308) sounds impossibly large. But idle game exponential progression can reach it faster than expected — aggressive players or very long sessions push through the limit. Using native JavaScript `BigInt` seems like the obvious fix but is 50x+ slower than double arithmetic and immutable (every operation allocates a new object), making it unsuitable for a game loop running hundreds of calculations per frame.

**How to avoid:**
Adopt `break_infinity.js` or `break_eternity.js` from the start of development, before any game numbers are hardcoded. These libraries represent numbers as `{mantissa, exponent}` pairs and support numbers up to 10^(1.79e308), far beyond what any idle game will reach. They are designed specifically for incremental games and have negligible performance overhead compared to BigInt. Do not use native `BigInt` for game arithmetic.

Store numbers as serialised strings in the database (e.g., `"1.5e350"`) rather than as native numeric types, which have their own overflow limits in databases (PostgreSQL NUMERIC handles arbitrary precision but is slower; use text columns with the library's serialisation).

Add a health-check assertion in the game loop: if any core game value is `NaN`, `Infinity`, or `-Infinity`, halt progression and log an error — do not let contamination propagate silently.

**Warning signs:**
- Any game value displays as "Infinity" or "NaN" in the UI
- The upgrade cost exceeds what numbers can represent but the "buy" button remains enabled
- Late-game playtests show inconsistent behaviour at "large" numbers
- Gold amounts in the database appear as `null` or invalid

**Phase to address:** Game engine number representation (before any progression math is implemented). Retrofitting a big-number library after formulas are written requires touching every calculation in the codebase.

---

### Pitfall 7: Progression Imbalance — Veterans Trivialise the Boss, New Players Feel Useless

**What goes wrong:**
Day 1 players do 100 DPS. Day 30 players do 10,000,000 DPS after weeks of upgrades and equipment. The shared boss HP is tuned for the combined damage of all active players. When veteran players are online, the boss dies in seconds — before new players have time to contribute meaningful damage. New players watch the boss HP bar drain instantly, their own floating numbers (100 damage) invisible against the veteran's millions. They never get a killing blow. They contribute nothing meaningful to the boss fight, which is the entire game. They churn within the first session.

**Why it happens:**
Developers balance for a "typical" player but forget the power spread between new and veteran players in a persistent, real-time shared world. Single-player idle games have no such problem — the player is always appropriately powered for their stage. Multiplayer boss HP must account for simultaneous contributions from players across the entire power spectrum.

**How to avoid:**
Design the boss HP as a function of the current player population's total DPS, not a fixed value. When players' combined DPS doubles (through upgrades), the next boss should have proportionally more HP so fights remain minutes-long. This also means new players' 100 DPS is proportionally meaningful — it is 0.001% of a 100,000,000-HP boss versus 0.001% of a 1,000-HP boss, but the fight takes the same amount of real time.

For the killing blow specifically: make it a probabilistic race weighted by recent damage contribution, not pure last-hit. Alternatively, implement a "last hit window" — the player who deals the final 1% of HP gets the kill. These approaches keep new players competitive for the killing blow regardless of their DPS tier.

Display contributions as percentages of total damage dealt this boss fight, not raw numbers. "You dealt 0.8% of this boss's HP" is meaningful. "You dealt 847 damage" is meaningless when veterans deal billions.

**Warning signs:**
- Veteran players kill the boss before newly joined players can send their first attack
- New player retention drops sharply after the first boss kill they witness
- Kill leaderboard is dominated by the same 5 accounts permanently
- Playtesters with high-level accounts consistently shorten boss kill time to under 10 seconds

**Phase to address:** Boss HP scaling formula (before launch, tuned in playtesting phase).

---

### Pitfall 8: Reconnect Without State Catch-Up — Stale Client After Tab Refresh

**What goes wrong:**
A player refreshes the page or briefly loses internet. The WebSocket reconnects successfully. But the client missed 30 seconds of boss HP events. The client's displayed HP is 30 seconds stale. The kill credit fires on the server while the client still shows the boss alive. The killing blow announcement appears to a player who sees a living boss. The client receives the "new boss spawned" event without the context that the old boss died, leading to UI inconsistency (old boss name still showing, wrong boss number).

**Why it happens:**
The WebSocket connection is event-driven and stateless between connections. Developers send delta events (HP decrements) rather than full state snapshots. A reconnecting client has no way to reconstruct the missed deltas. The server does not replay missed events because it has no per-client event buffer.

**How to avoid:**
On reconnect, the server must send a full state snapshot as the first message: current boss HP, current boss ID, current boss number, boss metadata. This snapshot replaces whatever stale state the client holds. Delta HP events are delivered after the snapshot, guaranteeing no gap. Implement exponential backoff reconnection on the client (start at 500ms, cap at 30 seconds) so transient disconnects recover quickly.

For events during the reconnect window (boss died while client was disconnected), the server should check: "did this client miss a boss kill while disconnected?" If yes, send a synthetic `boss_killed` + `boss_spawned` event sequence before the live delta stream resumes.

Store a per-boss event log with a short TTL (5 minutes) in Redis so any reconnecting client within that window receives full catch-up.

**Warning signs:**
- Refreshing the page shows a different boss HP than other tabs
- Players report "the boss died but I didn't see the kill animation"
- The boss number counter resets to 0 after a page refresh
- Load tests show clients diverging in displayed state after any server restart

**Phase to address:** WebSocket event architecture — design the catch-up pattern before building any events.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory boss HP (no Redis) | Zero infrastructure overhead | Breaks on horizontal scale, data lost on server restart | Never — Redis is cheap and the fix is cheap early, expensive late |
| Client-calculated damage trusted by server | Responsive UI, simple code | Entire leaderboard becomes exploitable | Never — the trust boundary must be set correctly from day one |
| Native JS `number` for all game values | Simple arithmetic, no library | NaN/Infinity crashes in late game, hard to retrofit | Only safe if the game is designed to never exceed 1e100 (not this game) |
| `setInterval` for client game loop | Simple to implement | Background tab throttling breaks idle play — the core use case | Never for the attack tick loop. OK for foreground-only UI animation |
| `last_online` in localStorage | No database changes needed | Trivially manipulated for offline progress exploits | Never for any value used in server-side calculations |
| Fixed boss HP (not player-count-adaptive) | Simpler to reason about | Veterans trivialise fights for new players | Acceptable for early MVP with a small, homogeneous test player base only |
| Broadcast full game state every tick | Eliminates all sync bugs | O(N) bandwidth per update, collapses at scale | Acceptable for < 100 concurrent players in early testing only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Redis DECRBY for boss HP | Using GET + SET as separate operations (race condition) | Use DECRBY atomically; use Lua script when decrement + conditional logic must be atomic |
| Redis Pub/Sub for broadcast | Subscribing in the same client connection used for commands | Use separate Redis client instances for Pub/Sub vs. commands — Redis Pub/Sub blocks the connection |
| WebSocket on Node.js + cluster | Multiple Node workers each holding their own WebSocket state | Use Redis adapter for Socket.io or equivalent — all workers share subscriptions through Redis |
| Authentication on WebSocket | Sending credentials in the first message after connect | Validate a signed token in the HTTP upgrade handshake (before the WebSocket is established) |
| Browser `Date.now()` for server calculations | Trusting client-supplied timestamps | Server always computes elapsed time from its own clock using stored `last_online` in the database |
| break_infinity.js serialisation | Storing numbers as JavaScript floats in database (loses precision) | Store as strings; deserialise on read using the library's `fromString()` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Broadcasting full player list every damage event | Server CPU spikes under load; clients lag on damage | Send HP delta only; send player list on join/leave events separately | ~50 concurrent players |
| Storing damage history per-tick in the database | Database write IOPS saturates | Accumulate damage in Redis per boss fight; persist aggregate to DB only on boss death | ~20 attacks/sec sustained |
| Calculating player DPS on every tick for the sidebar | N player lookups per tick | Maintain a cached DPS map in Redis, updated on stat change events, not on every attack | ~30 concurrent players |
| Sending a WebSocket message per floating damage number to all players | Bandwidth explodes with player count | Batch damage events into a single broadcast per 100ms window; client renders the batch | ~20 concurrent players |
| Server-side game loop using `setInterval` | Clock drift; inconsistent tick rate under load | Use a timestamped event model: store last processed time, calculate elapsed on next event | First server under any load |
| Redis WATCH/MULTI/EXEC retry loops on hot keys | Retry storms under high concurrency degrade to O(N^2) | Use Lua scripts for atomicity instead of optimistic locking (no retries needed) | ~10 concurrent attacks/sec on the same boss key |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting a `damage` field from the client | Any player can deal arbitrary damage, own the leaderboard | Server computes damage from stored player stats; client sends attack intent only |
| No rate limiting on attack messages | Bot scripts spam thousands of attacks per second | Per-connection rate limit: max 1 attack message per `(attack_speed_ms - tolerance)` interval; drop excess silently |
| Trusting client-reported player ID in WebSocket messages | Player A can send attacks attributed to Player B | Bind player identity to the WebSocket session at authentication time; ignore any client-supplied identity fields |
| Using `Math.random()` for kill credit tie-breaking | RNG can be manipulated via custom browser builds | Server uses `crypto.randomInt()` (Node.js built-in) for any randomness affecting rewards |
| No maximum cap on offline accumulation | Clock manipulation yields unlimited resources | Clamp `elapsed` to `MAX_OFFLINE_SECONDS` (e.g., 172800 = 48 hours) before any calculation |
| Leaderboard entries written by client | Fake leaderboard entries trivially injected | Leaderboard entries written exclusively by the kill-claim server logic, never by client request |
| WebSocket upgrade without token validation | Unauthenticated connections consume server resources | Validate JWT/session token in the HTTP upgrade handler; reject before WebSocket handshake completes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw damage numbers for all players | New players' 100 damage looks meaningless next to veteran's 100M | Show damage as percentage of total, or normalise to "your contribution this fight" |
| No confirmation or fanfare when boss spawns a new one | Players miss the transition; disorienting | Full-screen kill announcement with boss number counter; animate the new boss entrance |
| Upgrade costs in raw notation (e.g., "1847392847 gold") | Numbers become unreadable in mid/late game | Use named notation ("1.8 Billion") from the first upgrade; switch to scientific for very large values |
| Offline progress shown as a lump sum on return | Feels like magic, not idle accumulation | Show a "welcome back" breakdown: X hours offline, earned Y gold at Z DPS |
| No visual feedback that your attack is contributing | Idle games feel like nothing is happening | Floating damage numbers for your own attacks; personal damage bar in the player sidebar |
| Killing blow only celebrated for the winner | Everyone else feels like spectators | Announce KB winner prominently, but also show "Top 3 contributors" to give runners-up recognition |
| Boss number counter not prominently displayed | Core "global narrative" is invisible | Boss number ("Boss #47") displayed at all times, not just on kill; it is the shared story anchor |

---

## "Looks Done But Isn't" Checklist

- [ ] **Boss kill detection:** Verify the kill is detected atomically — not in a read-then-compare sequence. Test by simulating two damage events that both push HP below zero simultaneously.
- [ ] **Offline progress:** Verify `last_online` is only ever written by the server and never readable/writable from the client. Test by modifying a cookie or localStorage value and reconnecting.
- [ ] **Rate limiting:** Verify the attack rate limiter correctly rejects excess messages and does not credit excess attacks as damage. Test by scripting 100 attacks/sec from a single connection.
- [ ] **Number overflow:** Verify gold and damage values behave correctly after exceeding 1e308 (return meaningful numbers, not Infinity or NaN). Test with `break_infinity.js` values above the JS double limit.
- [ ] **Reconnect state:** Verify that a page refresh mid-fight restores the correct boss HP and boss number without requiring a manual refresh or visible flicker. Test with slow connections.
- [ ] **Background tab:** Verify the game continues accumulating idle progress (server-side) when the browser tab is backgrounded for 10 minutes. Test that the client correctly displays catch-up state on tab focus.
- [ ] **Multi-instance sync:** Verify boss HP is identical across two browser tabs connected to different server instances. Test by opening two tabs and attacking rapidly from both.
- [ ] **Kill leaderboard integrity:** Verify no client request can directly write a leaderboard entry. Attempt to forge a POST/WebSocket message to insert a kill record.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Boss HP race condition shipped | HIGH | Add Redis Lua script for atomic decrement; replay any affected boss kills from server logs; compensate affected players manually if leaderboard was corrupted |
| Client-trusted damage shipped | HIGH | Complete rewrite of damage pipeline (client sends intent, server calculates); invalidate all leaderboard entries from the exploit window; add anomaly detection before re-opening leaderboard |
| Offline time exploit discovered | MEDIUM | Switch `last_online` to server-written only; add offline cap; audit gold balances for outliers; optionally soft-reset suspicious accounts |
| In-memory state on multi-instance deploy | HIGH | Migrate boss state to Redis with downtime; restore from last checkpoint in database; accept data loss for the migration window |
| Number overflow NaN contamination | MEDIUM–HIGH | Emergency patch with break_infinity.js; audit saved game states in database for NaN/Infinity values; restore from last valid checkpoint or reset affected accounts with compensation |
| Background tab breaks idle accumulation | LOW | Switch attack tick to Web Worker; server-side accumulation is unaffected so no data loss |
| Stale state on reconnect | LOW | Add initial state snapshot on WebSocket connect; no data loss, only visual inconsistency |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Boss HP race condition | Phase 1: Core server + real-time boss loop | Concurrent load test: 50 simultaneous attacks when boss HP < min attack damage |
| Client-trusted damage | Phase 1: WebSocket message protocol design | Attempt to send forged damage value; server must reject/ignore it |
| Offline time exploit | Phase 2: Offline progress + account persistence | Modify localStorage/cookie timestamps; verify server uses DB-stored time only |
| Single-instance global state | Phase 1: Infrastructure setup | Deploy two server instances behind a load balancer; verify HP sync |
| Background tab setInterval | Phase 2: Client game loop | Background tab for 10 minutes; verify attack ticks continue via Web Worker |
| JS number overflow | Phase 1: Game number library selection | Unit test all arithmetic paths with values > 1e300 |
| Veteran vs new player power gap | Phase 3: Boss HP scaling + balance tuning | Simulate simultaneous 10x DPS spread between players; measure fight duration and KB win rate |
| Reconnect without catch-up | Phase 1: WebSocket event architecture | Disconnect mid-fight, reconnect, verify HP is current not stale |

---

## Sources

- [MMO Architecture: Lockless Queues](https://prdeving.wordpress.com/2025/01/02/mmo-architecture-optimizing-server-performance-with-lockless-queues/) — concurrency architecture patterns (HIGH confidence)
- [Fixing Race Conditions in Redis: Lua Scripting](https://dev.to/silentwatcher_95/fixing-race-conditions-in-redis-counters-why-lua-scripting-is-the-key-to-atomicity-and-reliability-38a4) — Redis atomic operations (HIGH confidence)
- [Redis Transactions Documentation](https://redis.io/docs/latest/develop/using-commands/transactions/) — WATCH/MULTI/EXEC and Lua atomicity (HIGH confidence)
- [The Math of Idle Games, Part III – Game Developer](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) — progression curve pitfalls (MEDIUM confidence)
- [Balancing Tips: Idle Idol – Game Developer](https://www.gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol) — real-world balance pitfalls from a shipped game (HIGH confidence)
- [Top Security Risks in HTML5 Multiplayer Games](https://genieee.com/top-security-risks-in-html5-multiplayer-games-and-how-to-fix-them/) — client-side damage exploitation (HIGH confidence)
- [Never Trust the Client – Game Developer](https://www.gamedeveloper.com/business/never-trust-the-client-simple-techniques-against-cheating-in-multiplayer-and-spatialos) — authoritative server patterns (HIGH confidence)
- [break_eternity.js GitHub](https://github.com/Patashu/break_eternity.js/) — number representation for incremental games (HIGH confidence)
- [Dealing with Huge Numbers in Idle Games – InnoBlog](https://blog.innogames.com/dealing-with-huge-numbers-in-idle-games/) — BigInt vs library trade-offs (MEDIUM confidence)
- [Inactive Tab Throttling in Browsers](https://javascript.plainenglish.io/inactive-tab-throttling-in-browsers-8aad673ab86d) — setInterval background throttling behaviour (HIGH confidence)
- [WebSocket Reconnection: State Sync Guide](https://websocket.org/guides/reconnection/) — reconnect catch-up patterns (HIGH confidence)
- [How to Scale WebSocket – Horizontal Scaling](https://tsh.io/blog/how-to-scale-websocket) — Redis Pub/Sub for multi-instance fanout (HIGH confidence)
- [Offline Progression – Clicker Heroes Blog](https://blog.clickerheroes.com/offline-progression-in-clicker-heroes/) — offline calculation real-world example (MEDIUM confidence)
- [Legends of IdleOn RNG Exploit – Full Disclosure](https://seclists.org/fulldisclosure/2024/Jan/21) — client-side RNG manipulation in browser idle game (HIGH confidence, real post-mortem)

---
*Pitfalls research for: Browser-based multiplayer idle-incremental game with global shared boss (Killing Blow)*
*Researched: 2026-03-18*
