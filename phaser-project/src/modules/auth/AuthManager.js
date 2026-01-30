import { AuthService } from '../../core/services/AuthService';
import { Logger } from '../../utils/Logger';

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
            const data = await this.authService.login(username, password);
            if (data) {
                this.saveSession(data);
                this.hideOverlay();
                this.gameStartCallback();
            }
        } catch (error) {
            this.showMessage(error.message);
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

    saveSession(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('coins', data.coins);
        localStorage.setItem('highScore', data.highScore);
        if (data.color) {
            localStorage.setItem('preferredColor', data.color);
        }
    }

    hideOverlay() {
        if (this.loginOverlay) this.loginOverlay.style.display = 'none';
    }

    async checkAutoLogin() {
        const savedToken = localStorage.getItem('token');
        const savedUsername = localStorage.getItem('username');

        if (savedToken) {
            this.hideOverlay();
            this.gameStartCallback();
        } else if (savedUsername && savedUsername.startsWith('Guest_')) {
            this.hideOverlay();
            this.gameStartCallback();
        } else {
            // Try to refresh token (HttpOnly Cookie)
            try {
                const data = await this.authService.refreshToken();
                if (data && data.token) {
                    this.saveSession(data);
                    this.hideOverlay();
                    this.gameStartCallback();
                }
            } catch (e) {
                // Not logged in, stay on overlay
                console.log('Auto-login failed:', e.message);
            }
        }
    }

    async logout() {
        const username = localStorage.getItem('username');
        if (username && !username.startsWith('Guest_')) {
            try {
                await this.authService.logout(username);
            } catch (e) {
                console.error('Logout failed:', e);
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('coins');
        localStorage.removeItem('highScore');
        localStorage.removeItem('inventory');

        // Show overlay or reload
        location.reload();
    }
}
