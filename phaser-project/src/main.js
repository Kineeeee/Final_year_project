import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { UIScene } from './scenes/UIScene';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { CustomizeScene } from './scenes/CustomizeScene';
import { ShopScene } from './scenes/ShopScene';
import { AuthManager } from './features/auth/AuthManager';

// Detect Mobile Device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const pixelRatio = window.devicePixelRatio || 1;
const resolution = Math.max(pixelRatio, 2.0);

// Config for Desktop (Responsive Full Screen)
let scaleConfig = {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
};

// Config for Mobile (High Definition)
if (isMobile) {
    scaleConfig = {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    };
}

const config = {
    type: Phaser.AUTO,
    resolution: resolution,
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    scale: scaleConfig,
    parent: 'game-container',
    backgroundColor: '#028af8',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CustomizeScene,
        Game,
        UIScene,
        ShopScene,
        GameOver
    ]
};

function startGame() {
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }
}

// Initialize Auth Manager (handles Login UI and calls startGame on success)
new AuthManager(startGame);

export { startGame };