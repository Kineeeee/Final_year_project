import io from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';
import { CONFIG } from '../../config/constants';
import { Logger } from '../../utils/Logger';

class SocketService {
    constructor() {
        this.socket = null;
    }

    /**
     * Establish a connection to the server
     * @param {string} [url] - Server URL (defaults to CONFIG.SERVER_URL)
     * @param {Object} [options] - Socket.io options
     * @returns {Object} The socket instance
     */
    connect(url, options = {}) {
        const targetUrl = url || CONFIG.SERVER_URL;

        // Guarantee fresh session when requested or URL changes to avoid stale listeners.
        if (this.socket) {
            const urlChanged = this.currentUrl && this.currentUrl !== targetUrl;
            if (options.forceNew || urlChanged) {
                this.disconnect();
            } else if (this.socket.connected) {
                return this.socket;
            }
        }

        if (!this.socket) {
            Logger.info('Network', `Connecting to ${targetUrl}`);
            const finalOptions = Object.assign({ parser }, options);
            this.socket = io(targetUrl, finalOptions);
            this.currentUrl = targetUrl;

            this.socket.on('connect', () => {
                Logger.info('Network', `Connected with ID: ${this.socket.id}`);
            });

            this.socket.on('disconnect', () => {
                Logger.info('Network', 'Disconnected from server');
            });

            this.socket.on('connect_error', (err) => {
                Logger.error('Network', 'Connection error:', err);
            });
        }

        return this.socket;
    }

    /**
     * Disconnect the socket
     */
    disconnect() {
        if (this.socket) {
            Logger.info('Network', 'Disconnecting socket...');
            this.socket.disconnect();
            this.socket = null;
            this.currentUrl = null;
        }
    }

    /**
     * Emit an event to the server
     * @param {string} event - Event name
     * @param {any} data - Payload
     */
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        } else {
            Logger.warn('Network', `Cannot emit '${event}': Socket not connected`);
        }
    }

    /**
     * Listen for an event from the server
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} [callback] - Specific callback to remove
     */
    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    /**
     * Get the raw socket instance
     * @returns {Object|null}
     */
    getSocket() {
        return this.socket;
    }
}

export const socketService = new SocketService();
