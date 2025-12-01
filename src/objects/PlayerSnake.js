import { Snake } from './Snake';
import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class PlayerSnake extends Snake {
    constructor(scene, x, y) {
        // Pass 'snake-circle' to match base class default, or let it default
        super(scene, x, y, 'snake-circle');
        
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
        const pointer = this.scene.input.activePointer;
        const targetAngle = PhaserMath.Angle.Between(
            this.head.x, this.head.y,
            pointer.worldX, pointer.worldY
        );

        // Smooth rotation
        let currentAngle = this.head.rotation;
        if (targetAngle - currentAngle > Math.PI) currentAngle += Math.PI * 2;
        else if (currentAngle - targetAngle > Math.PI) currentAngle -= Math.PI * 2;

        const maxRotation = this.rotationSpeed * (delta / 1000);
        const diff = targetAngle - currentAngle;

        if (Math.abs(diff) < maxRotation) {
            this.head.rotation = targetAngle;
        } else {
            this.head.rotation += (diff > 0 ? maxRotation : -maxRotation);
        }

        // Speed Boost
        const canBoost = this.body.length > 3;
        if ((this.spaceKey.isDown || this.scene.input.activePointer.isDown) && canBoost) {
            if (this.speed !== this.fastSpeed) {
                Logger.debug('PlayerSnake', 'Boosting started');
            }
            this.speed = this.fastSpeed;
            if (this.shadow) this.shadow.setLightingUp(true);
            
            // Shrink logic
            this.burnMass(delta);
        } else {
            if (this.speed !== this.slowSpeed) {
                Logger.debug('PlayerSnake', 'Boosting stopped');
            }
            this.speed = this.slowSpeed;
            if (this.shadow) this.shadow.setLightingUp(false);
        }
    }

    burnMass(delta) {
        this.burnTimer = (this.burnTimer || 0) + delta;
        if (this.burnTimer > 1000) { // Slower burn rate (every 500ms)
            this.burnTimer = 0;
            const pos = this.shrink();
            if (pos) {
                // Spawn food behind
                if (this.scene.spawnFood) {
                    this.scene.spawnFood(pos.x, pos.y, this.color);
                }
            }
        }
    }
}
