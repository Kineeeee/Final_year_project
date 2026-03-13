import { authStore } from '../../core/state/authStore.js';
import { AuthService } from '../../core/services/AuthService.js';
import { playerState } from '../../core/services/PlayerState.js';

export class AuthManager {
    constructor(gameStartCallback) {
        this.gameStartCallback = gameStartCallback;
        this.authService = new AuthService();

        // Core login elements
        this.loginOverlay = document.getElementById('login-overlay');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.btnLogin = document.getElementById('btn-login');
        this.btnRegister = document.getElementById('btn-register');
        this.loginMessage = document.getElementById('login-message');
        this.btnGuest = document.getElementById('btn-guest');

        // Signup + UI enhancements
        this.signupNameInput = document.getElementById('signup-name');
        this.signupEmailInput = document.getElementById('signup-email');
        this.signupPasswordInput = document.getElementById('signup-password');
        this.signupConfirmInput = document.getElementById('signup-confirm');
        this.signupMessage = document.getElementById('signup-message');
        this.strengthBar = document.getElementById('strength-bar');
        this.strengthLabel = document.getElementById('strength-label');
        this.requirementItems = document.querySelectorAll('.requirements [data-rule]');
        this.tabButtons = document.querySelectorAll('[data-auth-tab]');
        this.forms = document.querySelectorAll('.auth-form');
        this.authSubtitle = document.getElementById('auth-toggle-text');
        this.rememberCheckbox = document.getElementById('remember-me');
        this.forgotLink = document.getElementById('forgot-password');
        this.googleBtn = document.getElementById('btn-google');
        this.facebookBtn = document.getElementById('btn-facebook');
        this.resetModal = document.getElementById('reset-modal');
        this.resetEmailInput = document.getElementById('reset-email');
        this.resetSubmit = document.getElementById('reset-submit');
        this.resetMessage = document.getElementById('reset-message');
        this.resetClosers = document.querySelectorAll('[data-close-reset]');

        this.initListeners();
        this.restoreRemembered();
        this.updateStrength();
        this.initSocialLogins();
        this.checkAutoLogin();
    }

