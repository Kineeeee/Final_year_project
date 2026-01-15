import { GameHUD } from './components/GameHUD';
import { Leaderboard } from './components/Leaderboard';
import { MobileControls } from './components/MobileControls';
import { ItemSlots } from './components/ItemSlots';
import { Minimap } from './components/Minimap';

export class UIManager {
    constructor(scene, mode = 'normal') {
        this.scene = scene;
        this.mode = mode;
        this.components = {};

        // Initialize Components
        this.components.hud = new GameHUD(scene);
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
        if (this.components.controls) { // Changed from this.mobileControls to this.components.controls
            this.components.controls.update();
        }

        // Update FPS
        if (this.components.hud) { // Changed from this.gameHUD to this.components.hud
            this.components.hud.updateFPS(this.scene.game.loop.actualFps);
        }
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        const isMobile = !this.scene.sys.game.device.os.desktop;

        // Calculate Safe Area (Simple implementation, can be expanded)
        // For mobile, assume 60px padding for top notch/bottom bar
        const safeArea = {
            x: isMobile ? 60 : 20,
            y: isMobile ? 60 : 20,
            width: width - (isMobile ? 120 : 40),
            height: height - (isMobile ? 120 : 40),
            top: isMobile ? 60 : 20,
            bottom: height - (isMobile ? 60 : 20),
            left: isMobile ? 60 : 20,
            right: width - (isMobile ? 60 : 20),
            centerX: width / 2,
            centerY: height / 2
        };

        // Update all components with new layout
        Object.values(this.components).forEach(comp => {
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

    updateInventory(inventory) {
        this.components.items.updateInventory(inventory);
    }

    onItemActivated(data) {
        this.components.items.onItemActivated(data);
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
        Object.values(this.components).forEach(comp => {
            if (comp && comp.destroy) comp.destroy();
        });
        this.components = {};
    }
}
