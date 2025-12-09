import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { UIScene } from './scenes/UIScene';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { CustomizeScene } from './scenes/CustomizeScene';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#028af8',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
  },
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