    initListeners() {
        this.btnLogin?.addEventListener('click', () => this.handleLogin());
        this.btnRegister?.addEventListener('click', () => this.handleRegister());
        this.btnGuest?.addEventListener('click', () => this.handleGuest());

        this.tabButtons.forEach((btn) =>
            btn.addEventListener('click', () => this.switchMode(btn.dataset.authTab || 'login'))
        );

        [
            this.usernameInput,
            this.passwordInput,
            this.signupNameInput,
            this.signupEmailInput,
            this.signupPasswordInput,
            this.signupConfirmInput
        ].forEach((input) => {
            input?.addEventListener('input', () => this.clearFieldError(input));
        });

        this.signupPasswordInput?.addEventListener('input', () => this.updateStrength());
        this.signupConfirmInput?.addEventListener('input', () => this.validateConfirmMatch(false));

        this.forgotLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openResetModal();
        });

        this.googleBtn?.addEventListener('click', () => this.handleGoogleClick());
        this.facebookBtn?.addEventListener('click', () => {
            this.showMessage('Login via facebook is coming soon', false);
        });

        this.resetSubmit?.addEventListener('click', () => this.handleReset());
        this.resetEmailInput?.addEventListener('input', () => this.clearFieldError(this.resetEmailInput));
        this.resetClosers.forEach((el) =>
            el.addEventListener('click', () => this.closeResetModal())
        );
    }

    showMessage(msg, isError = true) {
        if (this.loginMessage) {
            this.loginMessage.textContent = msg;
            this.loginMessage.style.color = isError ? '#e36464' : '#16a34a';
        }
    }

    showSignupMessage(msg, isError = true) {
        if (this.signupMessage) {
            this.signupMessage.textContent = msg;
            this.signupMessage.style.color = isError ? '#e36464' : '#16a34a';
        }
    }

    restoreRemembered() {
        const remembered = localStorage.getItem('remembered-username');
        if (remembered && this.usernameInput) {
            this.usernameInput.value = remembered;
            if (this.rememberCheckbox) this.rememberCheckbox.checked = true;
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
            if (!username) this.showFieldError(this.usernameInput, 'Please enter your email or username');
            if (!password) this.showFieldError(this.passwordInput, 'Please enter your password');
            this.showMessage('Please fill in all fields');
            return;
        }

        if (this.rememberCheckbox?.checked) {
            localStorage.setItem('remembered-username', username);
        } else {
            localStorage.removeItem('remembered-username');
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
        const valid = this.validateSignupFields();
        if (!valid) return;

        const username = this.signupEmailInput?.value.trim() || this.signupNameInput?.value.trim();
        const password = this.signupPasswordInput?.value.trim();

        try {
            await this.authService.register(username, password);
            this.showSignupMessage('Registration successful! Please login.', false);
            if (this.usernameInput) this.usernameInput.value = username;
            if (this.passwordInput) this.passwordInput.value = '';
            this.switchMode('login');
        } catch (error) {
            this.showSignupMessage(error.message || 'Registration failed');
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

    switchMode(mode) {
        this.tabButtons.forEach((btn) => {
            const isActive = btn.dataset.authTab === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });

        this.forms.forEach((form) => {
            const targetId = `${mode}-form`;
            form.classList.toggle('active', form.id === targetId);
        });

        if (this.authSubtitle) {
            this.authSubtitle.textContent =
                mode === 'signup'
                    ? 'Create a parent account to guide your young learner.'
                    : 'Log in to continue your adventure.';
        }

        this.showMessage('', false);
        this.showSignupMessage('', false);
    }

    showFieldError(input, message) {
        if (!input) return;
        const field = input.closest('.auth-field');
        if (!field) return;
        const feedback = field.querySelector('.auth-field__feedback');

        field.classList.toggle('has-error', Boolean(message));
        field.classList.toggle('valid', !message && input.value.trim().length > 0);
        if (feedback) feedback.textContent = message || '';
    }

    clearFieldError(input) {
        if (!input) return;
        this.showFieldError(input, '');
    }

    evaluatePasswordRules(password) {
        return {
            length: password.length >= 8 && password.length <= 12,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };
    }

    updateStrength() {
        const password = this.signupPasswordInput?.value || '';
        const rules = this.evaluatePasswordRules(password);
        const score = Object.values(rules).filter(Boolean).length;

        const widths = [0, 26, 42, 64, 82, 100];
        const colors = ['#e5e7eb', '#fbbf24', '#f59e0b', '#7cd1b8', '#4ade80', '#22c55e'];
        const meterIndex = password.length === 0 ? 0 : Math.max(1, score);

        if (this.strengthBar) {
            this.strengthBar.style.width = `${widths[meterIndex]}%`;
            this.strengthBar.style.background = colors[meterIndex];
        }

        if (this.strengthLabel) {
            const labels = [
                'Start typing to see strength',
                'Too short',
                'Add more variety',
                'Getting stronger',
                'Great password',
                'Ready to launch'
            ];
            this.strengthLabel.textContent = labels[meterIndex];
        }

        this.requirementItems.forEach((item) => {
            const rule = item.dataset.rule;
            const met = rules[rule];
            item.classList.toggle('met', Boolean(met));
        });

        return rules;
    }

    validateConfirmMatch(showError = true) {
        const password = this.signupPasswordInput?.value || '';
        const confirm = this.signupConfirmInput?.value || '';
        const matches = password === confirm && confirm.length > 0;
        if (!this.signupConfirmInput) return true;
        if (!matches && showError) {
            this.showFieldError(this.signupConfirmInput, 'Passwords must match');
        } else if (matches) {
            this.showFieldError(this.signupConfirmInput, '');
        }
        return matches;
    }

    validateSignupFields() {
        let isValid = true;
        const name = this.signupNameInput?.value.trim() || '';
        const email = this.signupEmailInput?.value.trim() || '';

        if (!name) {
            this.showFieldError(this.signupNameInput, 'Please add a name');
            isValid = false;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(this.signupEmailInput, 'Enter a valid email');
            isValid = false;
        }

        const rules = this.updateStrength();
        const unmet = Object.keys(rules).filter((key) => !rules[key]);
        if (unmet.length > 0) {
            this.showFieldError(this.signupPasswordInput, 'Please meet all password requirements');
            isValid = false;
        }

        if (!this.validateConfirmMatch()) {
            isValid = false;
        }

        return isValid;
    }

    openResetModal() {
        this.resetMessage && (this.resetMessage.textContent = '');
        if (this.resetEmailInput) {
            this.resetEmailInput.value = this.usernameInput?.value || '';
            this.clearFieldError(this.resetEmailInput);
        }
        this.resetModal?.classList.add('open');
    }

    closeResetModal() {
        this.resetModal?.classList.remove('open');
    }

    async handleReset() {
        const email = this.resetEmailInput?.value.trim() || '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(this.resetEmailInput, 'Enter a valid email');
            return;
        }

        try {
            await this.authService.forgotPassword(email);
            if (this.resetMessage) {
                this.resetMessage.textContent = 'Reset link sent! Check your inbox.';
                this.resetMessage.style.color = '#16a34a';
            }
            setTimeout(() => this.closeResetModal(), 1200);
        } catch (error) {
            if (this.resetMessage) {
                this.resetMessage.textContent = error.message || 'Could not send reset link.';
                this.resetMessage.style.color = '#e36464';
            }
        }
    }

    initSocialLogins() {
        if (window.google) {
            this.googleClient = window.google.accounts.oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PENDING_CLIENT_ID',
                callback: this.handleGoogleCallback.bind(this),
                scope: 'email profile openid',
            });
        }
        
        window.fbAsyncInit = function() {
            window.FB.init({
                appId: import.meta.env.VITE_FACEBOOK_APP_ID || 'PENDING_APP_ID',
                cookie: true,
                xfbml: true,
                version: 'v18.0'
            });
        };
    }

    handleGoogleClick() {
        if (this.googleClient) {
            this.googleClient.requestAccessToken();
        } else if (window.google) {
            this.initSocialLogins();
            if (this.googleClient) this.googleClient.requestAccessToken();
        } else {
            this.showMessage('Google SDK not loaded yet', true);
        }
    }

    async handleGoogleCallback(response) {
        if (response.error) {
            this.showMessage('Google login failed or cancelled', true);
            return;
        }
        await this.processSocialLogin('google', response.access_token);
    }

    async handleFacebookCallback(response) {
        if (response.status === 'connected') {
            await this.processSocialLogin('facebook', response.authResponse.accessToken);
        } else {
            this.showMessage('Facebook login failed or cancelled', true);
        }
    }

    async processSocialLogin(provider, token) {
        try {
            const data = await authStore.socialLogin(provider, token);
            if (data) {
                this.hideOverlay();
                this.gameStartCallback();
            }
        } catch (error) {
            console.error(`[Auth] ${provider} login failed`, error);
            this.showMessage(error.message || `${provider} login failed.`);
        }
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
