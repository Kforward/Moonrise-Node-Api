# 一、项目的初始化

## 1 npm 初始化

```bash
$ npm init -y
```

生成`package。json`文件：

* 记录项目依赖

## 2 git 初始化

```bash
$ git init
```

生成`.git`隐藏文件夹，git的本地仓库

## 3 创建README文件

# 二、搭建项目

## 1 安装Koa框架

```bahs
$ npm install koa
```

## 2 编写最基本的app

创建 `src/main.js` 

```js
// 引入 koa
const Koa = require('koa')

// 创建 app 实例
const app = new Koa()

// 编写中间件  ctx 对应着 http 的所有上下文
app.use((ctx, next) => {
  // 响应
  ctx.body = 'hello api'
})

// 端口监听
app.listen(3000, _ => {
  console.log("server is running on http://localhost:3000");
})
```

## 3 测试

在终端，使用 `node src/main.js`

# 三、项目的基本优化

## 1 自动重启服务

安装 nodemon 工具

```bash
# 使用 -D 安装，在上线后就不会出现在生产环境中
$ npm i nodemon -D
```

编写`package.json`脚本

```json
"scripts": {
    "dev": "nodemon ./src/main.js",
        "test": "echo \"Error: no test specified\" && exit 1"
},
```

## 2 读取配置文件

安装`dotenv`，读取根目录中的`.env` 文件，将配置写入到`process.env`中

```bas
$ npm i dotenv
```

创建`.env`文件

```
APP_PORT = 8000
```

创建 `src/config/config.default.js`

```js
// 引入 dotenv
const dotenv = require('dotenv')

// 设置配置参数
dotenv.config()

// process: 当前应用进程; env: 环境变量;
module.exports = process.env
```

改写`main.js`

```js
// 引入 koa
const Koa = require('koa')
// 引入环境变量
const { APP_PORT } = require('./config/config.default.js')


// 创建 app 实例
const app = new Koa()

// 编写中间件  ctx 对应着 http 的所有上下文
app.use((ctx, next) => {
  // 响应
  ctx.body = 'hello api'
})

// 端口监听
app.listen(APP_PORT, _ => {
  console.log(`server is running on http://localhost:${APP_PORT}`);
})
```

# 四、添加路由

路由: 根据不同的URL，调用对应的处理函数

## 1 安装 koa-router

```bash
$ npm i koa-router
```

步骤：

1. 导入包
2. 实例化对象
3. 编写路由
4. 注册中间件

## 2 拆分路由

创建 `src/router` 目录，编写`user.route.js` 

```js
const Router = require('koa-router')

const router = new Router({ prefix: '/users' })

// 使用 GET 请求 '/users' 这里的写法是将 '/' 去拼接前缀 prefix: '/users' ~~> '/users/'
router.get('/', (ctx, next) => {
  ctx.body = 'hello users'
})

module.exports = router
```

## 3 改写 main.js

```js
// 引入 koa
const Koa = require('koa')
// 引入环境变量
const { APP_PORT } = require('./config/config.default.js')

// 创建 app 实例
const app = new Koa()

// 引入 路由规则
const userRouter = require('./router/user.route.js')

// 注册中间件 app.use接收的是一个函数类型的参数
app.use(userRouter.routes())

// 端口监听 "_" 表示声明一个不会被引用的变量
app.listen(APP_PORT, _ => {
  console.log(`server is running on http://localhost:${APP_PORT}`);
})
```



# 五、目录结构优化

## 1 将 http服务和app业务拆分

创建`src/app/index.js`

```js
// 业务相关代码
// 引入 koa
const Koa = require('koa')

// 创建 app 实例
const app = new Koa()

// 引入 路由规则
const userRouter = require('../router/user.route.js')

// 注册中间件 app.use接收的是一个函数类型的参数
app.use(userRouter.routes())

// 导出 app 对象
module.exports = app
```

改写`main.js`

```js
// 引入环境变量
const { APP_PORT } = require('./config/config.default.js')

