## Plan: Fix Deployed Frontend Startup

Frontend loads static assets on snakestudy.duckdns.org, but interactivity fails because deployed API/configuration is still inconsistent and there is likely one remaining JS startup bug in the auth/UI bootstrap path. Recommended approach: first stabilize runtime configuration (API URL, CORS, Mongo/Redis/API health), then verify whether the remaining `Cannot access ... before initialization` error still exists, and only then change frontend startup code.

**Steps**
1. Validate deployed runtime config on VPS: confirm `/opt/snake/.env` has the intended `APP_DOMAIN`, `API_DOMAIN`, lowercase `GHCR_OWNER`, and `IMAGE_TAG`; confirm `/opt/snake/api.env` has real `MONGO_URI`, `CORS_ORIGINS=https://snakestudy.duckdns.org,https://api.snakestudy.duckdns.org`, and `REDIS_URL=redis://redis:6379` with `REDIS_ENABLED=true`.
2. Verify backend health before touching frontend code: confirm the API container stays up, Mongo resolves and connects, Redis is healthy, and `https://api.snakestudy.duckdns.org/` responds without CORS errors for origin `https://snakestudy.duckdns.org`. This blocks all later steps.
3. Verify the built frontend is pointing at the correct API: inspect browser devtools/network on the deployed site and confirm requests go to `https://api.snakestudy.duckdns.org` (or the chosen production API origin), not `localhost`, `api.example.com`, or same-origin fallback. If wrong, fix the CI/CD build input `VITE_SERVER_URL` and rebuild.
4. Re-test frontend startup after config is correct: hard-refresh the deployed page, confirm whether the app still shows `ReferenceError: Cannot access ... before initialization`, and isolate the first failing request/script in the browser network + console timeline.
5. If the JS error remains after step 4, inspect and adjust bootstrap order in the auth/UI startup path: start from `/Users/kineee/Phaser3_snake copy 11/apps/web/src/app/main.js` where `new AuthManager(startGame)` runs at module scope, then review `/Users/kineee/Phaser3_snake copy 11/apps/web/src/modules/auth/AuthManager.js`, `/Users/kineee/Phaser3_snake copy 11/apps/web/src/core/services/AuthService.js`, and `/Users/kineee/Phaser3_snake copy 11/apps/web/src/config/AppConfig.js` for deploy-only initialization ordering or missing build-time env values. This depends on steps 2-4.
6. Clean up secondary frontend issues once core interactivity works: fix favicon path `/file.svg` vs `/assets/file.svg`, consider blocking dotfile probes in nginx, and decide whether Facebook SDK should be disabled until production app credentials are configured. These are parallel after step 5 or can be deferred.

**Relevant files**
- `/Users/kineee/Phaser3_snake copy 11/apps/web/src/app/main.js` — frontend bootstrap; `AuthManager` is instantiated at module scope.
- `/Users/kineee/Phaser3_snake copy 11/apps/web/src/modules/auth/AuthManager.js` — auth overlay setup, SDK initialization, and callbacks that can fail during startup.
- `/Users/kineee/Phaser3_snake copy 11/apps/web/src/config/AppConfig.js` — production `SERVER_URL` resolution from `__SERVER_URL__` / location fallback.
- `/Users/kineee/Phaser3_snake copy 11/apps/web/Dockerfile` — build-time `VITE_SERVER_URL` injection for production bundle.
- `/Users/kineee/Phaser3_snake copy 11/.github/workflows/deploy-ec2.yml` — CI build args and deploy behavior for frontend image.
- `/Users/kineee/Phaser3_snake copy 11/apps/server/server.js` — strict CORS policy for HTTP and Socket.IO.
- `/Users/kineee/Phaser3_snake copy 11/apps/server/src/infra/database/MongoConnection.js` — API exits on Mongo failure; frontend cannot work if backend loops.
- `/Users/kineee/Phaser3_snake copy 11/apps/deploy/compose.prod.yml` — deployed service wiring for caddy/web/api/redis.
- `/Users/kineee/Phaser3_snake copy 11/apps/web/index.html` — favicon path and async social SDK script tags.
- `/Users/kineee/Phaser3_snake copy 11/apps/web/nginx.conf` — static file routing and fallback behavior.

**Verification**
1. On VPS, confirm health with `docker compose -f compose.prod.yml --env-file .env ps`, then inspect `docker logs phaser-snake-api-1 --tail 200` and `docker logs phaser-snake-redis-1 --tail 100`.
2. From a browser or curl, verify `https://api.snakestudy.duckdns.org/` returns successfully and includes `Access-Control-Allow-Origin: https://snakestudy.duckdns.org` when called with that Origin header.
3. In deployed browser devtools, verify the first failed request, the actual request URL for auth/socket calls, and whether `ReferenceError: Cannot access ... before initialization` remains after the backend/CORS issues are fixed.
4. If a new frontend build is triggered, hard-refresh the page and verify the game becomes interactive: login overlay buttons respond, network requests succeed, and socket connection opens.

**Decisions**
- Treat this as config-first debugging: backend/API health and `VITE_SERVER_URL` correctness must be proven before changing frontend code.
- Keep Redis enabled in production stack using the internal compose service (`redis://redis:6379`).
- Use separate app/API domains (`snakestudy.duckdns.org` and `api.snakestudy.duckdns.org`) unless architecture is intentionally changed.
- Favicon and bot-scan hardening are non-blocking and should not distract from the startup failure.

**Further Considerations**
1. If Facebook login is not actually needed in production now, disable or gate its SDK initialization to remove a noisy failure source while validating core startup.
2. If `ReferenceError: Cannot access ... before initialization` still occurs after API/CORS is fixed, capture the source map-resolved stack or identify the original module symbol before changing bootstrap code.
3. Once the site is stable, add a deployment smoke test that validates web load + API health + CORS immediately after CI/CD deploy.
