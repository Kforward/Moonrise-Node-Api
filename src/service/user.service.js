const User = require("../model/use.model.js");

class UserService {
  async createUser(user_name, password) {
    // 插入数据 (模型查询-基础) 返回一个 Promise 对象
    // await 表达式: Promise对象成功的值
    const res = await User.create({
      // 需要对应至 表的字段
      user_name,
      password,
    })

    return res.dataValues
  }

  async getUserInfo({ id, user_name, password, is_admin }) {
    const whereOpt = {}

    id && Object.assign(whereOpt, { id });
    user_name && Object.assign(whereOpt, { user_name });
    password && Object.assign(whereOpt, { password });
    is_admin && Object.assign(whereOpt, { is_admin });

    const res = await User.findOne({
      attributes: ["id", "user_name", "password", "is_admin"],
      where: whereOpt,
    });
    return res ? res.dataValues : null;
  }

  async updateById({ id, user_name, password, is_admin }) {
    const whereOpt = { id };
    const newUser = {};

    user_name && Object.assign(newUser, { user_name });
    password && Object.assign(newUser, { password });
    is_admin && Object.assign(newUser, { is_admin });

    // res 等于 1 表示修改成功 等于 0 表示修改失败
    const [res] = await User.update(newUser, { where: whereOpt })
    // console.log(res);
    return (res > 0)
  }
}

module.exports = new UserService()
