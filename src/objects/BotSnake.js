import { Snake } from './Snake';
import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class BotSnake extends Snake {
    constructor(scene, x, y) {
        super(scene, x, y, 'snake-circle');
        this.trend = 1;
        this.turnChance = 0.02; // Chance to change direction per frame
        Logger.debug('BotSnake', 'Bot initialized');
    }

    update(time, delta) {
        if (!this.alive) return;

        // 1. AI Logic
        this.handleAI(delta);

        // 2. Move
        super.update(time, delta);
        
        // 3. Visuals (Pupils) - Handled by EyePair in base class
    }

    handleAI(delta) {
        // Randomly change turn direction
        if (Math.random() < this.turnChance) {
            this.trend *= -1;
        }

        // Rotate
        const rotationAmount = this.rotationSpeed * (delta / 1000) * 0.5; // Turn slower than max speed
        this.head.rotation += this.trend * rotationAmount;

        // Optional: Avoid walls (simple)
        const margin = 100;
        const bounds = this.scene.physics.world.bounds;
        if (this.head.x < bounds.x + margin) this.head.rotation = 0;
        else if (this.head.x > bounds.width - margin) this.head.rotation = Math.PI;
        else if (this.head.y < bounds.y + margin) this.head.rotation = Math.PI / 2;
        else if (this.head.y > bounds.height - margin) this.head.rotation = -Math.PI / 2;
    }
}
