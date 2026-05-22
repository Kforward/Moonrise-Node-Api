const path = require("path");

const { fileUploadError } = require("../constant/err.type.js")

class GoodsController {
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
}

module.exports = new GoodsController();
