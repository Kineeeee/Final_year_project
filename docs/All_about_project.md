# Project Overview
This project is a real-time multiplayer implementation of the classic Snake game, built using **Phaser 3** for the frontend and a **Node.js/Socket.IO** authoritative backend. The project is organized as a monorepo containing three main applications: a web client, an authoritative game server, and an Expo-based mobile app that acts as a WebView shell.

A primary unique feature of this game is its **Quiz Mode** (available in Math, English, and Custom user-created levels). In this mode, players are presented with questions and must navigate their snake to eat the food corresponding to the correct answer. The server also integrates local/remote LLM capabilities for processing custom quiz questions.

## Main Features
- **Real-Time Multiplayer Game Loop:** Authoritative server simulation ensuring fair physics and anti-cheat capabilities.
- **Educational Quiz Modes:** Specialized topics (Math, English) where the snake eats answer-labeled food.
- **Custom Game Rooms:** Ability to create dynamic namespaces/rooms for private matches with tailored quiz sets.
- **Bot AI System:** Automated bots play alongside humans in generic (non-quiz) game modes.
- **Authentication System:** Support for Guest play, Email/Password, Google, and Facebook logins, managed via a unified UI overlay.
- **Shop & Customization:** Systems for earning coins, buying cosmetics, and customizing the snake.
- **Achievements & Leaderboards:** Tracking player milestones and broadcasting global/room rankings.
- **Cross-Platform:** Browser-based web client and a React Native Expo WebView app for mobile.

## Technology Stack
- **Frontend / Client (`apps/web`):**
  - **Engine:** Phaser 3
  - **Build Tool:** Vite
  - **Networking:** Socket.IO Client (with MessagePack parser)
  - **Styling:** Vanilla CSS/HTML5 for UI Overlays
- **Backend / Game Server (`apps/server`):**
  - **Runtime:** Node.js
  - **Networking:** Socket.IO / Express.js
  - **Database:** MongoDB (via Mongoose)
  - **Caching/State:** Redis
  - **Security:** JWT, bcrypt, express-rate-limit
  - **Parsing:** Mammoth (for `.docx` parsing), LLM APIs (Google Gemma/Local via LM Studio) for quiz content generation.
- **Mobile (`apps/mobile`):**
  - Expo / React Native (WebView Wrapper)

## Project Architecture
The architecture is heavily **Client-Server** based, emphasizing a **Server-Authoritative** model:
- **GameServer (ECS-like Pattern):** The backend maintains the true state of the world within a Spatial Grid. It updates `Physics/Collision` using specialized Manager/System classes (`PlayerManager`, `FoodManager`, `CollisionSystem`) at a fixed HTTP tick rate (60 FPS), and heavily compresses State Deltas to send to clients via `BroadcastSystem`.
- **Phaser Web Client:** Operates mainly as a dumb terminal. It renders entities based on server updates. The player captures input and immediately forwards it to the server (`networkSystem`), applying lightweight interpolation for smooth visuals.
- **Shared Constants:** Game state constants (`constants.js`) are dynamically synchronized from the server up to the client upon `npm install` to avoid physics desyncs.

## Folder Structure
```text
/
├── apps/
│   ├── mobile/         # Expo React Native wrapper for mobile distribution.
│   ├── server/         # Authoritative NodeJS game server.
│   │   ├── src/
│   │   │   ├── config/       # Environment & Shared Constants.
│   │   │   ├── core/         # ECS Systems, SpatialGrid, Network handlers.
│   │   │   ├── infra/        # Database Connections.
│   │   │   ├── models/       # Mongoose Schemas (User, Question, UserQuiz, Item).
│   │   │   ├── modules/      # Feature domains (Auth, Bot, Food, Player, Quiz, Room, Shop).
│   │   │   └── utils/        # Logger, Helpers.
│   │   ├── scripts/    # Sync constants scripts.
│   │   └── server.js   # HTTP Express and Socket.IO entry point.
│   └── web/            # Phaser 3 Client project.
│       ├── index.html  # Application shell and Authentication UI Overlay.
│       ├── src/
│       │   ├── app/          # Phaser Game initialization (main.js).
│       │   ├── core/         # Client-side core logics and utilities.
│       │   ├── modules/      # Client-side features (auth, combat, food, hud, shop, snake...).
│       │   ├── scenes/       # Main Phaser Scenes (Boot, Preloader, MainMenu, Game, UIScene).
│       │   └── services/     # Network Client Service.
├── docs/               # System documentation and audit logs.
├── docker-compose.yml  # Docker environment for server/DB stack.
└── README.md
```

## Core System Flow
### 1. Request Flow (Connection & Authencation)
- User visits the frontend, presented with the `index.html` `login-overlay`.
- Submits credentials via API (`/api/auth`). Server validates against MongoDB.
- Successful login instantiates the `Phaser.Game` engine and connects Socket.io to the requested namespace (`/`, `/math`, `/custom/[roomCode]`).

