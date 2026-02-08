import { Math as PhaserMath } from 'phaser';
import { EyePair } from './EyePair';
import { Shadow } from './Shadow';
import { Logger } from '../../utils/Logger';
import { CONFIG } from '../../config/constants';

export class Snake {
    constructor(scene, x, y, color, spriteKey = 'snake-circle', segmentPool = null) {
        this.scene = scene;
        this.body = [];
        this.segmentPool = segmentPool;
        this.headPosition = new PhaserMath.Vector2(x, y);
        this.alive = true;

        Logger.debug('Snake', 'Creating new snake at', x, y);

        // Server runs at 60fps. Base speed 3px/frame = 180px/s. Boost 6px/frame = 360px/s.
        this.slowSpeed = CONFIG.PHYSICS.BASE_SPEED_PPS;
        this.fastSpeed = CONFIG.PHYSICS.BOOST_SPEED_PPS;
        this.speed = this.slowSpeed;
        this.rotationSpeed = CONFIG.PHYSICS.ROTATION_SPEED_PPS; // Match Server Turn Speed
        this.scale = CONFIG.PHYSICS.PLAYER_SCALE_BASE; // Starting scale

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
        this.color = color !== undefined ? color : Phaser.Display.Color.RandomRGB().color;
        headSprite.setTint(this.color);
        this.head.add(headSprite);

        // Physics for head (for collision)
        scene.physics.add.existing(this.head);
        // Match Server Radius: 15 * scale
        const radius = CONFIG.PHYSICS.FOOD_RADIUS * this.scale;
        this.head.body.setCircle(radius);
        this.head.body.setOffset(-radius, -radius); // Center the body

        // 2. Eyes (Using EyePair)
        this.eyes = new EyePair(scene, this.head, 1); // Scale handled by container

        // Initialize body
        this.bodyGroup = scene.add.group();

        this.score = 0; // Track score/length locally

        // Path history for body to follow
        this.movePath = [];
        this.pixelsPerSegment = CONFIG.PHYSICS.PIXELS_PER_SEGMENT; // Distance-based spacing (independent of frame rate)
        this.totalDistance = 0; // Track total distance traveled

        // Growth Queue
        this.queuedSections = 0;

        // Initial length
        this.addSections(CONFIG.INITIAL_LENGTH);

        // Shadow
        this.shadow = new Shadow(scene, this);

        // Temp vector for calculations
        this._tempVector = new PhaserMath.Vector2();
    }

    setColor(color) {
        this.color = color;
        // Update Head (First child of container)
        const headSprite = this.head.getAt(0);
        if (headSprite) {
            headSprite.setTint(color);
        }
        // Update Body
        this.body.forEach(segment => segment.setTint(color));
    }

