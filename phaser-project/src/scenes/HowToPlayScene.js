import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { UIButton } from '../ui/UIButton';
import { UIPanel } from '../ui/UIPanel';
import { COLORS, TEXT_STYLES } from '../ui/UIConstants';

export class HowToPlayScene extends Scene {
    constructor() {
        super('HowToPlayScene');
    }

    create() {
        Logger.info('HowToPlay', 'Showing How To Play');
        this.scene.stop('UIScene');

        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // Background
        this.add.tileSprite(0, 0, width, height, 'background').setOrigin(0).setTint(0x444444);
        this.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.7).setOrigin(0);

        // Panel
        const panelW = 1000;
        const panelH = height - 120;

        const closeAction = () => {
            this.scene.stop();
            this.scene.resume('MainMenu');
        };

        const panel = new UIPanel(this, centerX, centerY, panelW, panelH, 'HOW TO PLAY', closeAction);
        this.add.existing(panel);

        // Content Container (Scrollable or Static)
        // Since we have a lot of content, let's divide into visual sections inside the panel.

        // --- 1. CONTROLS ---
        const controlsY = centerY - 150;

        this.add.text(centerX - 350, controlsY, '💻 CONTROLS', { ...TEXT_STYLES.SUBHEADER, color: COLORS.PRIMARY }).setOrigin(0.5);

        const controlsText = [
            "MOUSE: Move cursor to guide snake",
            "CLICK: Dash (Speed Up)",
            "KEYS: 1, 2, 3 to use Items"
        ];

        this.add.text(centerX - 350, controlsY + 60, controlsText.join('\n\n'), {
            ...TEXT_STYLES.BODY,
            fontSize: '20px',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);


        // --- 2. MODES ---
        this.add.text(centerX + 150, controlsY, '🎮 GAME MODES', { ...TEXT_STYLES.SUBHEADER, color: COLORS.PRIMARY }).setOrigin(0.5);

        // Normal Mode
        this.add.text(centerX + 150, controlsY + 60, '🐍 SURVIVAL', { ...TEXT_STYLES.BUTTON, color: COLORS.TEXT.ACCENT }).setOrigin(0.5);
        this.add.text(centerX + 150, controlsY + 95,
            "Eat food to grow.\nAvoid other snakes and walls.\nLast snake slithering wins!",
            { ...TEXT_STYLES.BODY, fontSize: '18px', align: 'center', color: '#dddddd' }
        ).setOrigin(0.5);

        // Quiz Mode
        const quizY = controlsY + 180;
        this.add.text(centerX + 150, quizY, '🧠 QUIZ MODES', { ...TEXT_STYLES.BUTTON, color: 0xff8c00 }).setOrigin(0.5);
        this.add.text(centerX + 150, quizY + 45,
            "Answer questions correctly to get buffers.\nWrong answers slow you down!\nRace to the top score.",
            { ...TEXT_STYLES.BODY, fontSize: '18px', align: 'center', color: '#dddddd' }
        ).setOrigin(0.5);


        // --- 3. ITEMS ---
        const itemsY = centerY + 180;
        this.add.text(centerX, itemsY, '⚡ POWER-UPS ⚡', { ...TEXT_STYLES.SUBHEADER, color: COLORS.ACCENT }).setOrigin(0.5);

        const items = [
            { icon: 'MAGNET', desc: 'Magnet: Attract food' },
            { icon: 'SPEED_UP', desc: 'Speed: Dash without cost' },
            { icon: 'GHOST', desc: 'Ghost: Pass through snakes' }
        ];

        let startX = centerX - 300;
        items.forEach((item, i) => {
            const x = startX + (i * 300);

            // Icon placeholder (reusing existing asset logic if available, or text)
            // Ideally we have images. Assuming item keys exist.
            if (this.textures.exists(item.icon)) {
                const img = this.add.image(x, itemsY + 50, item.icon).setScale(0.8);
                panel.add(img); // Wait, panel is container? We added panel to scene. 
                // We are adding directly to scene for simplicity but above panel.
            } else {
                this.add.circle(x, itemsY + 50, 24, COLORS.SECONDARY).setStrokeStyle(2, 0xffffff);
            }

            this.add.text(x, itemsY + 100, item.desc, {
                ...TEXT_STYLES.BODY,
                fontSize: '18px',
                align: 'center'
            }).setOrigin(0.5);
        });

    }
}
