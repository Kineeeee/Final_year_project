import { COLORS } from '../../ui/UIConstants';
export class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.joystick = null;
        this.boostBtn = null;
        this.isBoosting = false;

        this.createControls();
    }

    createControls() {
        // Enable multi-touch
        this.scene.input.addPointer(3);

        // Joystick (Requires Rex Plugin)
        if (this.scene.plugins.get('rexvirtualjoystickplugin')) {
            this.joystick = this.scene.plugins.get('rexvirtualjoystickplugin').add(this.scene, {
                x: 0,
                y: 0,
                radius: 100, // Will be updated in resize
                base: this.scene.add.circle(0, 0, 100, 0x888888).setAlpha(0.5).setDepth(100),
                thumb: this.scene.add.circle(0, 0, 50, 0xcccccc).setAlpha(0.8).setDepth(101),
                dir: '8dir',
                forceMin: 16,
                enable: true
            });
        }

        // Boost Button
        this.boostBtn = this.scene.add.circle(0, 0, 80, 0xff0000)
            .setAlpha(0.5)
            .setInteractive()
            .setDepth(100);

        this.boostBtn.on('pointerdown', () => {
            this.isBoosting = true;
            this.boostBtn.setAlpha(1);
        });
        this.boostBtn.on('pointerup', () => {
            this.isBoosting = false;
            this.boostBtn.setAlpha(0.5);
        });
        this.boostBtn.on('pointerout', () => {
            this.isBoosting = false;
            this.boostBtn.setAlpha(0.5);
        });
    }

    resize(safeArea) {
        // Larger controls for HD resolution
        // Radius: Mobile = 130, Tablet? 
        const joyRadius = 130;
        const btnRadius = 90;
        const padding = 20;

        if (this.joystick) {
            // Position: Bottom Left (Inside Safe Area)
            // x = left + radius + padding
            // y = bottom - radius - padding
            const jX = safeArea.left + joyRadius + padding;
            const jY = safeArea.bottom - joyRadius - padding;

            this.joystick.setPosition(jX, jY);
            // Update radius visual if needed, but usually fixed works fine.
            // Note: Plugin setPosition might update visuals automatically.
        }

        if (this.boostBtn) {
            // Position: Bottom Right
            const bX = safeArea.right - btnRadius - padding;
            const bY = safeArea.bottom - btnRadius - padding;

            this.boostBtn.setPosition(bX, bY);
            this.boostBtn.setRadius(btnRadius);
        }
    }

    getInput() {
        if (!this.joystick) return null;
        return {
            angle: this.joystick.force > 0 ? Phaser.Math.DegToRad(this.joystick.angle) : null,
            isBoosting: this.isBoosting
        };
    }
}
