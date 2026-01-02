import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { UIScene } from './scenes/UIScene';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { CustomizeScene } from './scenes/CustomizeScene';
import { ShopScene } from './scenes/ShopScene';
import { Logger } from './utils/Logger';
import { CONFIG } from './config/constants';

// --- LOGIN LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const loginMessage = document.getElementById('login-message');
const btnGuest = document.getElementById('btn-guest');

const API_URL = `${CONFIG.SERVER_URL}/api/auth`; // Use configured Server URL (IP)

// Hàm hiển thị thông báo lỗi/thành công
const showMessage = (msg, isError = true) => {
    loginMessage.textContent = msg;
    loginMessage.style.color = isError ? '#ff4444' : '#00ff00';
};

// Hàm gọi API
const authAction = async (endpoint) => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    Logger.info('Auth', `Calling API: ${endpoint} with username: ${username}`);



    if (!username || !password) {
        Logger.warn('Auth', 'Username or password is empty');
        showMessage('Please enter username and password');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        Logger.info('Auth', `API Response Status: ${response.status}`);


        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }
        Logger.info('Auth', 'API call successful', data);
        return data;
    } catch (error) {
        Logger.error('Auth', 'API call failed', error);
        showMessage(error.message);
        return null;
    }
};

// Xử lý Đăng nhập
btnLogin.addEventListener('click', async () => {
    const data = await authAction('login');
    if (data) {
        // 1. Lưu token vào localStorage để dùng sau này
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('coins', data.coins);
        localStorage.setItem('highScore', data.highScore);


        // lưu màu từ server về
        if (data.color) {
            localStorage.setItem('preferredColor', data.color);
        }

        // 2. Ẩn form login
        loginOverlay.style.display = 'none';

        // 3. Khởi động game
        startGame();
    }
});

// Xử lý Đăng ký
btnRegister.addEventListener('click', async () => {
    const data = await authAction('register');
    if (data) {
        showMessage('Registration successful! Please login.', false);
        // Xóa password để người dùng nhập lại cho chắc
        passwordInput.value = '';
    }
});

if (btnGuest) {
    btnGuest.addEventListener('click', () => {
        // Tạo tên ngẫu nhiên
        const guestName = 'Guest_' + Math.floor(Math.random() * 10000);

        // Lưu thông tin giả vào localStorage
        localStorage.setItem('username', guestName);
        localStorage.setItem('coins', '0');
        localStorage.removeItem('token'); // Xóa token cũ nếu có để tránh lỗi xác thực sau này

        // Ẩn form và vào game
        if (loginOverlay) loginOverlay.style.display = 'none';
        startGame();
    });
}
// --- END LOGIN LOGIC ---

// Detect Mobile Device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Calculate resolution
// Force at least 2.0 for sharpness, cap at 3.0
const pixelRatio = window.devicePixelRatio || 1;
const resolution = Math.max(pixelRatio, 2.0);

// Config for Desktop (Responsive Full Screen)
let scaleConfig = {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
};

// Config for Mobile (High Definition)
if (isMobile) {
    // Force Landscape Mode Logic (Optional, or just use full screen)
    // Using RESIZE on mobile is also best for sharpness (1:1 pixel mapping)
    // But we explicitly state it here to handle mobile-specifics if needed later
    scaleConfig = {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    };
}

const config = {
    type: Phaser.AUTO,
    // High DPI support for sharper visuals on mobile
    resolution: resolution,
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    // Use the dynamic scale config
    scale: scaleConfig,
    parent: 'game-container',
    backgroundColor: '#028af8',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CustomizeScene,
        Game,
        UIScene,
        ShopScene,
        GameOver
    ]
};

function startGame() {
    // Kiểm tra xem game đã được tạo chưa để tránh tạo trùng
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }
}

// Tự động đăng nhập nếu đã có token hoặc là Guest cũ
const savedToken = localStorage.getItem('token');
const savedUsername = localStorage.getItem('username');

if (savedToken) {
    // Nếu muốn tự động vào game luôn (User đã đăng nhập):
    if (loginOverlay) loginOverlay.style.display = 'none';
    startGame();
} else if (savedUsername && savedUsername.startsWith('Guest_')) {
    // Resume Guest Session
    if (loginOverlay) loginOverlay.style.display = 'none';
    startGame();
}

// Export hàm startGame nếu cần dùng ở nơi khác (không bắt buộc)
export { startGame };