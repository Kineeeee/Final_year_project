import { Scene } from 'phaser';
import { HandShootingController } from './HandControl';
import { Target } from './Target';
import { quizService } from '../../core/services/QuizService';
import { Logger } from '../../utils/Logger';
import { i18n } from '../../core/services/I18nService';

export class ShootingScene extends Scene {
    constructor() {
        super('ShootingScene');
        this.handController = null;
        this.videoTexture = null;
        this.reticle = null;

        // Input Fallback State
        this.inputMode = 'CAMERA'; // 'CAMERA' or 'MOUSE'

        // Game State
        this.selectedHand = null;
        this.isPlaying = false;
        this.targets = [];
        this.score = 0;
        this.scoreText = null;
        this.spawnTimer = null;

        // Overlay & State UI
        this.minimap = null;
        this.minimapBorder = null;
        this.skeletonGraphics = null;
        this.stateWarningText = null;
        this.wasLost = false;

        // Quiz State
        this.currentQuestion = null;
        this.questionText = null;
        this.answerQueue = [];
        this.spawnedAnswers = [];
        this.questionDelay = 3000;
        this.isWaitingForQuestion = false;

        this.lastShotTime = 0;
        this.shootCooldown = 400;
        this.category = 'math';
        this.quizSource = 'SYSTEM';
    }

    init(data) {
        this.category = data?.category || 'math';
        this.quizSource = (data?.quizSource || 'SYSTEM').toUpperCase();
    }

    create() {
        Logger.info('ShootingScene', 'Initializing Shooting Scene');

        // Dark minimalist background instead of noisy camera
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111827).setOrigin(0);

        // Fallback Mouse listener
        this.input.on('pointermove', (pointer) => {
            if (this.inputMode === 'CAMERA' && this.handController && this.handController.currentState === 'LOST') {
                this.inputMode = 'MOUSE';
                this.showFloatingText(this.scale.width / 2, this.scale.height - 100, i18n.t('scene.shooting.mouseMode'), '#4CAF50');
                if (this.reticle) this.reticle.setAlpha(0.2); // Dim hand cursor
            } else if (this.inputMode === 'MOUSE' && this.handController && this.handController.currentState === 'TRACKING') {
                // Auto recover to camera
                this.inputMode = 'CAMERA';
                this.showFloatingText(this.scale.width / 2, this.scale.height - 100, i18n.t('scene.shooting.cameraMode'), '#00FFFF');
                if (this.reticle) this.reticle.setAlpha(1.0);
            }
        });

        this.input.on('pointerdown', (pointer) => {
            if (this.inputMode === 'MOUSE' && this.isPlaying && this.time.now > this.lastShotTime + this.shootCooldown) {
                this.fireShot(pointer.x, pointer.y);
                this.lastShotTime = this.time.now;
            }
        });

