import { Scene } from 'phaser';

const STORAGE_KEY = 'game:settings:v1';

const defaults = {
    soundEnabled: true,
    musicEnabled: true,
    graphicsQuality: 'high',
    controlsScheme: 'default',
};

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaults };
        return { ...defaults, ...(JSON.parse(raw) || {}) };
    } catch {
        return { ...defaults };
    }
}

function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // ignore storage write failure
    }
}

export class SettingsScene extends Scene {
    constructor() {
        super('SettingsScene');
        this.settings = loadSettings();
        this._labels = {};
    }

    create() {
        const parent = this.scene.get('MainMenu');
        const { width, height } = this.scale;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(1).setInteractive();
        const panelW = Math.min(760, width - 80);
        const panelH = Math.min(620, height - 80);

        const panel = this.add.graphics().setDepth(2);
        panel.fillStyle(0x111827, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 14);
        panel.lineStyle(3, 0x34dbcb, 1);
        panel.strokeRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 14);

        this.add.text(width / 2, height / 2 - panelH / 2 + 48, 'SETTINGS', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: '#34dbcb',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(3);

        const rows = [
            { key: 'soundEnabled', label: 'Sound', type: 'bool' },
            { key: 'musicEnabled', label: 'Music', type: 'bool' },
            { key: 'graphicsQuality', label: 'Graphics', type: 'enum', values: ['low', 'high'] },
            { key: 'controlsScheme', label: 'Controls', type: 'enum', values: ['default', 'classic'] },
        ];

        const rowStartY = height / 2 - 120;
        rows.forEach((row, idx) => {
            const y = rowStartY + idx * 92;
            this.add.text(width / 2 - panelW / 2 + 70, y, row.label.toUpperCase(), {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '16px',
                color: '#e5e7eb',
            }).setDepth(3);

            this._labels[row.key] = this.add.text(width / 2 + panelW / 2 - 220, y, '', {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '14px',
                color: '#fcd34d',
            }).setDepth(3);

            const button = this.add.rectangle(width / 2 + panelW / 2 - 90, y + 10, 140, 44, 0x3b82f6, 0.95)
                .setDepth(3)
                .setStrokeStyle(2, 0x1d4ed8)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.toggleSetting(row));
            this.add.text(button.x, button.y, 'CHANGE', {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '11px',
                color: '#ffffff',
            }).setOrigin(0.5).setDepth(4);
        });

        const applyBtn = this.add.rectangle(width / 2 - 90, height / 2 + panelH / 2 - 58, 150, 48, 0x22c55e, 0.95)
            .setDepth(3)
            .setStrokeStyle(2, 0x15803d)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.apply(parent));
        this.add.text(applyBtn.x, applyBtn.y, 'APPLY', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#052e16',
        }).setOrigin(0.5).setDepth(4);

        const closeBtn = this.add.rectangle(width / 2 + 90, height / 2 + panelH / 2 - 58, 150, 48, 0xef4444, 0.95)
            .setDepth(3)
            .setStrokeStyle(2, 0x991b1b)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.close(parent));
        this.add.text(closeBtn.x, closeBtn.y, 'CLOSE', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(4);

        this.renderValues();
    }

    toggleSetting(row) {
        if (row.type === 'bool') {
            this.settings[row.key] = !this.settings[row.key];
        } else if (row.type === 'enum') {
            const values = row.values || [];
            const current = this.settings[row.key];
            const idx = Math.max(0, values.indexOf(current));
            this.settings[row.key] = values[(idx + 1) % values.length];
        }
        this.renderValues();
    }

    renderValues() {
        Object.keys(this._labels).forEach((key) => {
            const value = this.settings[key];
            const text = typeof value === 'boolean'
                ? (value ? 'ON' : 'OFF')
                : String(value).toUpperCase();
            this._labels[key]?.setText(text);
        });
    }

    apply(mainMenuScene) {
        saveSettings(this.settings);
        // Low quality toggle applies immediately for future scene renders.
        try {
            const isLow = this.settings.graphicsQuality === 'low';
            if (this.game?.registry) {
                this.game.registry.set('graphics.lowQuality', isLow);
            }
        } catch {
            // no-op
        }

        if (mainMenuScene?.events) {
            mainMenuScene.events.emit('showToast', {
                message: 'Settings saved',
                color: '#34dbcb',
            });
        }
        this.close(mainMenuScene);
    }

    close(mainMenuScene) {
        this.scene.stop();
        if (mainMenuScene) {
            this.scene.resume('MainMenu');
        }
    }
}
