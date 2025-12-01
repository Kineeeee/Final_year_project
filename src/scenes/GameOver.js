import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create() {
        Logger.info('GameOver', 'Showing Game Over Screen');
        this.cameras.main.setBackgroundColor(0xff0000);

        this.add.image(512, 250, 'logo').setScale(0.09);

        this.add.text(512, 384, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            Logger.info('GameOver', 'Restarting Game');
            this.scene.start('MainMenu');

        });
    }
}
