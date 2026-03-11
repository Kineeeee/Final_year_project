import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { roomService } from '../../core/services/RoomService';

// Simple DOM overlay to list and join custom rooms
export class CustomRoomOverlay {
    constructor({ onJoin, onCreate, onClose } = {}) {
        this.onJoin = onJoin;
        this.onCreate = onCreate;
        this.onClose = onClose;
        this.root = null;
        this.tableBody = null;
        this.createBtn = null;
        this.capacityInfo = null;
        this.blockToken = null;
    }

    async open() {
        if (this.root) return;
        this.blockToken = overlayBlocker.block('custom-room');

        this.root = document.createElement('div');
        this.root.className = 'quiz-overlay';
        this.root.innerHTML = `
            <div class="quiz-overlay__backdrop"></div>
            <div class="quiz-overlay__panel">
                <div class="quiz-overlay__header">
                    <h2>Custom Rooms</h2>
                    <button id="custom-close" class="btn btn-secondary">✕</button>
                </div>
                <div class="quiz-overlay__body" style="max-height:400px;">
                    <div id="capacity-info" class="mb-2" style="color:#ccc; font-size:14px;"></div>
                    <div class="quiz-overlay__section">
                        <table class="room-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Category</th>
                                    <th>Players</th>
                                    <th>Owner</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="room-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="quiz-overlay__footer" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                    <button id="custom-create" class="btn btn-primary">Create Room</button>
                    <span style="font-size:12px; color:#bbb;">Custom rooms use your uploaded quiz. Only owners can start.</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.root);
        this.tableBody = this.root.querySelector('#room-body');
        this.createBtn = this.root.querySelector('#custom-create');
        this.capacityInfo = this.root.querySelector('#capacity-info');

        this.root.querySelector('#custom-close').onclick = () => this.close();
        this.createBtn.onclick = () => {
            if (this.onCreate) this.onCreate();
        };

        await this.refresh();
    }

    async refresh() {
        if (!this.tableBody) return;
        try {
            const { rooms = [], capacity } = await roomService.listRooms();
            this.renderRows(rooms);
            this.updateCapacity(capacity, rooms.length);
        } catch (err) {
            this.tableBody.innerHTML = `<tr><td colspan="5" style="color:#f66;">${err.message || 'Failed to load rooms'}</td></tr>`;
        }
    }

    renderRows(rooms) {
        this.tableBody.innerHTML = '';
        if (!rooms || rooms.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="5" style="color:#bbb;">No rooms yet. Create one!</td></tr>';
            return;
        }

        rooms.forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.code}</td>
                <td>${r.category || ''}</td>
                <td>${r.players || 0}/${r.capacity || 30}</td>
                <td>${r.ownerUserId || r.ownerId || 'n/a'}</td>
                <td><button class="btn btn-primary" data-code="${r.code}">Join</button></td>
            `;
            tr.querySelector('button').onclick = () => {
                if (this.onJoin) this.onJoin(r.code);
            };
            this.tableBody.appendChild(tr);
        });
    }

    updateCapacity(capacityObj, current) {
        if (!this.capacityInfo) return;
        if (!capacityObj) {
            this.capacityInfo.textContent = '';
            return;
        }
        const { max, current: cur, available } = capacityObj;
        this.capacityInfo.textContent = `Rooms: ${cur}/${max} · Slots available: ${available}`;
        const canCreate = available > 0;
        if (this.createBtn) this.createBtn.disabled = !canCreate;
    }

    close() {
        if (this.root) {
            this.root.remove();
            this.root = null;
            if (this.blockToken) {
                overlayBlocker.unblock(this.blockToken);
                this.blockToken = null;
            }
        }
        if (this.onClose) this.onClose();
    }
}

// Basic styles reuse .quiz-overlay; add a thin table style
const styleId = 'custom-room-overlay-style';
if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .room-table { width: 100%; border-collapse: collapse; }
        .room-table th, .room-table td { padding: 8px 10px; border-bottom: 1px solid #2d3748; text-align: left; color: #e5e7eb; }
        .room-table th { color: #9ca3af; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
        .room-table tr:hover { background: rgba(255,255,255,0.04); }
        .btn { padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-family: "Outfit", sans-serif; font-weight: 600; }
        .btn-primary { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; }
        .btn-secondary { background: #4b5563; color: #e5e7eb; }
    `;
    document.head.appendChild(style);
}
