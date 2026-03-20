# Mobile Deploy (Expo + EAS)

## 1) One-time setup

```bash
cd apps/mobile
npm install

npx eas-cli login
npx eas-cli whoami
```

## 2) Verify app config

Current production URL is pinned in 2 places:
- app.json -> expo.extra.serverUrl
- eas.json -> build.*.env.EXPO_PUBLIC_SERVER_URL

Both are set to:
- https://snakestudy.duckdns.org

## 3) Build Android

Preview build (internal sharing):

```bash
npm run build:android:preview
```

Production build:

```bash
npm run build:android:prod
```

## 4) Build iOS

Preview build:

```bash
npm run build:ios:preview
```

Production build:

```bash
npm run build:ios:prod
```

## 5) Submit to stores

Android:

```bash
npm run submit:android
```

iOS:

```bash
npm run submit:ios
```

## 6) Important before store release

Set unique identifiers in app.json:
- expo.android.package
- expo.ios.bundleIdentifier

Without these, store publish may fail or create unwanted default IDs.
