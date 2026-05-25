import { z } from "zod";

export const wechatLoginSchema = z.object({
  code: z.string().min(1, "微信登录 code 不能为空"),
  deviceKey: z.string().min(8, "设备标识至少 8 位"),
  deviceName: z.string().min(1).max(120).optional(),
  platform: z.string().min(1).max(32).default("mp-weixin"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken 不能为空"),
});

export type WechatLoginInput = z.infer<typeof wechatLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
