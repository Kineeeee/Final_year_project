import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { playerState } from '../core/services/PlayerState';
import { AuthService } from '../core/services/AuthService';
import { QuizSetupOverlay } from '../ui/quiz/QuizSetupOverlay';
import { globalQuizPrefs } from '../core/services/GlobalQuizPrefs';
import { CategorySelectOverlay } from '../ui/quiz/CategorySelectOverlay';
import { userQuizApi } from '../core/services/UserQuizApi';
import { overlayBlocker } from '../core/services/OverlayBlocker';
import { authStore } from '../core/state/authStore';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');

        if (this.scene.get('UIScene')) {
            this.scene.stop('UIScene');
        }

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // --- 1. BACKGROUND ---
        if (this.textures.exists('menu-bg')) {
            this.bg = this.add.image(centerX, centerY, 'menu-bg').setOrigin(0.5);
            // Scale background to cover screen
            const scaleX = width / this.bg.width;
            const scaleY = height / this.bg.height;
            const scale = Math.max(scaleX, scaleY);
            this.bg.setScale(scale).setScrollFactor(0);
        } else {
            this.add.rectangle(0, 0, width, height, 0x5c94fc).setOrigin(0);
        }

        // Tạo Container chính chứa toàn bộ UI
        const uiRoot = this.add.container(0, 0);

        // DATA
        const username = playerState.getUsername ? playerState.getUsername() : 'Guest';
        const coins = playerState.getCoins ? playerState.getCoins() : 0;
        const highScore = playerState.getHighScore ? playerState.getHighScore() : 0;

        // --- 2. HEADER ---
        // Hạ thấp Header xuống một chút (0.15) để Logo không bị cắt ở mép trên màn hình
        const headerY = height * 0.28; 
        const bannerW = 600;
        const bannerH = 80;

        // A. VẼ BANNER (NỀN) TRƯỚC
        const banner = this.add.graphics();
        // Bóng đổ
        banner.fillStyle(0x000000, 0.5);
        banner.fillRoundedRect(centerX - bannerW/2 + 6, headerY - bannerH/2 + 6, bannerW, bannerH, 4);
        // Thân banner
        banner.fillStyle(0x2b3b5c, 1); 
        banner.fillRoundedRect(centerX - bannerW/2, headerY - bannerH/2, bannerW, bannerH, 4);
        // Viền
        banner.lineStyle(6, 0xffa500, 1);
        banner.strokeRoundedRect(centerX - bannerW/2, headerY - bannerH/2, bannerW, bannerH, 4);

        // B. LOGO (FIX LỖI CHỒNG CHÉO TẠI ĐÂY)
        // 1. Kiểm tra tồn tại texture
        // 2. Đặt vị trí cao hơn hẳn (headerY - 70) để nó đậu trên nóc Banner, không đè vào chữ
        let logo;
        if (this.textures.exists('logo')) {
            logo = this.add.image(centerX, headerY - 140, 'logo').setScale(0.065);
        }

        // C. TITLE TEXT (VẼ SAU CÙNG ĐỂ NỔI LÊN TRÊN)
        const titleText = this.add.text(centerX, headerY, 'SNAKE ARENA', { // +10 để dịch chữ xuống dưới 1 chút, tránh Logo
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '38px', // Giảm size chữ 1 xíu cho đỡ chật
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: { offsetX: 4, offsetY: 4, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // QUAN TRỌNG: Thêm tất cả vào uiRoot theo thứ tự: Banner (dưới cùng) -> Logo -> Text (trên cùng)
        uiRoot.add(banner);
        if (logo) uiRoot.add(logo);
        uiRoot.add(titleText);


        // --- 3. STATS BAR ---
        // Tăng khoảng cách từ Header xuống Stats (từ 70 lên 85) để thoáng hơn
        const statsY = headerY + 85; 
        const statsContainer = this.add.container(centerX, statsY);
        
        const statsBg = this.add.graphics();
        const statsW = 620;
        const statsH = 46;
        const r = 10;
        
        // Layer 1: Shadow/Outline
        statsBg.fillStyle(0x000000, 1);
        statsBg.fillRoundedRect(-statsW/2 - 2, -statsH/2 - 2, statsW + 4, statsH + 4, r + 2);

        // Layer 2: Border Xanh Sáng
        statsBg.fillStyle(0x5c8aae, 1); 
        statsBg.fillRoundedRect(-statsW/2, -statsH/2, statsW, statsH, r);

        // Layer 3: Nền Xanh Đậm
        statsBg.fillStyle(0x242d42, 1); 
        statsBg.fillRoundedRect(-statsW/2 + 3, -statsH/2 + 3, statsW - 6, statsH - 6, r - 2);

        statsContainer.add(statsBg);

        const statsStyle = { 
            fontFamily: '"Press Start 2P", monospace', 
            fontSize: '14px', // Giảm xuống 14px để an toàn cho tên dài
            color: '#FFD700', 
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        };
        
        // Căn chỉnh lại tọa độ text để không bị đè nhau
        const iconUser = this.add.text(-260, 0, '👤', { fontSize: '18px' }).setOrigin(0.5); 
        const txtUser = this.add.text(-240, 0, username, statsStyle).setOrigin(0, 0.5); // Canh lề trái

        const iconCoin = this.add.text(-30, 0, '💰', { fontSize: '18px' }).setOrigin(0.5);
        const txtCoin = this.add.text(-10, 0, `${coins}`, statsStyle).setOrigin(0, 0.5);

        const iconCup = this.add.text(150, 0, '🏆', { fontSize: '18px' }).setOrigin(0.5);
        const txtScore = this.add.text(170, 0, `Best: ${highScore}`, statsStyle).setOrigin(0, 0.5);
        
        statsContainer.add([iconUser, txtUser, iconCoin, txtCoin, iconCup, txtScore]);
        uiRoot.add(statsContainer);

        // --- 4. GLOBAL QUIZ SOURCE + UPLOAD ---
        const sourceY = statsY + 80;
        const sourceLabel = this.add.text(centerX - 240, sourceY, 'Quiz Source:', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0, 0.5);

        const makeChip = (text, value, color) => {
            const chip = this.add.text(0, 0, text, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: color,
                padding: { x: 14, y: 8 },
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            chip.on('pointerdown', () => this.setGlobalQuizSource(value));
            return chip;
        };

        this.chipSystem = makeChip('SYSTEM', 'SYSTEM', '#27ae60');
        this.chipUser = makeChip('USER', 'USER', '#8e44ad');
        this.chipSystem.setPosition(centerX, sourceY);
        this.chipUser.setPosition(centerX + 170, sourceY);
        uiRoot.add([sourceLabel, this.chipSystem, this.chipUser]);
        this.refreshSourceChips();
        this.preloadUserQuizStatus();

        // --- 5. GAME MODES ---
        const modes = [
            { label: 'QUIZ', mode: 'quiz', icon: 'icon-math', color: 0xff9800, shadow: 0xb36b00 },
            { label: 'SHOOTING', mode: 'shooting', icon: 'icon-shooting', color: 0xf44336, shadow: 0xc62828 },
            { label: 'SURVIVAL', mode: 'normal', icon: 'icon-survival', color: 0x44c448, shadow: 0x1d6a21 }
        ];

        const cardWidth = 190;
        const cardHeight = 250;
        const cardGap = 25;
        const totalRowWidth = (cardWidth * modes.length) + (cardGap * (modes.length - 1));
        const startX = centerX - (totalRowWidth / 2) + (cardWidth / 2);
        
        // Tăng khoảng cách Start Y của Card để không đụng Stats Bar
        const cardY = centerY + 50; 

        modes.forEach((m, i) => {
            const x = startX + (i * (cardWidth + cardGap));
            const card = this.add.container(x, cardY);
            const g = this.add.graphics();
            const w = cardWidth;
            const h = cardHeight;
            const r = 16;
            const borderW = 4;
            const left = -w / 2;
            const top = -h / 2;

            g.fillStyle(0x000000, 1);
            g.fillRoundedRect(left - borderW, top - borderW, w + borderW*2, h + borderW*2, r + 2);
            g.fillStyle(m.shadow, 1); 
            g.fillRoundedRect(left, top, w, h, r);
            g.fillStyle(m.color, 1);
            g.fillRoundedRect(left, top, w, h - 10, r); 
            const innerMargin = 10;
            g.lineStyle(4, 0x000000, 0.2); 
            g.strokeRoundedRect(left + innerMargin, top + innerMargin, w - innerMargin*2, h - 10 - innerMargin*2, r - 4);
            g.lineStyle(4, 0xffffff, 0.3);
            g.strokeRoundedRect(left + 2, top + 2, w - 4, h - 14, r);

            card.add(g);

            if (this.textures.exists(m.icon)) {
                const icon = this.add.image(0, -25, m.icon);
                const maxDim = 110;
                if(icon.width > maxDim || icon.height > maxDim) {
                    const scale = Math.min(maxDim / icon.width, maxDim / icon.height);
                    icon.setScale(scale);
                }
                card.add(icon);
            }

            const label = this.add.text(0, h/2 - 45, m.label, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center',
                wordWrap: { width: w - 10 }
            }).setOrigin(0.5);

            card.add(label);

            const hitZone = this.add.rectangle(0, 0, w, h, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    this.tweens.add({ targets: card, y: cardY - 10, scale: 1.05, duration: 100, ease: 'Sine.easeOut' });
                })
                .on('pointerout', () => {
                    this.tweens.add({ targets: card, y: cardY, scale: 1, duration: 100, ease: 'Sine.easeOut' });
                })
                .on('pointerdown', () => this.startGame(m.mode));

            card.add(hitZone);
            uiRoot.add(card);
        });

        // --- 6. BOTTOM BUTTONS ---
        const bottomY = height - 60;
        this.createStylishButton(uiRoot, centerX - 220, bottomY, '🛒 SHOP', 0x3d6cb9, () => {
            this.scene.launch('ShopScene');
            this.scene.pause();
        });
        this.createStylishButton(uiRoot, centerX, bottomY, '🎨 SKINS', 0x8e44ad, () => {
            this.scene.start('CustomizeScene');
        });
        this.createStylishButton(uiRoot, centerX + 220, bottomY, 'UPLOAD QUIZ', 0x2980b9, () => {
            this.openUploadOverlay();
        });

        // --- 6. TOP RIGHT BUTTONS ---
        this.createPixelButton(uiRoot, width - 60, 40, 'EXIT', 0xe74c3c, () => {
            const username = localStorage.getItem('username');
            (async () => {
                await authStore.logout();
                try {
                    sessionStorage.clear();
                    document.cookie.split(';').forEach(c => {
                        document.cookie = c
                            .replace(/^ +/, '')
                            .replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;');
                    });
                } catch (err) {
                    console.warn('Cookie/storage clear failed', err);
                }
                location.reload();
            })();
        });
        this.createPixelButton(uiRoot, width - 140, 40, 'HELP', 0x2ecc71, () => {
             Logger.info('MainMenu', 'Help clicked');
             this.scene.launch('HowToPlayScene');
             this.scene.pause('MainMenu');
        });

        this.add.existing(uiRoot);
    }

    createStylishButton(container, x, y, text, color, callback) {
        const btn = this.add.container(x, y);
        const w = 200;
        const h = 55;
        const r = 10;
        const g = this.add.graphics();
        const darkColor = Phaser.Display.Color.IntegerToColor(color).darken(15).color;

        g.fillStyle(0x000000, 1);
        g.fillRoundedRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6, r);
        g.fillStyle(darkColor, 1);
        g.fillRoundedRect(-w/2, -h/2, w, h, r);
        g.fillStyle(color, 1);
        g.fillRoundedRect(-w/2, -h/2, w, h - 6, r);

        const label = this.add.text(0, -3, text, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback)
            .on('pointerover', () => btn.setScale(1.05))
            .on('pointerout', () => btn.setScale(1));

        btn.add([g, label, hit]);
        container.add(btn);
    }

    createPixelButton(container, x, y, text, color, callback) {
        const btn = this.add.container(x, y);
        const w = 70;
        const h = 35;
        const g = this.add.graphics();
        const darkColor = Phaser.Display.Color.IntegerToColor(color).darken(20).color;

        g.fillStyle(0x000000, 1);
        g.fillRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4);
        g.fillStyle(darkColor, 1);
        g.fillRect(-w/2, -h/2, w, h);
        g.fillStyle(color, 1);
        g.fillRect(-w/2, -h/2, w, h - 4);

        const label = this.add.text(0, -2, text, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        btn.add([g, label, hit]);
        container.add(btn);
    }

    startGame(mode) {
        const isBlocked = overlayBlocker.isBlocked();
        if (isBlocked) {
            Logger.warn('MainMenu', 'Start blocked because overlay is active');
            return;
        }
        if (mode === 'quiz' || mode === 'shooting') {
            this.openCategorySelect(mode);
            return;
        }

        Logger.info('MainMenu', `Starting: ${mode}`);
        this.cameras.main.fadeOut(300);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('Game', { mode: mode });
        });
    }

    async setGlobalQuizSource(src) {
        if (src === 'USER') {
            // Require at least one valid quiz in any category; deeper check when selecting category
            try {
                const [mathStatus, engStatus] = this.userQuizStatus
                    ? [this.userQuizStatus.math, this.userQuizStatus.english]
                    : await Promise.all([
                          userQuizApi.getStatus('math').catch(() => null),
                          userQuizApi.getStatus('english').catch(() => null),
                      ]);
                const hasValid = (mathStatus && mathStatus.isValid) || (engStatus && engStatus.isValid);
                if (!hasValid) {
                    alert('Bạn chưa có đề hợp lệ cho Math hoặc English. Tiếp tục dùng Đề hệ thống.');
                    this.refreshSourceChips();
                    return;
                }
                this.userQuizStatus = { math: mathStatus, english: engStatus };
            } catch (e) {
                alert('Không kiểm tra được đề của bạn. Tiếp tục dùng Đề hệ thống.');
                this.refreshSourceChips();
                return;
            }
            globalQuizPrefs.setQuizSource('USER');
        } else {
            globalQuizPrefs.setQuizSource('SYSTEM');
        }
        this.refreshSourceChips();
    }

    refreshSourceChips() {
        const src = globalQuizPrefs.getQuizSource();
        if (this.chipSystem) this.chipSystem.setAlpha(src === 'SYSTEM' ? 1 : 0.5);
        if (this.chipUser) {
            this.chipUser.setAlpha(src === 'USER' ? 1 : 0.5);
            if (this.userQuizStatus) {
                const allValid = this.userQuizStatus.math?.isValid || this.userQuizStatus.english?.isValid;
                this.chipUser.setTint(allValid ? 0xffffff : 0xffaa00);
            }
        }
    }

    async preloadUserQuizStatus() {
        if (!localStorage.getItem('token')) return;
        try {
            const [mathStatus, engStatus] = await Promise.all([
                userQuizApi.getStatus('math').catch(() => null),
                userQuizApi.getStatus('english').catch(() => null),
            ]);
            this.userQuizStatus = { math: mathStatus, english: engStatus };
            this.refreshSourceChips();
        } catch (e) {
            // ignore
        }
    }

    openUploadOverlay() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Vui lòng đăng nhập để upload đề của bạn.');
            return;
        }
        const overlay = new QuizSetupOverlay({
            defaultCategory: 'math',
            onClose: () => {
                this.input.enabled = true;
            },
            disablePlay: true,
        });
        this.input.enabled = false;
        overlay.open();
    }

    openCategorySelect(mode) {
        const overlay = new CategorySelectOverlay({
            onSelect: (category) => {
                this.input.enabled = true;
                const source = globalQuizPrefs.getQuizSource();
                // Validate user quiz for category if USER selected
                const proceed = async () => {
                    let finalSource = source;
                    if (source === 'USER') {
                        try {
                            const status = await userQuizApi.getStatus(category);
                            if (!status?.isValid) {
                                finalSource = 'SYSTEM';
                                alert('Bạn chưa có đề cho category này. Tạm dùng đề hệ thống.');
                            }
                        } catch (e) {
                            finalSource = 'SYSTEM';
                            alert('Không kiểm tra được đề của bạn. Tạm dùng đề hệ thống.');
                        }
                    }
                    if (mode === 'quiz') {
                        Logger.info('MainMenu', `Starting Quiz ${category} source=${finalSource}`);
                        this.cameras.main.fadeOut(300);
                        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                            this.scene.start('Game', { mode: category, quizSource: finalSource });
                        });
                    } else if (mode === 'shooting') {
                        Logger.info('MainMenu', `Starting Shooting ${category} source=${finalSource}`);
                        this.cameras.main.fadeOut(300);
                        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                            this.scene.start('ShootingScene', { category, quizSource: finalSource });
                        });
                    }
                };
                proceed();
            },
            onCancel: () => {
                this.input.enabled = true;
            },
        });
        this.input.enabled = false;
        overlay.open();
    }
}
