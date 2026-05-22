// 引入环境变量
const { APP_PORT, SOCKET_PORT } = require("./config/config.default.js")

// 导入 app 对象
const app = require("./app/index.js");

// 导入 websocket 对象
const socket = require("./socket/index.js");

// 端口监听 "_" 表示声明一个不会被引用的变量
app.listen(APP_PORT, _ => {
  console.log(`server is running on http://localhost:${APP_PORT}`);
});

socket.listen(SOCKET_PORT, _ => {
  console.log(`socket server is running on ws://localhost:${SOCKET_PORT}`);
});

/**
 * 总的入口文件
 */
