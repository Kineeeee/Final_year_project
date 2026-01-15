import { CONFIG } from '../config/constants';
import { Logger } from '../utils/Logger';

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

    async _authRequest(endpoint, body) {
        Logger.info('AuthService', `Calling API: ${endpoint} for user: ${body.username}`);

        try {
            const response = await fetch(`${this.apiUrl}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            Logger.info('AuthService', `API Response Status: ${response.status}`);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            return data;
        } catch (error) {
            Logger.error('AuthService', 'API call failed', error);
            throw error;
        }
    }
}
