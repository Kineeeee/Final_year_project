import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Logger } from '../../utils/Logger';

export class HandShootingController {
    constructor(targetHand = 'Right') {
        this.targetHand = targetHand;
        this.video = null;
        this.landmarker = null;
        this.running = false;
        this.lastVideoTime = -1;

        // State Machine
        this.STATE_IDLE = 'IDLE';
        this.STATE_TRACKING = 'TRACKING';
        this.STATE_LOST = 'LOST';
        this.currentState = this.STATE_IDLE;

        // Performance Throttling
        this.lastDetectionTime = 0;
        this.detectionInterval = 33;

        // Output state
        this.reticlePosition = { x: 0.5, y: 0.5 };
        this.targetReticle = { x: 0.5, y: 0.5 };
        this.rawLandmarks = null; // For skeleton rendering

        // Gesture Debounce
        this.isShooting = false;
        this.pinchHistory = [];
        this.pinchConfirmFrames = 3;

        // EMA Smoothing Config
        this.alpha = 0.3; // Responsive but smooth

        // Config
        this.width = 640;
        this.height = 480;
    }

    async init() {
        try {
            Logger.info('HandShootingController', `Initializing MediaPipe HandLandmarker (Target: ${this.targetHand})...`);
            this.currentState = this.STATE_IDLE;
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            await this.setupCamera();
            this.running = true;
            this.loop();
            Logger.info('HandShootingController', 'Initialization Complete');
        } catch (error) {
            Logger.error('HandShootingController', 'Failed to init', error);
            this.currentState = this.STATE_LOST;
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.style.display = 'none';
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

            const now = performance.now();
            if (now - this.lastDetectionTime >= this.detectionInterval) {
                this.lastDetectionTime = now;
                const results = this.landmarker.detectForVideo(this.video, now);

                if (results.landmarks && results.landmarks.length > 0) {
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
                        this.currentState = this.STATE_TRACKING;
                    } else {
                        // Hand not logic-matched
                        this.currentState = this.STATE_LOST;
                        this.detectGesture(false); // Force release
                        this.rawLandmarks = null;
                    }
                } else {
                    // No hands in frame at all
                    this.currentState = this.STATE_LOST;
                    this.detectGesture(false);
                    this.rawLandmarks = null;
                }
            }
        }
        
        // SMOOTHING (Exponential Moving Average)
        this.reticlePosition.x += (this.targetReticle.x - this.reticlePosition.x) * this.alpha;
        this.reticlePosition.y += (this.targetReticle.y - this.reticlePosition.y) * this.alpha;

        requestAnimationFrame(() => this.loop());
    }

    updateTarget(landmarks) {
        this.rawLandmarks = landmarks;

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const midX = (thumbTip.x + indexTip.x) / 2;
        const midY = (thumbTip.y + indexTip.y) / 2;

        // Mirror for selfie camera
        this.targetReticle.x = 1.0 - midX;
        this.targetReticle.y = midY;

        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );

        // Raw pinch detection
        const PINCH_THRESHOLD = 0.05;
        const RELEASE_THRESHOLD = 0.08;
        
        let rawPinching = this.isShooting;
        if (this.isShooting) {
            if (distance > RELEASE_THRESHOLD) rawPinching = false;
        } else {
            if (distance < PINCH_THRESHOLD) rawPinching = true;
        }

        this.detectGesture(rawPinching);
    }

    detectGesture(rawIsPinching) {
        this.pinchHistory.push(rawIsPinching);
        if (this.pinchHistory.length > this.pinchConfirmFrames) {
            this.pinchHistory.shift();
        }

        const stablePinch = this.pinchHistory.every(Boolean) && this.pinchHistory.length === this.pinchConfirmFrames;
        const stableRelease = this.pinchHistory.every(val => !val) && this.pinchHistory.length === this.pinchConfirmFrames;

        if (stablePinch) this.isShooting = true;
        if (stableRelease) this.isShooting = false;
    }

    getInput() {
        return {
            x: this.reticlePosition.x,
            y: this.reticlePosition.y,
            isShooting: this.isShooting,
            video: this.video,
            state: this.currentState,
            landmarks: this.rawLandmarks
        };
    }

    cleanup() {
        this.running = false;
        if (this.video) {
            const stream = this.video.srcObject;
            if (stream) stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        if (this.landmarker) this.landmarker.close();
    }
}