// 导入 app 对象
const app = require('./app/index.js')

// 端口监听 "_" 表示声明一个不会被引用的变量
app.listen(APP_PORT, _ => {
  console.log(`server is running on http://localhost:${APP_PORT}`);
})
```

## 2 将路由和控制器拆分

路由：解析URL，根据不同的URL进行分发给控制器对应的方法

控制器：处理不同的具体的业务

改写`user.route.js`

```js
const Router = require('koa-router')

// 导入业务处理器
const { register, login } = require('../controller/users.controller.js')

// 设置路由前缀
const router = new Router({ prefix: '/users' })

// 使用 POST 请求 '/login' 这里的写法是将 '/login' 去拼接前缀 prefix: '/users' ~~> '/users/login'
router.post('/login', login)  // 登录
router.post('/register', register)  // 注册

module.exports = router

/**
 * 用户模块-路由规则
 */
```

创建`controller/user.controller.js`

```js
class UserController {
  // 处理注册业务
  async register(ctx, next){
    ctx.body = '注册成功'
  }

  // 处理登录业务
  async login(ctx, next){
    ctx.body = '登录成功'
  }
}

// 导出 UserController 实例对象
module.exports = new UserController()

/**
 * 用户模块-接口处理器
 */
```

# 六、解析 body

## 1、安装 koa-body

```bash
$ npm i koa-body
```

## 2、注册中间件

改写 `app/index.js`

```js
// 引入 Koa-Body 对请求参数进行解析
const koaBody = require("koa-body").default

// 在请求中间件之前注册 koaBody
app.use(koaBody())
```

![1668687751859](C:\Users\lenovo\AppData\Local\Temp\1668687751859.png)

## 3、解析数据

改写`users.controller.js`

```js
class UserController {
  // 处理注册业务
  async register(ctx, next) {
    // 1、获取数据
    console.log("@请求数据", ctx.request.body);
    const { user_name, password } = ctx.request.body
    // 2、操作数据库
    const res = await createUser(user_name, password)
    console.log(res);

    // 3、返回一个结果
    ctx.body = res
  }

  // 处理登录业务
  async login(ctx, next) {
    ctx.body = "登录成功"
  }
}

```

![1668687890846](C:\Users\lenovo\AppData\Local\Temp\1668687890846.png)

## 4、拆分 servicce 层

service 层主要是做数据库处理 `/service/user.service.js`

```js
class UserService {
  async createUser(user_name, password) {
    // TODO: 写入数据库
    return "写入数据库成功"
  }
}

module.exports = new UserService()
```

# 七、数据库操作

sequelize ORM数据库工具

ORM：对象关系映射 将数据表当做对象（面向对象的方式操作数据库）

* 数据表映射（对应）一个对象；
* 数据表中的数据行（记录）对应一个对象（由类实例化出来的对象）；
* 数据表中的字段会映射成对象的属性
* 数据表的操作对应成对象的方法



## 1 安装 sequelize mysql2

```bash
$ npm i sequelize mysql2
```

## 2 连接数据库

`src/db/req.js`

```js
const { Sequelize } = require("sequelize");

const database = "zdsc" // 数据库名称
const username = "root" // 数据库用户名
const password = "123456" // 数据库密码
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

```

# 八、创建User模型

## 1 拆分Model层

sequelize 主要通过 Model 对应数据表

创建`src/model/user.model.js`

```js
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

```

# 九、添加用户入库

## 1 数据库插入数据

改写`user.service.js`

```js
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

    console.log("@数据库操作结果", res);

    return res.dataValues
  }
}

module.exports = new UserService()

```

改写 `user.controller.js`

```js
const { createUser } = require("../service/user.service.js")

class UserController {
  // 处理注册业务
  async register(ctx, next) {
    // 1、获取数据
    console.log("@请求数据", ctx.request.body);
    const { user_name, password } = ctx.request.body
    // 2、操作数据库
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
  }

  // 处理登录业务
  async login(ctx, next) {
    ctx.body = "登录成功"
  }
}

