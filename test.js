const Websocket = require("ws")

// 链接服务器
const ws = new Websocket("ws://localhost:30001/websocket");

ws.on("open", () => {
  console.log("链接成功")
  ws.send("这是一条测试消息")
})

ws.on("message", (data) => {
  console.log("接收到的消息：", data)
})

ws.on("close", () => {
  console.log("链接关闭")
})

ws.on("error", (error) => {
  console.error("链接出错", error)
})
