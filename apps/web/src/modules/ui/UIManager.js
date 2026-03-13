import { GameHUD } from '../hud/GameHUD';
import { Leaderboard } from '../leaderboard/Leaderboard';
import { MobileControls } from '../controls/MobileControls';
import { ItemSlots } from '../inventory/ItemSlots';
import { Minimap } from '../minimap/Minimap';
import { CONFIG } from '../../config/AppConfig';

export class UIManager {
    constructor(scene, mode = 'normal', { onExit } = {}) {
        this.scene = scene;
        this.mode = mode;
        this.components = {};

        // Initialize Components
        this.components.hud = new GameHUD(scene, { onExit });
        this.components.leaderboard = new Leaderboard(scene);
        this.components.items = new ItemSlots(scene, mode); // Pass mode to ItemSlots

        // Minimap only in Normal Mode
        if (mode === 'normal') {
            this.components.minimap = new Minimap(scene);
        }

        if (!scene.sys.game.device.os.desktop) {
            this.components.controls = new MobileControls(scene);
        }

        // Layout Management
        this.handleResize(scene.scale);
        scene.scale.on('resize', this.handleResize, this);
    }

    update() {
        // Update Mobile Controls (Joystick)
        if (this.components.controls) {
            // Changed from this.mobileControls to this.components.controls
            this.components.controls.update();
        }

        // Update FPS
        if (this.components.hud) {
            // Changed from this.gameHUD to this.components.hud
            this.components.hud.updateFPS(this.scene.game.loop.actualFps);
        }
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        const isMobile = !this.scene.sys.game.device.os.desktop;

        // Tighter gutters on mobile so HUD hugs the edge and leaves room for controls.
        const margin = isMobile ? 14 : 20;

        // Control radius hint lets other components (HUD, minimap) stay clear of buttons.
        const controlRadius = isMobile
            ? Math.max(56, Math.min(Math.min(width, height) * 0.16, 110))
            : 0;

        // Global UI scale relative to 1280x720 design size.
        const baseW = CONFIG?.WIDTH || 1280;
        const baseH = CONFIG?.HEIGHT || 720;
        const uiScaleRaw = Math.min(width / baseW, height / baseH);
        const uiScale = Math.max(0.55, Math.min(uiScaleRaw * (isMobile ? 0.9 : 1), 1));

        const safeArea = {
            x: margin,
            y: margin,
            width: width - margin * 2,
            height: height - margin * 2,
            top: margin,
            bottom: height - margin,
            left: margin,
            right: width - margin,
            centerX: width / 2,
            centerY: height / 2,
            controlRadius,
            controlPadding: margin,
            uiScale,
        };

        // Update all components with new layout
        Object.values(this.components).forEach((comp) => {
            if (comp && comp.resize) comp.resize(safeArea);
        });
    }

    // Proxy Methods for Game Updates
    updateLeaderboard(data) {
        this.components.leaderboard.update(data);
    }

    updatePing(latency) {
        this.components.hud.updatePing(latency);
    }

    updateCoins(coins) {
        this.components.hud.updateCoins(coins);
    }

    updateScore(score) {
        this.components.hud.updateScore(score);
    }

    updateRank(rank, total) {
        this.components.hud.updateRank(rank, total);
    }

    updateInventory(inventory) {
        this.components.items.updateInventory(inventory);
    }

    onItemActivated(data) {
        this.components.items.onItemActivated(data);
    }

    updateQuizSource(source) {
        if (this.components.hud && this.components.hud.setQuizSourceLabel) {
            this.components.hud.setQuizSourceLabel(source);
        }
    }

    // Quiz Methods
    updateQuestion(data) {
        this.components.hud.showQuestion(data);
    }

    startRoundTimer(data) {
        this.components.hud.startRoundTimer(data);
    }

    showWinner(data) {
        this.components.hud.showWinner(data);
    }

    // Minimap Methods
    updateMinimapPlayer(x, y) {
        if (this.components.minimap) this.components.minimap.updatePlayerPosition(x, y);
    }

    updateMinimapFood(foodData) {
        if (this.components.minimap) this.components.minimap.updateFood(foodData);
    }

    // Input Methods
    getMobileInput() {
        return this.components.controls ? this.components.controls.getInput() : null;
    }

    destroy() {
        if (this.scene && this.scene.scale && this.scene.scale.off) {
            this.scene.scale.off('resize', this.handleResize, this);
        }
        Object.values(this.components).forEach((comp) => {
            if (comp && comp.destroy) comp.destroy();
        });
        this.components = {};
        this.scene = null;
    }
}
