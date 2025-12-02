import { Math as PhaserMath } from 'phaser';
import { EyePair } from './EyePair';
import { Shadow } from './Shadow';
import { Logger } from '../utils/Logger';

export class Snake {
    constructor(scene, x, y, spriteKey = 'snake-circle') {
        this.scene = scene;
        this.body = [];
        this.headPosition = new PhaserMath.Vector2(x, y);
        this.alive = true;

        Logger.debug('Snake', 'Creating new snake at', x, y);

        this.slowSpeed = 150;
        this.fastSpeed = 300;
        this.speed = this.slowSpeed;
        this.rotationSpeed = 2 * Math.PI; // Radians per second
        this.scale = 0.6; // Starting scale (similar to reference)

        // Generate textures
        this.generateTextures(scene);

        // Create Container for the head
        this.head = scene.add.container(x, y);
        this.head.setDepth(10);
        this.head.snake = this; // Reference for Food
        this.head.setScale(this.scale);

        // 1. Head Circle (Base)
        // Reference uses 'circle' for both head and body.
        // I'll use 'snake-circle' (white) and tint it.
        const headSprite = scene.add.image(0, 0, spriteKey);
        // Random tint for variety, or specific if passed?
        // Reference doesn't show tinting logic, but for a clone, we usually want colors.
        // I'll assign a random color to this snake instance.
        this.color = Phaser.Display.Color.RandomRGB().color;
        headSprite.setTint(this.color);
        this.head.add(headSprite);
        
        // Physics for head (for collision)
        scene.physics.add.existing(this.head);
        this.head.body.setCircle(15); // Approximate radius
        this.head.body.setOffset(-15, -15); // Center the body

        // 2. Eyes (Using EyePair)
        this.eyes = new EyePair(scene, this.head, 1); // Scale handled by container

        // Initialize body
        this.bodyGroup = scene.add.group();
        
        // Path history for body to follow
        this.movePath = [];
        this.sectionLength = 4; // Distance between body parts (in frames/updates approx)
        
        // Growth Queue
        this.queuedSections = 0;
        
        // Initial length
        this.addSections(10);

        // Shadow
        this.shadow = new Shadow(scene, this);
        
        // Temp vector for calculations
        this._tempVector = new PhaserMath.Vector2();
    }

    generateTextures(scene) {
        if (!scene.textures.exists('snake-circle')) {
            const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

            // Circle (White) - Used for Head and Body
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(15, 15, 15);
            graphics.generateTexture('snake-circle', 30, 30);
            graphics.clear();

            // Eye (White Circle)
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(6, 6, 6);
            graphics.generateTexture('snake-eye', 12, 12);
            graphics.clear();

            // Pupil (Black Circle)
            graphics.fillStyle(0x000000, 1);
            graphics.fillCircle(3, 3, 3);
            graphics.generateTexture('snake-pupil', 6, 6);
            graphics.clear();

            // Shadow (White blurred circle)
            if (!scene.textures.exists('snake-shadow')) {
                graphics.fillStyle(0xffffff, 1);
                graphics.fillCircle(15, 15, 15);
                graphics.generateTexture('snake-shadow', 30, 30);
            }
        }
    }

    addSections(amount) {
        this.queuedSections += amount;
    }

    grow() {
        Logger.debug('Snake', 'Growing snake');
        const bodyPart = this.scene.add.image(this.head.x, this.head.y, 'snake-circle');
        this.scene.physics.add.existing(bodyPart);
        bodyPart.body.setCircle(15);
        
        bodyPart.setDepth(5);
        bodyPart.setScale(this.scale);
        bodyPart.setTint(this.color); // Match head color
        this.body.push(bodyPart);
        this.bodyGroup.add(bodyPart);

        this.updateScale();

    }
    updateScale() {
        // Optional: Slightly increase scale based on length
        let newScale = 0.6 + this.body.length * 0.002;
        
        // Limit max scale
        if (newScale > 1.2) newScale = 1.2;
        
        this.setScale(newScale);
    }
    

    shrink() {
        // Keep a minimum size, e.g., 3 body parts
        if (this.body.length <= 3) return null;

        Logger.debug('Snake', 'Shrinking snake');
        const lastPart = this.body.pop();
        const position = { x: lastPart.x, y: lastPart.y };
        
        // Remove from group and destroy
        this.bodyGroup.remove(lastPart);
        lastPart.destroy();
        
        return position;
    }

    update(time, delta) {
        if (!this.alive) return;

        // Movement logic (Head)
        // Use temp vector to avoid GC
        this.scene.physics.velocityFromRotation(this.head.rotation, this.speed * (delta / 1000), this._tempVector);

        this.head.x += this._tempVector.x;
        this.head.y += this._tempVector.y;

        // Update Eyes
        if (this.eyes) {
            this.eyes.update();
        }

        // Store position history
        this.movePath.unshift({ x: this.head.x, y: this.head.y });

        // Limit path history length
        // We need enough history for all body parts
        // sectionLength is roughly "frames per section"
        const neededHistory = (this.body.length + this.queuedSections) * this.sectionLength + 100;
        if (this.movePath.length > neededHistory) {
            this.movePath.pop();
        }

        // Handle Growth
        if (this.queuedSections > 0) {
            // Add one section per few frames or just one per update?
            // Let's add one per update if we have path history
            const targetIndex = (this.body.length + 1) * this.sectionLength;
            if (this.movePath.length > targetIndex) {
                this.grow();
                this.queuedSections--;
            }
        }

        // Move body parts
        let pathIndex = this.sectionLength;
        for (let i = 0; i < this.body.length; i++) {
            const part = this.body[i];
            if (this.movePath[pathIndex]) {
                part.x = this.movePath[pathIndex].x;
                part.y = this.movePath[pathIndex].y;
            }
            pathIndex += this.sectionLength;
        }

        // Update Shadow
        if (this.shadow) {
            this.shadow.update();
        }
    }
    
    setScale(scale) {
        this.scale = scale;
        this.head.setScale(scale);
        this.body.forEach(part => part.setScale(scale));
        // Shadow handles its own scale reading from snake.scale
    }

    getLookAngle() {
        return this.head.rotation;
    }

    incrementSize() {
        this.addSections(1);
        // Optional: Increase scale slightly every X foods
        // this.setScale(this.scale + 0.001);
    }
    
    destroy() {
        this.head.destroy();
        if (this.eyes) this.eyes.destroy();
        if (this.shadow) this.shadow.destroy();
        this.body.forEach(part => part.destroy());
        this.bodyGroup.destroy();
    }
}
