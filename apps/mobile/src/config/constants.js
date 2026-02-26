import Constants from 'expo-constants';

const DEV_FALLBACK_PORT = 5173;

const inferLanUrl = () => {
    const hostUri =
        Constants?.expoConfig?.hostUri ||
        Constants?.manifest?.hostUri ||
        (Constants?.expoConfig?.extra && Constants.expoConfig.extra.expoGo?.developer?.host);

    if (!hostUri) return null;

    try {
        const url = new URL(
            hostUri.startsWith('http') || hostUri.startsWith('exp') ? hostUri : `http://${hostUri}`
        );
        const host = url.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
        return `http://${host}:${DEV_FALLBACK_PORT}`;
    } catch {
        return null;
    }
};

const normalize = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return trimmed.replace(/\/+$/, ''); // drop trailing slash(es) to avoid double slashes in requests
};

const rawExtraUrl = Constants?.expoConfig?.extra?.serverUrl;
const envUrl = process.env.EXPO_PUBLIC_SERVER_URL || process.env.SERVER_URL;
const lanUrl = inferLanUrl();

// Priority: explicit config (if valid) -> env -> inferred LAN (Expo dev on device) -> localhost (sim)
const SERVER_URL =
    normalize(rawExtraUrl) ||
    normalize(envUrl) ||
    lanUrl ||
    'http://10.25.193.148:5173';

export const CONFIG = {
    SERVER_URL,
};
