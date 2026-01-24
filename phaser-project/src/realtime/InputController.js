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

        if (!scene.isMobile) {
            // DESKTOP: Always Mouse
            angle = player.getLookAngle();
            isBoosting = player.spaceKey.isDown || scene.input.activePointer.isDown;
        }

        return { angle, isBoosting };
    }
}
