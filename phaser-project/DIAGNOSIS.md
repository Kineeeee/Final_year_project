# Phaser3 Snake — System Diagnosis (Client)

> Goal: identify all current issues and bring the project to the best achievable state **without changing core gameplay**.
> Date: 2026-01-23

## Step 1 — Overall analysis

### 1.1 True entry point

**Client entry point**

- [src/main.js](src/main.js)
    - Builds Phaser config and registers scenes
    - Creates a single global engine instance via `window.game = new Phaser.Game(config)`
    - Starts the game only after `AuthManager` succeeds

**Server entry point**

- [phaser_server/server.js](../phaser_server/server.js) → constructs `GameServer` per namespace/mode
- [phaser_server/src/GameServer.js](../phaser_server/src/GameServer.js)

### 1.2 Runtime flow (open → play → end)

```
Browser loads index.html
  → src/main.js
     → new AuthManager(startGame)
        → (login/guest)
           → startGame()
              → new Phaser.Game(config)
                 → Boot
                    → Preloader
                       → MainMenu
                          → CustomizeScene (optional)
                          → ShopScene (optional)
                          → Game
                             → launch UIScene
                             → connect socket + realtime updates
                             → (death)
                                → GameOver
                                   → restart Game OR go MainMenu
```

### 1.3 Main modules (client)

**Scenes**

- [src/scenes/Boot.js](src/scenes/Boot.js)
- [src/scenes/Preloader.js](src/scenes/Preloader.js)
- [src/scenes/MainMenu.js](src/scenes/MainMenu.js)
- [src/scenes/CustomizeScene.js](src/scenes/CustomizeScene.js)
- [src/scenes/Game.js](src/scenes/Game.js)
- [src/scenes/UIScene.js](src/scenes/UIScene.js)
- [src/scenes/ShopScene.js](src/scenes/ShopScene.js)
- [src/scenes/GameOver.js](src/scenes/GameOver.js)

**Realtime / networking**

- [src/services/SocketService.js](src/services/SocketService.js) (singleton socket connector)
- [src/network/NetworkManager.js](src/network/NetworkManager.js) (client replication + events)

**Session / state**

- [src/session/GameState.js](src/session/GameState.js) (data-only session state)

**World / entities**

- [src/world/EntityManager.js](src/world/EntityManager.js) (reconcile GameState ↔ Phaser objects)
- [src/objects/Food.js](src/objects/Food.js)
- [src/objects/Coin.js](src/objects/Coin.js)
- [src/objects/QuizFood.js](src/objects/QuizFood.js)
- [src/objects/snake/Snake.js](src/objects/snake/Snake.js)
- [src/objects/snake/PlayerSnake.js](src/objects/snake/PlayerSnake.js)

**Input**

- [src/realtime/InputController.js](src/realtime/InputController.js)
- [src/realtime/CommandQueue.js](src/realtime/CommandQueue.js)
- [src/realtime/commands.js](src/realtime/commands.js)
- [src/input/GestureController.js](src/input/GestureController.js)

**UI**

- [src/ui/UIManager.js](src/ui/UIManager.js)
- components in [src/ui/components/](src/ui/components/)

### 1.4 Data lifetime classification

**Long-lived (cross sessions / across page reload)**

- `localStorage`: username, token, coins, inventory, preferredColor
- `window.game` Phaser engine instance
- singleton services: `socketService`, `playerState` (and historical `window.*` mirrors)

**Session-lived (should reset 100% on restart)**

- socket connection + listeners for the match
- `GameState` (players/foods/localPlayerId/sessionId)
- entity maps: playerId→Snake, foodId→Food/Coin/QuizFood
- scene timers: minimap timer, ping timer, staggered spawn timer

**Frame-lived**

- current input intent (angle/boost)
- queued commands to send

---

## Step 2 — All detected problems (with consequences + risks)

### A) Architecture / responsibility

1. **Scene as God Object** (historical)

- Description: Game scene used to own networking, entity lifecycle, input mapping, UI launching, timers.
- Consequence: restart doesn’t fully reset; hard-to-reason lifecycle.
- Risk: regressions when adding modes/realtime features.

2. **Singletons/global state leak**

- Description: `window.game`, `socketService`, `playerState` (plus `window.userCoins/window.playerInventory` compatibility).
- Consequence: old listeners persist; state crosses sessions.
- Risk: intermittent “only after 3rd restart” bugs.

3. **Network layer mutating view layer** (historical)

- Description: network handlers directly mutated scene arrays/maps and destroyed entities.
- Consequence: racing updates, partial teardown, duplicated listeners.
- Risk: UI / entity desync under packet loss.

### B) State management

4. **No single source of truth** (historical)

- Description: food and players existed in multiple forms: scene arrays, Phaser groups, socket packets.
- Consequence: ghost objects and impossible states.
- Risk: prediction/interpolation becomes unmaintainable.

5. **Eaten food not removed in client state** (server behavior mismatch)

- Description: server removes food silently on eat (no `removeFood`), only emits `foodEaten`.
- Consequence: client keeps stale foods; after refill cycles you get many ghosts.
- Risk: memory growth + broken gameplay perception.

### C) Object lifecycle / physics

6. **Mixed-type pooling**

- Description: pooling regular food in a group containing Coin/QuizFood causes wrong-type reuse and collider mismatch.
- Consequence: food visible but uncollectable.
- Risk: nondeterministic bugs.

7. **Container physics body offset pitfalls**

- Description: `Coin` / `QuizFood` bodies use negative offsets; naive `body.reset(x,y)` can desync hitbox.
- Consequence: ghost food (visual at A, hitbox elsewhere).
- Risk: “can’t eat” reports.

8. **Over-reconcile / multi-reconcile per tick**

- Description: multiple `foods:reconcile` emits in the same frame cause repeated spawn/reset.
- Consequence: flicker.
- Risk: perceived lag/jitter.

### D) Scene & UI coupling

9. **UI subscribes to Game events without reliable unbind** (historical)

- Consequence: duplicated UI updates after restarts.
- Risk: memory leaks and inconsistent UI.

### E) Realtime & input

10. **Input directly sends to network without intent layer** (historical)

- Consequence: hard to add prediction/interpolation.
- Risk: extensibility ceiling.

### F) Config/constant

11. **Config split and magic numbers** (observed)

- Consequence: tuning requires hunting.
- Risk: changes diverge client/server.

---

## Stabilizations already applied (architectural fixes, no gameplay change)

- Food lifecycle:
    - Separate regular pooled foods vs special foods in [src/scenes/Game.js](src/scenes/Game.js)
    - Prevent respawn/ghost via tombstones and correct state removal on `foodEaten`
    - Avoid hitbox desync by not calling `body.reset` for Coin/QuizFood
    - Coalesce reconciliation to once-per-frame

- GameOver robustness:
    - fallback to GameOver if local player is disconnected before `playerDied`

- Listener hygiene:
    - UIScene unbinds Game event handlers on shutdown
    - GameOver uses `socket.once` to prevent stacked listeners

---

## Step 3 — Bring project to “best possible state” (target architecture)

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full target design and migration plan.
