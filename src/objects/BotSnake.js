import { Snake } from './Snake';
import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class BotSnake extends Snake {
    constructor(scene, x, y) {
        super(scene, x, y, 'snake-circle');
        this.trend = 1;
        this.turnChance = 0.02; // Chance to change direction per frame
        Logger.debug('BotSnake', 'Bot initialized');
        
        // AI State
        this.isAttacking = false;
        this.attackTimer = 0;
        this.cooldownTimer = 0;
        
        // Config
        this.minAttackLength = 10;
        this.attackDuration = 3000; // Max attack time (ms)
        this.cooldownDuration = 2000; // Time before attacking again (ms)
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
        const bounds = this.scene.physics.world.bounds;
        const margin = 100;
        
        let targetAngle = null;
        let shouldBoost = false;

        // Update Timers
        if (this.cooldownTimer > 0) this.cooldownTimer -= delta;

        // 1. Wall Avoidance (Highest Priority)
        if (this.head.x < bounds.x + margin) targetAngle = 0;
        else if (this.head.x > bounds.width - margin) targetAngle = Math.PI;
        else if (this.head.y < bounds.y + margin) targetAngle = Math.PI / 2;
        else if (this.head.y > bounds.height - margin) targetAngle = -Math.PI / 2;

        // 2. Collision Avoidance (High Priority)
        if (targetAngle === null) {
            const avoidanceAngle = this.getAvoidanceAngle();
            if (avoidanceAngle !== null) {
                targetAngle = avoidanceAngle;
            }
        }

        // 3. Decision Making (Food vs Attack vs Flee)
        if (targetAngle === null) {
            const canAttack = this.body.length >= this.minAttackLength;
            let enemy = this.findNearestEnemy();

            // Flee Logic (If small and threatened)
            if (!canAttack && enemy) {
                const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, enemy.head.x, enemy.head.y);
                if (dist < 300) {
                    // Run away!
                    const angleToEnemy = PhaserMath.Angle.Between(this.head.x, this.head.y, enemy.head.x, enemy.head.y);
                    targetAngle = angleToEnemy + Math.PI; // Turn opposite
                }
            }

            // Attack Logic
            if (canAttack && enemy && this.cooldownTimer <= 0) {
                const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, enemy.head.x, enemy.head.y);
                
                if (this.isAttacking) {
                    this.attackTimer += delta;
                    // Stop if timeout or enemy too far
                    if (this.attackTimer > this.attackDuration || dist > 600) {
                        this.isAttacking = false;
                        this.attackTimer = 0;
                        this.cooldownTimer = this.cooldownDuration;
                        enemy = null; // Stop targeting this frame
                    }
                } else {
                    // Start attack if close enough
                    if (dist < 400) {
                        this.isAttacking = true;
                        this.attackTimer = 0;
                    } else {
                        enemy = null;
                    }
                }

                if (enemy && this.isAttacking) {
                    // Intercept logic
                    const interceptX = enemy.head.x + Math.cos(enemy.head.rotation) * 150;
                    const interceptY = enemy.head.y + Math.sin(enemy.head.rotation) * 150;
                    targetAngle = PhaserMath.Angle.Between(this.head.x, this.head.y, interceptX, interceptY);
                    
                    if (dist < 250) shouldBoost = true;
                }
            } else {
                // Not attacking or cooling down
                this.isAttacking = false;
            }

            // Food Logic (Default if no other target)
            if (targetAngle === null) {
                const food = this.findNearestFood();
                if (food) {
                    targetAngle = PhaserMath.Angle.Between(this.head.x, this.head.y, food.x, food.y);
                }
            }
        }

        // Apply Rotation
        if (targetAngle !== null) {
            const turnSpeed = this.rotationSpeed * (delta / 2000) * (shouldBoost ? 2 : 1);
            this.head.rotation = PhaserMath.Angle.RotateTo(this.head.rotation, targetAngle, turnSpeed);
        } else {
            // Wander
            if (Math.random() < this.turnChance) this.trend *= -1;
            const rotationAmount = this.rotationSpeed * (delta / 2000);
            this.head.rotation += this.trend * rotationAmount;
        }

        // Apply Boost
        // Only change boost state if necessary to prevent flickering
        if (shouldBoost && this.body.length > 5) {
             if (this.speed !== this.fastSpeed) {
                 this.speed = this.fastSpeed;
                 if (this.shadow) this.shadow.setLightingUp(true);
             }
             this.burnMass(delta);
        } else {
             if (this.speed !== this.slowSpeed) {
                 this.speed = this.slowSpeed;
                 if (this.shadow) this.shadow.setLightingUp(false);
             }
        }
    }

    getAvoidanceAngle() {
        const scanRadius = 150;
        const scanFov = Math.PI / 1.5; // 120 degrees
        
        let closestThreat = null;
        let minDist = scanRadius;

        this.scene.snakes.forEach(snake => {
            if (snake === this || !snake.alive) return;

            // Check head
            let dist = PhaserMath.Distance.Between(this.head.x, this.head.y, snake.head.x, snake.head.y);
            if (dist < minDist && this.isInFront(snake.head, scanFov)) {
                minDist = dist;
                closestThreat = snake.head;
            }

            // Check body parts
            for (let i = 0; i < snake.body.length; i += 4) {
                const part = snake.body[i];
                dist = PhaserMath.Distance.Between(this.head.x, this.head.y, part.x, part.y);
                if (dist < minDist && this.isInFront(part, scanFov)) {
                    minDist = dist;
                    closestThreat = part;
                }
            }
        });

        if (closestThreat) {
            const angleToThreat = PhaserMath.Angle.Between(this.head.x, this.head.y, closestThreat.x, closestThreat.y);
            let angleDiff = angleToThreat - this.head.rotation;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Turn away
            const turnDir = angleDiff > 0 ? -1 : 1;
            return this.head.rotation + (turnDir * Math.PI / 2);
        }

        return null;
    }

    isInFront(target, fov) {
        const angleToTarget = PhaserMath.Angle.Between(this.head.x, this.head.y, target.x, target.y);
        let angleDiff = angleToTarget - this.head.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        return Math.abs(angleDiff) < fov / 2;
    }

    findNearestFood() {
        let nearest = null;
        let minDist = 400; // Look for food within radius
        this.scene.foodGroup.children.iterate(food => {
            if (!food.active) return;
            const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, food.x, food.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = food;
            }
        });
        return nearest;
    }

    findNearestEnemy() {
        let nearest = null;
        let minDist = 500;
        this.scene.snakes.forEach(snake => {
            if (snake === this || !snake.alive) return;
            const dist = PhaserMath.Distance.Between(this.head.x, this.head.y, snake.head.x, snake.head.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = snake;
            }
        });
        return nearest;
    }

    burnMass(delta) {
        this.burnTimer = (this.burnTimer || 0) + delta;
        if (this.burnTimer > 1000) {
            this.burnTimer = 0;
            const pos = this.shrink();
            if (pos && this.scene.spawnFood) {
                this.scene.spawnFood(pos.x, pos.y, this.color);
            }
        }
    }
}
