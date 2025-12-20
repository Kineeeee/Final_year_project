import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { UIScene } from './scenes/UIScene';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { CustomizeScene } from './scenes/CustomizeScene';


// --- LOGIN LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const loginMessage = document.getElementById('login-message');
const btnGuest = document.getElementById('btn-guest');

const API_URL = 'http://localhost:3000/api/auth'; // Địa chỉ server của bạn

// Hàm hiển thị thông báo lỗi/thành công
const showMessage = (msg, isError = true) => {
    loginMessage.textContent = msg;
    loginMessage.style.color = isError ? '#ff4444' : '#00ff00';
};

// Hàm gọi API
const authAction = async (endpoint) => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showMessage('Please enter username and password');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
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

// Config for Desktop (Fixed Size, Fit to Screen)
let scaleConfig = {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
};

// Config for Mobile (HD Resolution, Fit to Screen)
if (isMobile) {
    // Get actual screen dimensions
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Ensure we calculate based on Landscape orientation
    const landscapeWidth = Math.max(w, h);
    const landscapeHeight = Math.min(w, h);
    
    // Calculate Aspect Ratio
    const aspectRatio = landscapeWidth / landscapeHeight;
    
    // Set HD Resolution (Base Height = 720p)
    // Width is calculated to match device aspect ratio (No black bars)
    const hdHeight = 720;
    const hdWidth = Math.round(hdHeight * aspectRatio);

    scaleConfig = {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: hdWidth,
        height: hdHeight
    };
}

const config = {
  type: Phaser.AUTO,
  // High DPI support for sharper visuals on mobile
  resolution: resolution,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
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
    GameOver
  ]
};

function startGame() {
    // Kiểm tra xem game đã được tạo chưa để tránh tạo trùng
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }
}

// Tự động đăng nhập nếu đã có token (Optional)
const savedToken = localStorage.getItem('token');
if (savedToken) {
    // Nếu muốn tự động vào game luôn:
    if (loginOverlay) loginOverlay.style.display = 'none';
    startGame();
}

// Export hàm startGame nếu cần dùng ở nơi khác (không bắt buộc)
export { startGame };