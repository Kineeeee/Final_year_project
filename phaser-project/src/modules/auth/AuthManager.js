import { Logger } from '../../utils/Logger';
import { authStore } from '../../core/state/authStore';
import { AuthService } from '../../core/services/AuthService';
import { playerState } from '../../core/services/PlayerState';

export class AuthManager {
    constructor(gameStartCallback) {
        this.gameStartCallback = gameStartCallback;
        this.authService = new AuthService();

        // DOM Elements
        this.loginOverlay = document.getElementById('login-overlay');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.btnLogin = document.getElementById('btn-login');
        this.btnRegister = document.getElementById('btn-register');
        this.loginMessage = document.getElementById('login-message');
        this.btnGuest = document.getElementById('btn-guest');

        this.initListeners();
        this.checkAutoLogin();
    }

    initListeners() {
        if (this.btnLogin) this.btnLogin.addEventListener('click', () => this.handleLogin());
        if (this.btnRegister) this.btnRegister.addEventListener('click', () => this.handleRegister());
        if (this.btnGuest) this.btnGuest.addEventListener('click', () => this.handleGuest());
    }

    showMessage(msg, isError = true) {
        if (this.loginMessage) {
            this.loginMessage.textContent = msg;
            this.loginMessage.style.color = isError ? '#ff4444' : '#00ff00';
        }
    }

    getCredentials() {
        return {
            username: this.usernameInput ? this.usernameInput.value.trim() : '',
            password: this.passwordInput ? this.passwordInput.value.trim() : ''
        };
    }

    async handleLogin() {
        const { username, password } = this.getCredentials();
        if (!username || !password) {
            this.showMessage('Please enter username and password');
            return;
        }

        try {
            const data = await authStore.login(username, password);
            if (data) {
                this.hideOverlay();
                this.gameStartCallback();
            }
        } catch (error) {
            console.error('[Auth] login failed', error);
            this.showMessage(error.message || 'Login failed. Check username/password and server.');
        }
    }

    async handleRegister() {
        const { username, password } = this.getCredentials();
        if (!username || !password) {
            this.showMessage('Please enter username and password');
            return;
        }

        try {
            await this.authService.register(username, password);
            this.showMessage('Registration successful! Please login.', false);
            // Clear password field
            if (this.passwordInput) this.passwordInput.value = '';
        } catch (error) {
            this.showMessage(error.message);
        }
    }

    handleGuest() {
        const guestName = 'Guest_' + Math.floor(Math.random() * 10000);
        localStorage.setItem('username', guestName);
        localStorage.setItem('coins', '0');
        localStorage.removeItem('token');

        this.hideOverlay();
        this.gameStartCallback();
    }

    hideOverlay() {
        if (this.loginOverlay) this.loginOverlay.style.display = 'none';
    }

    saveSession(data) {
        if (!data) return;

        try {
            // Reuse central state hydrator to keep tokens/coins/inventory in sync
            playerState.updateFromAuthData(data);
            authStore.notify();
        } catch (error) {
            console.warn('Failed to persist refreshed session', error);
        }
    }

    async checkAutoLogin() {
        const savedToken = localStorage.getItem('token');
        const savedUsername = localStorage.getItem('username');

        if (savedToken) {
            // Validate token existence (basic check), maybe verify expiry locally?
            // For now, assume if token exists, we try to use it. 
            // If invalid, Socket/NetworkManager will fail or handle it? 
            // Ideally we should verify with server, but for speed we trust local token presence 
            // and let the Background Refresh Token logic handle validity if needed?
            // Wait, logic below tries to refresh if NO token.
            this.hideOverlay();
            this.gameStartCallback();
        } else {
            // GUEST or EXPIRED:
            // Do NOT auto-login Guest. Always show overlay to allow "Login" or "Continue as Guest".

            // Try to refresh token (HttpOnly Cookie) in background just in case
            try {
                const data = await this.authService.refreshToken();
                if (data && data.token) {
                    this.saveSession(data);
                    this.hideOverlay();
                    this.gameStartCallback();
                }
            } catch (e) {
                // Not logged in, stay on overlay
                console.log('Auto-login failed / No session:', e.message);
            }
        }
    }

    async logout() {
        await authStore.logout();
        // Fully reset game/session without hard reload
        if (window.game && typeof window.game.destroy === 'function') {
            window.game.destroy(true);
            window.game = null;
        }
        // Show login overlay again
        if (this.loginOverlay) this.loginOverlay.style.display = 'flex';
        if (this.usernameInput) this.usernameInput.value = '';
        if (this.passwordInput) this.passwordInput.value = '';
        this.showMessage('Logged out', false);
    }
}
