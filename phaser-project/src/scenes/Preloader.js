import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        Logger.info('Preloader', 'Initializing Preloader');
        //  We loaded this image in our Boot Scene, so we can display it here
        //  this.add.image(512, 384, 'background');

        // Lấy kích thước màn hình hiện tại
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centerX, centerY, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff).setOrigin(0, 0.5);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        
        // for snake
        this.load.image('snake-circle', 'circle.png');
        this.load.image('background', 'tile.png');
        this.load.image('food', 'hex.png');
        this.load.image('snake-eye', 'eye-white.png');
        this.load.image('snake-pupil', 'eye-black.png');
        this.load.image('snake-shadow', 'white-shadow.png');

        // for joystick
        this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
        
        // for shop
        this.load.image('speed', 'speedUp.png');
        this.load.image('magnet', 'magnet.png');
        this.load.image('ghost', 'ghost.png');
    }

    create() {
        Logger.info('Preloader', 'Assets loaded, starting MainMenu');
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}