// 导出 UserController 实例对象
module.exports = new UserController()

/**
 * 用户模块-接口处理器
 */

```

## 2 数据库查询数据（判断用户是否已存在）

`user.service.js`

```js
const User = require("../model/use.model.js");

class UserService {
  // 创建数据
  async createUser(user_name, password) {
    // 插入数据 (模型查询-基础) 返回一个 Promise 对象
    // await 表达式: Promise对象成功的值
    const res = await User.create({
      // 需要对应至 表的字段
      user_name,
      password,
    })

    console.log("@数据库操作结果", res);

    return res.dataValues
  }
	
  // 查询数据
  async getUserInfo({ id, user_name, password, is_admin }) {
    const whereOpt = {}

    id && Object.assign(whereOpt, { id });
    user_name && Object.assign(whereOpt, { user_name });
    password && Object.assign(whereOpt, { password });
    is_admin && Object.assign(whereOpt, { is_admin });

    const res = await User.findOne({
      attributes: ["id", "user_name", "password", "is_admin"],
      where: whereOpt,
    })
    return res ? res.dataValues : null
  }
}

module.exports = new UserService()

```

`user.controller.js`

```js
const { createUser, getUserInfo } = require("../service/user.service.js")

class UserController {
  // 处理注册业务
  async register(ctx, next) {
    // 1、获取数据
    console.log("@请求数据", ctx.request.body);
    const { user_name, password } = ctx.request.body

    // 合法性
    if (!user_name || !password) {
      console.error("用户名或密码为空", ctx.request.body);
      ctx.status = 400
      ctx.body = {
        code: 100001,
        message: "用户名或密码为空",
        result: ""
      }
    }
    // 合理性
    if (getUserInfo({ user_name })) {
      ctx.status = 409 // 当请求与服务器的当前状态冲突时，将发送此响应。
      ctx.body = {
        code: "10002",
        message: "用户名存在",
        result: ""
      }
      return
    }

    // 2、操作数据库
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
  }

  // 处理登录业务
  async login(ctx, next) {
    ctx.body = "登录成功"
  }
}

// 导出 UserController 实例对象
module.exports = new UserController()

/**
 * 用户模块-接口处理器
 */

```

# 十、自定义中间件（抽分出用户输入校验）

## 1 自定义中间件

`/src/middleware/user.middleware.js`

`ctx.app.emit("error", userFormateError, ctx);` 调用 koa 的`emit/on`方法进行错误监听；

`userFormateError` 单独抽离成一个 错误处理函数 --> `/src/app/errorHandler.js`

```js
const { getUserInfo } = require("../service/user.service.js");
const { userFormateError, userAlreadyExited } = require("../constant/err.type.js")

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

const verifyUser = async (ctx, next) => {
  const { user_name } = ctx.request.body
  const res = await getUserInfo({ user_name })
  // 合理性
  if (res) {
    ctx.app.emit("error", userAlreadyExited, ctx);
    return;
  }

  await next();
}

module.exports = {
  userValidator,
  verifyUser
}

```

## 2 抽离错误处理方法

`src/constant/err.type.js` 定义错误常量

```js
module.exports = {
  userFormateError: {
    code: "10001",
    message: "用户名或密码为空",
    result: ""
  },
  userAlreadyExited: {
    code: "10002",
    message: "用户名已经存在",
    result: ""
  },
  userRegisterError: {
    code: "10003",
    message: "用户注册错误",
    result: ""
  }
}

```



 `errorHandler.js` 错误内容提示分发

```js
module.exports = (error, ctx) => {
  let errorObjectMapTable = {
    "10001": 400,
    "10002": 409,
    default: 500
  }
  // 当 errorObjectMapTable[error.code] === null or undefined 时 会返回 ?? 右侧的内容
  ctx.status = errorObjectMapTable[error.code] ?? errorObjectMapTable["default"]
  ctx.body = error
}

```

改写 `app/index.js`

```js
// 引入 koa
const Koa = require("koa");

