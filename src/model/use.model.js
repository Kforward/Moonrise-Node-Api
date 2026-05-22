const { DataTypes } = require("sequelize");
const seq = require("../db/seq");

/** 定义模型(Model zd_user -> zd_users)
 * @param { String } zd_user - 表名
 * @param { Object } attribute - 属性 对应数据库表中的字段
 * @param { Object } option - 配置 其他模型参数
*/
const User = seq.define("zd_user", {
  // id 会被 sequelize 自动创建，管理
  user_name: {
    type: DataTypes.STRING, // 设置数据类型
    allowNull: false, // 列的字段约束
    unique: true, // 该字段是唯一的
    comment: "用户名，唯一", // 表的注释
  },
  password: {
    type: DataTypes.CHAR(64),
    allowNull: false,
    comment: "密码",
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: 0, // 默认值
    comment: "是否为管理员，0：不是管理员（默认）；1：是管理员",
  }
})

/** 强制同步数据库（创建数据表）
 * force: true(模型同步) 如果之前有该数据表，那么就会删除之前的表，去创建一个新的数据表，如果为 false 就不会去删除之前的数据表
 * 同步完毕后，注释掉
 */

// User.sync({ force: true })

module.exports = User
