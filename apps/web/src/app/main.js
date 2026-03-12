import { Boot } from '../scenes/Boot';
import { Game } from '../scenes/Game';
import { UIScene } from '../scenes/UIScene';
import { GameOver } from '../scenes/GameOver';
import { MainMenu } from '../scenes/MainMenu';
import { Preloader } from '../scenes/Preloader';
import { CustomizeScene } from '../scenes/CustomizeScene';
import { ShopScene } from '../modules/shop/ShopScene';
import { ShootingScene } from '../modules/combat/ShootingScene';
import { HowToPlayScene } from '../scenes/HowToPlayScene';
import { AuthManager } from '../modules/auth/AuthManager';
import { AchievementsScene } from '../modules/achievements/AchievementsScene';
import { SettingsScene } from '../scenes/SettingsScene';

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// Detect Mobile Device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const pixelRatio = window.devicePixelRatio || 1;
const resolution = Math.max(pixelRatio, 2.0);

// Keep a fixed reference canvas (1280x720) and scale to FIT the screen.
// FIT shows all content (no cropping); side letterboxing is filled with page background.
const scaleConfig = {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT
};

const config = {
    type: Phaser.AUTO,
    resolution: resolution,
    render: {
        antialias: true,
        pixelArt: true,   // keep sprites/text crisp when scaled down
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
        ShootingScene,
        AchievementsScene,
        SettingsScene,
        HowToPlayScene,
        GameOver
    ]
};

function startGame() {
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }
}

// Match body/background color to game to mask letterboxing areas on extreme aspect ratios.
if (typeof document !== 'undefined') {
    const container = document.getElementById('game-container');
    if (container) {
        container.style.backgroundColor = '#028af8';
    }
    document.body.style.backgroundColor = '#028af8';
}

// Initialize Auth Manager (handles Login UI and calls startGame on success)
new AuthManager(startGame);

export { startGame };
