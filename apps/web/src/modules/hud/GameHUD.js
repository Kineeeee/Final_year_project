import { COLORS, TEXT_STYLES } from '../../ui/UIConstants';

export class GameHUD {
    constructor(scene, { onExit } = {}) {
        this.scene = scene;
        this.onExit = onExit;
        this.createElements();
    }

    createElements() {
        const makeText = (text, size, color = '#00ff00') =>
            this.scene.add.text(0, 0, text, {
                fontFamily: '"Outfit", sans-serif',
                fontSize: size,
                color,
                shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
            }).setOrigin(1, 0);

        this.pingText = makeText('Ping: 0ms', '14px').setDepth(1100);
        this.fpsText = makeText('FPS: 60', '14px').setDepth(1100);

        // Coin Text (Top-Left, Big & Bold)
        this.coinText = this.scene.add.text(0, 0, 'Coins: 0', {
            ...TEXT_STYLES.SUBHEADER,
            fontSize: '28px',
            color: COLORS.TEXT.ACCENT,
            stroke: '#000000',
            strokeThickness: 4
        });

        // Quiz Source Label
        this.quizSourceLabel = this.scene.add.text(0, 0, 'System Quiz', {
            ...TEXT_STYLES.BODY,
            fontSize: '16px',
            color: '#7dd3fc',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Quiz Question (Center)
        this.questionText = this.scene.add
            .text(0, 0, '', {
                ...TEXT_STYLES.BODY,
                fontSize: '26px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: { x: 20, y: 12 },
                align: 'center',
                wordWrap: { width: 600 },
            })
            .setOrigin(0.5)
            .setVisible(false);

        // Question Timer (Below Question)
        this.timerText = this.scene.add
            .text(0, 0, '', {
                fontFamily: 'Monospace',
                fontSize: '24px',
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            })
            .setOrigin(0.5)
            .setVisible(false);

        this.roundTimerText = makeText('', '20px', '#00ffff').setVisible(false).setDepth(1100);

        // Rank Text (Bottom-Left)
        this.rankText = this.scene.add.text(0, 0, 'Rank: --', {
            ...TEXT_STYLES.BODY,
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0, 1);

        // Score Text (Bottom-Left, below Rank? No, above Rank or stacked)
        // Let's put Score below Rank or side-by-side?
        // User asked for "your score and your rank".
        // Let's stack: Rank top, Score bottom? Or Score top (larger), Rank bottom (smaller)?
        // I will put Rank above Score. 
        this.scoreText = this.scene.add.text(0, 0, 'Score: 0', {
            ...TEXT_STYLES.BODY,
            fontSize: '18px',
            color: COLORS.TEXT.ACCENT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 1);

        // Exit Button (Top-right cluster)
        const exitW = 94;
        const exitH = 32;
        this.exitBtn = this.scene.add.container(0, 0);
        const bg = this.scene.add.rectangle(0, 0, exitW, exitH, 0xef4444, 0.9)
            .setStrokeStyle(2, 0xb91c1c)
            .setOrigin(1, 0);
        const label = this.scene.add.text(-exitW / 2, exitH / 2, 'EXIT', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#fff'
        }).setOrigin(0.5);
        const hit = this.scene.add.rectangle(0, 0, exitW, exitH, 0x000000, 0)
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (typeof this.onExit === 'function') this.onExit();
            });
        this.exitBtn.add([bg, label, hit]);
        this.exitBtn.setDepth(1200);
        this.exitBtn.setScrollFactor(0);
    }

    resize(safeArea) {
        const s = safeArea.uiScale || 1;

        // Top-right stack with consistent gaps
        const gap = 10 * s;
        const baseX = safeArea.right - 8 * s;
        let y = safeArea.top + 8 * s;

        const stack = [this.pingText, this.fpsText, this.roundTimerText];
        stack.forEach((el) => {
            if (!el) return;
            el.setScale(s);
            el.setPosition(baseX, y);
            const h = el.displayHeight || (el.height ? el.height * s : 16 * s);
            y += h + gap;
        });

        if (this.exitBtn) {
            const exitHeight = 32 * s;
            this.exitBtn.setScale(s);
            this.exitBtn.setPosition(baseX, y);
            y += exitHeight + gap;
        }

        // Coins: Top-Left
        this.coinText.setPosition(safeArea.left, safeArea.top);
        this.coinText.setScale(s);
        this.quizSourceLabel.setPosition(safeArea.left, safeArea.top + 32 * s);
        this.quizSourceLabel.setScale(s);

        // Quiz Question: Center Top (Below possible Item Slots area)
        // Ensure it doesn't overlap items.
        // ItemSlots are typically at safeArea.top + 80.
        // Let's push question down to safeArea.top + 180 or center of screen depending on importance.
        this.questionText.setPosition(safeArea.centerX, safeArea.top + 180 * s);
        this.questionText.setWordWrapWidth(safeArea.width * 0.8);
        this.questionText.setScale(s);

        // Question Timer
        this.timerText.setPosition(safeArea.centerX, safeArea.top + 260 * s);
        this.timerText.setScale(s);

        // Rank & Score: Bottom-Left
        // If mobile, move up to avoid joystick? 
        // Joystick is usually at bottom-left. 
        // Let's assume safeArea takes care of screen edges, but joystick is INSIDE safe area.
        // Let's align them slightly higher if needed? 
        // For now, adhere to "bottom left".

        const controlClearance = safeArea.controlRadius
            ? safeArea.controlRadius + (safeArea.controlPadding || 0) + 10
            : 0;
        const bottomY = safeArea.bottom - controlClearance;
        const leftX = safeArea.left;

        this.scoreText.setPosition(leftX, bottomY);
        this.rankText.setPosition(leftX, bottomY - 25 * s);
        this.scoreText.setScale(s);
        this.rankText.setScale(s);

        // Exit button: top-right, slightly below round timer
        if (this.exitBtn) {
            const x = safeArea.right - 4 * s;
            const y = safeArea.top + 80 * s;
            this.exitBtn.setPosition(x, y);
            this.exitBtn.setScale(s);
        }
    }

    updatePing(ping) {
        if (this.pingText) {
            this.pingText.setText(`Ping: ${ping}ms`);

            const color = ping < 100 ? '#00ff00' : (ping < 200 ? '#ffff00' : '#ff0000');
            this.pingText.setColor(color);
        }
    }

    updateFPS(fps) {
        if (this.fpsText) {
            this.fpsText.setText(`FPS: ${Math.round(fps)}`);

            const color = fps >= 55 ? '#00ff00' : (fps >= 30 ? '#ffff00' : '#ff0000');
            this.fpsText.setColor(color);
        }
    }

    updateCoins(coins) {
        this.coinText.setText(`Coins: ${coins}`);

        // Pop Animation
        this.scene.tweens.killTweensOf(this.coinText);
        this.coinText.setScale(1);
        this.scene.tweens.add({
            targets: this.coinText,
            scale: 1.3,
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
    }

    updateScore(score) {
        if (this.scoreText) {
            this.scoreText.setText(`Score: ${score}`);
        }
    }

    setQuizSourceLabel(source) {
        if (!this.quizSourceLabel) return;
        this.quizSourceLabel.setText(source === 'USER' ? 'Your Quiz' : 'System Quiz');
    }

    updateRank(rank, total) {
        if (this.rankText) {
            const totalStr = total ? `/${total}` : '';
            this.rankText.setText(`Rank: ${rank}${totalStr}`);
        }
    }

    showQuestion(data) {
        // Guard: only show in quiz modes (handled at UIScene level) but keep defensive check
        if (!data || !data.text) return;
        this.questionText.setText(`Q: ${data.text}`);
        this.questionText.setVisible(true);

        this.scene.tweens.add({
            targets: this.questionText,
            scale: { from: 1, to: 1.05 },
            duration: 200,
            yoyo: true,
            ease: 'Bounce.easeOut',
        });

        if (data.endTime) {
            this.startQuestionTimer(data.endTime);
        }
    }

    startQuestionTimer(endTime) {
        if (this.quizTimerEvent) this.quizTimerEvent.remove();
        this.timerText.setVisible(true);

        this.quizTimerEvent = this.scene.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                const timeLeft = Math.max(0, endTime - Date.now());
                const secs = Math.ceil(timeLeft / 1000);
                this.timerText.setText(`${secs}s`);

                if (secs <= 5) {
                    this.timerText.setColor('#ff0000');
                    this.timerText.setScale(1.2);
                } else {
                    this.timerText.setColor('#ffff00');
                    this.timerText.setScale(1.0);
                }

                if (timeLeft <= 0) {
                    this.timerText.setText("TIME'S UP!");
                    this.quizTimerEvent.remove();
                }
            },
        });
    }

