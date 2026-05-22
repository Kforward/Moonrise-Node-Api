const Router = require("koa-router")

// 导入自定义中间件
const { auth, hadAdminPermission } = require("../middleware/auth.middleware")

// 导入业务处理器
const { upload } = require("../controller/goods.controller.js")

// 设置路由前缀
const router = new Router({ prefix: "/goods" });

router.post("/upload", auth, hadAdminPermission, upload)

module.exports = router
