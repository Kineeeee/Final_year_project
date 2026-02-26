import { Math as PhaserMath } from 'phaser';

export class Eye {
    constructor(scene, headContainer, x, y, scale) {
        this.scene = scene;
        this.head = headContainer;
        this.scale = scale;
        
        // White Circle (Sclera)
        this.whiteCircle = scene.add.image(x, y, 'snake-eye');
        this.whiteCircle.setScale(scale);
        headContainer.add(this.whiteCircle);

        // Black Circle (Pupil)
        this.blackCircle = scene.add.image(x, y, 'snake-pupil');
        this.blackCircle.setScale(scale);
        headContainer.add(this.blackCircle);

        // Store initial relative position
        this.baseX = x;
        this.baseY = y;
    }

    update() {
        // Calculate look angle
        let lookAngle = this.head.rotation;
        
        // Check for mobile
        const isMobile = !this.scene.sys.game.device.os.desktop || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (!isMobile && this.head.snake && typeof this.head.snake.getLookAngle === 'function') {
            // Only use getLookAngle (mouse pointer) on Desktop
            lookAngle = this.head.snake.getLookAngle();
        } else {
            // On Mobile, or for other snakes, look forward (same as head rotation)
            lookAngle = this.head.rotation;
        }
        
        const relativeAngle = lookAngle - this.head.rotation;
        
        // Constraint distance (based on eye size)
        const limit = (this.whiteCircle.width * this.scale) * 0.25;

        this.blackCircle.x = this.baseX + Math.cos(relativeAngle) * limit;
        this.blackCircle.y = this.baseY + Math.sin(relativeAngle) * limit;
    }
    
    destroy() {
        this.whiteCircle.destroy();
        this.blackCircle.destroy();
    }
}
