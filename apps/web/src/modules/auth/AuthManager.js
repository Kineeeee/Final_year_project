import { authStore } from '../../core/state/authStore';
import { AuthService } from '../../core/services/AuthService';
import { playerState } from '../../core/services/PlayerState';

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
        this.requirementItems = document.querySelectorAll('[data-password-rule]');
        this.tabButtons = document.querySelectorAll('[data-auth-tab]');
        this.forms = document.querySelectorAll('[data-auth-form]');
        this.screens = document.querySelectorAll('[data-auth-screen]');
        this.authSubtitle = document.getElementById('auth-toggle-text');
        this.authSubtitleMobile = document.getElementById('auth-toggle-text-mobile');
        this.rememberCheckbox = document.getElementById('remember-me');
        this.forgotLink = document.getElementById('forgot-password');
        this.googleBtn = document.getElementById('btn-google');
        this.facebookBtn = document.getElementById('btn-facebook');
        this.resetModal = document.getElementById('reset-modal');
        this.resetEmailInput = document.getElementById('reset-email');
        this.resetSubmit = document.getElementById('reset-submit');
        this.resetMessage = document.getElementById('reset-message');
        this.resetClosers = document.querySelectorAll('[data-close-reset]');
        this.googleClient = null;
        this.googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
        this.facebookAppId = (import.meta.env.VITE_FACEBOOK_APP_ID || '').trim();

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
            this.showMessage('Tính năng đăng nhập Facebook sẽ sớm ra mắt', false);
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
            if (!username) this.showFieldError(this.usernameInput, 'Vui lòng nhập tên đăng nhập hoặc email');
            if (!password) this.showFieldError(this.passwordInput, 'Vui lòng nhập mật khẩu');
            this.showMessage('Vui lòng điền đầy đủ thông tin');
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
            this.showMessage(error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra tài khoản/mật khẩu.');
        }
    }

    async handleRegister() {
        const valid = this.validateSignupFields();
        if (!valid) return;

        const username = this.signupEmailInput?.value.trim() || this.signupNameInput?.value.trim();
        const password = this.signupPasswordInput?.value.trim();

        try {
            await this.authService.register(username, password);
            this.showSignupMessage('Đăng ký thành công! Vui lòng đăng nhập.', false);
            if (this.usernameInput) this.usernameInput.value = username;
            if (this.passwordInput) this.passwordInput.value = '';
            this.switchMode('login');
        } catch (error) {
            this.showSignupMessage(error.message || 'Đăng ký thất bại');
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
            const activeClasses = (btn.dataset.activeClasses || '').split(' ').filter(Boolean);
            const inactiveClasses = (btn.dataset.inactiveClasses || '').split(' ').filter(Boolean);

            if (activeClasses.length > 0 || inactiveClasses.length > 0) {
                btn.classList.remove(...activeClasses, ...inactiveClasses);
                btn.classList.add(...(isActive ? activeClasses : inactiveClasses));
            }

            btn.setAttribute('aria-selected', String(isActive));
            btn.setAttribute('aria-current', isActive ? 'page' : 'false');
        });

        this.forms.forEach((form) => {
            const targetId = `${mode}-form`;
            const isTarget = form.id === targetId;
            form.classList.toggle('hidden', !isTarget);
        });

        this.screens.forEach((screen) => {
            const isTarget = screen.dataset.authScreen === mode;
            screen.classList.toggle('hidden', !isTarget);
        });

        if (this.authSubtitle) {
            this.authSubtitle.textContent =
                mode === 'signup'
                    ? 'Tao tai khoan phu huynh de dong hanh cung be.'
                    : 'Dang nhap de tiep tuc cuoc phieu luu.';
        }

        if (this.authSubtitleMobile) {
            this.authSubtitleMobile.textContent =
                mode === 'signup'
                    ? 'Tao tai khoan phu huynh de dong hanh cung be.'
                    : 'Dang nhap de tiep tuc cuoc phieu luu.';
        }

        this.showMessage('', false);
        this.showSignupMessage('', false);
    }

    showFieldError(input, message) {
        if (!input) return;
        const field = input.closest('[data-auth-field]');
        if (!field) return;
        const feedback = field.querySelector('[data-feedback]');

        const hasError = Boolean(message);
        const hasValue = input.value.trim().length > 0;

        input.classList.toggle('border-[#f95630]', hasError);
        input.classList.toggle('bg-[#fff1ed]', hasError);
        input.classList.toggle('border-[#006b1b]', !hasError && hasValue);
        input.classList.toggle('bg-[#f5fff1]', !hasError && hasValue);
        input.classList.toggle('border-transparent', !hasError && !hasValue);
        input.classList.toggle('bg-[#e2ebda]', !hasError && !hasValue);

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
                'Start typing to see password strength',
                'Too short',
                'Add more diverse characters',
                'Getting stronger',
                'Strong password',
                'Ready to use'
            ];
            this.strengthLabel.textContent = labels[meterIndex];
        }

        this.requirementItems.forEach((item) => {
            const rule = item.dataset.passwordRule;
            const met = rules[rule];
            const icon = item.querySelector('[data-rule-icon]');

            item.classList.toggle('text-[#16a34a]', Boolean(met));
            item.classList.toggle('text-[#64748b]', !met);
            if (icon) icon.textContent = met ? '✓' : '○';
        });

        return rules;
    }

    validateConfirmMatch(showError = true) {
        const password = this.signupPasswordInput?.value || '';
        const confirm = this.signupConfirmInput?.value || '';
        const matches = password === confirm && confirm.length > 0;
        if (!this.signupConfirmInput) return true;
        if (!matches && showError) {
            this.showFieldError(this.signupConfirmInput, 'Mật khẩu xác nhận chưa khớp');
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
            this.showFieldError(this.signupNameInput, 'Vui lòng nhập biệt danh');
            isValid = false;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(this.signupEmailInput, 'Vui lòng nhập email hợp lệ');
            isValid = false;
        }

        const rules = this.updateStrength();
        const unmet = Object.keys(rules).filter((key) => !rules[key]);
        if (unmet.length > 0) {
            this.showFieldError(this.signupPasswordInput, 'Vui lòng đáp ứng đầy đủ yêu cầu mật khẩu');
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
        if (this.resetModal) {
            this.resetModal.classList.remove('hidden');
            this.resetModal.setAttribute('aria-hidden', 'false');
        }
    }

    closeResetModal() {
        if (this.resetModal) {
            this.resetModal.classList.add('hidden');
            this.resetModal.setAttribute('aria-hidden', 'true');
        }
    }

    async handleReset() {
        const email = this.resetEmailInput?.value.trim() || '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(this.resetEmailInput, 'Vui lòng nhập email hợp lệ');
            return;
        }

        try {
            await this.authService.forgotPassword(email);
            if (this.resetMessage) {
                this.resetMessage.textContent = 'Đã gửi liên kết đặt lại. Vui lòng kiểm tra hộp thư.';
                this.resetMessage.style.color = '#16a34a';
            }
            setTimeout(() => this.closeResetModal(), 1200);
        } catch (error) {
            if (this.resetMessage) {
                this.resetMessage.textContent = error.message || 'Không thể gửi liên kết đặt lại.';
                this.resetMessage.style.color = '#e36464';
            }
        }
    }

    initSocialLogins() {
        if (
            window.google?.accounts?.oauth2 &&
            this.googleClientId &&
            this.googleClientId !== 'PENDING_CLIENT_ID'
        ) {
            this.googleClient = window.google.accounts.oauth2.initTokenClient({
                client_id: this.googleClientId,
                callback: this.handleGoogleCallback.bind(this),
                scope: 'email profile openid',
            });
        }

        if (!this.facebookAppId || this.facebookAppId === 'PENDING_APP_ID') {
            return;
        }

        window.fbAsyncInit = () => {
            if (!window.FB) {
                return;
            }

            window.FB.init({
                appId: this.facebookAppId,
                cookie: true,
                xfbml: true,
                version: 'v18.0'
            });
        };
    }

    handleGoogleClick() {
        if (!this.googleClientId || this.googleClientId === 'PENDING_CLIENT_ID') {
            this.showMessage('Google login chưa được cấu hình. Hãy đặt VITE_GOOGLE_CLIENT_ID trong web env.', true);
            return;
        }

        if (this.googleClient) {
            this.googleClient.requestAccessToken();
        } else if (window.google?.accounts?.oauth2) {
            this.initSocialLogins();
            if (this.googleClient) this.googleClient.requestAccessToken();
        } else {
            this.showMessage('Google SDK not loaded yet', true);
        }
    }

    async handleGoogleCallback(response) {
        if (response.error) {
            const detail = response.error_description || response.error;
            this.showMessage(`Đăng nhập Google thất bại: ${detail}`, true);
            return;
        }

        if (!response.access_token) {
            this.showMessage('Đăng nhập Google thất bại: Thiếu access token từ Google.', true);
            return;
        }

        await this.processSocialLogin('google', response.access_token);
    }

    async handleFacebookCallback(response) {
        if (response.status === 'connected') {
            await this.processSocialLogin('facebook', response.authResponse.accessToken);
        } else {
            this.showMessage('Đăng nhập Facebook thất bại hoặc đã bị hủy', true);
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
            this.showMessage(error.message || `Đăng nhập ${provider} thất bại.`);
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
        if (this.loginOverlay) this.loginOverlay.style.display = 'block';
        if (this.usernameInput) this.usernameInput.value = '';
        if (this.passwordInput) this.passwordInput.value = '';
        this.showMessage('Đã đăng xuất', false);
    }
}