    setName(name) {
        this.name = name;
        if (this.nameText) this.nameText.destroy();
        this.nameText = this.scene.add.text(this.head.x, this.head.y - 25, name, {
            fontFamily: 'Arial',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(20);
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
        let bodyPart;

        if (this.segmentPool) {
            // Get from pool
            bodyPart = this.segmentPool.get(this.head.x, this.head.y, 'snake-circle');
            bodyPart.setActive(true).setVisible(true);
        } else {
            bodyPart = this.scene.add.image(this.head.x, this.head.y, 'snake-circle');
        }

        this.scene.physics.add.existing(bodyPart);

        // Match Server Radius
        const radius = CONFIG.PHYSICS.FOOD_RADIUS * this.scale;
        bodyPart.body.setCircle(radius);

        bodyPart.setDepth(5 - this.body.length * 0.001); // Ensure decreasing depth for tail
        bodyPart.setScale(this.scale);
        bodyPart.setTint(this.color); // Match head color
        this.body.push(bodyPart);
        // this.bodyGroup.add(bodyPart); // Removed usage of bodyGroup for segments to avoid removal issues with pool

        this.updateScale();

    }
    updateScale() {
        // Use score if available (synced from server), otherwise fallback to body length
        // Server formula: 0.6 + (10 + score) * 0.005
        // Client fallback: 0.6 + (10 + body.length) * 0.005 (approx)
        // Note: Server uses (10 + score), client previously used body.length.
        // Let's match server exactly.

        const score = this.score !== undefined ? this.score : this.body.length;
        let newScale = CONFIG.PHYSICS.PLAYER_SCALE_BASE + (CONFIG.INITIAL_LENGTH + score) * CONFIG.PHYSICS.PLAYER_SCALE_GROWTH;

        // Limit max scale
        if (newScale > 1.2) newScale = 1.2;

        this.setScale(newScale);
    }


    shrink() {
        // AUTHORTY SHIFT: Server controls when to shrink.
        // Server ensures score >= 0, so total length >= INITIAL_LENGTH.
        // We blindly execute the shrink command here.

        Logger.debug('Snake', 'Shrinking snake');
        if (this.body.length === 0) return;
        const lastPart = this.body.pop();

        if (this.segmentPool && this.segmentPool.contains(lastPart)) {
            this.segmentPool.killAndHide(lastPart);
            if (lastPart.body) lastPart.body.enable = false; // Disable physics
        } else {
            lastPart.destroy();
        }

        this.updateScale();


    }

    update(time, delta) {
        if (!this.alive) return;

        this.updateMovement(time, delta);
        this.updateBody();
        this.updateVisuals(time);

        // Update Eyes
        if (this.eyes) {
            this.eyes.update();
        }
    }

    updateMovement(time, delta) {
        // Movement logic (Head)
        // Use temp vector to avoid GC
        if (!this.isRemote) {
            this.scene.physics.velocityFromRotation(this.head.rotation, this.speed * (delta / 1000), this._tempVector);

            this.head.x += this._tempVector.x;
            this.head.y += this._tempVector.y;

            // Soft Server Reconciliation
            // If we have a server target, gently nudge towards it to prevent drift
            if (this.targetX !== undefined && this.targetY !== undefined) {
                const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, this.targetX, this.targetY);

                // If drift is small (> 5px), lerp slowly (0.05)
                // If drift is large (> 50px), lerp faster (0.1) or snap
                if (dist > 50) {
                    this.head.x = PhaserMath.Linear(this.head.x, this.targetX, 0.1);
                    this.head.y = PhaserMath.Linear(this.head.y, this.targetY, 0.1);
                } else if (dist > 5) {
                    this.head.x = PhaserMath.Linear(this.head.x, this.targetX, 0.05);
                    this.head.y = PhaserMath.Linear(this.head.y, this.targetY, 0.05);
                }
            }

            // RECONCILIATION: Rotation
            // Fixes "Direction mismatch over time"
            if (this.targetRotation !== undefined) {
                let diff = this.targetRotation - this.head.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                // If deviation is significant (> 10 degrees), gently correct it
                if (Math.abs(diff) > 0.17) {
                    this.head.rotation += diff * 0.05;
                }
            }
        } else {
            // DEAD RECKONING: Always move forward based on current velocity
            const moveAmount = this.speed * (delta / 1000);
            this.head.x += Math.cos(this.head.rotation) * moveAmount;
            this.head.y += Math.sin(this.head.rotation) * moveAmount;

            // RECONCILIATION: Smoothly correct position based on Server data
            if (this.targetX !== undefined && this.targetY !== undefined) {
                const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, this.targetX, this.targetY);

                if (dist > 2) {
                    // Smooth Lerp Factor
                    let t = 0.1 * (delta / 16.66);
                    if (t > 1) t = 1;

                    this.head.x = PhaserMath.Linear(this.head.x, this.targetX, t);
                    this.head.y = PhaserMath.Linear(this.head.y, this.targetY, t);
                }
            }

            // Rotation Interpolation
            if (this.targetRotation !== undefined) {
                let diff = this.targetRotation - this.head.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                let rotT = 0.15 * (delta / 16.66);
                if (rotT > 1) rotT = 1;
                this.head.rotation += diff * rotT;
            }
        }

        // Store position history
        let distMoved = 0;
        if (this.movePath.length > 0) {
            distMoved = PhaserMath.Distance.Between(this.head.x, this.head.y, this.movePath[0].x, this.movePath[0].y);
        }
        this.totalDistance += distMoved;

        this.movePath.unshift({ x: this.head.x, y: this.head.y, totalDist: this.totalDistance });
    }

