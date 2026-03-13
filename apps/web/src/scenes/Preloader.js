import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';
import { REWARDS, getGeneratedSkinTextureKey, getRewardPreloadEntries } from '../modules/achievements/RewardsCatalog.js';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        Logger.info('Preloader', 'Initializing Preloader');
        // Lấy kích thước màn hình hiện tại
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add.rectangle(centerX, centerY, 468, 32).setStrokeStyle(1, 0xffffff);

        const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff).setOrigin(0, 0.5);

        this.load.on('progress', (progress) => {
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'icons/logo.png');

        // for snake
        this.load.image('menu-bg', 'bg/menu_bg.png'); // Now pixel stadium or original
        this.load.image('icon-survival', 'icons/snake_icon_transparent.png');
        this.load.image('icon-math', 'icons/math_icon.png');
        this.load.image('icon-english', 'icons/english_icon_transparent.png');
        this.load.image('icon-shooting', 'icons/shooting_icon.png');
        this.load.image('gameover-bg', 'bg/gameover_bg.png');

        this.load.image('food', 'game/hex.png');
        this.load.image('snake-eye', 'snake/eye-white.png');
        this.load.image('snake-pupil', 'snake/eye-black.png');
        this.load.image('snake-shadow', 'snake/white-shadow.png');

        // Catalog-driven rewards preload (skins/themes with file textures)
        getRewardPreloadEntries().forEach(({ key, path }) => {
            this.load.image(key, path);
        });

        // custom icons
        this.load.image('badge_mastery', 'icons/badge_mastery.png');

        // for shop
        this.load.image('speed', 'icons/speedUp.png');
        this.load.image('magnet', 'icons/magnet.png');
        this.load.image('ghost', 'icons/ghost.png');
    }

    create() {
        this.generateCatalogSkinTextures();
        Logger.info('Preloader', 'Assets loaded, starting MainMenu');
        this.scene.start('MainMenu');
    }

    generateCatalogSkinTextures() {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        Object.values(REWARDS).forEach((reward) => {
            if (reward.type !== 'skin' || reward.texture) return;

            const generatedKey = getGeneratedSkinTextureKey(reward);
            if (!generatedKey || this.textures.exists(generatedKey)) return;

            const fill = reward.tint || 0xffffff;
            const alpha = reward.alpha ?? 1;

            graphics.clear();
            graphics.fillStyle(fill, alpha);
            graphics.fillCircle(15, 15, 15);
            graphics.lineStyle(3, 0xffffff, Math.min(0.35, alpha));
            graphics.strokeCircle(15, 15, 12);
            graphics.generateTexture(generatedKey, 30, 30);
        });

        graphics.destroy();
    }
}