### 2. Main Business Logic (Game Loop)
- The backend `GameServer.js` runs multiple `setIntervals`:
  - Fixed Physics Update (`update()` at 60 FPS) to advance player positions and check collisions (`CollisionSystem`).
  - Broadcast Loop (`BroadcastSystem.broadcastGameUpdate`) at a lower FPS to send compacted delta-compressed worlds.
  - `FoodManager.refillFood` checks and replenishes the map.

### 3. Data Flow (In-Game)
- **Input:** Client pushes keystrokes or joystick inputs `EVENT.PLAYER_INPUT` to the server logic continually.
- **Simulation:** Server interprets input, changes velocity data, and updates coordinates in the `SpatialGrid`.
- **Output:** The server broadcasts `EVENT.WORLD_DELTA`, which instructs the client Phaser engine on where every `snake` or `food` sprite should be drawn the next frame.

## Important Components
- **`apps/server/src/GameServer.js`**: Orchestrates `PlayerManager`, `FoodManager`, `BotManager`, and `QuizManager` within fixed intervals for a single namespace/room.
- **`apps/server/src/core/systems/NetworkSystem.js`**: Deserializes raw input from Socket.io, assigns ownership to entities, and manages player connection drops.
- **Phaser `Game.js` Scene (Web)**: The rendering loop. Listens to `worldDelta` packets, updates interpolators for smooth tracking of opponent snakes, and manages camera following.
- **`QuizManager` (Server)**: Connects a game room to a topic. Continuously pulls a question from MongoDB/LLM, maps the correct answer payload to a dynamically spawned piece of `Food`, and validates correct/incorrect ingestible interactions. 

## Database Design
MongoDB is structured around discrete entities via Mongoose:
- **User (`models/User.js`)**: Stores authentication data (passwords, oauth ids), metadata (level, high scores), inventory items, and an array of unlocked achievements.
- **Question (`models/Question.js`)**: A system-level generic question bank, categorizing subject matter (`math`, `english`), options, and the correct identifier.
- **UserQuiz (`models/UserQuiz.js`)**: Custom quizzes created by players. Typically contains embedded arrays of `questions` or references to an LLM-processed document, along with visibility toggles.
- **Item (`models/Item.js`)**: Global registry of shop cosmetics (skins, avatars) with currency prices.

## API Endpoints
- **Authentication (`/api/auth/*`)**:
  - `POST /login`, `POST /register`, `POST /guest`, `POST /google`, `POST /facebook`.
- **Rooms (`/api/rooms/*`)**:
  - `POST /create`, `POST /join`, `GET /custom/capacity`.
- **Quizzes (`/api/user-quiz/*`, `/api/questions/*`)**:
  - CRUD operations for retrieving and updating quiz setups and importing documents.

## Configuration
The environment is handled primarily via the `.env` configuration on the `server`:
- `PORT`, `MONGO_URI`, `REDIS_URL`
- `JWT_SECRET`, `REFRESH_SECRET`
- `CORS_ORIGINS`: Determines allowed Web clients.
- `LLM_BASE_URL`, `LLM_MODEL`: Configuration for quiz processing integrations via OpenAI-compatible endpoints or LM Studio.

## How to Run the Project
### Option 1: Using Docker (Server & DBs)
```bash
cd apps/server
docker compose up --build
```

### Option 2: Local Development
**1. Start the Server:**
```bash
cd apps/server
npm install
npm run sync:constants  # Important: Synchronizes game physics variables to the web client
npm start
```
**2. Start the Web Client:**
```bash
cd apps/web
npm install
npm run dev
```
**3. Start Mobile App (Optional):**
```bash
cd apps/mobile
npm install
npm start
```

## Possible Improvements
- **Code Structure / Maintainability:** Standardize the use of TypeScript or strict JSDoc typing for the ECS payload to reduce ambiguous attribute tracking on `player` and `food` objects.
- **Performance:** Implement Binary serialization algorithms beyond standard `msgpack` specifically for spatial coordinates to significantly minimize bandwidth usage.
- **Client Prediction:** Apply robust pure Client-Side Prediction (CSP) for the local player's snake head movement so the game does not feel floaty under high latencies limit.
- **Scalability:** Introduce a central matchmaker server or microservices so dynamic rooms run on separate Node child processes/worker threads, preventing heavy CPU blocks across all namespaces.

---

# System Usecase Audit

## 1. System Actors
- **Guest Player**: Browses the site, plays standard system modes, testing features.
- **Registered/Logged-in Player**: Play games with saved progress, high scores, inventory, and coins.
- **Room Host (Owner)**: A logged-in player who creates a custom room based on their uploaded quizzes. Controls the lobby (kick, start).
- **Room Participant**: Any player (Guest or Registered) joining a Custom Room via room code.

