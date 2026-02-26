import { COLORS } from '../../ui/UIConstants';
import { CONFIG } from '../../config/constants';

export class Minimap {
    constructor(scene) {
        this.scene = scene;
        this.size = 150; // Map display size (px)
        this.scale = this.size / CONFIG.WORLD_WIDTH; // Scaling factor

        this.createElements();
    }

    createElements() {
        // Container
        this.container = this.scene.add.container(0, 0).setDepth(90); // Below HUD text

        // Background
        this.bg = this.scene.add
            .rectangle(0, 0, this.size, this.size, 0x000000, 0.5)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0xffffff);
        this.container.add(this.bg);

        // Food Layer (Graphics)
        this.foodGraphics = this.scene.add.graphics();
        this.container.add(this.foodGraphics);

        // Player Dot (Green)
        this.playerDot = this.scene.add.circle(0, 0, 3, 0x00ff00);
        this.container.add(this.playerDot);

        // Hide initially
        this.container.setVisible(true);
    }

    resize(safeArea) {
        // Position Bottom-Right
        // safeArea.right, safeArea.bottom
        // Just above the Mobile Controls (if any)?
        // Let's verify Mobile Controls position. Usually bottom-left or bottom-right.
        // Assuming Bottom-Left for Joystick, Bottom-Right for Button.
        // Let's put Minimap Top-Left? Or Top-Right below HUD?
        // User requested UI Map. Bottom-Right is standard but conflicts with boost button.
        // Let's put it Bottom-Right but shifted up, or Bottom-Center?
        // Safe bet: Bottom-Right, offset by margin.

        const margin = 20;
        const x = safeArea.right - this.size - margin;
        const y = safeArea.bottom - this.size - margin;

        this.container.setPosition(x, y);
    }

    updatePlayerPosition(x, y) {
        // Map World (0..10000) to Map (0..150)
        this.playerDot.x = x * this.scale;
        this.playerDot.y = y * this.scale;
    }

    updateFood(foodData) {
        // foodData is the full object { id: {x,y,color...} } provided by Game.js
        this.foodGraphics.clear();

        // Optimization: Don't draw every single dot if too many?
        // Simple dot drawing is fast in Canvas/WebGL.

        // Draw Dots
        Object.values(foodData).forEach((f) => {
            // Filter: Standard Food only? Or Coins too?
            // Density implies all food.
            let color = 0xffffff;
            let alpha = 0.5;
            let size = 1;

            if (f.type === 'coin') {
                color = 0xffd700;
                size = 2;
                alpha = 0.8;
            } else if (f.type === 'text') {
                color = 0x00ffff;
                size = 3;
                alpha = 1;
            } else {
                // Regular food
                color = f.color || 0xffffff;
            }

            this.foodGraphics.fillStyle(color, alpha);
            this.foodGraphics.fillPoint(f.x * this.scale, f.y * this.scale, size);
        });
    }
}
