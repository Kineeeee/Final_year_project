export class InputController {
    constructor(scene) {
        this.scene = scene;
    }

    // Returns { angle, isBoosting } or null
    getPlayerInputIntent() {
        const scene = this.scene;
        const player = scene.player;
        if (!player || !player.alive) return null;

        let angle;
        let isBoosting = false;

        if (scene.isMobile) {
            // MOBILE: Only use Joystick input
            angle = player.rotation;

            const uiScene = scene.scene.get('UIScene');
            if (uiScene && uiScene.getMobileInput) {
                const mobileInput = uiScene.getMobileInput();
                if (mobileInput) {
                    if (mobileInput.angle !== null) {
                        angle = mobileInput.angle;
                    }
                    isBoosting = mobileInput.isBoosting;
                }
            }

            return { angle, isBoosting };
        }

        // DESKTOP
        let gestureActive = false;

        if (
            scene.controlMode === 'GESTURE' &&
            scene.gestureController &&
            scene.gestureController.running
        ) {
            const gestureParams = scene.gestureController.getParams();

            if (gestureParams.angle !== null) {
                angle = gestureParams.angle;
                isBoosting = gestureParams.isBoosting;
                gestureActive = true;
            } else {
                // Lost hand tracking: fall back to last known angle
                if (scene.gestureController.angle !== null) {
                    angle = scene.gestureController.angle;
                    isBoosting = false;
                    gestureActive = true;
                }
            }
        }

        if (!gestureActive) {
            if (scene.controlMode === 'MOUSE') {
                angle = player.getLookAngle();
                isBoosting = player.spaceKey.isDown || scene.input.activePointer.isDown;
            } else if (scene.controlMode === 'GESTURE') {
                if (typeof angle === 'undefined') angle = player.rotation;
            }
        }

        return { angle, isBoosting };
    }
}