// 引入 Koa-Body 对请求参数进行解析
const koaBody = require("koa-body").default

// 引入错误处理程序
const errorHandler = require("./errorHandler.js")

// 创建 app 实例
const app = new Koa();

// 引入 用户接口 相关路由规则
const userRouter = require("../router/user.route.js");

// 在请求中间件之前注册 koaBody
app.use(koaBody())
// 注册中间件 app.use接收的是一个函数类型的参数 userRouter 通过routes()方法返回一个函数
app.use(userRouter.routes())

// 在最后监听 统一的错误处理
app.on("error", errorHandler)

// 导出 app 对象
module.exports = app

/**
 * 业务入口
 */

```

## 3 中间件调用 

`/src/router/user.router.js`

```js
const Router = require("koa-router")

// 导入自定义中间件
const { userValidator, verifyUser } = require("../middleware/user.middleware.js");

// 导入业务处理器
const { register, login } = require("../controller/users.controller.js")

// 设置路由前缀
const router = new Router({ prefix: "/users" })

// 使用 POST 请求 '/login' 这里的写法是将 '/login' 去拼接前缀 prefix: '/users' ~~> '/users/login'
router.post("/login", login) // 登录接口
router.post("/register", userValidator, verifyUser, register) // 注册接口

module.exports = router

/**
 * 用户模块-路由规则
 */

```



# 十一、加密

在将密码保存至数据库之前，对密码进行加密处理

123123abc (加盐) 加盐加密

## 1 安装`bcryptjs`加密

```bash
#安装 bcryptjs
npm i bcryptjs
```

## 2 编写加密中间件
`src/middleware/user.middleware.js`

```js
const cryptPassword = async (ctx, next) => {
  const { password } = ctx.request.body

  const salt = bcrypt.genSaltSync(10);

  // hash 保存的是密文
  const hash = bcrypt.hashSync(password, salt)

  ctx.request.body.password = hash

  await next()
}
```

## 3 在 router 中使用
改写 `src/router/user.route.js`

```js
const Router = require("koa-router")

// 导入自定义中间件
const { userValidator, verifyUser, cryptPassword, verifyLogin } = require("../middleware/user.middleware.js");

// 导入业务处理器
const { register, login } = require("../controller/users.controller.js")

// 设置路由前缀
const router = new Router({ prefix: "/users" })

// 使用 POST 请求 '/login' 这里的写法是将 '/login' 去拼接前缀 prefix: '/users' ~~> '/users/login'
router.post("/login", userValidator, verifyLogin, login) // 登录接口
router.post("/register", userValidator, verifyUser, cryptPassword, register) // 注册接口

module.exports = router
```

# 十二、登录验证

流程:
  * 验证格式
  * 验证用户是否存在
  * 验证密码是否匹配

## 1 改写`src/middleware/user.middleware.js`

```js
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

```

## 2 定义错误类型

`src/constant/err.type.js`
```js
module.exports = {
  userFormateError: {
    code: "10001",
    message: "用户名或密码为空",
    result: ""
  },
  userAlreadyExited: {
    code: "10002",
    message: "用户名已经存在",
    result: ""
  },
  userRegisterError: {
    code: "10003",
    message: "用户注册错误",
    result: ""
  },
  userDoesNotExist: {
    code: "10004",
    message: "用户不存在",
    result: ""
  },
  userLoginError: {
    code: "10005",
    message: "用户登录失败",
    result: ""
  },
  invalidPasswordError: {
    code: "10006",
    message: "密码不匹配",
    result: ""
  }
}

```


## 3 改写路由
```js
// 使用 POST 请求 '/login' 这里的写法是将 '/login' 去拼接前缀 prefix: '/users' ~~> '/users/login'
router.post("/login", userValidator, verifyLogin, login) // 登录接口
```

# 十三、颁发Token

登录成功后, 给用户颁发一个令牌 token, 用户在以后的每一次请求中携带这个令牌.

jwt: jsonwebtoken

- header: 头部
- payload: 载荷
- signature: 签名

## 1 颁发 token

### 1) 安装 jsonwebtoken
```bash
$ npm i jsonwebtoken
```

### 2) 在控制器中改写 login 方法

`src/controller/users.controller.js`

```js
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
          token: jwt.sign(resUser, JWT_SECRET, { expiresIn: "1d" }),
        }
      }
    } catch (err) {
      console.error("@获取错误", err);
    }
  }
