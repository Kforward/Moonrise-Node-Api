// 引入 dotenv
const dotenv = require("dotenv")

// 设置配置参数
dotenv.config()

// process: 当前应用进程; env: 环境变量;
module.exports = process.env
