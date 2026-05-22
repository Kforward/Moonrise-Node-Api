const Koa = require("koa");
const route = require("koa-router")();

const websockify = require("koa-websocket")

const app = websockify(new Koa());

// 创建socket接口
route.all("/kapi/socket/init", async (ctx, next) => {
  ctx.websocket.on("message", msg => {
    console.log("前端发过来的数据：", msg.toString("utf8"))
    ctx.websocket.send("message")
  })

  return next(ctx)
})

app.ws.use(route.routes()).use(route.allowedMethods());

module.exports = app;
