import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { playerState } from '../core/services/PlayerState';
import { AuthService } from '../core/services/AuthService';
import { QuizSetupOverlay } from '../ui/quiz/QuizSetupOverlay';
import { globalQuizPrefs } from '../core/services/GlobalQuizPrefs';
import { CategorySelectOverlay } from '../ui/quiz/CategorySelectOverlay';
import { CustomRoomOverlay } from '../ui/quiz/CustomRoomOverlay';
import { userQuizApi } from '../core/services/UserQuizApi';
import { overlayBlocker } from '../core/services/OverlayBlocker';
import { authStore } from '../core/state/authStore';
import { roomService } from '../core/services/RoomService';

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
        const isMobile = width < 1080;
        const padding = isMobile ? 18 : 32;
        const uiScale = isMobile ? 1.05 : 1.5;
        const scaleVal = (n) => Math.round(n * uiScale);
        this.uiScale = uiScale;
        this.scaleVal = scaleVal;

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
        const headerY = height * (isMobile ? 0.22 : 0.24); 
        const bannerW = Math.min(scaleVal(620), width - padding * 2);
        const bannerH = scaleVal(isMobile ? 68 : 80);

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
            const logoScale = isMobile ? 0.052 : 0.07;
            // Position logo to sit near the lower edge of the ribbon, not floating above it.
            const logoY = headerY - (bannerH * 0.55) - 80;
            logo = this.add.image(centerX, logoY, 'logo').setScale(logoScale);
        }

        // C. TITLE TEXT (VẼ SAU CÙNG ĐỂ NỔI LÊN TRÊN)
        const titleText = this.add.text(centerX, headerY, 'SNAKE ARENA', { // +10 để dịch chữ xuống dưới 1 chút, tránh Logo
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${scaleVal(isMobile ? 30 : 38)}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: Math.max(6, Math.round(6 * uiScale)),
            shadow: { offsetX: 4, offsetY: 4, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // QUAN TRỌNG: Thêm tất cả vào uiRoot theo thứ tự: Banner (dưới cùng) -> Logo -> Text (trên cùng)
        uiRoot.add(banner);
        if (logo) uiRoot.add(logo);
        uiRoot.add(titleText);


        // --- 3. STATS BAR ---
        // Tăng khoảng cách từ Header xuống Stats (từ 70 lên 85) để thoáng hơn
        const statsY = headerY + scaleVal(isMobile ? 80 : 95); 
        const statsContainer = this.add.container(centerX, statsY);
        
        const statsBg = this.add.graphics();
        const statsW = Math.min(scaleVal(620), width - padding * 2);
        const statsH = scaleVal(40);
        const r = scaleVal(10);
        
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
            fontSize: `${scaleVal(isMobile ? 12 : 14)}px`, // Giảm xuống 14px để an toàn cho tên dài
            color: '#FFD700', 
            stroke: '#000000',
            strokeThickness: Math.max(3, Math.round(4 * uiScale)),
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        };
        
        // Căn chỉnh lại tọa độ text để không bị đè nhau
        const iconUser = this.add.text(-scaleVal(260), 0, '👤', { fontSize: `${scaleVal(18)}px` }).setOrigin(0.5); 
        const txtUser = this.add.text(-scaleVal(240), 0, username, statsStyle).setOrigin(0, 0.5); // Canh lề trái

        const iconCoin = this.add.text(-scaleVal(30), 0, '💰', { fontSize: `${scaleVal(18)}px` }).setOrigin(0.5);
        const txtCoin = this.add.text(-scaleVal(10), 0, `${coins}`, statsStyle).setOrigin(0, 0.5);

        const iconCup = this.add.text(scaleVal(150), 0, '🏆', { fontSize: `${scaleVal(18)}px` }).setOrigin(0.5);
        const txtScore = this.add.text(scaleVal(170), 0, `Best: ${highScore}`, statsStyle).setOrigin(0, 0.5);
        
        statsContainer.add([iconUser, txtUser, iconCoin, txtCoin, iconCup, txtScore]);
        uiRoot.add(statsContainer);

        // --- 4. GLOBAL QUIZ SOURCE + UPLOAD ---
        const sourceY = statsY + scaleVal(isMobile ? 80 : 90);
        const sourceLabel = this.add.text(centerX - 240, sourceY, 'Quiz Source:', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${scaleVal(isMobile ? 12 : 14)}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0, 0.5);

        const makeChip = (text, value, color) => {
            const chip = this.add.text(0, 0, text, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: `${scaleVal(12)}px`,
                color: '#ffffff',
                backgroundColor: color,
                padding: { x: scaleVal(14), y: scaleVal(8) },
                stroke: '#000000',
                strokeThickness: Math.max(2, Math.round(3 * uiScale))
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            chip.on('pointerdown', () => this.setGlobalQuizSource(value));
            return chip;
        };

        this.chipSystem = makeChip('SYSTEM', 'SYSTEM', '#27ae60');
        this.chipUser = makeChip('USER', 'USER', '#8e44ad');
        this.chipSystem.setPosition(centerX - (isMobile ? 60 : 0), sourceY);
        this.chipUser.setPosition(centerX + (isMobile ? 60 : 170), sourceY);
        uiRoot.add([sourceLabel, this.chipSystem, this.chipUser]);
        this.refreshSourceChips();
        this.preloadUserQuizStatus();

        // --- 5. GAME MODES ---
        const modes = [
            { label: 'QUIZ', mode: 'quiz', icon: 'icon-math', color: 0xff9800, shadow: 0xb36b00 },
            { label: 'CUSTOM QUIZ', mode: 'custom_quiz', icon: 'icon-english', color: 0x9b59b6, shadow: 0x6c3483 },
            { label: 'SHOOTING', mode: 'shooting', icon: 'icon-shooting', color: 0xf44336, shadow: 0xc62828 },
            { label: 'SURVIVAL', mode: 'normal', icon: 'icon-survival', color: 0x44c448, shadow: 0x1d6a21 }
        ];

        const maxCols = isMobile ? 2 : Math.min(4, modes.length);
        const cols = Math.min(maxCols, modes.length);
        const rows = Math.ceil(modes.length / cols);
        const availW = width - padding * 2;
        const cardGap = scaleVal(isMobile ? 12 : 18);
        const cardWidth = Math.min(scaleVal(180), (availW - cardGap * (cols - 1)) / cols);
        const cardHeight = Math.min(scaleVal(190), cardWidth * 1.15);
        const totalRowWidth = (cardWidth * cols) + (cardGap * (cols - 1));
        const startX = centerX - (totalRowWidth / 2) + (cardWidth / 2);
        const modesStartY = sourceY + scaleVal(isMobile ? 120 : 140);

        modes.forEach((m, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + (col * (cardWidth + cardGap));
            const y = modesStartY + row * (cardHeight + (isMobile ? 14 : 18));
            const card = this.add.container(x, y);
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
                const maxDim = scaleVal(110);
                if(icon.width > maxDim || icon.height > maxDim) {
                    const scale = Math.min(maxDim / icon.width, maxDim / icon.height);
                    icon.setScale(scale);
                }
                card.add(icon);
            }

                const label = this.add.text(0, h/2 - scaleVal(45), m.label, {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: `${scaleVal(isMobile ? 14 : 18)}px`,
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: Math.max(5, Math.round(6 * uiScale)),
                    align: 'center',
                    wordWrap: { width: w - 10 }
                }).setOrigin(0.5);

            card.add(label);

            const hoverUp = () => this.tweens.add({ targets: card, scale: 1.05, y: y - 8, duration: 120, ease: 'Sine.easeOut' });
            const hoverDown = () => this.tweens.add({ targets: card, scale: 1, y: y, duration: 120, ease: 'Sine.easeOut' });

            const hitZone = this.add.rectangle(0, 0, w, h, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', hoverUp)
                .on('pointerout', hoverDown)
                .on('pointerdown', () => {
                    this.tweens.add({ targets: card, scale: 0.97, duration: 60, yoyo: true });
                    this.startGame(m.mode);
                });

            card.add(hitZone);
            uiRoot.add(card);
        });

        // --- 6. BOTTOM BUTTONS ---
        const bottomY = height - (isMobile ? scaleVal(40) : scaleVal(70)); // position above safe area
        const bottomButtons = [
            {
                label: '🛒 SHOP',
                color: 0x3d6cb9,
                action: () => { this.scene.launch('ShopScene'); this.scene.pause(); }
            },
            {
                label: '🏅 ACHIEV.',
                color: 0xf59e0b,
                action: () => { this.scene.launch('AchievementsScene'); this.scene.pause(); }
            },
            {
                label: '🎨 SKINS',
                color: 0x8e44ad,
                action: () => { this.scene.start('CustomizeScene'); }
            },
            {
                label: 'UPLOAD QUIZ',
                color: 0x2980b9,
                action: () => { this.openUploadOverlay(); }
            }
        ];
        const spacing = scaleVal(180);
        const bottomStartX = centerX - spacing * ((bottomButtons.length - 1) / 2);
        bottomButtons.forEach((btn, idx) => {
            this.createStylishButton(uiRoot, bottomStartX + idx * spacing, bottomY, btn.label, btn.color, btn.action);
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
        const scaleVal = this.scaleVal || ((n) => n);
        const btn = this.add.container(x, y);
        const w = scaleVal(200);
        const h = scaleVal(55);
        const r = scaleVal(10);
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
            fontSize: `${scaleVal(20)}px`,
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
            .on('pointerover', () => {
                this.tweens.add({ targets: btn, scale: 1.08, duration: 100, ease: 'Sine.easeOut' });
            })
            .on('pointerout', () => {
                this.tweens.add({ targets: btn, scale: 1, duration: 100, ease: 'Sine.easeOut' });
            })
            .on('pointerdown', () => {
                this.tweens.add({ targets: btn, scale: 0.95, duration: 60, yoyo: true });
                callback();
            });

        btn.add([g, label, hit]);
        container.add(btn);
    }

    startGame(mode) {
        const isBlocked = overlayBlocker.isBlocked();
        if (isBlocked) {
            Logger.warn('MainMenu', 'Start blocked because overlay is active');
            return;
        }
        if (mode === 'custom_quiz') {
            this.startCustomQuizFlow();
            return;
        }
        if (mode === 'quiz') {
            // Immediate join system quiz arena (no category selection)
            Logger.info('MainMenu', 'Starting Quiz Arena (system questions)');
            this.cameras.main.fadeOut(300);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.scene.start('Game', { mode: 'math', quizSource: 'SYSTEM' });
            });
            return;
        }
        if (mode === 'shooting') {
            this.openCategorySelect(mode);
            return;
        }

        Logger.info('MainMenu', `Starting: ${mode}`);
        this.cameras.main.fadeOut(300);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('Game', { mode: mode });
        });
    }

    async startCustomQuizFlow() {
        if (overlayBlocker.isBlocked()) return;
        if (!this.customOverlay) {
            this.customOverlay = new CustomRoomOverlay({
                onJoin: (code) => {
                    this.customOverlay?.close();
                    this.startCustomRoomJoin(code);
                },
                onCreate: () => {
                    this.customOverlay?.close();
                    this.openCategorySelect('custom_create');
                },
                onClose: () => {
                    this.input.enabled = true;
                }
            });
        }
        this.input.enabled = false;
        await this.customOverlay.open();
    }

    startCustomRoomJoin(code) {
        (async () => {
            try {
                const meta = await roomService.getRoomMeta(code);
                if (meta.players >= meta.capacity) {
                    alert('Phòng đã đầy.');
                    return;
                }
                Logger.info('MainMenu', `Join custom room ${code}`);
                const namespace = `/custom/${code}`;
                this.cameras.main.fadeOut(300);
                this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                    this.scene.start('Game', {
                        mode: 'quiz',
                        quizSource: 'USER',
                        customNamespace: namespace,
                        roomMeta: meta
                    });
                });
            } catch (err) {
                alert(err.message || 'Không tìm thấy phòng');
            }
        })();
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
                const source = (mode === 'custom_create') ? 'USER' : globalQuizPrefs.getQuizSource();
                // Validate user quiz for category if USER selected
                const proceed = async () => {
                    let finalSource = source;
                    if (source === 'USER') {
                        if (mode === 'custom_create') {
                            try {
                                const { namespace } = await roomService.createCustomRoom(category);
                                Logger.info('MainMenu', `Created custom room ${namespace}`);
                                this.cameras.main.fadeOut(300);
                                this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                                    this.scene.start('Game', { mode: 'quiz', quizSource: 'USER', customNamespace: namespace });
                                });
                                return;
                            } catch (err) {
                                alert(err.message || 'Tạo phòng custom thất bại');
                                return;
                            }
                        } else {
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
