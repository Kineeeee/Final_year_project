import { GameObjects } from 'phaser';

export class Target extends GameObjects.Container {
    constructor(scene, x, y, type = 'standard', text = '', isCorrect = false) {
        super(scene, x, y);
        this.type = type; // 'standard', 'mystery', 'answer'
        this.text = text;
        this.isCorrect = isCorrect;
        this.scene = scene;
        this.active = true;

        // Config based on type
        this.radius = type === 'answer' ? 50 : (type === 'mystery' ? 30 : 40);
        this.speed = type === 'mystery' ? 200 : (type === 'answer' ? 80 : 100);

        // Score value
        if (type === 'answer') {
            this.scoreValue = isCorrect ? 100 : -50;
        } else {
            this.scoreValue = type === 'mystery' ? 50 : 10;
        }

        this.velocityX = 0;
        this.velocityY = 0;

        this.createVisuals();
        this.scene.add.existing(this);
    }

    createVisuals() {
        const graphics = this.scene.add.graphics();
        let color = 0x00ffff; // Standard (Cyan)

        if (this.type === 'mystery') color = 0xff00ff; // Pink
        if (this.type === 'answer') color = 0x00ff00; // Greenish (but maybe hide logic?)
        // Let's make all answers same color to avoid spoilers, or different shapes?
        // User said "ngoài các loại bia ngắm còn lại hãy thêm 1 loại bia ngắm nữa là answer"
        // Let's make answer targets look distinct but uniform.
        if (this.type === 'answer') color = 0xffaa00; // Gold/Orange

        // Glow
        graphics.lineStyle(4, color, 1);
        graphics.fillStyle(color, 0.2);

        if (this.type === 'mystery') {
            graphics.fillCircle(0, 0, this.radius);
            graphics.strokeCircle(0, 0, this.radius);
        } else if (this.type === 'answer') {
            // Hexagon for answers
            this.drawHexagon(graphics, this.radius);
        } else {
            // Square/Diamond
            graphics.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            graphics.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        }

        this.add(graphics);

        // Core (not for answers as it blocks text)
        if (this.type !== 'answer') {
            const core = this.scene.add.circle(0, 0, 5, 0xffffff, 1);
            this.add(core);
        }

        // Text (if answer)
        if (this.text) {
            const label = this.scene.add.text(0, 0, this.text, {
                fontFamily: '"Monospace"',
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.add(label);
        }

        // Spin tween
        this.scene.tweens.add({
            targets: this,
            angle: 360,
            duration: this.type === 'mystery' ? 1000 : 3000,
            repeat: -1
        });
    }

    drawHexagon(graphics, radius) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Phaser.Math.DegToRad(60 * i);
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true, true);
    }

    setVelocity(vx, vy) {
        this.velocityX = vx;
        this.velocityY = vy;
    }

    update(delta) {
        this.x += this.velocityX * (delta / 1000);
        this.y += this.velocityY * (delta / 1000);

        const buffer = 100;
        if (this.x < -buffer || this.x > this.scene.scale.width + buffer ||
            this.y < -buffer || this.y > this.scene.scale.height + buffer) {
            this.destroy();
        }
    }

    hit() {
        this.destroy();
        return this.scoreValue;
    }
}
