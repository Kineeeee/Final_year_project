import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        Logger.info('Boot', 'Booting game...');
    }

    create() {
        Logger.info('Boot', 'Boot complete, starting Preloader');
        this.scene.start('Preloader');
    }
}
