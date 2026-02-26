cách sử dụng log

// import log vào file mày muốn check
import { Logger } from '../utils/Logger';

các cách ghi log:

// Ghi thông tin bình thường
Logger.info('Game', 'Game started');

// Ghi thông tin debug (chi tiết, thường dùng khi dev)
Logger.debug('Snake', 'Position:', x, y);

// Ghi cảnh báo
Logger.warn('Physics', 'Collision detected but ignored');

// Ghi lỗi
Logger.error('Network', 'Connection failed');
