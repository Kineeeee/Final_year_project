import { Math as PhaserMath } from 'phaser';

export class Coin extends Phaser.GameObjects.Container {
    constructor(scene, x, y, id, value) {
        super(scene, x, y);
        scene.add.existing(this);
        // Physics for the container
        scene.physics.add.existing(this);

        this.id = id;
        this.value = value;
        this.type = 'coin';

        // 1. Background Circle (Gold)
        const bg = scene.add.circle(0, 0, 12, 0xFFD700);
        bg.setStrokeStyle(2, 0xFFFFFF);
        this.add(bg);

        // 2. Dollar Symbol
        const text = scene.add.text(0, 0, '$', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add(text);

        // Physics body size (circular)
        this.body.setCircle(12);
        this.body.setOffset(-12, -12);

        // Animation properties
        this.wobbleTimer = Math.random() * 100;

        this.target = null;
        this.speed = 900; // Slightly faster than food
        this.magnetDistance = 15;
    }

    preUpdate(time, delta) {
        // Wobble Animation
        this.wobbleTimer += delta * 0.005;
        this.rotation = Math.sin(this.wobbleTimer) * 0.2; // +/- 0.2 radians
        this.scale = 1.0 + Math.sin(this.wobbleTimer * 2) * 0.1; // Pulse size

        // Magnet Logic (Server-driven trigger)
        if (this.target) {
            if (!this.target.active) {
                this.destroy();
                return;
            }

            const angle = PhaserMath.Angle.Between(this.x, this.y, this.target.x, this.target.y);
            const velocity = new PhaserMath.Vector2();
            this.scene.physics.velocityFromRotation(angle, this.speed, velocity);

            this.x += velocity.x * (delta / 1000);
            this.y += velocity.y * (delta / 1000);

            // Check if reached
            const distance = PhaserMath.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (distance < this.magnetDistance) {
                this.eat();
            }
        }
    }

    magnetTo(head) {
        this.target = head;
        if (this.body) this.body.enable = false;
    }

    eat() {
        // Just destroy visuals. Logic is server-side.
        this.destroy();
    }
}
