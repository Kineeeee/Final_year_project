# Naming Conventions

## Scope
This convention applies to `apps/server/src` and `apps/web/src`.

## General
- Use `PascalCase` for file names that export classes, scenes, managers, controllers, services, routes, and middleware.
- Use `camelCase` only for utility/helper modules that primarily export functions.
- Keep file names aligned with the primary responsibility of the module.
- In strict mode, config modules should also use `PascalCase` (example: `AppConfig.js`, `SharedConfig.js`, `ServerConstants.js`).

## Server (Node/Express)
- Route modules: `*Routes.js` (example: `UserQuizRoutes.js`, `ChatbotRoutes.js`).
- Middleware modules: `*Middleware.js` (example: `RequireAuthMiddleware.js`, `AuthRateLimitMiddleware.js`).
- Domain orchestration: `*Manager.js` (example: `QuizManager.js`, `PlayerManager.js`).
- External model/API client wrappers: `*Client.js` (example: `LlmClient.js`).

## Web (Phaser Client)
- Scene modules: `*Scene.js` (example: `ChatbotScene.js`, `CustomizeScene.js`).
- HTTP API wrappers: `*Api.js` (example: `UserQuizApi.js`, `ChatbotApi.js`).
- Local state/services: `*Service.js`, `*Store.js`, `*State.js` as appropriate.
- UI components: `PascalCase` component names (example: `ProfileModal.js`, `UIPanel.js`).
- Config modules: `*Config.js` (example: `AppConfig.js`, `SharedConfig.js`, `ItemsConfig.js`).

## Entry-Point Exceptions
- Framework entry points may remain lowercase where ecosystem conventions apply (example: `main.js`).

## Naming Guidance
- Prefer explicit names over technical legacy names.
  - Good: `LlmClient.js`
  - Avoid: `aiParserAdapter.js` when module does more than parsing.
- Prefer singular role per module. If a file grows beyond one role, split by concern.

## Backward Compatibility
- If renaming a widely used module, allow temporary export aliases for one transition cycle.
- Remove aliases after all imports are migrated.
