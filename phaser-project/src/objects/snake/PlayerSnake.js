import { Snake } from './Snake';
import { Math as PhaserMath } from 'phaser';
import { Logger } from '../../utils/Logger';

export class PlayerSnake extends Snake {
    constructor(scene, x, y, color) {
        // Pass 'snake-circle' to match base class default, or let it default
        super(scene, x, y, color, 'snake-circle');

        // Input keys
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        Logger.info('PlayerSnake', 'Player initialized at', x, y);
    }

    update(time, delta) {
        if (!this.alive) return;

        // 1. Handle Input
        this.handleInput(delta);

        // 2. Move (Base class update)
        super.update(time, delta);

        // 3. Update Visuals (Pupils) - Handled by EyePair in base class
    }

    handleInput(delta) {
        // Check for mobile
        const isMobile = !this.scene.sys.game.device.os.desktop || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // On mobile, input is handled by Game.js -> UIScene. 
        // We skip local input handling here to avoid conflicts (e.g. touching joystick triggering boost).
        if (isMobile) return;

        // Only handle Boost input locally for visual feedback/state
        // Rotation is handled by Server (via Game.js sending input and receiving updates)

        // Speed Boost
        // REMOVED LOCAL PREDICTION: Visuals now updated via Server State in Game.js
    }

    getLookAngle() {
        // Check for mobile
        const isMobile = !this.scene.sys.game.device.os.desktop || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // On mobile, look angle is determined by the joystick (handled in Game.js)
            // or defaults to current rotation if no input.
            // We return the current rotation so the eyes look forward by default.
            // If Game.js overrides the angle with joystick input, the eyes will update naturally
            // because the head rotates to that angle.
            return this.rotation;
        }

        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;

        // Use Screen Center for steering
        const centerX = cam.width / 2;
        const centerY = cam.height / 2;

        return PhaserMath.Angle.Between(
            centerX, centerY,
            pointer.x, pointer.y
        );
    }
}
