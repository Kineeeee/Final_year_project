import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { GAME_PHASE } from '../../core/state/GamePhases';

export class UISceneResultController {
    showResultOverlay(uiScene, payload = {}) {
        // Always block input
        uiScene._teardownWaitingOverlay();
        uiScene.uiPhase = 'result';
        uiScene.setGamePhase(GAME_PHASE.RESULT);
        uiScene.resultBlockToken = overlayBlocker.block('result');

        if (uiScene.resultOverlay) uiScene.resultOverlay.destroy(true);
        uiScene.resultButtons = [];

        const { width, height } = uiScene.scale;
        const container = uiScene.add.container(width / 2, height / 2).setDepth(3000);
        const bg = uiScene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0.5);
        container.add(bg);

        const panelW = Math.min(600, width - 80);
        const panelH = 360;
        const panel = uiScene.add.graphics();
        panel.fillStyle(0x111827, 0.95);
        panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        panel.lineStyle(2, 0x4b5563, 1);
        panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        container.add(panel);

        const title = uiScene.add.text(0, -panelH / 2 + 30, 'RESULT', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#e5e7eb',
        }).setOrigin(0.5);
        container.add(title);

        const winner = payload.winner;
        const winnerText = uiScene.add.text(0, -60, winner
            ? `Winner: ${winner.name || 'Unknown'} (${winner.questionsSolved || 0} solved)`
            : 'No winner', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '20px',
            color: '#fcd34d',
        }).setOrigin(0.5);
        container.add(winnerText);

        const myId = uiScene.localSocketId;
        const me = (payload.players || []).find((p) => p.id === myId);
        const mySolved = me?.questionsSolved ?? 0;
        const myScore = me?.score ?? 0;

        const stats = uiScene.add.text(0, 0, `Your solved: ${mySolved}\nYour score: ${myScore}`, {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '18px',
            color: '#e5e7eb',
            align: 'center',
        }).setOrigin(0.5);
        container.add(stats);

        const listY = 80;
        const topList = (payload.players || []).slice(0, 5).map((p, idx) =>
            `${idx + 1}. ${p.name || 'Player'} — ${p.questionsSolved || 0} solved, ${p.score || 0} pts`
        ).join('\n');
        const listText = uiScene.add.text(0, listY, topList || 'No players', {
            fontFamily: '"Outfit", sans-serif',
            fontSize: '16px',
            color: '#cbd5e1',
            align: 'center',
            lineSpacing: 4,
        }).setOrigin(0.5);
        container.add(listText);

        const btnY = panelH / 2 - 50;
        const makeBtn = (x, label, color, handler) => {
            const rect = uiScene.add.rectangle(x, btnY, 150, 44, color, 0.9)
                .setStrokeStyle(2, Phaser.Display.Color.IntegerToColor(color).darken(20).color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', handler);
            const txt = uiScene.add.text(x, btnY, label, {
                fontFamily: '"Outfit", sans-serif',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#0b0f16',
            }).setOrigin(0.5);
            container.add(rect);
            container.add(txt);
            uiScene.resultButtons.push(rect, txt);
        };

        if (payload.mode === 'custom') {
            makeBtn(0, 'MAIN MENU', 0xf59e0b, () => uiScene.returnToMenu('result'));
        } else {
            makeBtn(-90, 'PLAY AGAIN', 0x22c55e, () => this.hideResultOverlay(uiScene, 'restart'));
            makeBtn(90, 'MAIN MENU', 0xf59e0b, () => uiScene.returnToMenu('result'));
        }

        uiScene.resultOverlay = container;
    }

    hideResultOverlay(uiScene, reason = 'continue') {
        if (uiScene.resultOverlay) {
            uiScene.resultOverlay.destroy(true);
            uiScene.resultOverlay = null;
            uiScene.resultButtons = [];
        }
        if (uiScene.resultBlockToken) {
            overlayBlocker.unblock(uiScene.resultBlockToken);
            uiScene.resultBlockToken = null;
        }
        if (reason === 'menu') {
            uiScene.uiPhase = 'idle';
        } else {
            uiScene.uiPhase = 'playing';
            uiScene.setGamePhase(GAME_PHASE.PLAYING);
        }
    }
}