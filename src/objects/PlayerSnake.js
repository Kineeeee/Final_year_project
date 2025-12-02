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
        const cam = this.scene.cameras.main;

        // Use Screen Coordinates for steering
        // This prevents the "stale world position" bug where the snake turns around
        // if the mouse is stationary but the camera moves.
        
        // Get Head position on screen
        // Reuse _tempVector from base class to avoid GC
        // Manually calculate screen position: (WorldPos - ScrollPos) * Zoom
        const headScreenX = (this.head.x - cam.scrollX) * cam.zoom;
        const headScreenY = (this.head.y - cam.scrollY) * cam.zoom;
        
        // Calculate distance in screen space
        const dist = PhaserMath.Distance.Between(headScreenX, headScreenY, pointer.x, pointer.y);
        
        if (dist > 20) {
            // Calculate angle relative to screen
            const targetAngle = PhaserMath.Angle.Between(
                headScreenX, headScreenY,
                pointer.x, pointer.y
            );

            // Use Phaser's built-in RotateTo for robust shortest-path rotation
            const turnSpeed = this.rotationSpeed * (delta / 2000);
            this.head.rotation = PhaserMath.Angle.RotateTo(this.head.rotation, targetAngle, turnSpeed);
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

    getLookAngle() {
        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;
        
        // Manually calculate screen position: (WorldPos - ScrollPos) * Zoom
        const headScreenX = (this.head.x - cam.scrollX) * cam.zoom;
        const headScreenY = (this.head.y - cam.scrollY) * cam.zoom;
        
        return PhaserMath.Angle.Between(
            headScreenX, headScreenY,
            pointer.x, pointer.y
        );
    }
}
