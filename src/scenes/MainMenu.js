import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');
        // Scale the logo down if it's too big
        this.add.image(512, 300, 'logo').setScale(0.09);

        this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            Logger.info('MainMenu', 'Starting Game');
            this.scene.start('Game');

        });
    }
}
