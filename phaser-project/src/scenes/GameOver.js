import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create() {
        Logger.info('GameOver', 'Showing Game Over Screen');

        // Lấy kích thước màn hình hiện tại
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;


        this.cameras.main.setBackgroundColor(0xff0000);

        this.add.image(centerX, centerY - 134, 'logo').setScale(0.09);

        this.add.text(centerX, centerY, 'Game Over', {
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
