import { AuthService } from '../services/AuthService';
import { playerState } from '../services/PlayerState';
import { socketService } from '../services/SocketService';

class AuthStore {
    constructor() {
        this.authService = new AuthService();
        this.subs = new Set();
    }

    get isLoggedIn() {
        return !!localStorage.getItem('token');
    }

    notify() {
        this.subs.forEach((fn) => {
            try { fn(); } catch (e) { /* ignore */ }
        });
    }

    subscribe(fn) {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
    }

    async login(username, password) {
        const data = await this.authService.login(username, password);
        playerState.updateFromAuthData(data);
        this.notify();
        return data;
    }

    async socialLogin(provider, token) {
        const data = await this.authService.socialLogin(provider, token);
        playerState.updateFromAuthData(data);
        this.notify();
        return data;
    }

    async logout() {
        const username = localStorage.getItem('username');
        try {
            if (username && !username.startsWith('Guest_')) {
                await this.authService.logout(username);
            }
        } catch (e) {
            console.warn('Logout failed', e);
        } finally {
            this._clearLocal();
            socketService.disconnect();
            this.notify();
        }
    }

    _clearLocal() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('coins');
        localStorage.removeItem('highScore');
        localStorage.removeItem('inventory');
    }
}

export const authStore = new AuthStore();
