import { CONFIG } from '../../config/AppConfig';
import Phaser from 'phaser';

export class CameraManager {
    constructor(scene) {
        this.scene = scene;
        this.baseZoom = CONFIG.ZOOM.BASE;
    }

    setup() {
        this.scene.cameras.main.setBackgroundColor(CONFIG.UI.CAMERA_BG);
        this.handleResize();
        this.scene.scale.on('resize', this.handleResize, this);
    }

    startFollow(target) {
        this.scene.cameras.main.startFollow(target);
    }

    update(player) {
        if (!player || !player.alive) return;

        // Calculate target zoom based on player scale
        const scaleDiff = player.scale - CONFIG.PHYSICS.PLAYER_SCALE_BASE;

        // Use calculated baseZoom instead of fixed 1.0
        let targetZoom = this.baseZoom - scaleDiff * 0.4;

        // Limit zoom relative to baseZoom
        // Min zoom is half of baseZoom
        targetZoom = Phaser.Math.Clamp(targetZoom, this.baseZoom * 0.5, this.baseZoom);

        // Smoothly interpolate current zoom to target zoom
        this.scene.cameras.main.setZoom(
            Phaser.Math.Linear(this.scene.cameras.main.zoom, targetZoom, CONFIG.ZOOM.SMOOTH_FACTOR)
        );
    }

    handleResize() {
        const width = this.scene.scale.width;
        // Target width is roughly what we expect on a standard desktop (e.g., 1440)
        // If the screen is smaller (mobile), we zoom out (reduce zoom value) to show more world.
        const targetWidth = CONFIG.ZOOM.TARGET_WIDTH;

        let zoom = width / targetWidth;

        // Clamp zoom to reasonable limits
        this.baseZoom = Phaser.Math.Clamp(zoom, CONFIG.ZOOM.MIN, CONFIG.ZOOM.MAX);

        // Apply immediately if player not spawned yet
        // Accessing 'this.scene.player' requires tight coupling, but unavoidable unless passed in.
        // Or we just set camera zoom directly if no follow target is active?
        // Let's assume safely:
        if (!this.scene.player) {
            this.scene.cameras.main.setZoom(this.baseZoom);
        }
    }

    destroy() {
        this.scene.scale.off('resize', this.handleResize, this);
    }
}
