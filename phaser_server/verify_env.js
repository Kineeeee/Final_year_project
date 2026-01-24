require('dotenv').config();

console.log('--- Verification: Environment Variables ---');

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error('❌ FAIL: MONGO_URI is missing!');
    process.exit(1);
}

if (!uri.startsWith('mongodb+srv://')) {
    console.error('❌ FAIL: MONGO_URI does not look like a proper connection string');
    console.log('Current Value:', uri);
    process.exit(1);
}

console.log('✅ PASS: MONGO_URI is loaded correctly.');
console.log('--- VERIFICATION SUCCESS ---');
process.exit(0);
