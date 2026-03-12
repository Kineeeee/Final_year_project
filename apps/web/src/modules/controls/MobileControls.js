import { COLORS } from '../../ui/UIConstants';
export class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.joystick = null;
        this.boostBtn = null;
        this.isBoosting = false;
        this._fallback = {
            active: false,
            pointerId: null,
            angle: null,
            radius: 100,
            centerX: 0,
            centerY: 0,
            base: null,
            thumb: null,
        };
        this._pointerHandlers = [];

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
        } else {
            this.createFallbackJoystick();
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

    createFallbackJoystick() {
        const base = this.scene.add.circle(0, 0, this._fallback.radius, 0x888888).setAlpha(0.35).setDepth(100);
        const thumb = this.scene.add.circle(0, 0, 45, 0xcccccc).setAlpha(0.75).setDepth(101);
        this._fallback.base = base;
        this._fallback.thumb = thumb;

        const onPointerDown = (pointer) => {
            const { centerX } = this._fallback;
            if (pointer.x > centerX + this._fallback.radius) return;
            this._fallback.active = true;
            this._fallback.pointerId = pointer.id;
            this.updateFallbackThumb(pointer.x, pointer.y);
        };

        const onPointerMove = (pointer) => {
            if (!this._fallback.active || this._fallback.pointerId !== pointer.id) return;
            this.updateFallbackThumb(pointer.x, pointer.y);
        };

        const onPointerUp = (pointer) => {
            if (this._fallback.pointerId !== pointer.id) return;
            this.resetFallbackThumb();
        };

        this.scene.input.on('pointerdown', onPointerDown);
        this.scene.input.on('pointermove', onPointerMove);
        this.scene.input.on('pointerup', onPointerUp);
        this.scene.input.on('pointerupoutside', onPointerUp);

        this._pointerHandlers = [
            ['pointerdown', onPointerDown],
            ['pointermove', onPointerMove],
            ['pointerup', onPointerUp],
            ['pointerupoutside', onPointerUp],
        ];
    }

    updateFallbackThumb(x, y) {
        const dx = x - this._fallback.centerX;
        const dy = y - this._fallback.centerY;
        const dist = Math.hypot(dx, dy);
        const radius = this._fallback.radius;
        const clamp = dist > radius ? radius / dist : 1;

        const tx = this._fallback.centerX + dx * clamp;
        const ty = this._fallback.centerY + dy * clamp;
        this._fallback.thumb.setPosition(tx, ty);

        if (dist > 12) {
            this._fallback.angle = Phaser.Math.Angle.Between(this._fallback.centerX, this._fallback.centerY, tx, ty);
        } else {
            this._fallback.angle = null;
        }
    }

    resetFallbackThumb() {
        this._fallback.active = false;
        this._fallback.pointerId = null;
        this._fallback.angle = null;
        this._fallback.thumb.setPosition(this._fallback.centerX, this._fallback.centerY);
    }

    resize(safeArea) {
        // Scale controls based on available safe area so they don't cover UI.
        const joyRadius = Math.max(70, safeArea.controlRadius || 120);
        const btnRadius = Math.max(60, Math.round(joyRadius * 0.7));
        const padding = safeArea.controlPadding || 20;

        if (this.joystick) {
            const jX = safeArea.left + joyRadius + padding;
            const jY = safeArea.bottom - joyRadius - padding;

            this.joystick.setPosition(jX, jY);
            if (typeof this.joystick.radius !== 'undefined') {
                this.joystick.radius = joyRadius;
            }
            // Keep visuals in sync with the logical radius.
            if (this.joystick.base?.setRadius) {
                this.joystick.base.setRadius(joyRadius);
            }
            if (this.joystick.thumb?.setRadius) {
                this.joystick.thumb.setRadius(Math.max(36, joyRadius * 0.45));
            }
        } else if (this._fallback.base && this._fallback.thumb) {
            const jX = safeArea.left + joyRadius + padding;
            const jY = safeArea.bottom - joyRadius - padding;
            this._fallback.radius = joyRadius;
            this._fallback.centerX = jX;
            this._fallback.centerY = jY;
            this._fallback.base.setRadius(joyRadius);
            this._fallback.base.setPosition(jX, jY);
            this._fallback.thumb.setRadius(Math.max(36, joyRadius * 0.45));
            if (!this._fallback.active) {
                this._fallback.thumb.setPosition(jX, jY);
            }
        }

        if (this.boostBtn) {
            const bX = safeArea.right - btnRadius - padding;
            const bY = safeArea.bottom - btnRadius - padding;

            this.boostBtn.setPosition(bX, bY);
            this.boostBtn.setRadius(btnRadius);
        }
    }

    getInput() {
        if (!this.joystick && !this._fallback.base) return null;

        if (!this.joystick) {
            return {
                angle: this._fallback.angle,
                isBoosting: this.isBoosting,
            };
        }

        return {
            angle: this.joystick.force > 0 ? Phaser.Math.DegToRad(this.joystick.angle) : null,
            isBoosting: this.isBoosting
        };
    }

    destroy() {
        this._pointerHandlers.forEach(([evt, fn]) => this.scene.input.off(evt, fn));
        this._pointerHandlers = [];

        if (this._fallback.base) this._fallback.base.destroy();
        if (this._fallback.thumb) this._fallback.thumb.destroy();
        this._fallback.base = null;
        this._fallback.thumb = null;

        if (this.boostBtn) this.boostBtn.destroy();
        this.boostBtn = null;

        if (this.joystick && this.joystick.destroy) this.joystick.destroy();
        this.joystick = null;
    }
}
