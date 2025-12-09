import { Snake } from './Snake';
import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class PlayerSnake extends Snake {
    constructor(scene, x, y, color) {
        // Pass 'snake-circle' to match base class default, or let it default
        super(scene, x, y, color, 'snake-circle');
        
        // Input keys
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        Logger.info('PlayerSnake', 'Player initialized at', x, y);
    }

    update(time, delta) {
        if (!this.alive) return;

        // 1. Handle Input
        this.handleInput(delta);

        // 2. Move (Base class update)
        super.update(time, delta);
        
        // 3. Update Visuals (Pupils) - Handled by EyePair in base class
    }

    handleInput(delta) {
        // Only handle Boost input locally for visual feedback/state
        // Rotation is handled by Server (via Game.js sending input and receiving updates)
        
        // Speed Boost
        // Match Server Condition: score > 2
        const canBoost = this.score > 2;
        if ((this.spaceKey.isDown || this.scene.input.activePointer.isDown) && canBoost) {
            if (this.speed !== this.fastSpeed) {
                Logger.debug('PlayerSnake', 'Boosting started');
            }
            this.speed = this.fastSpeed;
            if (this.shadow) this.shadow.setLightingUp(true);
            
            // Shrink logic is handled by Server updates in Game.js
        } else {
            if (this.speed !== this.slowSpeed) {
                Logger.debug('PlayerSnake', 'Boosting stopped');
            }
            this.speed = this.slowSpeed;
            if (this.shadow) this.shadow.setLightingUp(false);
        }
    }

    getLookAngle() {
        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;
        
        // Use Screen Center for steering
        const centerX = cam.width / 2;
        const centerY = cam.height / 2;
        
        return PhaserMath.Angle.Between(
            centerX, centerY,
            pointer.x, pointer.y
        );
    }
}
