# Phaser3 Snake Monorepo (client + server + mobile)

## Cấu trúc
- apps/web: client Phaser3 + Vite.
- apps/server: Node/Express + Socket.io, authoritative game server.
- apps/mobile: vỏ Expo mở WebView trỏ về client.
- docs/tóm tắt tổng quan dự án: kiến trúc, chẩn đoán, audit.

## Chạy nhanh (dev)
### Server
```
cd apps/server
npm install
npm run sync:constants   # đồng bộ hằng số sang client
npm start
```
### Client web
```
cd apps/web
npm install
npm run dev -- --host
```
### Mobile (Expo)
```
cd apps/mobile
npm install
npm start
```

## Đồng bộ hằng số
Server là nguồn sự thật. Script: `apps/server/scripts/sync_constants.js`
- Tự chạy sau `npm install` của client (postinstall).
- Có thể chạy tay: `cd apps/server && npm run sync:constants`.

## Lưu ý
- Không commit `node_modules` (đã thêm .gitignore gốc).
- Bản ShootingScene hợp lệ ở `apps/web/src/modules/combat/ShootingScene.js` (đã xóa bản cũ trong `src/scenes`).
- Tài liệu kiến trúc quan trọng: `docs/tóm tắt tổng quan dự án/ARCHITECTURE.md`.
