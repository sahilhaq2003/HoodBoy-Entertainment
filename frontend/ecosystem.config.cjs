module.exports = {
  apps: [{
    name: 'hbe-frontend',
    cwd: __dirname,
    script: 'npm',
    args: 'start',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '400M',
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
