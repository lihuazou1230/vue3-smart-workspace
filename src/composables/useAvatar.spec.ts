import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import type { AuthResult, AuthUser, SignUpPayload } from '@/types/auth'

/** 认证持久层用桩：useAvatar 只关心「是否已登录 / 用户 id / 头像地址」 */
const api = vi.hoisted(() => ({
  describeAuthError: vi.fn<(error: unknown) => string>(),
  getCurrentSessionUser: vi.fn<() => Promise<AuthUser | null>>(),
  signInWithGitHub: vi.fn<(redirectTo?: string) => Promise<AuthResult>>(),
  signInWithPassword: vi.fn<(email: string, password: string) => Promise<AuthResult>>(),
  signOutUser: vi.fn<() => Promise<AuthResult>>(),
  signUpWithPassword: vi.fn<(payload: SignUpPayload) => Promise<AuthResult>>(),
  subscribeAuthChanges: vi.fn<(cb: (user: AuthUser | null) => void) => () => void>(),
  updateAvatarMetadata: vi.fn<(avatarUrl: string) => Promise<AuthResult>>(),
}))

const supabase = vi.hoisted(() => ({ isSupabaseConfigured: vi.fn(() => true) }))

const avatarApi = vi.hoisted(() => ({
  uploadAvatar: vi.fn<(userId: string, blob: Blob) => Promise<string>>(),
  removeAvatarObject: vi.fn<(userId: string) => Promise<void>>(),
}))

vi.mock('@/api/auth', () => api)
vi.mock('@/api/supabase', () => supabase)
vi.mock('@/api/avatar', () => avatarApi)

import { useAuthStore } from '@/stores/authStore'
import { AVATAR_BLOB_KEY, deleteBlob, getBlob, putBlob } from './useIndexedDb'
import { resetAvatarStateForTest, useAvatar } from './useAvatar'

const USER: AuthUser = {
  id: 'u1',
  email: 'zhang@example.com',
  displayName: '张三',
  avatarUrl: '',
  provider: 'email',
}

/** happy-dom 的 objectURL 支持不完整，这里统一打桩 */
function stubObjectUrl() {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:raw' })
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
  }
  let seq = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++seq}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
}

async function signIn(mockUser: AuthUser = USER) {
  const store = useAuthStore()
  api.getCurrentSessionUser.mockResolvedValue(mockUser)
  await store.init()
  return store
}

