import { Scene } from 'phaser';
import { HandShootingController } from './HandControl';
import { Target } from './Target';
import { quizService } from '../../core/services/QuizService';
import { Logger } from '../../utils/Logger';

export class ShootingScene extends Scene {
    constructor() {
        super('ShootingScene');
        this.handController = null;
        this.videoTexture = null;
        this.reticle = null;

        // Game State
        this.selectedHand = null;
        this.isPlaying = false;
        this.targets = [];
        this.score = 0;
        this.scoreText = null;
        this.spawnTimer = null;

        // Quiz State
        this.currentQuestion = null;
        this.questionText = null;
        this.answerQueue = []; // Answers waiting to be spawned
        this.spawnedAnswers = []; // Currently on screen
        this.questionDelay = 3000; // Delay between questions
        this.isWaitingForQuestion = false;

        this.lastShotTime = 0;
        this.shootCooldown = 400;
    }

    create() {
        Logger.info('ShootingScene', 'Initializing Shooting Scene');

        // Background
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000).setOrigin(0);

        // Hand Selection UI
        this.createHandSelectionUI();
    }

    createHandSelectionUI() {
        this.selectionGroup = this.add.container(0, 0);
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        const title = this.add.text(cx, cy - 150, 'SELECT YOUR HAND', {
            fontFamily: '"Monospace"',
            fontSize: '36px',
            color: '#00ffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const btnLeft = this.createCyberButton(cx - 150, cy, 'LEFT HAND', () => this.startGame('Left'));
        const btnRight = this.createCyberButton(cx + 150, cy, 'RIGHT HAND', () => this.startGame('Right'));

        const exit = this.add.text(cx, cy + 150, 'BACK TO MENU', {
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
        this.isPlaying = true;

        // Init Controller
        this.handController = new HandShootingController(this.selectedHand);
        await this.handController.init();

        // Init Game UI
        this.createGameUI();
        this.createReticle();
        this.createParticles();

        // Fetch Questions
        await quizService.fetchQuestions('math'); // Hardcoded topic for now, or select in UI?

        // Start Loops
        this.spawnTimer = this.time.addEvent({
            delay: 1500, // Faster spawn
            callback: this.spawnTarget,
            callbackScope: this,
            loop: true
        });

        this.nextQuestion();
    }

    createGameUI() {
        this.scoreText = this.add.text(30, 30, 'SCORE: 0', {
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

        // Instructions
        this.add.text(this.scale.width / 2, this.scale.height - 40, 'AIM: Thumb+Index Midpoint | PINCH: Shoot', {
            fontFamily: '"Monospace"',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#00000088'
        }).setOrigin(0.5);

        // Exit
        this.add.text(30, 80, '< EXIT', {
            fontFamily: 'Monospace', fontSize: '20px', color: '#ffffff', backgroundColor: '#333333'
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.returnToMenu());
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

        // improved animation for new question
        this.tweens.add({
            targets: this.questionContainer,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.out'
        });

        // Prepare answer queue
        // Mix correct and wrong answers
        const answers = [];
        answers.push({ text: q.correctAnswer, isCorrect: true });
        q.wrongAnswers.forEach(ans => answers.push({ text: ans, isCorrect: false }));

        // Shuffle
        this.answerQueue = Phaser.Utils.Array.Shuffle(answers);
    }

    spawnTarget() {
        if (!this.isPlaying) return;

        // Determine Type
        let type = 'standard';
        let answerData = null;

        // Higher chance for answer if queue has items and we are not waiting
        if (!this.isWaitingForQuestion && this.answerQueue.length > 0 && Math.random() < 0.6) {
            type = 'answer';
            // Use GetRandom instead of pop() so answers can persist/respawn until question is answered
            answerData = Phaser.Utils.Array.GetRandom(this.answerQueue);
        } else if (Math.random() < 0.2) {
            type = 'mystery';
        }

        const side = Math.random() < 0.5 ? 'left' : 'right';
        const startX = side === 'left' ? -60 : this.scale.width + 60;
        const startY = Phaser.Math.Between(150, this.scale.height - 100);

        const target = new Target(
            this,
            startX,
            startY,
            type,
            answerData ? answerData.text : '',
            answerData ? answerData.isCorrect : false
        );

        const speed = target.speed;
        target.setVelocity(side === 'left' ? speed : -speed, Phaser.Math.Between(-20, 20));

        this.targets.push(target);
    }

    update(time, delta) {
        if (!this.isPlaying || !this.handController) return;

        // Video Texture
        const input = this.handController.getInput();
        if (input.video && input.video.readyState >= 2) {
            if (!this.videoTexture) {
                this.videoTexture = this.textures.createCanvas('webcam', input.video.videoWidth, input.video.videoHeight);
                this.add.image(this.scale.width / 2, this.scale.height / 2, 'webcam').setDisplaySize(this.scale.width, this.scale.height).setDepth(-10);
            }
            this.videoTexture.context.drawImage(input.video, 0, 0);
            this.videoTexture.refresh();
        }

        // Targets
        this.targets = this.targets.filter(t => t.active);
        this.targets.forEach(t => t.update(delta));

        // Reticle
        if (this.reticle) {
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
        // Points
        let points = target.hit();

        // Logic for Answer
        if (target.type === 'answer') {
            if (target.isCorrect) {
                // Correct!
                points = 100;
                this.showFloatingText(target.x, target.y, 'CORRECT!', '#00ff00');
                this.explosionManager.emitParticleAt(target.x, target.y, 40);

                // Clear other answers for this question to avoid confusion?
                // Or just move to next question
                this.time.delayedCall(500, () => this.nextQuestion());
                this.isWaitingForQuestion = true;

                // Destroy other answer targets currently on screen?
                this.targets.forEach(t => {
                    if (t.type === 'answer') t.destroy();
                });
            } else {
                // Wrong!
                points = -50;
                this.showFloatingText(target.x, target.y, 'WRONG!', '#ff0000');
                this.cameras.main.shake(300, 0.02);
            }
        } else {
            // Normal hit
            this.explosionManager.emitParticleAt(target.x, target.y, 20);
            this.showFloatingText(target.x, target.y, `+${points}`, '#ffff00');
            if (target.type === 'mystery') this.cameras.main.shake(100, 0.005);
        }

        this.score += points;
        this.scoreText.setText(`SCORE: ${this.score}`);
    }

    showFloatingText(x, y, msg, color) {
        const text = this.add.text(x, y, msg, { fontSize: '32px', color: color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
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
        if (this.textures.exists('webcam')) this.textures.remove('webcam');
    }
}
