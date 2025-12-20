import { Math as PhaserMath } from 'phaser';
import { Logger } from '../utils/Logger';

export class Food extends Phaser.GameObjects.Image {
    constructor(scene, x, y, color) {
        super(scene, x, y, 'food');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set color (random if not provided)
        if (color === undefined) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
            this.setTint(colors[Math.floor(Math.random() * colors.length)]);
        } else {
            this.setTint(color);
        }

        this.target = null;
        this.speed = 800;
        this.magnetDistance = 15; // Distance to be considered "eaten"
    }

    preUpdate(time, delta) {
        // If we have a target (snake head), move towards it
        if (this.target) {
            // Nếu mục tiêu (đầu rắn) đã bị huỷ (ví dụ rắn chết), thì xoá thức ăn luôn
            if (!this.target.active) {
                this.destroy();
                return;
            }

            const angle = PhaserMath.Angle.Between(this.x, this.y, this.target.x, this.target.y);
            const velocity = new PhaserMath.Vector2();
            this.scene.physics.velocityFromRotation(angle, this.speed, velocity);

            this.x += velocity.x * (delta / 1000);
            this.y += velocity.y * (delta / 1000);

            // Check if we reached the target
            const distance = PhaserMath.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (distance < this.magnetDistance) {
                this.eat();
            }
        }

        if (this.type === 'coin') {
            // 1. Xoay tròn
            this.rotation += 0.05;

            // 2. Lấp lánh (Thay đổi độ sáng/alpha hoặc scale nhẹ)
            this.shineTimer += delta;

            // Tạo hiệu ứng nhấp nháy scale nhẹ (Pulse)
            const scalePulse = 1.5 + Math.sin(this.shineTimer * 0.005) * 0.1;
            this.setScale(scalePulse);

            // Hoặc hiệu ứng đổi màu nhẹ (nếu muốn)
            // const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
            //     Phaser.Display.Color.ValueToColor(0xFFD700), // Vàng
            //     Phaser.Display.Color.ValueToColor(0xFFFFFF), // Trắng
            //     100,
            //     Math.floor(Math.abs(Math.sin(this.shineTimer * 0.005)) * 100)
            // );
            // this.setTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
        }
    }

    magnetTo(head) {
        this.target = head;
        // Disable physics body to prevent multiple collisions/overlaps while moving
        if (this.body) {
            this.body.enable = false;
        }
    }




    eat() {
        Logger.debug('Food', 'Food eaten');
        // REMOVED LOCAL GROWTH: Growth is handled by Game.js upon receiving Server Score Update


        this.target = null; // Clear target immediately
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            this.body.stop(); // Stop velocity
            this.body.enable = false;
        }
    }

    onSpawn(x, y, color) {
        this.setActive(true);
        this.setVisible(true);

        if (this.body) {
            this.body.enable = true;
            this.body.reset(x, y); // Reset position and velocity
        } else {
            this.setPosition(x, y);
        }

        this.target = null;

        if (color === undefined) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
            this.setTint(colors[Math.floor(Math.random() * colors.length)]);
        } else {
            this.setTint(color);
        }
    }
}
