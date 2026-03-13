import { CONFIG } from '../../config/AppConfig';
import { Logger } from '../../utils/Logger';

class RoomService {
    async createCustomRoom(category) {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Bạn cần đăng nhập để tạo phòng custom.');

        const res = await fetch(`${CONFIG.SERVER_URL}/api/rooms/custom`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ category }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.message || 'Tạo phòng thất bại');
        }
        Logger.info('RoomService', `Created custom room ${data.code}`);
        return data;
    }

    async getRoomMeta(code) {
        const res = await fetch(`${CONFIG.SERVER_URL}/api/rooms/meta/${code}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.message || 'Không tìm thấy phòng');
        }
        return data;
    }

    async listRooms() {
        const res = await fetch(`${CONFIG.SERVER_URL}/api/rooms/custom/list`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.message || 'Không lấy được danh sách phòng');
        }
        return data; // { rooms: [...], capacity }
    }

    async getCapacity() {
        const res = await fetch(`${CONFIG.SERVER_URL}/api/rooms/custom/capacity`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.message || 'Không lấy được sức chứa');
        }
        return data; // { max, current, available }
    }
}

export const roomService = new RoomService();
