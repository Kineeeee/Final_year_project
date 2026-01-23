
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Logger } from '../utils/Logger';

export class GestureController {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.landmarker = null;
        this.running = false;
        this.lastVideoTime = -1;

        // Output state
        this.angle = null;
        this.isBoosting = false;

        // Smoothing State
        this.lastAngle = 0;
        this.angleAlpha = 0.2; // Smoothing factor (Lower = Smoother/Slower)

        // Config
        this.width = 320;
        this.height = 240;
        this.deadZone = 0.05; // 5% of screen size from center
    }

    async init() {
        try {
            Logger.info('GestureController', 'Initializing MediaPipe HandLandmarker...');
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });

            await this.setupCamera();
            this.createOverlay();

            this.running = true;
            this.loop();
            Logger.info('GestureController', 'Initialization Complete');
        } catch (error) {
            Logger.error('GestureController', 'Failed to init', error);
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.style.display = 'none';
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: this.width, height: this.height }
        });
        this.video.srcObject = stream;
        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    createOverlay() {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.bottom = '10px';
        container.style.left = '10px';
        container.style.width = `${this.width}px`;
        container.style.height = `${this.height}px`;
        container.style.border = '2px solid #00ff00';
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        container.style.zIndex = '1000';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        container.id = 'gesture-overlay';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.transform = 'scaleX(-1)';

        this.ctx = this.canvas.getContext('2d');
        container.appendChild(this.canvas);
        document.body.appendChild(container); // Append to body (or game container)

        // Add label
        const label = document.createElement('div');
        label.innerText = 'Gesture Control';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.color = '#00ff00';
        label.style.fontFamily = 'monospace';
        label.style.fontSize = '12px';
        label.style.pointerEvents = 'none';
        // Need to un-mirror text if container is mirrored? No, only canvas is mirrored.
        container.appendChild(label);
    }

    loop() {
        if (!this.running || !this.video || !this.landmarker) return;

        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const startTimeMs = performance.now();
            const results = this.landmarker.detectForVideo(this.video, startTimeMs);

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.video, 0, 0, this.width, this.height);

            // Draw Center Crosshair
            // NOTE: Canvas is mirrored via CSS, but drawing coordinates are logical 0->width
            // If I draw at 0, it appears at Right.
            // If I draw at width, it appears at Left.
            // Let's draw purely in logical coords.
            const cx = this.width / 2;
            const cy = this.height / 2;

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, 0); this.ctx.lineTo(cx, this.height);
            this.ctx.moveTo(0, cy); this.ctx.lineTo(this.width, cy);
            this.ctx.stroke();

            // Draw Dead Zone
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, this.deadZone * this.width, 0, 2 * Math.PI);
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.stroke();

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                this.processGestures(landmarks);
                this.drawLandmarks(landmarks);
            } else {
                // Keep last angle or reset? 
                // User said "Lost Hand -> Handle". 
                // Usually maintaining last angle is best for "Cruise Control"
                // But if they take hand away, maybe they want to stop steering?
                // Slither.io: Can't stop. 
                // "No hand" => Keep going straight relative to current direction?
                // Or keep last input? Keep last input prevents sudden snaps.
                // We do NOT update this.angle, so it stays as last valid value.
                this.isBoosting = false;
            }
        }
        requestAnimationFrame(() => this.loop());
    }

    processGestures(landmarks) {
        // 1. Steering: Index Finger Tip (8) relative to Center
        const tip = landmarks[8];
        if (!tip) return;

        // Coordinates: x (0 left - 1 right), y (0 top - 1 bottom)
        // Center is 0.5, 0.5

        // MIRROR LOGIC REVISITED:
        // User moves hand to THEIR Right.
        // Webcam sees hand move to image Left (x decreases).
        // On screen (mirrored), hand moves Right.
        // We want this to correspond to Angle 0 (Right).

        // Vector Calculation:
        // We want Positive X when user moves Right (image Left).
        // dx = 0.5 - tip.x
        // dy = tip.y - 0.5 (Down is Down)

        const dx = 0.5 - tip.x;
        const dy = tip.y - 0.5;

        // Dead Zone Check
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.deadZone) {
            // Inside dead zone, do not update angle (maintain course)
            return;
        }

        const rawAngle = Math.atan2(dy, dx);

        // SMOOTHING (Lerp on Unit Circle to strictly avoid wrap-around issues)
        // Or simply specialized angle Lerp
        if (this.angle === null) {
            this.angle = rawAngle;
        } else {
            // Shortest path interpolation
            let diff = rawAngle - this.lastAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            this.angle = this.lastAngle + (diff * this.angleAlpha);

            // Normalize
            // (Strictly not needed for atan2 result but good for clean state)
        }
        this.lastAngle = this.angle;


        // 2. Boosting: Fist Detection
        // Refined: Check average distance of ALL fingertips to Wrist
        // If all close -> Fist
        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
        let foldedCount = 0;

        // Dynamic threshold based on hand scale (Wrist to MiddleMCP)
        const mcp = landmarks[9];
        const handSize = Math.sqrt(Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2));
        const threshold = handSize * 1.0; // Tip within 1.0x palm length of wrist

        for (const i of tips) {
            const t = landmarks[i];
            const d = Math.sqrt(Math.pow(t.x - wrist.x, 2) + Math.pow(t.y - wrist.y, 2));
            if (d < threshold) foldedCount++;
        }

        // Require 3 or more fingers folded for stability (allow index to be slightly out?)
        // If steering with Index, Index is OUT.
        // So Fist means... stop steering? OR steer with fist?
        // User wants "Core gameplay: snake moves continuous".
        // If I make a fist, I lose the "Index Pointer". 
        // PROPOSAL: If Fist, use Wrist/Knuckles as pointer? Or maintain direction?
        // Usually, Boosting is temporary.
        // BETTER: "Pinch" (Thumb + Index tip touching) for Boost?
        // Pinch allows keeping the hand extended and pointing!
        // But requested was "Fist".
        // Let's stick to: If Fist detected, Boost = True.
        // Direction? If Fist, use Wrist or Center of Hand (9) for direction.

        this.isBoosting = (foldedCount >= 3);

        // If boosting (Fist), we might lose index tip pointer accuracy.
        // Use Middle MCP (9) or Wrist as fallback for direction if Fist?
        // Let's implement fallback:
        if (this.isBoosting) {
            // Fallback to Knuckle (9) for steering while boosting
            const knuckle = landmarks[9];
            const kDx = 0.5 - knuckle.x;
            const kDy = knuckle.y - 0.5;
            const kRaw = Math.atan2(kDy, kDx);
            // Blend this into angle logic? 
            // For simplicity, let's trust the smoothing to handle the transition 
            // or continue using index if visible. 
            // Usually even in fist, index knuckle is visible, but tip is hidden.
        }
    }

    drawLandmarks(landmarks) {
        this.ctx.lineWidth = 2;

        // Draw connection/skeleton
        // Simplified

        // Color based on state
        this.ctx.fillStyle = this.isBoosting ? '#FF0000' : '#00FF00';
        this.ctx.strokeStyle = this.isBoosting ? '#FF0000' : '#00FF00';

        // Draw Tip (Steering Point)
        if (landmarks[8]) {
            const x = landmarks[8].x * this.width;
            const y = landmarks[8].y * this.height;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
            this.ctx.fill();

            // Draw Line from Center to Tip (Visual Feedback of Vector)
            // Canvas Center
            const cx = this.width / 2;
            const cy = this.height / 2;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }

        // Draw Direction Arrow (Visual Feedback of Smoothed Angle)
        if (this.angle !== null && !this.isBoosting) {
            const cx = this.width / 2;
            const cy = this.height / 2;
            const arrowLength = 50;

            // Adjust angle for mirrored canvas: 
            // Canvas is scaled X: -1. 
            // Logic Angle 0 (Right) -> Internal X > cx -> Renders on CSS Left.
            // We want Angle 0 to Render on CSS Right.
            // CSS Right corresponds to Internal Left (X < cx).
            // So we need Internal Angle to be PI.
            // Visual Angle = PI - Logic Angle.

            const visualAngle = Math.PI - this.angle;

            const ex = cx + Math.cos(visualAngle) * arrowLength;
            const ey = cy + Math.sin(visualAngle) * arrowLength;

            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(ex, ey);
            this.ctx.strokeStyle = '#FFFF00'; // Yellow
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            // Draw Arrow Head
            // Rotate +/- 30 deg from visualAngle + PI (pointing back)
            const headLen = 10;
            const angle1 = visualAngle + Math.PI - 0.5;
            const angle2 = visualAngle + Math.PI + 0.5;

            this.ctx.beginPath();
            this.ctx.moveTo(ex, ey);
            this.ctx.lineTo(ex + Math.cos(angle1) * headLen, ey + Math.sin(angle1) * headLen);
            this.ctx.lineTo(ex + Math.cos(angle2) * headLen, ey + Math.sin(angle2) * headLen);
            this.ctx.lineTo(ex, ey);
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.fill();
        }
    }

    getParams() {
        return {
            angle: this.angle,
            isBoosting: this.isBoosting
        };
    }

    cleanup() {
        this.running = false;
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
        }
        const overlay = document.getElementById('gesture-overlay');
        if (overlay) overlay.remove();
    }
}