    updateBody() {
        // Limit path history length
        const neededHistoryDist = (this.body.length + this.queuedSections + 5) * this.pixelsPerSegment;

        // Prune path points that are too old
        while (this.movePath.length > 1 && this.totalDistance - this.movePath[this.movePath.length - 1].totalDist > neededHistoryDist) {
            this.movePath.pop();
        }

        // Handle Growth
        if (this.queuedSections > 0) {
            const currentLen = this.body.length;
            const neededDist = (currentLen + 1) * this.pixelsPerSegment;
            // If we have enough history to place the new part
            if (this.movePath.length > 0 && this.totalDistance - this.movePath[this.movePath.length - 1].totalDist >= neededDist) {
                this.grow();
                this.queuedSections--;
            }
        }

        // Move body parts
        let pathIndex = 0;
        for (let i = 0; i < this.body.length; i++) {
            const part = this.body[i];
            const targetDist = this.totalDistance - (i + 1) * this.pixelsPerSegment;

            // Find the segment containing targetDist
            while (pathIndex < this.movePath.length - 1 && this.movePath[pathIndex + 1].totalDist > targetDist) {
                pathIndex++;
            }

            if (pathIndex < this.movePath.length - 1) {
                const p1 = this.movePath[pathIndex];
                const p2 = this.movePath[pathIndex + 1];

                // Interpolate
                const span = p1.totalDist - p2.totalDist;
                let t = 0;
                if (span > 0.001) {
                    t = (p1.totalDist - targetDist) / span;
                }

                part.x = p1.x + (p2.x - p1.x) * t;
                part.y = p1.y + (p2.y - p1.y) * t;
            } else {
                // Fallback
                const p = this.movePath[pathIndex];
                part.x = p.x;
                part.y = p.y;
            }
        }
    }

    updateVisuals(time) {
        // Low Quality Optimization
        if (CONFIG.GRAPHICS.LOW_QUALITY) {
            if (this.shadow) this.shadow.setVisible(false);
            return;
        }

        // Update Shadow
        if (this.shadow) {
            this.shadow.update();
        }

        // Update Name Text
        if (this.nameText) {
            this.nameText.setPosition(this.head.x, this.head.y - 25);
        }

        // Update Magnet Visuals (Wave Effect)
        if (this.isMagnetActive && this.magnetGraphics) {
            this.magnetGraphics.clear();
            const maxRadius = this.magnetRadius || 200;
            const waveCount = 3;
            const speed = 0.1;

            this.magnetGraphics.lineStyle(3 * this.scale, 0x008080, 0.8);

            const headRadius = CONFIG.PHYSICS.FOOD_RADIUS * this.scale;
            const effectiveMaxRadius = maxRadius + headRadius;

            for (let i = 0; i < waveCount; i++) {
                // Offset each wave
                const t = (time * speed + i * (effectiveMaxRadius / waveCount)) % effectiveMaxRadius;

                // Only draw if outside head
                if (t > headRadius) {
                    const alpha = 1 - ((t - headRadius) / maxRadius); // Fade out based on distance from head
                    this.magnetGraphics.lineStyle(3 * this.scale, 0x008080, alpha);
                    this.magnetGraphics.strokeCircle(this.head.x, this.head.y, t);
                }
            }
        }

        // Speed Effect Emission (Full Body)
        if (this.isSpeedActive && this.speedEmitter) {
            // Emit from head
            this.speedEmitter.emitParticleAt(this.head.x, this.head.y);

            // Emit from body (randomly to save performance/limit density)
            this.body.forEach(part => {
                if (Math.random() < 0.1) {
                    this.speedEmitter.emitParticleAt(part.x, part.y);
                }
            });
        }
    }

