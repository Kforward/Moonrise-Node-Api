const fs = require("fs");

const Router = require("koa-router");
const router = new Router();

fs.readdirSync(__dirname).forEach(fileName => {
  if (fileName !== "index.js") {
    let r = require(`./${fileName}`);
    router.use(r.routes());
  }
})

// 导出后，在`src/app/index.js`文件中进行导入
module.exports = router

/*
 * 自动注册路由
*/
