const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config.default");
const { tokenExpiredError, invalidToken, hasNotAdminPermission } = require("../constant/err.type")

// 判断用户是否登录
const auth = async (ctx, next) => {
  // 获取请求头header中的token信息
  const { authorization } = ctx.request.header;

  const token = authorization.replace("Bearer ", "");

  try {
    // user 中包含了 payload 的信息(id, user_name, is_admin)
    const user = jwt.verify(token, JWT_SECRET);
    ctx.state.user = user
  } catch (err) {
    switch (err.name) {
      case "TokenExpiredError":
        console.error("token过期", err);
        return ctx.app.emit("error", tokenExpiredError, ctx);
      case "JsonWebTokenError":
        console.error("token无效", err);
        return ctx.app.emit("error", invalidToken, ctx);
    }
  }
  await next();
}

// 判断用户是否是管理员
const hadAdminPermission = async (ctx, next) => {
  const { is_admin } = ctx.state.user

  if (!is_admin) {
    console.error("该用户没有授权", ctx.state.user);

    return ctx.app.emit("error", hasNotAdminPermission, ctx)
  }

  await next();
}

module.exports = {
  auth,
  hadAdminPermission
}