## 2. Complete Use Case List
| ID | Use Case Name | Actor | Description | Preconditions | Main Flow |
|---|---|---|---|---|---|
| UC1 | **Join System Match** | Guest / Registered | Player joins a public match (Math, English, Survival). | Web client loaded. | Clicks mode -> Connects to namespace -> Spawns -> Plays. |
| UC2 | **Create Custom Room** | Room Host | Host creates a private room using a user-uploaded quiz. | Logged in, valid quiz exists. | UI Clicks "Custom Quiz" -> API creates room -> Redirects to waiting room -> Host waits. |
| UC3 | **Join Custom Room** | Participant | Player joins via an 8-hex code. | Knows room code, room not full. | Enters code -> Server validates `RoomRegistry` -> Client transitions to waiting room. |
| UC4 | **Manage Waiting Room** | Room Host | Host kicks unwanted players or starts the match. | Sits in waiting room. | Host clicks Kick -> target removed. Host clicks Start -> game begins. |
| UC5 | **Leave Waiting Room** | Participant/Host | Player leaves room before it starts. | In waiting room. | Clicks "Leave" -> Socket leaves -> `RoomRegistry` delegates new owner if host leaves. |
| UC6 | **Disconnect Handling** | System | Player drops connection ungracefully. | Player in-game or waiting. | Socket drops -> Server removes avatar -> Transfers host if needed -> Emits updates. |
| UC7 | **Gameplay (Movement)** | Game Player | Player sends directional input. | Match active. | Desktop keys/Mobile joystick sends `PLAYER_INPUT` -> Server updates ECS -> Broadcasts delta. |
| UC8 | **Gameplay (Quiz Logic)**| Game Player | Snake eats correct/incorrect food. | Quiz match active. | Server validates food -> Emmits score change UI -> Spawns next question. |
| UC9 | **End of Match** | System | Match timer runs out. | Match active. | Server checks winner -> Broadcasts `result` -> Client shows Result Overlay -> Players return to Menu. |

## 3. Use Case Coverage Analysis
- **UC1 (Join System Match):** Fully Implemented.
- **UC2 (Create Custom Room):** Fully Implemented. The `RoomRoutes.js` guards max custom rooms.
- **UC3 (Join Custom Room):** Partially Implemented. UI uses `window.alert` for "room full" which breaks immersion.
- **UC4 (Manage Waiting Room):** Fully Implemented. UI shows kick buttons for the host natively in `UIScene.js`.
- **UC5 (Leave Waiting Room):** Fully Implemented. `NetworkSystem.js` handles `leaveLobby`.
- **UC6 (Disconnect Handling):** Partially Implemented / Minor Issue. A race condition may exist where `localDied` vs `disconnect` events crash local references if socket reconnects too fast.
- **UC7 (Gameplay Movement):** Fully Implemented.
- **UC8 (Gameplay Quiz):** Fully Implemented.
- **UC9 (End of Match):** Fully Implemented. Result overlay displays natively and pauses rendering.

## 4. System Issues & Missing Features
1. **Matchmaking UI Errors:** Rejection errors (e.g., room full, kicked) rely on native browser `alert()` which is jarring for an HTML5 Canvas game.
2. **Guest Identity Spoofing:** In `NetworkSystem.js`, if a user provides an invalid token but passes a name like `user_xyz`, it falls back to a randomized `Guest_XXX` name. However, malicious packets could still potentially manipulate the `name` property without validation.
3. **Room Grace Period:** Custom rooms automatically close after 2 minutes if the creator doesn't join (`joinGraceTimer`). If the client network is slow to load `Phaser` assets, the room may close before the UI connects.
4. **Host Migration in Gameplay:** If a Host leaves *during* an active match, the UI logic for returning to menu might conflict with active game ticks.
5. **No Mid-Game Joins:** Custom quiz rooms prevent input if joined before host starts, but it does not completely lock the namespace from accepting connections *after* it starts. The UI emits `room_started` immediately causing a race condition where joining players immediately see `room_started` but don't get the opening countdown.

## 5. Recommended Fixes & Architecture Improvements
- **UI Replacements:** Replace `window.alert` inside `NetworkManager.js` and `MainMenu.js` with proper Phaser Modal Windows or HTML Overlay toasts.
- **Strict Payload Validation:** Enhance `NetworkSystem.js` to strictly enforce validation on all `initPlayer` socket payloads. Force guest names to be immutable on connection.
- **Room Lock Mechanics:** In `GameServer.js`, once a custom room match starts, reject any new incoming connections entirely instead of letting them spawn mid-quiz. Change `RoomRegistry` to track `matchStarted` and reject joins at the HTTP routing level `/api/rooms/meta`.
- **Client Prediction:** The current `worldDelta` compresses physics but feels floaty. A separate module for Client-Side Prediction (CSP) on the local snake's `x` and `y` coordinates should be integrated before production to hide server round-trip latency.

## 6. Final System Readiness Evaluation
**Status: STABLE / BETA**
The architectural foundation of the project (Server-Authoritative Phaser ECS) is extremely sound. The database handling, room instancing, and quiz integration are functional and well-structured. However, the system requires a layer of polish resolving edge cases in networking edge states (disconnects, full rooms, late joins) and replacing native browser `alerts` before it can be considered fully production-ready for a large end-user release.
