module.exports = {
  apps: [{
    "name": "koa-api",
    "cwd": "./",
    "script": "./src/main.js",
    "log_date_format": "YYYY-MM-DD HH:mm Z",
    "error": "./logs/node-app.stderr.log",
    "output": "./logs/node-app.stdout.log",
    "instances": 6,
    "min_uptime": "200s",
    "max_restarts": 10,
    "max_memory_restart": "1M",
    "cron_restart": "1 0 * * *",
    "watch": [
      "bin",
      "utils",
      "controllers",
      "models",
      "public",
      "routes",
      "views"
    ],
    "merge_logs": true,
    "exec_interpreter": "node",
    "exec_mode": "fork",
    "autorestart": false,
    "vizion": false
  }],

  deploy: {
    production: {
      user: "SSH_USERNAME",
      host: "SSH_HOSTMACHINE",
      ref: "origin/master",
      repo: "GIT_REPOSITORY",
      path: "DESTINATION_PATH",
      "pre-deploy-local": "",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": ""
    }
  }
};