    setScale(scale) {
        this.scale = scale;
        this.head.setScale(scale);

        // Update Head Physics Body
        const radius = CONFIG.PHYSICS.FOOD_RADIUS * scale;
        if (this.head.body) {
            this.head.body.setCircle(radius);
            this.head.body.setOffset(-radius, -radius);
        }

        this.body.forEach(part => {
            part.setScale(scale);
            // Update Body Part Physics
            if (part.body) {
                part.body.setCircle(radius);
                // Images are centered by default, but setCircle might need offset if origin is 0.5
                // For Image with origin 0.5, body is top-left aligned to (x - w/2, y - h/2)
                // setCircle(r) sets it relative to that top-left.
                // If we want it centered, and width is 30*scale, and 2*r is 30*scale, offset is 0.
                // But let's be safe.
            }
        });
        // Shadow handles its own scale reading from snake.scale

        // Updates Speed Effect Scale
        if (this.speedEmitter && this.isSpeedActive) {
            // Emitter Swap Strategy:
            // Scaling the emitter container causes offset bugs.
            // Dynamic scaling function caused visibility bugs.
            // Solution: Retire the old emitter and create a new one with the new scale.

            const oldEmitter = this.speedEmitter;
            oldEmitter.emitting = false; // Stop emitting new particles (though we use manual emit anyway)
            // If we are manually emitting, just stopping logic usage is enough, but let's let existing particles fade.

            // Destroy after lifespan (400ms) + buffer
            this.scene.time.delayedCall(450, () => {
                if (oldEmitter) oldEmitter.destroy();
            });

            this.speedEmitter = null;
            this.setSpeedEffect(true); // Re-create with new 'this.scale'
        }
    }

    getLookAngle() {
        return this.head.rotation;
    }

    incrementSize() {
        this.addSections(1);
        // Optional: Increase scale slightly every X foods
        // this.setScale(this.scale + 0.001);
    }

    setGhostEffect(active) {
        const alpha = active ? 0.5 : 1.0;
        this.head.setAlpha(alpha);
        this.body.forEach(segment => segment.setAlpha(alpha));
        if (this.shadow) this.shadow.setVisible(!active);
    }

    setMagnetEffect(active, range) {
        if (active) {
            this.magnetRadius = range || 200; // Use buff value or default
            if (!this.magnetGraphics) {
                this.magnetGraphics = this.scene.add.graphics();
                this.magnetGraphics.setDepth(4);
            }
            this.magnetGraphics.setVisible(true);
            this.isMagnetActive = true;
        } else {
            if (this.magnetGraphics) {
                this.magnetGraphics.setVisible(false);
            }
            this.isMagnetActive = false;
        }
    }

    setSpeedEffect(active) {
        if (CONFIG.GRAPHICS.LOW_QUALITY) return;

        this.isSpeedActive = active;
        if (active) {
            if (!this.speedEmitter) {
                // Phaser 3.60+ / 3.90 Syntax
                // this.scene.add.particles(x, y, texture, config)
                this.speedEmitter = this.scene.add.particles(0, 0, 'snake-circle', {
                    speed: 100,
                    scale: { start: 1.7 * this.scale, end: 0 },
                    lifespan: 400,
                    blendMode: "NORMAL",
                    tint: 0x888888,
                    alpha: { start: 0.5, end: 0 },
                    emitting: false // Manual emission
                });
                this.speedEmitter.setDepth(4);
            }
            // No need to start(), we emit manually in update()
        } else {
            // Just stop emitting? Manual emission stops naturally if we don't call emit.
            // But we might want to clear existing particles? No, let them fade.
            if (this.speedEmitter) {
                this.speedEmitter.destroy();
                this.speedEmitter = null;
            }
        }
    }

    destroy() {
        this.alive = false;
        if (this.nameText) this.nameText.destroy();
        if (this.head) this.head.destroy();
        if (this.eyes) this.eyes.destroy();
        if (this.shadow) this.shadow.destroy();

        // Release body parts to pool
        this.body.forEach(part => {
            if (this.segmentPool && this.segmentPool.contains(part)) {
                this.segmentPool.killAndHide(part);
                if (part.body) part.body.enable = false;
            } else {
                part.destroy();
            }
        });

        if (this.bodyGroup) this.bodyGroup.destroy();

        // Effects Cleanup
        if (this.magnetGraphics) this.magnetGraphics.destroy();
        if (this.speedEmitter) this.speedEmitter.destroy();
    }
}
