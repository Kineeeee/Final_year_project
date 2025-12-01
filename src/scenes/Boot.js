import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        Logger.info('Boot', 'Booting game...');
        //  The Boot Scene is typically used to load the assets needed for the Preloader
        //  For example, you'd load the background image for the loading bar here
        //  this.load.image('background', 'assets/bg.png');
    }

    create() {
        Logger.info('Boot', 'Boot complete, starting Preloader');
        this.scene.start('Preloader');
    }
}
