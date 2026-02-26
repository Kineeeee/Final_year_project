import Constants from 'expo-constants';

// Read from Expo extra; fallback to localhost:5173 for dev
const SERVER_URL = (Constants?.expoConfig?.extra?.serverUrl) || 'http://localhost:5173';

export const CONFIG = {
    SERVER_URL,
};
