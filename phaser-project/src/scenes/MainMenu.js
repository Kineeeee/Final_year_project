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


        const username = localStorage.getItem('username') || 'Guest';
        Logger.info('MainMenu', `Welcome back, ${username}!`);
        const coins = localStorage.getItem('coins') || '0';
        Logger.info('MainMenu', `You have ${coins} coins.`);

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
        

        // Thông tin người chơi (Đặt dưới tiêu đề một chút)
        this.add.text(centerX, centerY + 10, `Welcome back, ${username}! You have ${coins} coins.`, {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#00ff00'
        }).setOrigin(0.5);




        // ------------------------------
        // NÚT START GAME (Đặt ở giữa phần dưới)
        // ------------------------------
        this.createButton(centerX, centerY + 100, 'Play Now', () => {
            Logger.info('MainMenu', 'Start Game clicked');
            // Bắt đầu trò chơi, truyền tên người chơi
            this.scene.start('Game', {name: username});
        });

        // ------------------------------
        // NÚT CUSTOMIZE SNAKE (Đặt dưới nút Start)
        // ------------------------------
        this.createButton(centerX, centerY + 180, 'Customize Snake', () => {
            Logger.info('MainMenu', 'Customize clicked');
            this.scene.start('CustomizeScene');
        });


        // LOGOUT BUTTON 
        const isGuest = !localStorage.getItem('token');
        const logoutText = isGuest ? 'Login' : 'Logout';

        this.createButton(centerX, centerY + 260, logoutText, () => {
            Logger.info('MainMenu', 'Login/Logout clicked');
            // Xóa token và thông tin người dùng khỏi localStorage
            localStorage.clear();
            // Tải lại trang để hiển thị lại form đăng nhập
            location.reload();
        });
    }


    // ---------------------------------------
    // REUSABLE BUTTON FUNCTION
    // ---------------------------------------
    createButton(x, y, text, callback) {
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

        if (callback) {
            btn.on('pointerdown', callback);
            // Hack nhỏ để text cũng click được
            btnText.setInteractive({ useHandCursor: true });
            btnText.on('pointerdown', callback);
            btnText.on('pointerover', () => btn.emit('pointerover'));
            btnText.on('pointerout', () => btn.emit('pointerout'));
        }

        return btn;
    }
}