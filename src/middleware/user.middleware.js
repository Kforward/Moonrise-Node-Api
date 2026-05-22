const bcrypt = require("bcryptjs");
const { getUserInfo } = require("../service/user.service.js");
const { userFormateError, userAlreadyExited, userRegisterError, userLoginError, userDoesNotExist, invalidPasswordError } = require("../constant/err.type.js")

// 验证器
const userValidator = async (ctx, next) => {
  const { user_name, password } = ctx.request.body

  // 合法性
  if (!user_name || !password) {
    console.error("用户名或密码为空", ctx.request.body);
    ctx.app.emit("error", userFormateError, ctx);

    return;
  }

  // 交由下一个中间件处理
  await next();
}

// 用户验证
const verifyUser = async (ctx, next) => {
  const { user_name } = ctx.request.body
  try {
    const res = await getUserInfo({ user_name })
    // 合理性
    if (res) {
      ctx.app.emit("error", userAlreadyExited, ctx);
      return;
    }

    await next();
  } catch (_) {
    console.log(_);
    ctx.app.emit("error", userRegisterError, ctx)
  }
}

// 密码处理
const cryptPassword = async (ctx, next) => {
  const { password } = ctx.request.body

  const salt = bcrypt.genSaltSync(10);

  // hash 保存的是密文
  const hash = bcrypt.hashSync(password, salt)

  ctx.request.body.password = hash

  await next()
}

// 登录处理中间件
const verifyLogin = async(ctx, next) => {
  const { user_name, password } = ctx.request.body
  try {
    // 1. 根据用户名查询用户是否存在(不存在： 报错)
    const res = await getUserInfo({ user_name })
    if (!res) {
      console.error("用户不存在", { user_name });
      ctx.app.emit("error", userDoesNotExist, ctx)
      return
    }

    // 2. 用户存在，密码是否匹配（不匹配：报错）
    if (!bcrypt.compareSync(password, res.password)) {
      ctx.app.emit("error", invalidPasswordError, ctx)
      return
    }
    await next()
  } catch (err) {
    console.error("@用户不存在");
    ctx.app.emit("error", userLoginError, ctx);
  }
}

module.exports = {
  userValidator,
  verifyUser,
  verifyLogin,
  cryptPassword
}
