import { describe, expect, it } from 'vitest'

import { AVATAR_MAX_BYTES } from '@/types/auth'
import {
  avatarInitial,
  avatarStoragePath,
  formatBytes,
  isOwnAvatarPath,
  stripAvatarVersion,
  validateAvatarFile,
  withAvatarVersion,
} from './avatarImage'

describe('头像文件前置校验', () => {
  it('接受 JPG / PNG / WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateAvatarFile({ name: 'a', type, size: 1024 })).toEqual({ ok: true, message: '' })
    }
  })

  it('拒绝非图片类型并给出当前格式', () => {
    const result = validateAvatarFile({ name: 'a.pdf', type: 'application/pdf', size: 1024 })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('JPG / PNG / WebP')
    expect(result.message).toContain('application/pdf')
  })

  it('拒绝超过 5MB 的图片并给出实际体积', () => {
    const result = validateAvatarFile({
      name: 'big.jpg',
      type: 'image/jpeg',
      size: 6 * 1024 * 1024,
    })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('5.00 MB')
    expect(result.message).toContain('6.00 MB')
  })

  it('刚好 5MB 视为合法（边界包含）', () => {
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES }).ok).toBe(true)
  })

  it('空文件与空入参被拦截', () => {
    expect(validateAvatarFile(null).ok).toBe(false)
    expect(validateAvatarFile({ type: 'image/png', size: 0 }).ok).toBe(false)
  })
})

describe('Storage 路径与缓存失效', () => {
  it('路径固定为 user_id/avatar.webp（覆盖上传）', () => {
    expect(avatarStoragePath('u-1')).toBe('u-1/avatar.webp')
  })

  it('只有本人目录算自己的头像', () => {
    expect(isOwnAvatarPath('u-1/avatar.webp', 'u-1')).toBe(true)
    expect(isOwnAvatarPath('u-2/avatar.webp', 'u-1')).toBe(false)
  })

  it('追加版本号，已带 query 时用 & 拼接', () => {
    expect(withAvatarVersion('https://x/a.webp', 123)).toBe('https://x/a.webp?v=123')
    expect(withAvatarVersion('https://x/a.webp?raw=1', 123)).toBe('https://x/a.webp?raw=1&v=123')
    expect(withAvatarVersion('', 123)).toBe('')
  })

  it('stripAvatarVersion 还原稳定地址', () => {
    expect(stripAvatarVersion('https://x/a.webp?v=123')).toBe('https://x/a.webp')
  })
})

describe('姓名首字母兜底', () => {
  it('中文名取前两个字', () => {
    expect(avatarInitial('张三')).toBe('张三')
    expect(avatarInitial('欧阳锋')).toBe('欧阳')
    expect(avatarInitial('  李 四 ')).toBe('李四')
  })

  it('英文名取各单词首字母并大写', () => {
    expect(avatarInitial('alice zhang')).toBe('AZ')
    expect(avatarInitial('bob')).toBe('BO')
  })

  it('空名兜底为问号', () => {
    expect(avatarInitial('')).toBe('?')
    expect(avatarInitial('   ')).toBe('?')
  })
})

describe('formatBytes', () => {
  it('按量级选择单位', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })
})
