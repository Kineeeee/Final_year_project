const { createClient } = require('redis');
const Logger = require('../../utils/Logger');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.isDisabled = false;
        this.hasLoggedUnavailable = false;
    }

    async connect() {
        if (this.isDisabled || this.isConnected || this.isConnecting) return;

        if ((process.env.REDIS_ENABLED || 'false').toLowerCase() !== 'true') {
            this.isDisabled = true;
            if (!this.hasLoggedUnavailable) {
                Logger.info('Redis', 'Redis is disabled (set REDIS_ENABLED=true to enable).');
                this.hasLoggedUnavailable = true;
            }
            return;
        }

        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        this.isConnecting = true;

        try {
            this.client = createClient({
                url,
                socket: {
                    connectTimeout: 2000,
                    reconnectStrategy: () => false,
                },
            });

            this.client.on('error', (err) => {
                if (!this.hasLoggedUnavailable) {
                    Logger.warn('Redis', `Client unavailable: ${err?.code || err?.message || 'unknown error'}`);
                    this.hasLoggedUnavailable = true;
                }
            });
            this.client.on('connect', () => Logger.info('Redis', 'Connected to Redis'));

            await this.client.connect();
            this.isConnected = true;
            this.hasLoggedUnavailable = false;
        } catch (err) {
            this.isDisabled = true;
            this.client = null;
            if (!this.hasLoggedUnavailable) {
                Logger.warn('Redis', `Redis disabled after failed connect: ${err?.code || err?.message || 'unknown error'}`);
                this.hasLoggedUnavailable = true;
            }
        } finally {
            this.isConnecting = false;
        }
    }

    async zAdd(key, score, member) {
        if (!this.isConnected) return;
        return this.client.zAdd(key, { score, value: member });
    }

    async zIncrBy(key, increment, member) {
        if (!this.isConnected) return;
        return this.client.zIncrBy(key, increment, member);
    }

    async zRem(key, member) {
        if (!this.isConnected) return;
        return this.client.zRem(key, member);
    }

    async zAddBatch(key, members) {
        if (!this.isConnected) return;
        // members = [{ score: 10, value: 'name' }, ...]
        return this.client.zAdd(key, members);
    }

    async zRevRangeWithScores(key, start, stop) {
        if (!this.isConnected) return [];
        return this.client.zRangeWithScores(key, start, stop, { REV: true });
    }

    // Hash Operations for Metadata
    async hSet(key, field, value) {
        if (!this.isConnected) return;
        return this.client.hSet(key, field, value);
    }

    async hMSet(key, obj) {
        if (!this.isConnected) return;
        return this.client.hSet(key, obj);
    }

    async hGet(key, field) {
        if (!this.isConnected) return null;
        return this.client.hGet(key, field);
    }

    async hGetAll(key) {
        if (!this.isConnected) return {};
        return this.client.hGetAll(key);
    }

    async hDel(key, field) {
        if (!this.isConnected) return;
        return this.client.hDel(key, field);
    }

    async mGet(keys) {
        if (!this.isConnected) return [];
        return this.client.mGet(keys);
    }

    async hmGet(key, fields) {
        if (!this.isConnected) return [];
        return this.client.hmGet(key, fields);
    }
}

module.exports = new RedisClient();
