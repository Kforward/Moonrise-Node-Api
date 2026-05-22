const path = require("path")

// 引入 koa
const Koa = require("koa");

// 引入 Koa-Body 对请求参数进行解析
const koaBody = require("koa-body").default
const koaStatic = require("koa-static")

// 引入错误处理程序
const errorHandler = require("./errorHandler.js")

// 创建 app 实例
const app = new Koa();

// 引入 相关路由规则
const routers = require("../router");

// 在请求中间件之前注册 koaBody
app.use(koaBody({
  multipart: true, // 配置开启上传文件的功能 - 默认为false
  formidable: {
    // 在 option 中的相对路径，不是相对当前文件，而是相对 process.cwd() 当前进程所运行的
    uploadDir: path.join(__dirname, "../uploads"), // 上传的文件保存在那个目录下 - 在配置选项 option 中不推荐使用相对路径 `../uploads`
    keepExtensions: true // 保持展示文件的扩展名
  }
}))
// 注册koa-static静态资源文件目录
app.use(koaStatic(path.join(__dirname, "../uploads")))

// 注册中间件 app.use接收的是一个函数类型的参数 routers 通过routes()方法返回一个函数
// allowedMethods限制http请求方式 冷门方式返回 501
app.use(routers.routes()).use(routers.allowedMethods())

// 统一的错误处理
app.on("error", errorHandler)

// 导出 app 对象
module.exports = app

/**
 * 业务入口
 */
