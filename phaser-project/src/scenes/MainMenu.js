import { Scene } from 'phaser';
import { Logger } from '../utils/Logger';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        Logger.info('MainMenu', 'Showing Main Menu');

        // Lấy kích thước màn hình hiện tại
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // Logo (Đặt ở 1/3 phía trên)
        this.add.image(centerX, centerY - 150, 'logo').setScale(0.1);

        // Title (Đặt dưới logo một chút)
        this.add.text(centerX, centerY - 40, 'Snake arena', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);


        // ------------------------------
        // NÚT START GAME (Đặt ở giữa phần dưới)
        // ------------------------------
        const startBtn = this.createButton(centerX, centerY + 100, 'Start Game');
        startBtn.on('pointerdown', () => {
            Logger.info('MainMenu', 'Start Game clicked');
            this.scene.start('Game');
        });


        // ------------------------------
        // NÚT CUSTOMIZE SNAKE (Đặt dưới nút Start)
        // ------------------------------
        const customBtn = this.createButton(centerX, centerY + 180, 'Customize Snake');
        customBtn.on('pointerdown', () => {
            Logger.info('MainMenu', 'Customize clicked');
            this.scene.start('CustomizeScene');
        });
    }


    // ---------------------------------------
    // REUSABLE BUTTON FUNCTION
    // ---------------------------------------
    createButton(x, y, text) {
        const btn = this.add.rectangle(x, y, 280, 70, 0x1e90ff)
            .setStrokeStyle(4, 0xffffff)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(x, y, text, {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#ffffff'
        }).setOrigin(0.5);


        // Hover effect
        btn.on('pointerover', () => {
            btn.setFillStyle(0x3cb0ff);
            btn.setScale(1.05);
            btnText.setScale(1.05);
        });

        btn.on('pointerout', () => {
            btn.setFillStyle(0x1e90ff);
            btn.setScale(1.0);
            btnText.setScale(1.0);
        });

        // Trả về container hoặc group nếu muốn quản lý tốt hơn, 
        // nhưng ở đây trả về btn (rectangle) để gán sự kiện click là đủ.
        // Lưu ý: btnText không nhận sự kiện click trong code cũ, chỉ có btn nhận.
        // Để tốt hơn, ta nên gán sự kiện cho cả text hoặc dùng Container.
        
        // Hack nhỏ để text cũng click được (nếu người dùng click trúng chữ)
        btnText.setInteractive({ useHandCursor: true });
        btnText.on('pointerdown', () => btn.emit('pointerdown'));
        btnText.on('pointerover', () => btn.emit('pointerover'));
        btnText.on('pointerout', () => btn.emit('pointerout'));

        return btn;
    }
}