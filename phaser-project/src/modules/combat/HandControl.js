import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Logger } from '../../utils/Logger';

export class HandShootingController {
    constructor(targetHand = 'Right') {
        this.targetHand = targetHand; // 'Left' or 'Right'
        this.video = null;
        this.landmarker = null;
        this.running = false;
        this.lastVideoTime = -1;

        // Performance Throttling
        this.lastDetectionTime = 0;
        this.detectionInterval = 33; // ~30 FPS (1000ms / 30)

        // Output state
        this.reticlePosition = { x: 0.5, y: 0.5 }; // Smoothed (Game uses this)
        this.targetReticle = { x: 0.5, y: 0.5 };   // Raw (From Vision)

        this.isShooting = false;
        this.gestureConfidence = 0;

        // Smoothing Config
        this.alpha = 0.1; // Lower alpha for smoother movement at high framerate

        // Config
        this.width = 640;
        this.height = 480;
    }

    async init() {
        try {
            Logger.info('HandShootingController', `Initializing MediaPipe HandLandmarker (Target: ${this.targetHand})...`);
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2 // Detect both to filter correctly
            });

            await this.setupCamera();
            this.running = true;
            this.loop();
            Logger.info('HandShootingController', 'Initialization Complete');
        } catch (error) {
            Logger.error('HandShootingController', 'Failed to init', error);
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.style.display = 'none'; // Hidden, we render to scene texture
        this.video.autoplay = true;
        this.video.playsInline = true;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: this.width },
                height: { ideal: this.height },
                facingMode: 'user'
            }
        });
        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    loop() {
        if (!this.running || !this.video || !this.landmarker) return;

        if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
            this.lastVideoTime = this.video.currentTime;

            // Run detection with Throttling
            const now = performance.now();
            if (now - this.lastDetectionTime >= this.detectionInterval) {
                this.lastDetectionTime = now;
                const results = this.landmarker.detectForVideo(this.video, now);

                if (results.landmarks && results.landmarks.length > 0) {
                    // Filter by Handedness
                    // MediaPipe Handedness: Label is 'Left' or 'Right'.
                    // IMPORTANT: In Selfie Mode (Mirrored), Left Hand appears as Right in image, but MediaPipe usually corrects this?
                    // Actually MediaPipe 'Left' usually means it LOOKS like a left hand (Thumb on right side of palm).
                    // But in mirrored video, your actual Left Hand appears on the Right side of the screen.
                    // MediaPipe analyzes the geometry.
                    // Let's rely on the label matching the "User's Intent".
                    // If user selects "Right Hand", they raise their physical Right Hand.
                    // In mirrored selfie video, that hand appears on the LEFT of the screen.
                    // MediaPipe labels it 'Left' usually because of the mirror.
                    // RULE OF THUMB: MediaPipe Label is usually the OPPOSITE of physical hand in selfie mode.
                    // Target: 'Right' (Physical) -> Search for 'Left' (Label)

                    // Let's stick to the prompt's warning:
                    // "Logic controls Left/Right match the user's perception (usually MediaPipe label will be opposite when mirror)"

                    const expectedLabel = this.targetHand === 'Right' ? 'Left' : 'Right';

                    let foundHand = null;

                    for (let i = 0; i < results.handedness.length; i++) {
                        const handInfo = results.handedness[i][0];
                        if (handInfo.categoryName === expectedLabel) {
                            foundHand = results.landmarks[i];
                            break;
                        }
                    }

                    if (foundHand) {
                        this.updateTarget(foundHand);
                    } else {
                        // Start easing off shooting if hand lost?
                        // Keep last position for smoothing but stop shooting
                        this.isShooting = false;
                    }
                }
            }
        }
        // SMOOTHING (Interpolate towards target every frame)
        this.reticlePosition.x += (this.targetReticle.x - this.reticlePosition.x) * this.alpha;
        this.reticlePosition.y += (this.targetReticle.y - this.reticlePosition.y) * this.alpha;

        requestAnimationFrame(() => this.loop());
    }

    updateTarget(landmarks) {
        // 1. Aiming: Midpoint between Thumb Tip (4) and Index Tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // Midpoint
        const midX = (thumbTip.x + indexTip.x) / 2;
        const midY = (thumbTip.y + indexTip.y) / 2;

        // Mirror X because it's a selfie camera
        const targetX = 1.0 - midX;
        const targetY = midY;

        // Set Raw Target (Smoothing handled in loop)
        this.targetReticle.x = targetX;
        this.targetReticle.y = targetY;

        // 2. Shooting Gesture: Pinch (Distance between 4 and 8)
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );

        // Fixed Threshold as requested
        const PINCH_THRESHOLD = 0.05;
        // Optional hysteresis? "Release threshold"
        const RELEASE_THRESHOLD = 0.08;

        if (this.isShooting) {
            if (distance > RELEASE_THRESHOLD) this.isShooting = false;
        } else {
            if (distance < PINCH_THRESHOLD) this.isShooting = true;
        }
    }

    /**
     * Returns the current state of input
     * @returns {Object} { x: number (0-1), y: number (0-1), isShooting: boolean, video: HTMLVideoElement }
     */
    getInput() {
        return {
            x: this.reticlePosition.x,
            y: this.reticlePosition.y,
            isShooting: this.isShooting,
            video: this.video
        };
    }

    cleanup() {
        this.running = false;
        if (this.video) {
            const stream = this.video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            this.video.srcObject = null;
        }
        if (this.landmarker) {
            this.landmarker.close();
        }
    }
}

