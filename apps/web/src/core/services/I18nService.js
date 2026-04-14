const dictionaryEn = {
    // Auth & Navigation HTML
    "login.title": "Welcome back to",
    "login.subtitle": "Log in to continue your adventure.",
    "login.username": "Username",
    "login.password": "Password",
    "login.remember": "Remember me!",
    "login.forgot": "Forgot password?",
    "login.submit": "Login",
    "login.or": "Or login with",
    "login.noAccount": "Don't have an account? Join now!",
    "login.signup": "Create new account",
    "login.guest": "Play as Guest",

    "signup.title": "Begin your adventure with",
    "signup.subtitle": "Discover the wonderful world of knowledge through fun lessons.",
    "signup.name": "NICKNAME",
    "signup.email": "PARENT EMAIL",
    "signup.password": "PASSWORD",
    "signup.confirm": "CONFIRM PASSWORD",
    "signup.submit": "Join Now!",
    "signup.hasAccount": "Already have an account?",
    "signup.loginHere": "Login here",

    "auth.safety": "Absolute Safety",
    "auth.age": "For ages 8-12",

    // Game Scenes
    "scene.shooting.selectHand": "SELECT YOUR HAND",
    "scene.shooting.leftHand": "LEFT HAND",
    "scene.shooting.rightHand": "RIGHT HAND",
    "scene.shooting.backMenu": "BACK TO MENU",
    "scene.shooting.loadingModel": "Loading AI Model...",
    "scene.shooting.noQuestions": "No questions available for this mode.",
    "scene.shooting.score": "SCORE: ",
    "scene.shooting.instructions": "AIM: Thumb+Index Midpoint | PINCH: Shoot",
    "scene.shooting.lostWarning": "WARNING: Hand signal lost!\nPlease raise your hand clearly.",
    "scene.shooting.mouseMode": "Switched to Mouse Input!",
    "scene.shooting.cameraMode": "Restored Hand Gestures!",

    // Other UI
    "ui.language": "Language",
    "ui.en": "English",
    "ui.vi": "Tiếng Việt"
};

const dictionaryVi = {
    // Auth & Navigation HTML
    "login.title": "Chào mừng trở lại với",
    "login.subtitle": "Đăng nhập để tiếp tục cuộc phiêu lưu.",
    "login.username": "Tên đăng nhập",
    "login.password": "Mật khẩu",
    "login.remember": "Nhớ mật khẩu!",
    "login.forgot": "Quên mật khẩu rồi à?",
    "login.submit": "Đăng nhập",
    "login.or": "Hoặc đăng nhập bằng",
    "login.noAccount": "Chưa có tài khoản? Tham gia ngay!",
    "login.signup": "Đăng ký tài khoản mới",
    "login.guest": "Chơi với tư cách khách",

    "signup.title": "Bắt đầu chuyến phiêu lưu với",
    "signup.subtitle": "Khám phá thế giới tri thức kỳ thú qua các bài học sinh động.",
    "signup.name": "BIỆT DANH",
    "signup.email": "EMAIL",
    "signup.password": "MẬT KHẨU",
    "signup.confirm": "XÁC NHẬN MẬT KHẨU",
    "signup.submit": "Tham gia ngay!",
    "signup.hasAccount": "Đã có tài khoản?",
    "signup.loginHere": "Đăng nhập tại đây",

    "auth.safety": "An toàn tuyệt đối",
    "auth.age": "Dành cho trẻ 8-12 tuổi",

    // Game Scenes
    "scene.shooting.selectHand": "CHỌN TAY CỦA BÉ",
    "scene.shooting.leftHand": "TAY TRÁI",
    "scene.shooting.rightHand": "TAY PHẢI",
    "scene.shooting.backMenu": "QUAY VỀ MENU",
    "scene.shooting.loadingModel": "Đang tải AI Model (Vui lòng chờ)...",
    "scene.shooting.noQuestions": "Chưa có câu hỏi cho chế độ này.",
    "scene.shooting.score": "ĐIỂM: ",
    "scene.shooting.instructions": "NHẮM: Giữa Ngón Trỏ + Ngón Cái  |  BẮN: Chạm 2 ngón",
    "scene.shooting.lostWarning": "CẢNH BÁO: Không có tín hiệu!\nVui lòng đưa rành mạch tay vào camera.",
    "scene.shooting.mouseMode": "Đã chuyển sang dùng Chuột!",
    "scene.shooting.cameraMode": "Đã phục hồi AI Cử Chỉ!",

    // Other UI
    "ui.language": "Ngôn ngữ",
    "ui.en": "English",
    "ui.vi": "Tiếng Việt"
};

const dictionaries = {
    'en': dictionaryEn,
    'vi': dictionaryVi
};

class I18nService {
    constructor() {
        const savedLang = localStorage.getItem('snake_lang');
        this.language = savedLang && dictionaries[savedLang] ? savedLang : 'vi'; // Default VI
    }

    setLanguage(lang) {
        if (dictionaries[lang]) {
            this.language = lang;
            localStorage.setItem('snake_lang', lang);
            // Option A: Hard Reload for clean wipe and rebuild of all scenes & DOM elements
            window.location.reload();
        }
    }

    t(key) {
        const dict = dictionaries[this.language];
        return dict && dict[key] !== undefined ? dict[key] : key;
    }

    currentLanguage() {
        return this.language;
    }

    // Replace all elements in DOM with data-i18n
    localizeDOM() {
        if (typeof document !== 'undefined') {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (key) {
                    el.textContent = this.t(key);
                }
            });

            // Set select value if language switcher exists
            const selectLang = document.getElementById('lang-switcher');
            if (selectLang) {
                selectLang.value = this.language;
            }
        }
    }
}

// Singleton
export const i18n = new I18nService();
