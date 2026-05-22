const { Sequelize } = require("sequelize");

const database = "zdsc" // 数据库名称
const username = "root" // 数据库用户名
const password = "link@Wlk87" // 数据库密码
const option = { // 主机、数据库类型
  host: "localhost",
  dialect: "mysql"
}
const seq = new Sequelize(database, username, password, option);

// 测试连接
// seq.authenticate().then(_ => {
//   console.log("@数据库连接成功");
// }).catch(err => {
//   console.log("@数据库连接失败", err);
// })

module.exports = seq
