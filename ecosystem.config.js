module.exports = {
  apps: [{
    "name": "moonrise-node-api",
    "cwd": "./",
    "script": "./dist/main.js",
    "log_date_format": "YYYY-MM-DD HH:mm Z",
    "error": "./logs/node-app.stderr.log",
    "output": "./logs/node-app.stdout.log",
    "instances": 1,
    "min_uptime": "200s",
    "max_restarts": 10,
    "max_memory_restart": "512M",
    "cron_restart": "1 0 * * *",
    "watch": false,
    "merge_logs": true,
    "exec_interpreter": "node",
    "exec_mode": "fork",
    "autorestart": true,
    "vizion": false
  }],

  deploy: {
    production: {
      user: "SSH_USERNAME",
      host: "SSH_HOSTMACHINE",
      ref: "origin/main",
      repo: "GIT_REPOSITORY",
      path: "DESTINATION_PATH",
      "pre-deploy-local": "",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": ""
    }
  }
};
