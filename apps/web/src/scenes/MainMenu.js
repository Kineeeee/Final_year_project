import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { playerState } from '../core/services/PlayerState';
import { AuthService } from '../core/services/AuthService';
import { overlayBlocker } from '../core/services/OverlayBlocker';
import { authStore } from '../core/state/authStore';
import { ProfileModal } from '../ui/ProfileModal';
import { RewardsInventoryModal } from '../ui/RewardsInventoryModal';
import { MainMenuFlowController } from './controllers/MainMenuFlowController';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
        this.flow = null;
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');

        // Defensive reset: avoid stale overlay lock from previous scenes blocking menu interactions.
        overlayBlocker.reset();

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
        this.flow = new MainMenuFlowController(this);

        // UI Events
        this.events.on('showToast', data => this.showToast(data.message, data.color));

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
        const titleText = this.add.text(centerX, headerY, 'SNAKE STUDY', { // +10 để dịch chữ xuống dưới 1 chút, tránh Logo
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
        const statsY = headerY + scaleVal(isMobile ? 96 : 106);
        const statsContainer = this.add.container(centerX, statsY).setDepth(30);
        const statsW = Math.min(scaleVal(720), width - padding * 2);
        const statsCols = isMobile ? 2 : 4;
        const statsRows = Math.ceil(4 / statsCols);
        const chipGapX = scaleVal(isMobile ? 10 : 12);
        const chipGapY = scaleVal(isMobile ? 10 : 0);
        const chipH = scaleVal(isMobile ? 42 : 46);
        const chipW = Math.floor((statsW - scaleVal(20) - chipGapX * (statsCols - 1)) / statsCols);
        const statsInnerH = (chipH * statsRows) + chipGapY * (statsRows - 1);
        const statsH = statsInnerH + scaleVal(18);
        const r = scaleVal(12);

        const statsBg = this.add.graphics();
        statsBg.fillStyle(0x000000, 0.9);
        statsBg.fillRoundedRect(-statsW / 2 - 3, -statsH / 2 - 3, statsW + 6, statsH + 6, r + 2);
        statsBg.fillStyle(0x5c8aae, 1);
        statsBg.fillRoundedRect(-statsW / 2, -statsH / 2, statsW, statsH, r);
        statsBg.fillStyle(0x1f2b44, 1);
        statsBg.fillRoundedRect(-statsW / 2 + 3, -statsH / 2 + 3, statsW - 6, statsH - 6, r - 2);
        statsContainer.add(statsBg);

        const usernameShort = (username && username.length > 10)
            ? `${username.slice(0, 9)}…`
            : username;

        const chipFont = `${scaleVal(isMobile ? 9 : 10)}px`;
        const iconFont = `${scaleVal(isMobile ? 15 : 16)}px`;

        const createStatusChip = ({ idx, icon, text, accent = 0x34dbcb, onClick }) => {
            const col = idx % statsCols;
            const row = Math.floor(idx / statsCols);
            const startX = -((chipW * statsCols) + (chipGapX * (statsCols - 1))) / 2 + chipW / 2;
            const x = startX + col * (chipW + chipGapX);
            const y = -statsInnerH / 2 + chipH / 2 + row * (chipH + chipGapY);

            const chip = this.add.container(x, y);
            const chipBg = this.add.graphics();

            const drawChip = (hover = false) => {
                chipBg.clear();
                chipBg.fillStyle(0x0b1220, hover ? 0.98 : 0.9);
                chipBg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 8);
                chipBg.lineStyle(2, hover ? 0xffffff : accent, hover ? 0.75 : 0.6);
                chipBg.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 8);
            };

            drawChip(false);

            const iconTxt = this.add.text(-chipW / 2 + scaleVal(10), 0, icon, {
                fontSize: iconFont
            }).setOrigin(0, 0.5);

            const valueTxt = this.add.text(-chipW / 2 + scaleVal(34), 0, text, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: chipFont,
                color: '#ffe59a',
                stroke: '#000000',
                strokeThickness: Math.max(2, Math.round(2 * uiScale))
            }).setOrigin(0, 0.5);

            const hit = this.add.rectangle(0, 0, chipW, chipH, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    drawChip(true);
                    this.tweens.add({ targets: chip, scale: 1.04, duration: 90, ease: 'Sine.easeOut' });
                })
                .on('pointerout', () => {
                    drawChip(false);
                    this.tweens.add({ targets: chip, scale: 1, duration: 90, ease: 'Sine.easeOut' });
                })
                .on('pointerdown', () => {
                    this.tweens.add({ targets: chip, scale: 0.96, duration: 60, yoyo: true });
                    if (onClick) onClick();
                });

            chip.add([chipBg, iconTxt, valueTxt, hit]);
            statsContainer.add(chip);
        };

        createStatusChip({
            idx: 0,
            icon: '👤',
            text: usernameShort || 'Guest',
            accent: 0x34dbcb,
            onClick: () => this.openProfileOverlay()
        });
        createStatusChip({
            idx: 1,
            icon: '💰',
            text: `${coins}`,
            accent: 0xf1c40f,
            onClick: () => this.showToast(`Coins: ${coins}`, '#f1c40f')
        });
        createStatusChip({
            idx: 2,
            icon: '🏆',
            text: `Best ${highScore}`,
            accent: 0x38bdf8,
            onClick: () => this.showToast(`Best score: ${highScore}`, '#38bdf8')
        });
        createStatusChip({
            idx: 3,
            icon: '🎒',
            text: 'Kho do',
            accent: 0xa78bfa,
            onClick: () => this.openInventoryOverlay()
        });

        uiRoot.add(statsContainer);

        // --- 4A. GLOBAL LEADERBOARD (REDIS) ---
        const globalPanelW = Math.min(scaleVal(isMobile ? 207 : 233), width - padding * 2);
        const globalPanelH = scaleVal(isMobile ? 106 : 128);
        const globalPanelX = width - padding - globalPanelW / 2;
        const globalPanelY = headerY + scaleVal(isMobile ? 56 : 62);

        const globalPanel = this.add.container(globalPanelX, globalPanelY).setDepth(40);
        const globalBg = this.add.graphics();
        globalBg.fillStyle(0x000000, 0.75);
        globalBg.fillRoundedRect(-globalPanelW / 2, -globalPanelH / 2, globalPanelW, globalPanelH, 10);
        globalBg.lineStyle(2, 0xf4d03f, 0.9);
        globalBg.strokeRoundedRect(-globalPanelW / 2, -globalPanelH / 2, globalPanelW, globalPanelH, 10);

        const globalTitle = this.add.text(-globalPanelW / 2 + scaleVal(10), -globalPanelH / 2 + scaleVal(12), 'GLOBAL TOP 5', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${scaleVal(isMobile ? 9 : 10)}px`,
            color: '#f7dc6f',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0, 0);

        const refreshLabel = this.add.text(globalPanelW / 2 - scaleVal(10), -globalPanelH / 2 + scaleVal(12), 'REFRESH', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${scaleVal(isMobile ? 8 : 9)}px`,
            color: '#7fffd4',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

        refreshLabel.on('pointerdown', () => {
            this.refreshGlobalLeaderboard();
        });
        refreshLabel.on('pointerover', () => refreshLabel.setTint(0xc8fff1));
        refreshLabel.on('pointerout', () => refreshLabel.clearTint());

        this.globalLeaderboardText = this.add.text(
            -globalPanelW / 2 + scaleVal(10),
            -globalPanelH / 2 + scaleVal(34),
            'Dang tai Global leaderboard...',
            {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: `${scaleVal(isMobile ? 8 : 9)}px`,
                color: '#ffffff',
                lineSpacing: scaleVal(5),
            }
        ).setOrigin(0, 0);

        globalPanel.add([globalBg, globalTitle, refreshLabel, this.globalLeaderboardText]);
        uiRoot.add(globalPanel);

        // --- 4. GLOBAL QUIZ SOURCE + UPLOAD ---
        const sourceY = statsY + (statsH / 2) + scaleVal(isMobile ? 30 : 34);
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
        this.flow.refreshSourceChips();
        this.flow.preloadUserQuizStatus();
        this.refreshGlobalLeaderboard();

        // --- 5. BOTTOM BUTTONS LAYOUT PLAN (used to avoid overlap with mode cards) ---
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
                    label: 'CHATBOT',
                    color: 0x16a085,
                    action: () => {
                        this.scene.launch('ChatbotScene');
                        this.scene.pause('MainMenu');
                    }
                },
            {
                label: 'UPLOAD QUIZ',
                color: 0x2980b9,
                action: () => { this.flow.openUploadOverlay(); }
            }
        ];

        const buttonWidth = scaleVal(200);
        const buttonHeight = scaleVal(55);
        const buttonGapX = scaleVal(isMobile ? 18 : 20);
        const buttonGapY = scaleVal(isMobile ? 14 : 0);
        const buttonsCols = isMobile ? 2 : bottomButtons.length;
        const buttonsRows = Math.ceil(bottomButtons.length / buttonsCols);
        const buttonsGridWidth = (buttonsCols * buttonWidth) + ((buttonsCols - 1) * buttonGapX);
        const buttonsGridHeight = (buttonsRows * buttonHeight) + ((buttonsRows - 1) * buttonGapY);
        const buttonsSafeBottom = isMobile ? scaleVal(22) : scaleVal(26);
        const buttonsTopY = height - buttonsSafeBottom - buttonsGridHeight;

        // --- 6. GAME MODES ---
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

        const modesStartY = sourceY + scaleVal(isMobile ? 116 : 132);
        const modesBottomLimit = buttonsTopY - scaleVal(isMobile ? 16 : 22);
        const rowGap = isMobile ? 14 : 18;
        const maxHeightBySpace = rows > 0
            ? Math.floor((modesBottomLimit - modesStartY - rowGap * (rows - 1)) / rows)
            : scaleVal(190);
        const cardHeight = Math.max(
            scaleVal(isMobile ? 124 : 150),
            Math.min(scaleVal(190), Math.min(cardWidth * 1.15, maxHeightBySpace))
        );

        const totalRowWidth = (cardWidth * cols) + (cardGap * (cols - 1));
        const startX = centerX - (totalRowWidth / 2) + (cardWidth / 2);

        modes.forEach((m, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + (col * (cardWidth + cardGap));
            const y = modesStartY + row * (cardHeight + rowGap);
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
                const icon = this.add.image(0, -Math.round(cardHeight * 0.16), m.icon);
                const maxDim = Math.min(scaleVal(110), Math.round(cardHeight * 0.48));
                if(icon.width > maxDim || icon.height > maxDim) {
                    const scale = Math.min(maxDim / icon.width, maxDim / icon.height);
                    icon.setScale(scale);
                }
                card.add(icon);
            }

                const label = this.add.text(0, h/2 - scaleVal(isMobile ? 34 : 45), m.label, {
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
                    this.flow.startGame(m.mode);
                });

            card.add(hitZone);
            uiRoot.add(card);
        });

        // --- 7. BOTTOM BUTTONS ---
        const buttonsStartX = centerX - (buttonsGridWidth / 2) + (buttonWidth / 2);
        const buttonsStartY = buttonsTopY + (buttonHeight / 2);
        bottomButtons.forEach((btn, idx) => {
            const row = Math.floor(idx / buttonsCols);
            const col = idx % buttonsCols;
            const x = buttonsStartX + col * (buttonWidth + buttonGapX);
            const y = buttonsStartY + row * (buttonHeight + buttonGapY);
            this.createStylishButton(uiRoot, x, y, btn.label, btn.color, btn.action);
        });

        // --- 8. TOP RIGHT BUTTONS ---
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
        this.createPixelButton(uiRoot, width - 220, 40, 'SET', 0x38bdf8, () => {
            this.scene.launch('SettingsScene');
            this.scene.pause('MainMenu');
        });

           // Ensure the stats bar stays above mode card hit zones.
           uiRoot.bringToTop(statsContainer);

        this.add.existing(uiRoot);
        
        // Listen for network errors returning from Game scene (NetworkManager)
        this.events.on('network:error', (data) => {
            this.flow.showNetworkErrorModal(data.message);
        });

        this.events.once('shutdown', () => {
            if (this._globalLeaderboardCleanup) {
                this._globalLeaderboardCleanup();
                this._globalLeaderboardCleanup = null;
            }
        });
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
        this.flow.startGame(mode);
    }

    async startCustomQuizFlow() {
        return this.flow.startCustomQuizFlow();
    }

    startCustomRoomJoin(code) {
        this.flow.startCustomRoomJoin(code);
    }

    async setGlobalQuizSource(src) {
        return this.flow.setGlobalQuizSource(src);
    }

    refreshSourceChips() {
        this.flow.refreshSourceChips();
    }

    async preloadUserQuizStatus() {
        return this.flow.preloadUserQuizStatus();
    }

    openUploadOverlay() {
        this.flow.openUploadOverlay();
    }

    openCategorySelect(mode) {
        this.flow.openCategorySelect(mode);
    }

    _handleCategoryChoice(category, mode, overlay) {
        this.flow.handleCategoryChoice(category, mode, overlay);
    }

    showNetworkErrorModal(message) {
        this.flow.showNetworkErrorModal(message);
    }

    openProfileOverlay() {
        if (overlayBlocker.isBlocked()) return;
        if (this._profileModal) return;

        const { width, height } = this.scale;
        this._profileModal = new ProfileModal(this, width / 2, height / 2, {
            onClose: () => {
                this._profileModal = null;
            }
        });
    }

    openInventoryOverlay() {
        if (overlayBlocker.isBlocked()) return;
        if (this._inventoryModal) return;

        const { width, height } = this.scale;
        this._inventoryModal = new RewardsInventoryModal(this, width / 2, height / 2, {
            onClose: () => {
                this._inventoryModal = null;
            }
        });
    }

    showToast(message, color = '#2ecc71') {
        const { width, height } = this.scale;
        const toastBg = this.add.rectangle(width / 2, height - Math.min(200, height * 0.2), 200, 40, 0x000000, 0.8).setDepth(999).setAlpha(0);
        toastBg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color);
        
        const toastMsg = this.add.text(width / 2, height - Math.min(200, height * 0.2), message, {
            fontFamily: '"Press Start 2P", monospace', 
            fontSize: '12px', 
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(1000).setAlpha(0);

        this.tweens.add({
            targets: [toastBg, toastMsg],
            alpha: 1,
            y: '-=20',
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: [toastBg, toastMsg],
                        alpha: 0,
                        duration: 300,
                        onComplete: () => { toastBg.destroy(); toastMsg.destroy(); }
                    });
                });
            }
        });
    }

    refreshGlobalLeaderboard() {
        if (!this.globalLeaderboardText || !this.flow) return;

        if (this._globalLeaderboardCleanup) {
            this._globalLeaderboardCleanup();
            this._globalLeaderboardCleanup = null;
        }

        this.globalLeaderboardText.setText('Dang tai Global leaderboard...');
        this._globalLeaderboardCleanup = this.flow.requestGlobalLeaderboard({
            limit: 5,
            onSuccess: (payload) => this.renderGlobalLeaderboard(payload),
            onError: () => {
                if (this.globalLeaderboardText) {
                    this.globalLeaderboardText.setText('Khong the tai leaderboard\nVui long thu lai sau');
                }
            },
        });
    }

    renderGlobalLeaderboard(payload) {
        if (!this.globalLeaderboardText) return;

        const top = payload && Array.isArray(payload.top) ? payload.top : [];
        if (top.length === 0) {
            this.globalLeaderboardText.setText('Chua co du lieu\nHay choi va leo top!');
            return;
        }

        const lines = top.slice(0, 5).map((entry, index) => {
            const name = entry?.name || 'Unknown';
            const score = Number(entry?.score || 0);
            return `${index + 1}. ${name}: ${score}`;
        });
        this.globalLeaderboardText.setText(lines.join('\n'));
    }
}
