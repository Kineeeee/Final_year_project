export class Shadow {
    constructor(scene, snake) {
        this.scene = scene;
        this.snake = snake;
        this.shadowGroup = scene.add.group();
        this.shadows = [];

        this.isLightingUp = false;
        this.lightStep = 0;
        this.maxLightStep = 3;

        // Tints (Matched to reference shadow.js)
        this.darkTint = 0xaaaaaa;
        this.lightTintBright = 0xaa3333;
        this.lightTintDim = 0xdd3333;

        // Create initial shadows for existing body
        this.initShadows();
    }

    initShadows() {
        // Clear existing
        this.shadows.forEach(s => s.destroy());
        this.shadows = [];
        this.shadowGroup.clear(true, true);

        // Create a shadow for the head
        this.addShadow(this.snake.head.x, this.snake.head.y);

        // Create shadows for the body
        this.snake.body.forEach(part => {
            this.addShadow(part.x, part.y);
        });
    }

    addShadow(x, y) {
        const shadow = this.scene.add.image(x, y, 'snake-shadow');
        shadow.setDepth(0); // Below everything
        shadow.setScale(this.snake.scale);
        // Reference shadow.js: shadow.alpha = 1; shadow.naturalAlpha = 1;
        // But it also says "since the image is white... various tints... darkTint = 0xaaaaaa"
        // If I use 0xaaaaaa on white, it becomes grey.
        // Reference update: "shadow.tint = this.darkTint;"
        shadow.setTint(this.darkTint);
        this.shadowGroup.add(shadow);
        this.shadows.push(shadow);
        return shadow;
    }

    update() {
        // Sync shadows with snake parts
        // Index 0 is head
        if (this.shadows[0]) {
            this.shadows[0].x = this.snake.head.x;
            this.shadows[0].y = this.snake.head.y;
            this.shadows[0].setScale(this.snake.scale);
        }

        // Rest are body parts
        for (let i = 0; i < this.snake.body.length; i++) {
            const shadowIndex = i + 1;
            if (this.shadows[shadowIndex]) {
                this.shadows[shadowIndex].x = this.snake.body[i].x;
                this.shadows[shadowIndex].y = this.snake.body[i].y;
                this.shadows[shadowIndex].setScale(this.snake.scale);
            } else {
                // If we have more body parts than shadows (growth), add one
                this.addShadow(this.snake.body[i].x, this.snake.body[i].y);
            }
        }

        // Remove excess shadows (if snake shrank)
        while (this.shadows.length > this.snake.body.length + 1) {
            const removedShadow = this.shadows.pop();
            removedShadow.destroy();
        }

        // Handle Lighting Effect
        if (this.isLightingUp) {
            this.lightUp();
        } else {
            this.shadows.forEach(shadow => {
                shadow.setTint(this.darkTint);
                // Reference doesn't explicitly set alpha to 0.3 in update loop for dark mode, 
                // but it sets alpha to 1 or 0 based on position overlap.
                // I'll stick to tinting.
                shadow.setAlpha(1);
            });
        }
    }

    lightUp() {
        this.lightStep++;
        if (this.lightStep >= this.maxLightStep) this.lightStep = 0;

        this.shadows.forEach((shadow, i) => {
            shadow.setAlpha(1);

            // Alternating pattern
            if ((i - this.lightStep) % this.maxLightStep === 0) {
                shadow.setTint(this.lightTintBright);
            } else {
                shadow.setTint(this.lightTintDim);
            }
        });
    }

    setLightingUp(value) {
        this.isLightingUp = value;
    }

    setVisible(value) {
        this.shadowGroup.setVisible(value);
    }

    destroy() {
        this.shadowGroup.destroy(true);
    }
}
