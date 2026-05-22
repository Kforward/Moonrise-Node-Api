const jwt = require("jsonwebtoken")
const { JWT_SECRET } = require("../config/config.default")
const { createUser, getUserInfo, updateById } = require("../service/user.service.js");
const { userRegisterError, updateUserPasswordError } = require("../constant/err.type.js")

class UserController {
  // 处理注册业务
  async register(ctx, next) {
    // 1、获取数据
    const { user_name, password } = ctx.request.body
    // 2、操作数据库
    try {
      const res = await createUser(user_name, password)
      // 3、返回一个结果
      ctx.body = {
        code: 0,
        message: "用户注册成功",
        result: {
          id: res.id,
          userName: res.user_name
        }
      }
    } catch (err) {
      console.log(err);
      ctx.app.emit("error", userRegisterError, ctx)
    }
  }

  // 处理登录业务
  async login(ctx, next) {
    const { user_name } = ctx.request.body

    // 1. 获取用户信息 （在 token 的 payLoad 中记录id, user_name, is_admin）
    try {
      // 从返回结果对象中，剔除 password 属性，将剩下的属性，放在一个新的对象 resUser 中
      const { password, ...resUser } = await getUserInfo({ user_name })
      console.log("@password", password);
      ctx.body = {
        code: "0",
        message: "用户登录成功",
        result: {
          // expiresIn: 1d 表示一天过后在过期
          token: jwt.sign(resUser, JWT_SECRET, { expiresIn: "1d" }),
        }
      }
    } catch (err) {
      console.error("@获取错误", err);
    }
  }

  // 处理修改密码业务
  async update(ctx, next) {
    // 1. 获取数据
    const id = ctx.state.user.id
    const password = ctx.request.body.password

    // 2. 操作数据库
    const res = await updateById({ id, password });

    if (res) {
      ctx.body = {
        code: "0",
        message: "修改密码成功",
        result: ""
      }
    } else {
      ctx.app.emit("error", updateUserPasswordError, next)
    }
  }
}

// 导出 UserController 实例对象
module.exports = new UserController()

/**
 * 用户模块-接口处理器
 */
