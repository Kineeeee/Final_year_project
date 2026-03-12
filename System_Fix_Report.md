# System Fix Report

## Summary of Problems Found
1. **Matchmaking UI Rejections:** Socket errors like "room full" or "room closed" crashed the immersive experience by triggering native browser `window.alert()`.
2. **Guest Identity Spoofing:** Guests connecting over websockets could manually embed string usernames in their handshake, bypassing token verification logic and manipulating databases/leaderboards.
3. **Mid-Game Active Joins (Room Locks):** The `RoomRoutes.js` API strictly blocked over-capacity joins, but permitted joining custom rooms even *after* the host clicked Start Match, creating UI race conditions.
4. **Host Migration in Gameplay:** Mid-game host disconnections triggered confusing UI state transitions for the remaining players.
5. **Slow Joins / Grace Period Flaws:** Connections on mobile or slow networks could accidentally trigger the 2-minute `joinGraceTimer` if loading took too long, silently killing the room.

---

## Use Cases Fixed & Validated

| ID | Title | Status Before | Status After | Fix Description |
|---|---|---|---|---|
| **UC2/UC3** | Custom Room Lifecycle | 🟡 Partially Implemented | 🟢 Fully Implemented | Native browser alerts replaced entirely with sleek internal `Phaser` HTML Modals. If the match is active (`meta.started`), HTTP queries reject immediately before spawning sockets. |
| **UC4/UC6** | Graceful Disconnects & Kicks | 🟡 Partially Implemented | 🟢 Fully Implemented | `RoomRegistry.js` now smoothly reassigns ownership without crashing. Furthermore, `UIScene` listens to mid-game (`playing` state) changes to `room:owner` and pops up a golden "Host disconnected! Migrating Host..." notification. |
| **UC1** | Guest Spoofing | 🔴 Buggy | 🟢 Fully Implemented | `NetworkSystem.js` explicitly strips manual `name` and `username` keys if the socket has no corresponding JWT Token, forcing a random `Guest_XYZ` identifier natively on connection. |

---

## Files Modified
1. `apps/server/src/core/systems/NetworkSystem.js`
   - Forced `Guest_${Math.floor(Math.random() * 1000)}` naming structure stringently during the `INIT_PLAYER` auth failure/fallback handler to strip malicious payloads.
   - Guarded connection: if `gameServer.matchStarted` is true, explicitly reject the socket on `connection` instead of creating an entity.

2. `apps/server/src/modules/room/RoomRoutes.js`
   - Modified `GET /api/rooms/meta/:code`. If `meta.started` is true, the server returns an HTTP 403 `room_already_started` immediately locking the room API query from the frontend.

3. `apps/web/src/core/network/NetworkManager.js`
   - Stripped `alert(...)`. Emitted native `network:error` bus events so `MainMenu.js` and `UIScene.js` could handle them gracefully.
   - Listened to `'room_already_started'` socket reject emissions.

4. `apps/web/src/scenes/MainMenu.js`
   - Added `showNetworkErrorModal(message)` to inject an aesthetic DOM-overlay on top of the canvas matching the game's retro styling.
   - Caught `network:error` events.

5. `apps/web/src/scenes/UIScene.js`
   - Hooked up `room:owner` listener to detect mid-game owner modifications.
   - Wired a `showToast` UI update saying *Host disconnected! You are now the Host.* or *Migrating Host...* so users aren't left confused when the creator drops.

## Remaining Limitations
- **Client Prediction:** Although the server accurately handles simulation, Client-Side Prediction (CSP) is not yet active for raw X/Y inputs, allowing network latency to feel "floaty".
- **Bot Fallback Check:** Reassigning the owner works natively, but if all original human players drop, throwing bots into the room to preserve it might be requested later.

## Suggestions for Future Improvements
- Implement pure Socket Binary Interpolation to remove `json` dependency in world deltas entirely.
- Transition UI DOM overlays (like `sn-error-modal`) directly into proper WebGL Phaser GameObjects for easier mobile porting and uniform scaling.
