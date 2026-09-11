module.exports = {
  apps: [
    {
      name: 'hbe-backend',
      cwd: __dirname,
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
