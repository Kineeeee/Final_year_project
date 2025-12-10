import { Eye } from './Eye';

export class EyePair {
    constructor(scene, headContainer, scale) {
        this.scene = scene;
        this.head = headContainer;
        this.scale = scale;
        
        // Calculate offsets based on head size (approx 30px width)
        // We want eyes at the "front" (Right side, +X) and separated by Y.
        // Reference logic was a bit different due to orientation, but we want it to look right.
        // Head radius 15.
        // Eyes at x=10 looks good (front).
        // y=8 and y=-8 looks good (side separation).
        
        const xOffset = 15;
        const yOffset = 15;
        
        this.leftEye = new Eye(scene, headContainer, xOffset, -yOffset, scale*0.9);
        this.rightEye = new Eye(scene, headContainer, xOffset, yOffset, scale*0.9);
    }

    update() {
        this.leftEye.update();
        this.rightEye.update();
    }
    
    destroy() {
        this.leftEye.destroy();
        this.rightEye.destroy();
    }
}
