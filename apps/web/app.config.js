import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    serverUrl: process.env.VITE_SERVER_URL || 'http://localhost:3000',
  },
});
