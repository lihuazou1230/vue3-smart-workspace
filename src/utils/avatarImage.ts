/**
 * 头像相关的纯函数工具
 *
 * 这里只放「不碰 DOM、不碰网络」的逻辑：文件前置校验、Storage 路径、缓存失效版本号、
 * 姓名首字母兜底。裁剪与压缩（cropperjs / canvas）在组件层，纯数学部分尽量下沉到此处，
 * 好处是可以直接单测——头像这类交互没法在 happy-dom 里真跑一遍裁剪。
 */

import { AVATAR_ALLOWED_TYPES, AVATAR_INITIAL_MAX, AVATAR_MAX_BYTES } from '@/types/auth'

/** 文件对象的最小子集（`File` 满足该结构，测试可直接传普通对象） */
export interface AvatarFileLike {
  name?: string
  type?: string
  size?: number
}

/** 校验结果 */
export interface AvatarValidation {
  ok: boolean
  message: string
}

/** 人类可读的体积（用于报错文案） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 上传前置校验：类型白名单 + 原始大小 ≤ 5MB。
 * 放在浏览器端拦截，避免把一个 20MB 的相机原图白白传上去再被服务端拒绝。
 */
export function validateAvatarFile(file: AvatarFileLike | null | undefined): AvatarValidation {
  if (!file) return { ok: false, message: '请选择一张图片' }

  const type = (file.type ?? '').toLowerCase()
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(type)) {
    const shown = type || file.name || '未知格式'
    return { ok: false, message: `仅支持 JPG / PNG / WebP 格式（当前：${shown}）` }
  }

  const size = typeof file.size === 'number' ? file.size : 0
  if (size <= 0) return { ok: false, message: '图片内容为空，请重新选择' }
  if (size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      message: `图片不能超过 ${formatBytes(AVATAR_MAX_BYTES)}（当前 ${formatBytes(size)}）`,
    }
  }

  return { ok: true, message: '' }
}

/** Storage 对象路径：每个用户一个固定文件，覆盖上传（`user_id/avatar.webp`） */
export function avatarStoragePath(userId: string): string {
  return `${userId}/avatar.webp`
}

/** 该路径是否属于某个用户（RLS 策略同样按第一段目录判定，这里做前端自检） */
export function isOwnAvatarPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`)
}

/**
 * 给头像地址追加版本号做缓存失效。
 * 同一路径覆盖上传后 CDN 可能还在缓存旧图，URL 变了才会重新拉取。
 */
export function withAvatarVersion(url: string, version: number | string): string {
  if (!url) return ''
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${version}`
}

/** 去掉版本号，得到稳定的资源地址（比较「是否同一个头像」时用） */
export function stripAvatarVersion(url: string): string {
  return url.split('?')[0]
}

/**
 * 无头像时的姓名首字母兜底：
 * - 中文名（含 CJK）取前 1~2 个字，中文没有「首字母」概念，取字更像头像
 * - 英文/拼音名取各单词首字母（最多 2 个）并大写
 */
export function avatarInitial(name: string, max = AVATAR_INITIAL_MAX): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed.replace(/\s+/g, '').slice(0, max)
  }

  const words = trimmed.split(/[\s._-]+/).filter(Boolean)
  const letters = words.length > 1 ? words.map((w) => w.charAt(0)).join('') : trimmed
  return letters.slice(0, max).toUpperCase()
}