    startRoundTimer(data) {
        if (!data || !data.endTime) return;
        this.roundTimerText.setVisible(true);
        if (this.roundTimerEvent) this.roundTimerEvent.remove();

        this.roundTimerEvent = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const timeLeft = Math.max(0, data.endTime - Date.now());
                const mins = Math.floor(timeLeft / 60000);
                const secs = Math.floor((timeLeft % 60000) / 1000);
                this.roundTimerText.setText(`Round: ${mins}:${secs < 10 ? '0' : ''}${secs}`);
                if (timeLeft <= 0) {
                    this.roundTimerText.setText('Round Over');
                    this.roundTimerEvent.remove();
                }
            },
        });
    }

    showWinner(data) {
        const { width, height } = this.scene.scale;

        // Use a container for easier cleanup
        const container = this.scene.add.container(width / 2, height / 2).setDepth(200);

        // Dark Overlay
        const bg = this.scene.add.rectangle(0, 0, width, height, COLORS.OVERLAY, 0.85);
        container.add(bg);

        // Panel Background (Rounded)
        const panelW = 600;
        const panelH = 400;
        const panel = this.scene.add.graphics();
        panel.fillStyle(COLORS.PANEL_BG, 1);
        panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);
        panel.lineStyle(4, COLORS.ACCENT, 1);
        panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 24);
        container.add(panel);

        // Title
        const title = this.scene.add.text(0, -120, 'ROUND OVER', {
            ...TEXT_STYLES.HEADER,
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(title);

        if (data.winner) {
            const winnerText = this.scene.add.text(0, 0, `WINNER\n${data.winner.name}`, {
                ...TEXT_STYLES.SUBHEADER,
                fontSize: '36px',
                color: COLORS.TEXT.ACCENT,
                align: 'center'
            }).setOrigin(0.5);

            const scoreText = this.scene.add.text(0, 80, `Score: ${data.winner.score}`, {
                ...TEXT_STYLES.BODY,
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);

            container.add([winnerText, scoreText]);
        } else {
            const noWinnerText = this.scene.add.text(0, 0, 'No Winner', {
                ...TEXT_STYLES.SUBHEADER,
                color: COLORS.TEXT.MUTED
            }).setOrigin(0.5);
            container.add(noWinnerText);
        }

        const nextText = this.scene.add.text(0, 160, 'Next round starts in 10s...', {
            ...TEXT_STYLES.BODY,
            fontSize: '18px',
            color: '#aaaaaa'
        }).setOrigin(0.5);
        container.add(nextText);

        this.scene.time.delayedCall(10000, () => {
            // Optional fade out?
            container.destroy();
        });
    }

    destroy() {
        if (this.quizTimerEvent) this.quizTimerEvent.remove();
        if (this.roundTimerEvent) this.roundTimerEvent.remove();
    }
}
