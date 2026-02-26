const { createClient } = require('redis');
const Logger = require('../../utils/Logger');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) return;

        const url = process.env.REDIS_URL || 'redis://localhost:6379';

        try {
            this.client = createClient({ url });

            this.client.on('error', (err) => Logger.error('Redis', 'Client Error', err));
            this.client.on('connect', () => Logger.info('Redis', 'Connected to Redis'));

            await this.client.connect();
            this.isConnected = true;
        } catch (err) {
            Logger.error('Redis', 'Failed to connect', err);
            // Non-fatal? Game can run without Redis if we fallback, but for P3 we assume it's needed
            // For now, let's just log error.
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
