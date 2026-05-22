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
