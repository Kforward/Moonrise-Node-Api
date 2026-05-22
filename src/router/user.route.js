const Router = require("koa-router")

// 导入自定义中间件
const { userValidator, verifyUser, cryptPassword, verifyLogin } = require("../middleware/user.middleware.js");
const { auth } = require("../middleware/auth.middleware")

// 导入业务处理器
const { register, login, update } = require("../controller/users.controller.js")

// 设置路由前缀
const router = new Router({ prefix: "/users" })

// 使用 POST 请求 '/login' 这里的写法是将 '/login' 去拼接前缀 prefix: '/users' ~~> '/users/login'
router.post("/login", userValidator, verifyLogin, login) // 登录接口
router.post("/register", userValidator, verifyUser, cryptPassword, register) // 注册接口
router.patch("/update", auth, cryptPassword, update) // 修改密码接口

module.exports = router

/**
 * 用户模块-路由规则
 */
