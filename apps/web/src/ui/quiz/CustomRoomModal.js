import { roomService } from '../../core/services/RoomService';

export class CustomRoomModal extends Phaser.GameObjects.Container {
    constructor(scene, x, y, options = {}) {
        super(scene, x, y);
        this.scene = scene;
        this.onJoin = options.onJoin;
        this.onCreate = options.onCreate;
        this.onClose = options.onClose;
        
        const { width, height } = scene.scale;
        
        // Background overlay
        this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
        this.bg.setInteractive(); // Block clicks to underlying elements
        // Center the container content relative to the middle of the screen
        this.add(this.bg);
        this.bg.setPosition(-x, -y); // Adjust since container is at centerX, centerY
        
        const panelW = Math.min(1500, width * 0.98);
        const panelH = Math.min(900, height * 0.92);
        
        this.panelBg = scene.add.graphics();
        this.panelBg.fillStyle(0x000000, 0.5);
        this.panelBg.fillRoundedRect(-panelW/2 + 6, -panelH/2 + 6, panelW, panelH, 12);
        this.panelBg.fillStyle(0x273043, 1);
        this.panelBg.fillRoundedRect(-panelW/2, -panelH/2, panelW, panelH, 12);
        this.add(this.panelBg);

        this.title = scene.add.text(0, -panelH/2 + 46, 'Phòng Custom', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '30px',
            color: '#fff',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        this.add(this.title);

        // Close button
        this.closeBtn = scene.add.text(panelW/2 - 20, -panelH/2 + 20, '✕', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '30px',
            color: '#e74c3c'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.closeBtn.on('pointerdown', () => this.close());
        this.add(this.closeBtn);

        // Capacity text
        this.capacityText = scene.add.text(-panelW/2 + 20, -panelH/2 + 60, 'Đang tải...', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '18px',
            color: '#bdc3c7'
        }).setOrigin(0, 0.5);
        this.add(this.capacityText);

        // Header Background
        const headerBg = scene.add.graphics();
        headerBg.fillStyle(0x1a202c, 1);
        headerBg.fillRect(-panelW/2 + 20, -panelH/2 + 110, panelW - 40, 74);
        this.add(headerBg);

        // Table Headers
        const listLeft = -panelW / 2 + 36;
        this.listCols = {
            code: listLeft,
            lang: listLeft + panelW * 0.22,
            count: listLeft + panelW * 0.46,
            owner: listLeft + panelW * 0.68,
            join: panelW / 2 - 120,
            headerY: -panelH / 2 + 148,
        };
        const headerStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '30px', color: '#9ca3af' };
        this.add(scene.add.text(this.listCols.code, this.listCols.headerY, 'CODE', headerStyle).setOrigin(0, 0.5));
        this.add(scene.add.text(this.listCols.lang, this.listCols.headerY, 'NGÔN NGỮ', headerStyle).setOrigin(0, 0.5));
        this.add(scene.add.text(this.listCols.count, this.listCols.headerY, 'SỐ NGƯỜI', headerStyle).setOrigin(0, 0.5));
        this.add(scene.add.text(this.listCols.owner, this.listCols.headerY, 'CHỦ PHÒNG', headerStyle).setOrigin(0, 0.5));

        // Rows container
        this.rowsContainer = scene.add.container(0, 0);
        this.add(this.rowsContainer);

        // Create Room Button
        this.createBtn = scene.add.container(0, panelH/2 - 66);
        const btnW = 420, btnH = 74;
        const btnBg = scene.add.graphics();
        btnBg.fillStyle(0x27ae60, 1);
        btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
        const btnText = scene.add.text(0, 0, 'TẠO PHÒNG', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '30px', color: '#fff'
        }).setOrigin(0.5);
        const btnHit = scene.add.rectangle(0, 0, btnW, btnH, 0x0, 0).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.onCreate) this.onCreate();
            });
        this.createBtn.add([btnBg, btnText, btnHit]);
        this.add(this.createBtn);

        this.panelW = panelW;
        this.panelH = panelH;

        this.bg.on('pointerdown', (pointer) => {
            const insidePanel =
                pointer.x >= x - panelW / 2 &&
                pointer.x <= x + panelW / 2 &&
                pointer.y >= y - panelH / 2 &&
                pointer.y <= y + panelH / 2;
            if (insidePanel) return;
            this.close();
        });

        scene.add.existing(this);
        this.setDepth(100);

        this.setScale(0.8);
        scene.tweens.add({ targets: this, scale: 1, duration: 200, ease: 'Back.easeOut' });

        this.refresh();
    }

    async refresh() {
        try {
            const { rooms = [], capacity } = await roomService.listRooms();
            this.renderRows(rooms);
            
            if (capacity) {
                this.capacityText.setText(`Phòng: ${capacity.current}/${capacity.max} · Trống: ${capacity.available}`);
                if (capacity.available <= 0) {
                    // Disable create button
                    this.createBtn.setAlpha(0.5);
                    this.createBtn.list[2].disableInteractive();
                } else {
                    this.createBtn.setAlpha(1);
                    this.createBtn.list[2].setInteractive({ useHandCursor: true });
                }
            }
        } catch (err) {
            this.capacityText.setText('Lỗi tải danh sách!');
        }
    }

    renderRows(rooms) {
        this.rowsContainer.removeAll(true);
        if (!rooms || rooms.length === 0) {
            this.rowsContainer.add(this.scene.add.text(0, 0, 'CHƯA CÓ PHÒNG NÀO', {
                fontFamily: '"Press Start 2P", monospace', fontSize: '30px', color: '#bdc3c7'
            }).setOrigin(0.5));
            return;
        }

        const startY = -this.panelH / 2 + 234;
        const rowHeight = 92;
        const rowStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '30px', color: '#e5e7eb' };

        rooms.forEach((r, idx) => {
            const y = startY + (idx * rowHeight);
            
            // Hover bg
            const rowBg = this.scene.add.rectangle(0, y, this.panelW - 40, rowHeight - 8, 0xffffff, 0.05);
            this.rowsContainer.add(rowBg);

            this.rowsContainer.add(this.scene.add.text(this.listCols.code, y, r.code, rowStyle).setOrigin(0, 0.5));
            this.rowsContainer.add(this.scene.add.text(this.listCols.lang, y, r.category || '', rowStyle).setOrigin(0, 0.5));
            this.rowsContainer.add(this.scene.add.text(this.listCols.count, y, `${r.players || 0}/${r.capacity || 30}`, rowStyle).setOrigin(0, 0.5));
            this.rowsContainer.add(this.scene.add.text(this.listCols.owner, y, `${r.ownerUserId || r.ownerId || 'n/a'}`, rowStyle).setOrigin(0, 0.5));

            // Join Button
            const btn = this.scene.add.container(this.listCols.join, y);
            const rbg = this.scene.add.graphics();
            rbg.fillStyle(0x3498db, 1);
            rbg.fillRoundedRect(-76, -28, 152, 56, 8);
            const txt = this.scene.add.text(0, 0, 'JOIN', { fontFamily: '"Press Start 2P", monospace', fontSize: '30px', color: '#fff' }).setOrigin(0.5);
            const hit = this.scene.add.rectangle(0, 0, 152, 56, 0x0, 0).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.onJoin) this.onJoin(r.code);
                });
            btn.add([rbg, txt, hit]);
            this.rowsContainer.add(btn);
        });
    }

    close() {
        this.scene.tweens.add({
            targets: this,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                if (this.onClose) this.onClose();
                this.destroy();
            }
        });
    }
}
