require('dotenv').config();
const RedisClient = require('./src/config/RedisClient');
const Logger = require('./src/utils/Logger');

async function test() {
    console.log('--- Verification: P3 Optimization ---');

    console.log('1. Testing Helper Logger...');
    Logger.info('Verify', 'This is a test log', { foo: 'bar' });

    console.log('2. Testing Redis Connection...');
    await RedisClient.connect();

    if (RedisClient.isConnected) {
        console.log('   [PASS] Redis Connected');

        console.log('3. Testing Redis Leaderboard...');
        await RedisClient.zAdd('test_leaderboard', 100, 'PlayerA');
        await RedisClient.zAdd('test_leaderboard', 200, 'PlayerB');

        const top = await RedisClient.zRevRangeWithScores('test_leaderboard', 0, 10);
        console.log('   Top Players:', top);

        if (top.length === 2 && top[0].value === 'PlayerB') {
            console.log('   [PASS] Redis Sorted Set Order');
            console.log('--- VERIFICATION SUCCESS ---');
            process.exit(0);
        } else {
            console.error('❌ FAIL: Leaderboard order incorrect', top);
            process.exit(1);
        }
    } else {
        console.error('❌ FAIL: Redis Not Connected (Did you run docker-compose up?)');
        // Note: In CI/Automated env without Docker, this fails.
        // For this agent session, if fail, we assume infrastructure missing.
        process.exit(1);
    }
}

test();
