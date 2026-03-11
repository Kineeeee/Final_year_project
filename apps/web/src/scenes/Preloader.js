import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

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

        this.load.image('logo', 'logo.png');

        // for snake
        this.load.image('snake-circle', 'circle.png');
        this.load.image('background', 'tile.png');
        this.load.image('menu-bg', 'menu_bg.png'); // Now pixel stadium
        this.load.image('icon-survival', 'snake_icon_transparent.png');
        this.load.image('icon-math', 'math_icon.png');
        this.load.image('icon-english', 'english_icon_transparent.png');
        this.load.image('icon-shooting', 'shooting_icon.png');
        this.load.image('gameover-bg', 'gameover_bg.png');

        this.load.image('food', 'hex.png');
        this.load.image('snake-eye', 'eye-white.png');
        this.load.image('snake-pupil', 'eye-black.png');
        this.load.image('snake-shadow', 'white-shadow.png');

        // for joystick
        this.load.plugin(
            'rexvirtualjoystickplugin',
            'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js',
            true
        );

        // for shop
        this.load.image('speed', 'speedUp.png');
        this.load.image('magnet', 'magnet.png');
        this.load.image('ghost', 'ghost.png');
    }

    create() {
        Logger.info('Preloader', 'Assets loaded, starting MainMenu');
        this.scene.start('MainMenu');
    }
}
