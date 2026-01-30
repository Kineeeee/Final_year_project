# Phaser3 Snake — Target Architecture (Realtime Slither-like)

> Constraints

- Do not change gameplay rules, feel, core mechanics.
- Prefer lifecycle/state fixes over micro-bug patching.
- No premature optimization.

## Core model

### Session boundary (single responsibility)

**GameSession** represents exactly one match.

- Owns: `GameState`, socket connection, timers, subscriptions, managers.
- Provides: `start()`, `stop()`, `destroy()`.

**GameState** is the single source of truth.

- Data-only, no Phaser objects.
- Can be reset cleanly.

**Managers own lifecycles**

- Network/Replication: parse packets → mutate GameState
- EntityManager: reconcile GameState → Phaser entities (create/update/destroy)
- InputController: raw inputs → intents/commands

**Scenes are thin**

- WorldScene: render + forward raw input
- UIScene: render UI + emit intents

---

## Flow diagrams

### Startup → play → end

```
main.js
  → Boot → Preloader → MainMenu
       → Game (WorldScene)
          → create GameSession
          → connect network
          → tick loop:
              - apply replication to GameState
              - reconcile entities
              - gather input intents
              - send commands
          → death → GameOver
          → restart → new GameSession
```

### Realtime (command-based)

```
Input sources (mouse/gesture/joystick/UI)
  → InputController
      → CommandQueue (latest input + discrete actions)
          → NetworkManager.send*

Server packets
  → NetworkManager
      → GameState mutations
      → emit "state:*" events

World render
  → EntityManager.reconcile*
```

---

## Migration roadmap (phased)

### Phase 1 — stabilize state & lifecycle (DoD)

- Restart yields 100% clean state
- No ghost food
- UI listeners do not stack

### Phase 2 — normalize responsibilities (DoD)

- Network does not mutate Phaser objects directly
- Entities are created/destroyed only by EntityManager
- GameState is the only authoritative store

### Phase 3 — realtime foundation (DoD)

- Input is expressed as commands/intents
- CommandQueue exists
- Ready for prediction/interpolation (not necessarily enabled)

---

## Concrete mapping (current repo)

### Keep (mostly)

- Scenes: Boot/Preloader/MainMenu/Customize/Shop/GameOver
- UI system: UIManager + components
- Entity classes: Snake/Food/Coin/QuizFood

### Refactor/Extract

- Game scene: move toward WorldScene (thin)
- SocketService: move from singleton-per-app to instance-per-session (recommended next)
- NetworkManager: keep as replication/controller, state-only

### Current folder structure (already moving toward target)

- `src/session/` (GameState)
- `src/world/` (EntityManager)
- `src/realtime/` (InputController, CommandQueue)

Recommended final structure (when ready to rename)

- `src/app/` (Phaser config + scene registry)
- `src/session/` (GameSession, GameState)
- `src/realtime/` (transport, replication, command types)
- `src/world/` (entity factories + reconciliation)
- `src/scenes/` (thin scenes)
- `src/ui/` (UI layer)

---

## Next high-value steps (non-breaking)

1. Introduce `GameSession` class to own teardown cleanly.
2. Remove remaining cross-session globals (`window.*` mirrors in PlayerState).
3. Make SocketService non-singleton (instantiate per session).
4. Add a debug overlay/toggle to print: state foods count, entity foods count, pending-removal size.
