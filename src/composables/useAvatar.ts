/**
 * 头像读写 composable —— 统一「未登录存本地 / 登录后传云端」两条链路
 *
 * | 状态 | 存放位置 | 展示 |
 * |------|---------|------|
 * | 未登录（本地模式） | IndexedDB 存 blob（原图不转 base64），objectURL 展示 | side bar / 设置页 |
 * | 已登录 + 已配置 Supabase | Storage `avatars/user_id/avatar.webp` + user_metadata.avatar_url | 跨设备一致 |
 *
 * 本地头像用模块级共享状态：一个浏览器只有一份「我的头像」，
 * 侧边栏与设置页同时挂载时不该各自读一份、各自生成一个 objectURL。
 */

import { computed, ref, watch } from 'vue'

import { removeAvatarObject, uploadAvatar } from '@/api/avatar'
import { describeAuthError } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import type { AuthResult } from '@/types/auth'
import { AVATAR_BLOB_KEY, deleteBlob, getBlob, putBlob } from '@/composables/useIndexedDb'

/** 本地头像的 objectURL（模块级共享） */
const localAvatarUrl = ref('')
/** 是否已经尝试从 IndexedDB 读过一次 */
let loadedOnce = false
/** 上一个 objectURL，替换时释放，避免内存泄漏 */
let lastObjectUrl = ''

function setLocalObjectUrl(url: string) {
  if (lastObjectUrl && lastObjectUrl !== url) URL.revokeObjectURL(lastObjectUrl)
  lastObjectUrl = url
  localAvatarUrl.value = url
}

export function useAvatar() {
  const authStore = useAuthStore()

  const saving = ref(false)
  const error = ref('')

  /**
   * 头像图加载失败标记。
   * 为什么需要：GitHub OAuth 登录时 `avatar_url` 指向 `avatars.githubusercontent.com`，
   * 国内网络经常加载不出来——没有兜底就会显示一张碎图。失败后回落到姓名首字母，
   * 视觉上依然完整（这也是「渐进增强的降级链路」的一部分）。
   */
  const imageFailed = ref(false)

  /** 展示用头像地址：云端优先，其次本地；加载失败一律回落到首字母 */
  const displayUrl = computed(() =>
    imageFailed.value ? '' : authStore.avatarUrl || localAvatarUrl.value,
  )
  const hasAvatar = computed(() => displayUrl.value !== '')
  /** 无头像时的首字母兜底 */
  const fallbackInitial = computed(() => authStore.initial)

  /** 标记当前地址加载失败（组件在 <img @error> 里调用） */
  function markImageFailed() {
    imageFailed.value = true
  }

  // 换了一张头像就重新给一次机会（否则失败标记会一直卡住新图）
  watch([() => authStore.avatarUrl, localAvatarUrl], () => {
    imageFailed.value = false
  })

  /** 从 IndexedDB 读本地头像（只读一次；刷新页面后本地头像能恢复） */
  async function loadLocalAvatar(): Promise<void> {
    if (loadedOnce) return
    loadedOnce = true
    const blob = await getBlob(AVATAR_BLOB_KEY)
    if (blob) setLocalObjectUrl(URL.createObjectURL(blob))
  }

  /**
   * 保存头像。
   * 已登录 → 上传 Storage 并写回 user_metadata；未登录 → 存 IndexedDB（本地也有完整预览）。
   */
  async function saveAvatar(blob: Blob): Promise<AuthResult> {
    saving.value = true
    error.value = ''
    try {
      const userId = authStore.user?.id

      if (authStore.isAuthed && userId && !authStore.isLocalMode) {
        const url = await uploadAvatar(userId, blob)
        const result = await authStore.setAvatarUrl(url)
        if (!result.ok) {
          error.value = result.message
          return result
        }
        return { ok: true, message: '头像已保存并同步到云端' }
      }

      // 未登录：本地存一份，刷新后仍在（登录后可再点一次「保存到云端」）
      const persisted = await putBlob(AVATAR_BLOB_KEY, blob)
      setLocalObjectUrl(URL.createObjectURL(blob))
      return {
        ok: true,
        message: persisted
          ? '头像已保存到本地（登录后可同步到云端）'
          : '头像已应用（当前环境不支持本地持久化，刷新后会丢失）',
      }
    } catch (caught) {
      const message = describeAuthError(caught)
      error.value = message
      return { ok: false, message }
    } finally {
      saving.value = false
    }
  }

  /** 移除头像：云端删对象 + 清 metadata；本地删 blob。两边都尽力而为 */
  async function removeAvatar(): Promise<AuthResult> {
    saving.value = true
    error.value = ''
    try {
      const userId = authStore.user?.id

      if (authStore.isAuthed && userId && !authStore.isLocalMode) {
        try {
          await removeAvatarObject(userId)
        } catch {
          // Storage 删不掉（对象本就不存在等）不该阻塞「移除头像」这个动作
        }
        authStore.clearLocalAvatar()
        await authStore.setAvatarUrl('')
      }

      await deleteBlob(AVATAR_BLOB_KEY)
      setLocalObjectUrl('')
      return { ok: true, message: '已移除头像' }
    } catch (caught) {
      const message = describeAuthError(caught)
      error.value = message
      return { ok: false, message }
    } finally {
      saving.value = false
    }
  }

  /** 释放 objectURL（组件卸载时调用） */
  function dispose() {
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl)
      lastObjectUrl = ''
    }
    localAvatarUrl.value = ''
    loadedOnce = false
  }

  return {
    displayUrl,
    hasAvatar,
    fallbackInitial,
    saving,
    error,
    markImageFailed,
    loadLocalAvatar,
    saveAvatar,
    removeAvatar,
    dispose,
  }
}

/** 仅测试用：重置模块级共享状态 */
export function resetAvatarStateForTest() {
  localAvatarUrl.value = ''
  loadedOnce = false
  lastObjectUrl = ''
}
