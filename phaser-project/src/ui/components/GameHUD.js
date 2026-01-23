export class GameHUD {
    constructor(scene) {
        this.scene = scene;
        this.createElements();
    }

    createElements() {
        // Ping Text (Will be positioned Top-Right)
        this.pingText = this.scene.add
            .text(0, 0, 'Ping: 0ms', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#00ff00',
                backgroundColor: '#00000088',
                padding: { x: 5, y: 5 },
            })
            .setOrigin(1, 0);

        // Coin Text (Will be positioned Top-Left, below Leaderboard)
        this.coinText = this.scene.add.text(0, 0, 'Coins: 0', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#FFD700',
            backgroundColor: '#00000088',
            padding: { x: 10, y: 10 },
        });

        // FPS Text (Below Ping)
        this.fpsText = this.scene.add
            .text(0, 0, 'FPS: 60', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#00ff00',
                backgroundColor: '#00000088',
                padding: { x: 5, y: 5 },
            })
            .setOrigin(1, 0)
            .setDepth(100);

        // Quiz Question (Center)
        this.questionText = this.scene.add
            .text(0, 0, '', {
                fontFamily: '"Outfit", sans-serif',
                fontSize: '24px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                backgroundColor: '#00000066',
                padding: { x: 20, y: 10 },
                align: 'center',
                wordWrap: { width: 600 },
            })
            .setOrigin(0.5)
            .setVisible(false);

        // Question Timer (Below Question)
        this.timerText = this.scene.add
            .text(0, 0, '', {
                fontFamily: 'Monospace',
                fontSize: '20px',
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setVisible(false);

        // Round Timer (Top Right, below Ping)
        this.roundTimerText = this.scene.add
            .text(0, 0, '', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#00ffff',
                backgroundColor: '#00000088',
                padding: { x: 8, y: 5 },
            })
            .setOrigin(1, 0)
            .setVisible(false);
    }

    resize(safeArea) {
        // Ping: Top-Right
        this.pingText.setPosition(safeArea.right, safeArea.top);

        // FPS: Below Ping
        this.fpsText.setPosition(safeArea.right, safeArea.top + 30);

        // Round Timer: Below FPS
        this.roundTimerText.setPosition(safeArea.right, safeArea.top + 60);

        // Coins: Top-Left (Below Leaderboard, assuming Leaderboard is at safeArea.top)
        // Leaderboard typically takes ~150-200px height depending on rows.
        // Let's safe-guess 220px down for now, or we can stack it differently.
        // The original code had `safeMargin + 200`.
        this.coinText.setPosition(safeArea.left, safeArea.top + 220);

        // Quiz Question: Center Top (Moved DOWN below Item Slots)
        this.questionText.setPosition(safeArea.centerX, safeArea.top + 180);
        this.questionText.setWordWrapWidth(safeArea.width * 0.8); // Responsive wrap

        // Question Timer
        this.timerText.setPosition(safeArea.centerX, safeArea.top + 240);
    }

    updatePing(ping) {
        if (this.pingText) {
            this.pingText.setText(`Ping: ${ping}ms`);
            // Color code ping
            if (ping < 100) this.pingText.setColor('#00ff00');
            else if (ping < 200) this.pingText.setColor('#ffff00');
            else this.pingText.setColor('#ff0000');
        }
    }

    updateFPS(fps) {
        if (this.fpsText) {
            this.fpsText.setText(`FPS: ${Math.round(fps)}`);
            if (fps >= 55) this.fpsText.setColor('#00ff00');
            else if (fps >= 30) this.fpsText.setColor('#ffff00');
            else this.fpsText.setColor('#ff0000');
        }
    }
    updateCoins(coins) {
        this.coinText.setText(`Coins: ${coins}`);

        // Pop Animation
        this.scene.tweens.killTweensOf(this.coinText);
        this.coinText.setScale(1);
        this.scene.tweens.add({
            targets: this.coinText,
            scale: 1.2,
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
    }

    showQuestion(data) {
        this.questionText.setText(`Q: ${data.text}`);
        this.questionText.setVisible(true);

        // Flash
        this.scene.tweens.add({
            targets: this.questionText,
            scale: { from: 1, to: 1.1 },
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

                if (secs <= 10) this.timerText.setColor('#ff0000');
                else this.timerText.setColor('#ffff00');

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

        // Full screen check for background
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8);
        container.add(bg);

        const titleStyle = {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
        };

        const title = this.scene.add.text(0, -100, 'ROUND OVER', titleStyle).setOrigin(0.5);
        container.add(title);

        if (data.winner) {
            const winnerText = this.scene.add
                .text(0, 0, `WINNER\n${data.winner.name}\nScore: ${data.winner.score}`, {
                    ...titleStyle,
                    fontSize: '32px',
                    color: '#FFD700',
                })
                .setOrigin(0.5);
            winnerText.setTint(data.winner.color);
            container.add(winnerText);
        } else {
            const noWinnerText = this.scene.add
                .text(0, 0, 'No Winner', { ...titleStyle, fontSize: '32px' })
                .setOrigin(0.5);
            container.add(noWinnerText);
        }

        const nextText = this.scene.add
            .text(0, 150, 'Next round starts in 10s...', {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#aaaaaa',
            })
            .setOrigin(0.5);
        container.add(nextText);

        this.scene.time.delayedCall(10000, () => {
            container.destroy();
        });
    }

    destroy() {
        if (this.quizTimerEvent) this.quizTimerEvent.remove();
        if (this.roundTimerEvent) this.roundTimerEvent.remove();
        // UI elements are destroyed by Scene shutdown automatically
    }
}
