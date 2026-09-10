/**
 * 头像 Storage API（Supabase Storage · `avatars` bucket）
 *
 * 约定（与 supabase/schema.sql 里的 policies 对应）：
 * - 公开读：bucket 设 public，任何人可通过公开 URL 读取头像
 * - 仅本人可写：路径第一段必须是自己的 user_id，RLS 策略按 `storage.foldername(name)[1]` 校验
 * - 固定路径覆盖上传（`user_id/avatar.webp`），靠 URL 上的 `?v=` 版本号做缓存失效
 */

import { AVATAR_BUCKET } from '@/types/auth'
import { avatarStoragePath, withAvatarVersion } from '@/utils/avatarImage'
import { requireSupabaseClient } from './supabase'

/**
 * 上传头像，返回可直接放进 `<img src>` 的公开地址（带版本号）。
 * @param userId 当前登录用户 id（路径第一段）
 * @param blob 已裁剪压缩好的 webp blob
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const client = requireSupabaseClient()
  const path = avatarStoragePath(userId)

  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/webp',
    // 头像换得不频繁，但换完要能立刻看到：给 60s 短缓存 + URL 版本号兜底
    cacheControl: '60',
  })
  if (error) throw error

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return withAvatarVersion(data.publicUrl, Date.now())
}

/** 删除云端头像对象（「移除头像」时调用；对象不存在也不报错） */
export async function removeAvatarObject(userId: string): Promise<void> {
  const client = requireSupabaseClient()
  const { error } = await client.storage.from(AVATAR_BUCKET).remove([avatarStoragePath(userId)])
  if (error) throw error
}