```

### 3) 定义私钥

在`src/controller/users.controller.js`定义 最好定义在`.env`
```bash
JWT_SECRET = xzd
```


## 2 用户认证

### 1) 创建 auth 中间件

```js
const jwt = require('jsonwebtoken')

const { JWT_SECRET } = require('../config/config.default')

const { tokenExpiredError, invalidToken } = require('../constant/err.type')

const auth = async (ctx, next) => {
  const { authorization } = ctx.request.header
  const token = authorization.replace('Bearer ', '')
  console.log(token)

  try {
    // user中包含了payload的信息(id, user_name, is_admin)
    const user = jwt.verify(token, JWT_SECRET)
    ctx.state.user = user
  } catch (err) {
    switch (err.name) {
      case 'TokenExpiredError':
        console.error('token已过期', err)
        return ctx.app.emit('error', tokenExpiredError, ctx)
      case 'JsonWebTokenError':
        console.error('无效的token', err)
        return ctx.app.emit('error', invalidToken, ctx)
    }
  }

  await next()
}

module.exports = {
  auth,
}
```

### 2) 改写 router

```js
// 修改密码接口
router.patch('/update', auth, cryptPassword, update)
```
`src/controller/users.controller.js`
```js
// 处理修改密码业务
  async update(ctx, next) {
    // 1. 获取数据
    const id = ctx.state.user.id
    const password = ctx.request.body.password
    console.table({ id, password });
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
```

`src/service/user.service.js`
```js
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
```

# 十四、自动加载路由
`src/router/index.js`

1. 通过使用 node 的 fs 核心模块，读取当前文件下的所有文件名

```js
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

```

`src/app/index.js`

2. 改写 app 文件的路由注册方式

```js
// 引入 相关路由规则
const routers = require("../router");

……

// 注册中间件 app.use接收的是一个函数类型的参数 routers 通过routes()方法返回一个函数
// allowedMethods限制http请求方式 冷门方式返回 501
app.use(routers.routes()).use(routers.allowedMethods())
```

# 十五、封装管理权限判断中间件
`src/middleware/auth.middleware.js`

1. 通过用户的token携带的信息中获取是否是管理员身份进行判断

```js
// 判断用户是否是管理员
const hadAdminPermission = async (ctx, next) => {
  const { is_admin } = ctx.state.user

  if (!is_admin) {
    console.error("该用户没有授权", ctx.state.user);

    return ctx.app.emit("error", hasNotAdminPermission, ctx)
  }

  await next();
}
```

2. 路由中使用

`src/router/goods.route.js`

```js
// 导入自定义中间件
const { auth, hadAdminPermission } = require("../middleware/auth.middleware")

……

router.post("/upload", auth, hadAdminPermission, upload)
```

# 十五、开启文件上传配置
`src/app/index.js`

1. 通过 koa-body 自带的文件上传功能进行上传文件并保存在指定的目录下

```js
// 在请求中间件之前注册 koaBody
app.use(koaBody({
  multipart: true, // 配置开启上传文件的功能 - 默认为false
  formidable: {
    // 在 option 中的相对路径，不是相对当前文件，而是相对 process.cwd() 当前进程所运行的
    uploadDir: path.join(__dirname, "../uploads"), // 上传的文件保存在那个目录下 - 在配置选项 option 中不推荐使用相对路径 `../uploads`
    keepExtensions: true // 保持展示文件的扩展名
  }
}))
```

2. 通过 ctx.request.files 获取上传的文件信息

`src/controller/goods.controller.js`

```js
  async upload(ctx, next) {
    // file 是在调用的时候，设置的key值
    const { file } = ctx.request.files
    if (file) {
      ctx.body = {
        code: "0",
        message: "商品图片上传成功",
        result: {
          goods_images: path.basename(file.filepath)
        }
      }
    } else {
      return ctx.app.emit("error", fileUploadError, ctx)
    }
  }
```

3. 添加 koa-static 静态资源文件插件
   
```bash
$ npm i koa-static
```

4. 配置静态资源文件目录
`src/app/index.js`

```js
// 注册koa-static静态资源文件目录  然后可以通过 http://localhost:9528/[fileName] 进行访问  age: http://47.98.245.164:9528/d6f243edcabc4d320a7f99200.jpeg
app.use(koaStatic(path.join(__dirname, "../uploads")))
```

# 十六、

# 配置

## 1 .eslintrc

```bash
# 安装 eslint  https://eslint.org/
$ npm init @eslint/config
```

### 1.1 eslintrc 的检查规则

```js
module.exports = {
  // 运行环境
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  // 全局可能会出现的变量
  globals: {
    "process": true
  },
  // 根据那种语法进行限制代码风格
  extends: "eslint:recommended",
  overrides: [
  ],
  parserOptions: {
    // 语言选项 -- 最新
    ecmaVersion: "latest",
  },
  rules: {
    // 强制箭头函数的箭头前后使用一致的空格
    "arrow-spacing": [
      2,
      {
        before: true,
        after: true,
      },
    ],
    // 强制在代码块中开括号前和闭括号后有空格
    "block-spacing": [2, "always"],
    // 强制在代码块中使用一致的大括号风格
    "brace-style": [
      2,
      "1tbs",
      {
        allowSingleLine: true,
      },
    ],
    // 强制使用骆驼拼写法命名约定
    camelcase: [
      0,
      {
        properties: "always",
      },
    ],
}
```

### 1.2 .eslintignore

配置过滤文件

```
// 该文件属于自定义文件，可以直接在  .eslintrc 文件的同级创建

内部内容直接写需要过滤的文件名称
```

## 2 配置 husky & git commit 强制提交规范

### 2.1  安装 commit 配置插件

```bash
# 安装 https://www.npmjs.com/package/@commitlint/config-conventional
$ npm install -D @commitlint/cli @commitlint/config-conventional

# 生成配置文件 /commitlint.config.js
$ echo "module.exports = {extends: ['@commitlint/config-conventional']}" > commitlint.config.js

# 自定义配置规则
// 加git提交的检查提交的信息
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 提交的前缀
    // feat：新功能（feature）
    // fix：修补 bug
    // docs：文档（README、Change Log 等）
    // style： 格式，仅代码格式，不是 CSS 样式
    // refactor：重构（即不是新增功能，也不是修改 Bug 的代码变动）
    // test：增加测试
    // chore：构建过程或辅助工具的变动，例如构建脚本、Dockerfile、package.json 的改动
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", "test", "chore"
    ]],
    "type-case": [0],
    "type-empty": [0],
    "scope-empty": [0],
    "scope-case": [0],
    "subject-full-stop": [0, "never"],
    "subject-case": [0, "never"],
    "header-max-length": [0, "always", 72]
  }
}

