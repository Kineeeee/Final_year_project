import { CONFIG } from '../../config/constants';
import { Logger } from '../../utils/Logger';

export class AuthService {
    constructor() {
        this.apiUrl = `${CONFIG.SERVER_URL}/api/auth`;
    }

    async login(username, password) {
        return this._authRequest('login', { username, password });
    }

    async register(username, password) {
        return this._authRequest('register', { username, password });
    }

    async logout(username) {
        return this._authRequest('logout', { username });
    }

    async refreshToken() {
        return this._authRequest('refresh', {});
    }

    async forgotPassword(email) {
        return this._authRequest('forgot', { email });
    }

    async _authRequest(endpoint, body) {
        Logger.info('AuthService', `Calling API: ${endpoint} for user: ${body.username}`);

        try {
            const response = await fetch(`${this.apiUrl}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Important for Cookies
                body: JSON.stringify(body),
            });

            Logger.info('AuthService', `API Response Status: ${response.status}`);

            let data = null;
            try {
                data = await response.json();
            } catch (e) {
                // fallback
            }

            if (!response.ok) {
                const detail = data?.message || `HTTP ${response.status}`;
                throw new Error(detail);
            }

            return data;
        } catch (error) {
            Logger.error('AuthService', 'API call failed', error);
            throw error;
        }
    }
}
