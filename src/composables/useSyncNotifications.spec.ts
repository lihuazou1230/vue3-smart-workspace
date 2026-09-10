import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { useTodoStore } from '@/stores/todoStore'
import { OFFLINE_NOTICE_TEXT, SYNC_RESTORED_NOTICE_TEXT } from '@/utils/syncNotice'
import { useSyncNotifications } from './useSyncNotifications'
import type { SyncNotifier } from './useSyncNotifications'

function fakeNotifier(): SyncNotifier & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    success: (text: string) => calls.push(`success:${text}`),
    warning: (text: string) => calls.push(`warning:${text}`),
  }
}

/** 把 store 的同步状态切过去（并等 watcher 跑完） */
async function setState(store: ReturnType<typeof useTodoStore>, next: string) {
  store.syncState = next as never
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useSyncNotifications（接线上 Toast 的时机）', () => {
  it('断网提示一次，恢复网络再提示一次', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    useSyncNotifications(notify)

    await setState(store, 'syncing')
    await setState(store, 'synced')
    expect(notify.calls).toEqual([])

    await setState(store, 'offline')
    expect(notify.calls).toEqual([`warning:${OFFLINE_NOTICE_TEXT}`])

    // 补发链路：offline → syncing → synced
    await setState(store, 'syncing')
    await setState(store, 'synced')
    expect(notify.calls).toEqual([
      `warning:${OFFLINE_NOTICE_TEXT}`,
      `success:${SYNC_RESTORED_NOTICE_TEXT}`,
    ])
  })

  it('一直离线时不会重复弹（每次推送失败都弹会刷屏）', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    useSyncNotifications(notify)

    await setState(store, 'offline')
    await setState(store, 'offline')
    await setState(store, 'offline')
    expect(notify.calls).toHaveLength(1)
  })

  it('迁移完成消息弹一次成功提示，重复的同一条不再弹', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    useSyncNotifications(notify)

    store.syncMessage = '已把本地 2 条任务迁移到云端'
    await nextTick()
    expect(notify.calls).toEqual(['success:已把本地 2 条任务迁移到云端'])

    // 同一句话重复赋值（例如再次激活时的兜底）不再重复提示
    store.syncMessage = ''
    await nextTick()
    store.syncMessage = '已把本地 2 条任务迁移到云端'
    await nextTick()
    expect(notify.calls).toHaveLength(1)
  })

  it('离线文案这类常驻消息不弹 Toast（交给设置页与侧边栏展示）', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    useSyncNotifications(notify)

    store.syncMessage = '当前处于离线模式：改动已保存在本地，恢复网络后自动同步'
    await nextTick()
    expect(notify.calls).toEqual([])
  })

  it('登出后重新离线：会再次提示（标记已随 local 复位）', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    useSyncNotifications(notify)

    await setState(store, 'offline')
    await setState(store, 'local')
    await setState(store, 'offline')
    expect(notify.calls.filter((c) => c.startsWith('warning:'))).toHaveLength(2)
  })

  it('对外暴露离线标记（便于排查「恢复提示没弹」）', async () => {
    const store = useTodoStore()
    const notify = fakeNotifier()
    const { state } = useSyncNotifications(notify)

    expect(state.wasOffline).toBe(false)
    await setState(store, 'offline')
    expect(state.wasOffline).toBe(true)
    await setState(store, 'synced')
    expect(state.wasOffline).toBe(false)
  })

  it('提示器异常不影响同步流程（Toast 失败不冒泡、不拖垮应用）', async () => {
    const store = useTodoStore()
    const throwing = {
      success: vi.fn(() => {
        throw new Error('UI 崩了')
      }),
      warning: vi.fn(() => {
        throw new Error('UI 崩了')
      }),
    }
    useSyncNotifications(throwing)

    // 不抛错：异常在提示层被吞掉
    await expect(setState(store, 'offline')).resolves.toBeUndefined()
    expect(throwing.warning).toHaveBeenCalledTimes(1)
    expect(store.syncState).toBe('offline')

    // 恢复提示同样不炸
    await expect(setState(store, 'syncing')).resolves.toBeUndefined()
    await expect(setState(store, 'synced')).resolves.toBeUndefined()
    expect(throwing.success).toHaveBeenCalledTimes(1)
    expect(store.syncState).toBe('synced')
  })
})