```

### 2.2 安装 husky lint-staged 配置插件

```bash
# 安装 lint-staged: 用于实现每次提交只检查本次提交所修改的文件。  husky 我们可以在 git 提交的不同生命周期进行一些自动化操作
$ npm i -D husky lint-staged
```

配置

创建 .huskyrc.json 文件 填充如下规则

```json
{
  "hooks": {
    "pre-commit": ["lint-staged"],
    "commit-msg": "commitlint -e $HUSKY_GIT_PARAMS",
    "pre-push": ""
  }
}
```

在 package.json 添加 scripts 

```json
{
  "prepare": "husky install",
  "lint": "eslint src",
  "lint-staged": "lint-staged"
}
```

执行 npm run prepare 来启动 husky 

添加 pre-commit 钩子 

```bash
$ npx husky add .husky/pre-commit "npm run lint-staged" 
```





# 其他

#  1 app.use

app.use接收的时候一个函数

---

# Moonrise Node.js 后端 AI 文档入口

本目录下的 `backend_ai_docs/` 用于承载未来 Node.js 后端项目的 AI 开发文档。它与当前小程序工程保持分离，后续可以整体迁移到独立后端仓库中使用。

## 当前运行骨架

当前项目已进入第一轮“骨架重构 + 依赖清理 + 目录重排”阶段，运行骨架采用 Node.js + TypeScript + Fastify。

```bash
npm install
npm run dev
```

健康检查：

```bash
GET http://localhost:8000/api/v1/health
```

当前 `src/` 目录按照 `common / infrastructure / modules / database` 分层组织；旧 Koa、MySQL、Sequelize、商品上传、账号密码 demo 和 WebSocket demo 已从运行骨架中移除。`auth / users / cycle` 已具备开发期基础接口、DTO 校验和内存仓储适配器，`sync_change_logs` 和审计日志也已接入内存适配器。后续业务实现请优先阅读 `backend_ai_docs/07_migration_roadmap.md`。

## 数据库迁移

当前默认使用 `DATABASE_DRIVER=memory`，便于前端本地联调不依赖 PostgreSQL。PostgreSQL/Drizzle 基础设施、schema 和初始迁移已接入，`auth / users / cycle / sync` 已具备内存/PostgreSQL 双仓储实现，认证审计日志、用户资料同步日志、周期同步日志和增量同步读取可在 PostgreSQL 模式写入或读取对应数据表。幂等响应快照已先收敛到 repository，PostgreSQL 模式暂用进程内快照，后续可按需要补专用持久化表。

```bash
npm run db:generate
npm run db:migrate
```

切换 PostgreSQL 前，请在 `.env` 中配置：

```bash
DATABASE_DRIVER=postgresql
DATABASE_URL=postgresql://moonrise:moonrise_password@localhost:5432/moonrise
```

## 文档地图

1. `backend_ai_docs/00_backend_prd.md`：后端产品范围、当前小程序功能映射、阶段目标。
2. `backend_ai_docs/01_architecture.md`：Node.js 后端架构、模块边界、推荐技术栈。
3. `backend_ai_docs/02_business_rules.md`：周期记录、同步、备份、隐私安全的后端业务规则。
4. `backend_ai_docs/03_api_design.md`：前后端分离 API 草案、响应格式、幂等与分页规则。
5. `backend_ai_docs/04_database_design.md`：数据库表设计、字段说明、索引与约束。
6. `backend_ai_docs/05_security_design.md`：数据安全、加密、认证、审计和恢复策略。
7. `backend_ai_docs/06_ai_dev_rules.md`：迁移到后端项目后给 AI 使用的开发规则。
8. `backend_ai_docs/07_migration_roadmap.md`：当前仓库改造成正式后端项目的保留、替换、删除和优先级路线。
9. `backend_ai_docs/database/001_initial_schema.sql`：PostgreSQL 建表草案。

## 当前设计基准

- 后端语言：Node.js + TypeScript。
- 推荐运行框架：NestJS 或 Fastify，文档按“模块化 + 依赖注入 + 分层服务”约束编写。
- 推荐数据库：PostgreSQL，原因是 JSONB、索引、约束、审计字段和后续加密元数据表达更直接。
- 当前定位：先服务小程序的数据同步、备份和安全存储，不在第一阶段强制把所有预测计算迁到后端。
- 隐私原则：经期记录、用户资料、备份快照均视为敏感数据；后端默认不保存明文密钥。

## 迁移方式

将整个 `backend_ai_docs/` 复制到后端仓库根目录。后端 Codex 或其他 AI 进入后端项目时，应优先阅读本文件，再阅读 `backend_ai_docs/07_migration_roadmap.md`、`backend_ai_docs/00_backend_prd.md` 和 `backend_ai_docs/06_ai_dev_rules.md`。
