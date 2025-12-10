import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { UIScene } from './scenes/UIScene';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { CustomizeScene } from './scenes/CustomizeScene';

// Detect Mobile Device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Calculate resolution
// Force at least 2.0 for sharpness, cap at 3.0
const pixelRatio = window.devicePixelRatio || 1;
const resolution = Math.max(pixelRatio, 2.0);

// Config for Desktop (Fixed Size, Fit to Screen)
let scaleConfig = {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
};

// Config for Mobile (HD Resolution, Fit to Screen)
if (isMobile) {
    // Get actual screen dimensions
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Ensure we calculate based on Landscape orientation
    const landscapeWidth = Math.max(w, h);
    const landscapeHeight = Math.min(w, h);
    
    // Calculate Aspect Ratio
    const aspectRatio = landscapeWidth / landscapeHeight;
    
    // Set HD Resolution (Base Height = 720p)
    // Width is calculated to match device aspect ratio (No black bars)
    const hdHeight = 720;
    const hdWidth = Math.round(hdHeight * aspectRatio);

    scaleConfig = {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: hdWidth,
        height: hdHeight
    };
}

const config = {
  type: Phaser.AUTO,
  // High DPI support for sharper visuals on mobile
  resolution: resolution,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  // Use the dynamic scale config
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
    GameOver
  ]
};

export default new Phaser.Game(config);