describe('useAvatar', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    stubObjectUrl()
    resetAvatarStateForTest()
    await deleteBlob(AVATAR_BLOB_KEY)

    supabase.isSupabaseConfigured.mockReturnValue(true)
    api.describeAuthError.mockImplementation((error) => `err:${String(error)}`)
    api.getCurrentSessionUser.mockResolvedValue(null)
    api.subscribeAuthChanges.mockReturnValue(vi.fn())
    api.updateAvatarMetadata.mockResolvedValue({ ok: true, message: '头像已更新' })
    avatarApi.uploadAvatar.mockResolvedValue('https://cdn/avatars/u1/avatar.webp?v=1')
    avatarApi.removeAvatarObject.mockResolvedValue(undefined)

    setActivePinia(createPinia())
  })

  describe('未登录（本地模式）', () => {
    beforeEach(() => {
      supabase.isSupabaseConfigured.mockReturnValue(false)
    })

    it('保存头像：存进 IndexedDB 并给出「可登录后同步」的提示', async () => {
      await signIn()
      const { saveAvatar, displayUrl } = useAvatar()
      const blob = new Blob(['x'], { type: 'image/webp' })

      const result = await saveAvatar(blob)

      expect(result.ok).toBe(true)
      expect(result.message).toContain('本地')
      expect(avatarApi.uploadAvatar).not.toHaveBeenCalled()
      expect(await getBlob(AVATAR_BLOB_KEY)).toBeTruthy()
      expect(displayUrl.value).toBe('blob:mock-1')
    })

    it('刷新页面后能从 IndexedDB 恢复本地头像（只读一次）', async () => {
      await putBlob(AVATAR_BLOB_KEY, new Blob(['old'], { type: 'image/png' }))
      const { loadLocalAvatar, displayUrl } = useAvatar()

      await loadLocalAvatar()
      expect(displayUrl.value).toBe('blob:mock-1')

      await loadLocalAvatar()
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('移除头像：清掉本地 blob 与展示地址', async () => {
      const { saveAvatar, removeAvatar, displayUrl } = useAvatar()
      await saveAvatar(new Blob(['x'], { type: 'image/webp' }))
      expect(displayUrl.value).not.toBe('')

      const result = await removeAvatar()

      expect(result.ok).toBe(true)
      expect(await getBlob(AVATAR_BLOB_KEY)).toBeNull()
      expect(displayUrl.value).toBe('')
    })
  })

  describe('已登录（云端）', () => {
    it('保存头像：上传 Storage → 写回 user_metadata → 展示云端地址', async () => {
      const authStore = await signIn()
      const { saveAvatar, displayUrl } = useAvatar()
      const blob = new Blob(['x'], { type: 'image/webp' })

      const result = await saveAvatar(blob)

      expect(result.ok).toBe(true)
      expect(result.message).toContain('云端')
      expect(avatarApi.uploadAvatar).toHaveBeenCalledWith('u1', blob)
      expect(api.updateAvatarMetadata).toHaveBeenCalledWith(
        'https://cdn/avatars/u1/avatar.webp?v=1',
      )
      expect(authStore.avatarUrl).toBe('https://cdn/avatars/u1/avatar.webp?v=1')
      expect(displayUrl.value).toBe('https://cdn/avatars/u1/avatar.webp?v=1')
      // 云端路径不再往本地写，避免两份数据不一致
      expect(await getBlob(AVATAR_BLOB_KEY)).toBeNull()
    })

    it('上传失败：返回失败结果并记录错误，不污染用户状态', async () => {
      const authStore = await signIn()
      avatarApi.uploadAvatar.mockRejectedValue(new Error('Failed to fetch'))
      const { saveAvatar, error } = useAvatar()

      const result = await saveAvatar(new Blob(['x']))

      expect(result.ok).toBe(false)
      // describeAuthError 在本用例里是桩（err: 前缀），真实实现会把 fetch 失败翻成中文
      expect(result.message).toContain('Failed to fetch')
      expect(error.value).toContain('Failed to fetch')
      expect(authStore.avatarUrl).toBe('')
    })

    it('写元数据失败：返回失败结果（头像地址没变）', async () => {
      const authStore = await signIn()
      api.updateAvatarMetadata.mockResolvedValue({ ok: false, message: '权限不足' })
      const { saveAvatar } = useAvatar()

      const result = await saveAvatar(new Blob(['x']))

      expect(result).toEqual({ ok: false, message: '权限不足' })
      expect(authStore.avatarUrl).toBe('')
    })

    it('移除头像：删 Storage 对象 + 清空 metadata；Storage 删失败也不阻塞', async () => {
      const authStore = await signIn({ ...USER, avatarUrl: 'https://cdn/a.webp?v=9' })
      avatarApi.removeAvatarObject.mockRejectedValue(new Error('not found'))
      const { removeAvatar, displayUrl } = useAvatar()

      const result = await removeAvatar()

      expect(result.ok).toBe(true)
      expect(avatarApi.removeAvatarObject).toHaveBeenCalledWith('u1')
      expect(api.updateAvatarMetadata).toHaveBeenLastCalledWith('')
      expect(authStore.avatarUrl).toBe('')
      expect(displayUrl.value).toBe('')
    })

    it('云端头像优先于本地头像', async () => {
      await putBlob(AVATAR_BLOB_KEY, new Blob(['local'], { type: 'image/png' }))
      await signIn({ ...USER, avatarUrl: 'https://cdn/a.webp?v=2' })
      const { loadLocalAvatar, displayUrl } = useAvatar()

      await loadLocalAvatar()
      expect(displayUrl.value).toBe('https://cdn/a.webp?v=2')
    })
  })

  describe('兜底与释放', () => {
    it('无头像时给出姓名首字母兜底', async () => {
      await signIn()
      const { hasAvatar, fallbackInitial } = useAvatar()

      expect(hasAvatar.value).toBe(false)
      expect(fallbackInitial.value).toBe('张三')
    })

    it('未登录时首字母兜底取「本地访客」前两字', async () => {
      supabase.isSupabaseConfigured.mockReturnValue(false)
      await signIn()
      const { fallbackInitial } = useAvatar()
      expect(fallbackInitial.value).toBe('本地')
    })

    it('头像图加载失败（如 GitHub 头像 CDN 打不开）时回落到首字母，不显示碎图', async () => {
      const authStore = await signIn({
        ...USER,
        avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      })
      const { displayUrl, hasAvatar, markImageFailed } = useAvatar()
      expect(displayUrl.value).toContain('githubusercontent')

      markImageFailed()

      expect(displayUrl.value).toBe('')
      expect(hasAvatar.value).toBe(false)

      // 换一张头像后重新给一次机会
      authStore.user = { ...authStore.user!, avatarUrl: 'https://cdn/new.webp?v=2' }
      await nextTick()
      expect(displayUrl.value).toBe('https://cdn/new.webp?v=2')
    })

    it('dispose 释放 objectURL 并重置共享状态', async () => {
      supabase.isSupabaseConfigured.mockReturnValue(false)
      await signIn()
      const avatar = useAvatar()
      await avatar.saveAvatar(new Blob(['x'], { type: 'image/webp' }))

      avatar.dispose()

      expect(URL.revokeObjectURL).toHaveBeenCalled()
      expect(avatar.displayUrl.value).toBe('')
    })
  })
})