        // Hand Selection UI
        this.createHandSelectionUI();
    }

    createHandSelectionUI() {
        this.selectionGroup = this.add.container(0, 0);
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        const title = this.add.text(cx, cy - 150, i18n.t('scene.shooting.selectHand'), {
            fontFamily: '"Monospace"',
            fontSize: '36px',
            color: '#00ffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const btnLeft = this.createCyberButton(cx - 150, cy, i18n.t('scene.shooting.leftHand'), () => this.startGame('Left'));
        const btnRight = this.createCyberButton(cx + 150, cy, i18n.t('scene.shooting.rightHand'), () => this.startGame('Right'));

        const exit = this.add.text(cx, cy + 150, i18n.t('scene.shooting.backMenu'), {
            fontFamily: 'Monospace',
            fontSize: '20px',
            color: '#888888'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'));

        this.selectionGroup.add([title, btnLeft, btnRight, exit]);
    }

    createCyberButton(x, y, text, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 220, 80, 0x000000);
        bg.setStrokeStyle(4, 0x00ffff);

        const label = this.add.text(0, 0, text, {
            fontFamily: '"Monospace"',
            fontSize: '24px',
            color: '#00ffff'
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(220, 80);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => { bg.setFillStyle(0x00ffff); label.setColor('#000000'); });
        btn.on('pointerout', () => { bg.setFillStyle(0x000000); label.setColor('#00ffff'); });
        btn.on('pointerdown', callback);

        return btn;
    }

    async startGame(hand) {
        this.selectedHand = hand;
        this.selectionGroup.destroy();

        // Show Loading
        const loadingText = this.add.text(this.scale.width / 2, this.scale.height / 2, i18n.t('scene.shooting.loadingModel'), {
            fontFamily: 'Monospace', fontSize: '24px', color: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Init Controller
        this.handController = new HandShootingController(this.selectedHand);
        await this.handController.init();
        loadingText.destroy();

        this.isPlaying = true;
        this.inputMode = 'CAMERA';

        // Init Game UI
        this.createGameUI();
        this.createReticle();
        this.createParticles();

        // Fetch Questions
        const questions = await quizService.fetchQuestions(this.category, this.quizSource);
        if (!questions || questions.length === 0) {
            this.isPlaying = false;
            if (this.spawnTimer) this.spawnTimer.remove();
            this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, i18n.t('scene.shooting.noQuestions'), {
                fontFamily: '"Monospace"', fontSize: '24px', color: '#ff5555'
            }).setOrigin(0.5);
            const backBtn = this.createCyberButton(this.scale.width / 2, this.scale.height / 2 + 30, i18n.t('scene.shooting.backMenu'), () => this.returnToMenu());
            this.add.existing(backBtn);
            return;
        }

        // Start Loops
        this.spawnTimer = this.time.addEvent({
            delay: 1500,
            callback: this.spawnTarget,
            callbackScope: this,
            loop: true
        });

        this.nextQuestion();
    }

    createGameUI() {
        this.scoreText = this.add.text(30, 30, i18n.t('scene.shooting.score') + '0', {
            fontFamily: '"Monospace"',
            fontSize: '32px',
            color: '#00ffff',
            shadow: { offsetX: 2, offsetY: 2, color: '#ff00ff', blur: 4, stroke: true, fill: true }
        });

        // Question Container
        this.questionContainer = this.add.container(this.scale.width / 2, 80);
        const qBg = this.add.rectangle(0, 0, 800, 100, 0x000000, 0.7);
        qBg.setStrokeStyle(2, 0xffaa00);

        this.questionText = this.add.text(0, 0, 'Loading...', {
            fontFamily: '"Monospace"',
            fontSize: '28px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 750 }
        }).setOrigin(0.5);

        this.questionContainer.add([qBg, this.questionText]);
        this.questionContainer.setVisible(false);

        // State Warning overlay (hidden by default)
        this.stateWarningText = this.add.text(this.scale.width / 2, this.scale.height / 2, i18n.t('scene.shooting.lostWarning'), {
            fontFamily: 'Monospace', fontSize: '36px', color: '#ff4444', fontStyle: 'bold', align: 'center',
            backgroundColor: '#000000dd', padding: { x: 40, y: 30 }
        }).setOrigin(0.5).setDepth(2000).setVisible(false);

        // Exit
        this.add.text(30, 80, '< ' + i18n.t('scene.shooting.backMenu'), {
            fontFamily: 'Monospace', fontSize: '20px', color: '#ffffff', backgroundColor: '#333333'
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.returnToMenu());

        // Instruction
        this.add.text(this.scale.width / 2, this.scale.height - 40, i18n.t('scene.shooting.instructions'), {
            fontFamily: '"Monospace"',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#00000088'
        }).setOrigin(0.5);
    }

    createReticle() {
        this.reticle = this.add.circle(0, 0, 20, 0x00ffff, 0.3);
        this.reticle.setStrokeStyle(3, 0xff00ff);
        this.reticle.setDepth(100);
        this.reticleDot = this.add.circle(0, 0, 4, 0xffffff, 1).setDepth(101);
    }

    createParticles() {
        this.explosionManager = this.add.particles(0, 0, 'flare', {
            lifespan: 800, speed: { min: 150, max: 350 }, scale: { start: 0.8, end: 0 }, blendMode: 'ADD', emitting: false
        });
        if (!this.textures.exists('flare')) {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8); g.generateTexture('flare', 16, 16);
        }
    }

    nextQuestion() {
        this.isWaitingForQuestion = false;

        const q = quizService.getRandomQuestion();
        if (!q) {
            this.questionText.setText("No Questions Available");
            this.questionContainer.setVisible(true);
            return;
        }

        this.currentQuestion = q;
        this.questionText.setText(q.questionText);
        this.questionContainer.setVisible(true);

        this.tweens.add({
            targets: this.questionContainer,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.out'
        });

        const answers = [];
        answers.push({ text: q.correctAnswer, isCorrect: true });
        q.wrongAnswers.forEach(ans => answers.push({ text: ans, isCorrect: false }));
        this.answerQueue = Phaser.Utils.Array.Shuffle(answers);
    }

    spawnTarget() {
        // Pause spawning if lost or not playing
        if (!this.isPlaying || (this.handController && this.handController.currentState === 'LOST' && this.inputMode !== 'MOUSE')) return;

        let type = 'standard';
        let answerData = null;

        if (!this.isWaitingForQuestion && this.answerQueue.length > 0 && Math.random() < 0.6) {
            type = 'answer';
            answerData = Phaser.Utils.Array.GetRandom(this.answerQueue);
        } else if (Math.random() < 0.2) {
            type = 'mystery';
        }

        const side = Math.random() < 0.5 ? 'left' : 'right';
        const startX = side === 'left' ? -60 : this.scale.width + 60;
        const startY = Phaser.Math.Between(150, this.scale.height - 100);

        const target = new Target(
            this, startX, startY, type,
            answerData ? answerData.text : '',
            answerData ? answerData.isCorrect : false
        );

        const speed = target.speed;
        target.setVelocity(side === 'left' ? speed : -speed, Phaser.Math.Between(-20, 20));
        this.targets.push(target);
    }

    update(time, delta) {
        if (!this.isPlaying || !this.handController) return;

        const input = this.handController.getInput();
        this.updateMiniMap(input);
        this.handleStateLogic(input);

        // Pause Game Elements if signal lost and no mouse fallback available
        if (input.state === 'LOST' && this.inputMode !== 'MOUSE') {
            this.targets.forEach(t => t.body.setVelocity(0, 0));
            return; // Pause processing aims
        }

        // Restore target velocities if recovered
        if (this.wasLost && (input.state === 'TRACKING' || this.inputMode === 'MOUSE')) {
            this.wasLost = false;
            this.targets.forEach(t => {
                const speed = t.speed;
                // Simple assumption: resume x direction
                t.body.setVelocityX(t.x < this.scale.width / 2 ? speed : -speed);
            });
        }

        // Targets update
        this.targets = this.targets.filter(t => t.active);
        this.targets.forEach(t => t.update(delta));

        // Reticle
        if (this.reticle && this.inputMode === 'CAMERA') {
            let rx = input.x * this.scale.width;
            let ry = input.y * this.scale.height;

            // Magnetic Aim
            let closest = null;
            let closestDist = 100;
            for (const t of this.targets) {
                const dist = Phaser.Math.Distance.Between(rx, ry, t.x, t.y);
                if (dist < closestDist) { closestDist = dist; closest = t; }
            }

            if (closest) {
                rx = rx + (closest.x - rx) * 0.3;
                ry = ry + (closest.y - ry) * 0.3;
                this.reticle.setStrokeStyle(4, 0xff0000);
            } else {
                this.reticle.setStrokeStyle(3, 0xff00ff);
            }

            this.reticle.setPosition(rx, ry);
            this.reticleDot.setPosition(rx, ry);

            if (input.isShooting && time > this.lastShotTime + this.shootCooldown) {
                this.fireShot(rx, ry);
                this.lastShotTime = time;
            }
            this.reticle.setScale(input.isShooting ? 0.8 : 1.0);
        } else if (this.reticle && this.inputMode === 'MOUSE') {
            // MOUSE Reticle moves directly to mouse
            this.reticle.setPosition(this.input.x, this.input.y);
            this.reticleDot.setPosition(this.input.x, this.input.y);
            this.reticle.setScale(this.input.activePointer.isDown ? 0.8 : 1.0);
        }
    }

    handleStateLogic(input) {
        if (input.state === 'LOST' && this.inputMode !== 'MOUSE') {
            this.wasLost = true;
            this.stateWarningText.setVisible(true);
            if (this.minimapBorder) this.minimapBorder.lineStyle(4, 0xff4444); // Red
        } else {
            this.stateWarningText.setVisible(false);
            if (this.minimapBorder) this.minimapBorder.lineStyle(4, 0x4CAF50); // Green
        }
    }

    updateMiniMap(input) {
        if (input.video && input.video.readyState >= 2) {
            const minimapW = 320;
            const minimapH = 240;
            const mx = this.scale.width - minimapW / 2 - 30;
            const my = this.scale.height - minimapH / 2 - 30;

            if (!this.videoTexture) {
                this.videoTexture = this.textures.createCanvas('webcam', input.video.videoWidth, input.video.videoHeight);
                this.minimap = this.add.image(mx, my, 'webcam').setDisplaySize(minimapW, minimapH).setDepth(1000).setAlpha(0.6);
                
                this.minimapBorder = this.add.graphics().setDepth(1001);
                this.minimapBorder.lineStyle(4, 0x4CAF50);
                this.minimapBorder.strokeRect(mx - minimapW / 2, my - minimapH / 2, minimapW, minimapH);

                this.skeletonGraphics = this.add.graphics().setDepth(1002);
            }

            this.videoTexture.context.drawImage(input.video, 0, 0);
            
            // Draw skeleton
            this.skeletonGraphics.clear();
            if (input.landmarks && input.state === 'TRACKING') {
                const ctxWidth = input.video.videoWidth;
                const ctxHeight = input.video.videoHeight;
                const scaleX = minimapW / ctxWidth;
                const scaleY = minimapH / ctxHeight;

                const ox = mx - minimapW / 2;
                const oy = my - minimapH / 2;

                this.skeletonGraphics.lineStyle(2, 0xffffff, 0.8);
                this.skeletonGraphics.fillStyle(0x00ffff, 1);

                // Helper to map and mirror X
                const mapPoint = (lm) => {
                    return {
                        x: ox + (1.0 - lm.x) * ctxWidth * scaleX,
                        y: oy + lm.y * ctxHeight * scaleY
                    };
                };

                // MediaPipe HAND_CONNECTIONS
                const connections = [
                    [0,1], [1,2], [2,3], [3,4], // Thumb
                    [0,5], [5,6], [6,7], [7,8], // Index
                    [5,9], [9,10], [10,11], [11,12], // Middle
                    [9,13], [13,14], [14,15], [15,16], // Ring
                    [13,17], [0,17], [17,18], [18,19], [19,20] // Pinky & Palm
                ];

                connections.forEach(conn => {
                    const p1 = mapPoint(input.landmarks[conn[0]]);
                    const p2 = mapPoint(input.landmarks[conn[1]]);
                    this.skeletonGraphics.beginPath();
                    this.skeletonGraphics.moveTo(p1.x, p1.y);
                    this.skeletonGraphics.lineTo(p2.x, p2.y);
                    this.skeletonGraphics.strokePath();
                });

                // Nodes
                input.landmarks.forEach(lm => {
                    const p = mapPoint(lm);
                    this.skeletonGraphics.fillCircle(p.x, p.y, 3);
                });
            }
            this.videoTexture.refresh();
        }
    }

    fireShot(x, y) {
        const circle = this.add.circle(x, y, 10, 0xffffff, 0);
        circle.setStrokeStyle(2, 0xffffff);
        this.tweens.add({ targets: circle, radius: 50, alpha: 0, duration: 300, onComplete: () => circle.destroy() });

        let hitTarget = null;
        for (const t of this.targets) {
            if (Phaser.Math.Distance.Between(x, y, t.x, t.y) < t.radius + 15) {
                hitTarget = t;
                break;
            }
        }
        if (hitTarget) this.handleHit(hitTarget);
    }

    handleHit(target) {
        let points = target.hit();

        if (target.type === 'answer') {
            if (target.isCorrect) {
                points = 100;
                this.showFloatingText(target.x, target.y, 'CORRECT!', '#00ff00');
                this.explosionManager.emitParticleAt(target.x, target.y, 40);

                this.time.delayedCall(500, () => this.nextQuestion());
                this.isWaitingForQuestion = true;

                this.targets.forEach(t => {
                    if (t.type === 'answer') t.destroy();
                });
            } else {
                points = -50;
                this.showFloatingText(target.x, target.y, 'WRONG!', '#ff0000');
                this.cameras.main.shake(300, 0.02);
            }
        } else {
            this.explosionManager.emitParticleAt(target.x, target.y, 20);
            this.showFloatingText(target.x, target.y, `+${points}`, '#ffff00');
            if (target.type === 'mystery') this.cameras.main.shake(100, 0.005);
        }

        this.score += points;
        this.scoreText.setText(i18n.t('scene.shooting.score') + this.score);
    }

    showFloatingText(x, y, msg, color) {
        const text = this.add.text(x, y, msg, { fontSize: '32px', color: color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({ targets: text, y: y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    }

    returnToMenu() {
        if (this.handController) this.handController.cleanup();
        this.scene.start('MainMenu');
    }

    shutdown() {
        if (this.handController) this.handController.cleanup();
        if (this.spawnTimer) this.spawnTimer.remove();
        this.targets.forEach(t => t.destroy());
        this.targets = [];
        if (this.explosionManager) this.explosionManager.destroy();
        if (this.textures.exists('webcam')) this.textures.remove('webcam');
    }
}
