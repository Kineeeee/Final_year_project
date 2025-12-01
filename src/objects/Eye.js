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
        // Calculate angle to mouse relative to head rotation
        // We want the pupils to look at the mouse (for Player) or just forward/target (for Bot)
        // The reference Eye.js uses mouse position for ALL eyes?
        // "var mousePosX = this.game.input.activePointer.worldX;"
        // Yes, even for bots? 
        // In the reference, BotSnake extends Snake. Snake creates Eyes.
        // Eye.update() uses input.activePointer.
        // So even bots look at the player's mouse? That's funny.
        // Let's replicate that behavior if it's in the reference, or maybe make it smarter.
        // Actually, for a clone, usually bots look at their target.
        // But the reference code literally says `this.game.input.activePointer`.
        // I will stick to that for now as requested "based on the files".
        
        const pointer = this.scene.input.activePointer;
        const angleToMouse = PhaserMath.Angle.Between(
            this.head.x, this.head.y, 
            pointer.worldX, pointer.worldY
        );
        
        const relativeAngle = angleToMouse - this.head.rotation;
        
        // Constraint distance (based on eye size)
        // Original used whiteCircle.width * 0.25
        // My texture 'snake-eye' is 12px.
        const limit = (this.whiteCircle.width * this.scale) * 0.25;

        this.blackCircle.x = this.baseX + Math.cos(relativeAngle) * limit;
        this.blackCircle.y = this.baseY + Math.sin(relativeAngle) * limit;
    }
    
    destroy() {
        this.whiteCircle.destroy();
        this.blackCircle.destroy();
    }
}
