/**
 * 第五阶段验收项「两台设备（或无痕窗口）登录同一账号，任务数据一致」的**自动化**版本。
 *
 * 为什么单独一个文件：这里要的是**有状态的假云端**——设备 A 推上去的行，设备 B 必须拉得到，
 * 才能验证「收敛」。`todoStore.sync.spec.ts` 用的是无状态桩（只关心"该推什么、失败怎么办"），
 * 两者关注点不同。
 *
 * 模拟方式：
 * - 「云端」= 模块级 Map（跨设备共享）
 * - 「一台设备」= 一份干净的 localStorage + 一个独立 Pinia（store 是单例，换 Pinia 才算换设备）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import type { Todo } from '@/types/todo'

/** 假云端：id → { 账号, 任务快照, 顺序位 } */
const cloud = vi.hoisted(() => ({
  rows: new Map<string, { userId: string; todo: Todo; order: number }>(),
}))

vi.mock('@/api/todoRemote', () => ({
  fetchRemoteTodos: vi.fn(async (userId: string) =>
    [...cloud.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => a.order - b.order)
      .map((row) => JSON.parse(JSON.stringify(row.todo)) as Todo),
  ),
  pushRemoteTodos: vi.fn(async (userId: string, entries: { todo: Todo; position: number }[]) => {
    for (const entry of entries) {
      // 深拷贝：真云端也一样是按值存，不共享引用
      cloud.rows.set(entry.todo.id, {
        userId,
        todo: JSON.parse(JSON.stringify(entry.todo)) as Todo,
        order: entry.position,
      })
    }
  }),
  deleteRemoteTodos: vi.fn(async (ids: readonly string[]) => {
    for (const id of ids) cloud.rows.delete(id)
  }),
  clearRemoteTodos: vi.fn(async (userId: string) => {
    for (const [id, row] of [...cloud.rows]) {
      if (row.userId === userId) cloud.rows.delete(id)
    }
  }),
}))

import { useTodoStore } from './todoStore'

/** 等 watcher 与异步补发跑完 */
async function settle() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

/** 把当前 localStorage 拍成快照（= 这台设备的本地缓存） */
function snapshotStorage(): Record<string, string> {
  const snapshot: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key) snapshot[key] = localStorage.getItem(key) ?? ''
  }
  return snapshot
}

function restoreStorage(snapshot: Record<string, string>) {
  localStorage.clear()
  for (const [key, value] of Object.entries(snapshot)) localStorage.setItem(key, value)
}

/** 启动一台「设备」：可带上它自己的本地缓存，返回新的 store 实例 */
function bootDevice(localSnapshot?: Record<string, string>) {
  if (localSnapshot) restoreStorage(localSnapshot)
  else localStorage.clear()
  setActivePinia(createPinia())
  return useTodoStore()
}

beforeEach(() => {
  cloud.rows.clear()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('多设备一致性（同一账号，两个浏览器存储）', () => {
  it('设备 A 新增的任务，设备 B 首次登录就能看到', async () => {
    // ---- 设备 A：登录后新增任务，自动推到云端 ----
    const deviceA = bootDevice()
    await deviceA.activateCloud('u1')
    deviceA.addTodo({ title: '写周报', priority: 'high' })
    await settle()

    expect(cloud.rows.size).toBe(1)
    const snapshotA = snapshotStorage()

    // ---- 设备 B：另一台电脑，首次登录 ----
    const deviceB = bootDevice()
    await deviceB.activateCloud('u1')
    await settle()

    expect(deviceB.todos.map((t) => t.title)).toEqual(['写周报'])
    expect(deviceB.syncState).toBe('synced')
    // A 的本地缓存没被污染（各设备各存各的）
    restoreStorage(snapshotA)
    expect(JSON.parse(localStorage.getItem('smart-workspace:todos') ?? '[]')).toHaveLength(1)
  })

  it('设备 B 的改动（完成 + 新增）在设备 A 重新打开后收敛一致', async () => {
    // ---- 设备 A 建一条任务 ----
    const deviceA = bootDevice()
    await deviceA.activateCloud('u1')
    deviceA.addTodo({ title: '写周报', priority: 'high' })
    await settle()
    const snapshotA = snapshotStorage()

    // ---- 设备 B 拉下来后做两件事：完成它、再加一条 ----
    const deviceB = bootDevice()
    await deviceB.activateCloud('u1')
    await settle()
    const reportId = deviceB.todos[0].id

    deviceB.toggleComplete(reportId)
    deviceB.addTodo({ title: 'B 的补充', priority: 'low' })
    await settle()

    // 云端已经是 B 改过的样子
    expect(cloud.rows.get(reportId)?.todo.status).toBe('completed')
    expect(cloud.rows.size).toBe(2)

    // ---- 设备 A 重新打开（用自己的本地缓存 + 拉云端）----
    const deviceAReloaded = bootDevice(snapshotA)
    await deviceAReloaded.activateCloud('u1')
    await settle()

    const titles = deviceAReloaded.todos.map((t) => t.title)
    expect(titles).toContain('B 的补充') // 看到 B 新增的
    expect(deviceAReloaded.todos.find((t) => t.id === reportId)?.status).toBe('completed') // 看到 B 的完成
    expect(deviceAReloaded.todos.find((t) => t.title === '写周报')?.status).toBe('completed')
  })

  it('设备 A 真正删除任务后，设备 B 重新打开也不再看到它', async () => {
    const deviceA = bootDevice()
    await deviceA.activateCloud('u1')
    deviceA.addTodo({ title: '要删掉的', priority: 'medium' })
    deviceA.addTodo({ title: '保留的', priority: 'medium' })
    await settle()
    const targetId = deviceA.todos.find((t) => t.title === '要删掉的')!.id

    const snapshotA = snapshotStorage()

    // 设备 B 先看到两条
    const deviceB = bootDevice()
    await deviceB.activateCloud('u1')
    await settle()
    expect(deviceB.todos).toHaveLength(2)
    const snapshotB = snapshotStorage()

    // 设备 A 真正删除（软删除期内不碰云端，这里直接走"超时后真正删除"那个动作）
    const deviceAReloaded = bootDevice(snapshotA)
    await deviceAReloaded.activateCloud('u1')
    await settle()
    deviceAReloaded.commitDelete(targetId)
    await settle()

    expect(cloud.rows.has(targetId)).toBe(false)

    // 设备 B 重新打开：云端已经没这条，本地缓存也要跟着少一条
    const deviceBReloaded = bootDevice(snapshotB)
    await deviceBReloaded.activateCloud('u1')
    await settle()

    expect(deviceBReloaded.todos.map((t) => t.title)).toEqual(['保留的'])
  })

  it('两台设备各自离线改动后先后上线：两边的改动都保留，不互相覆盖', async () => {
    // 设备 A 在线建一条，作为共同起点
    const deviceA = bootDevice()
    await deviceA.activateCloud('u1')
    deviceA.addTodo({ title: '共同起点', priority: 'medium' })
    await settle()
    const snapshotA = snapshotStorage()

    const deviceB = bootDevice()
    await deviceB.activateCloud('u1')
    await settle()
    const snapshotB = snapshotStorage()

    // ---- 两台设备同时断网，各自改各自的 ----
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    const offlineA = bootDevice(snapshotA)
    await offlineA.activateCloud('u1')
    offlineA.addTodo({ title: 'A 离线加的', priority: 'high' })
    await settle()
    expect(offlineA.syncState).toBe('offline')

    const offlineB = bootDevice(snapshotB)
    await offlineB.activateCloud('u1')
    offlineB.addTodo({ title: 'B 离线加的', priority: 'low' })
    await settle()
    expect(offlineB.syncState).toBe('offline')

    // 断网期间云端只有起点那一条——两边的改动都还压在各自的队列里
    expect(cloud.rows.size).toBe(1)

    // ---- 网络恢复：A 先上线补发 ----
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    expect(await offlineA.syncNow()).toBe(true)
    await settle()
    expect(cloud.rows.size).toBe(2)
    expect(offlineA.syncState).toBe('synced')

    // ---- B 后上线补发：两条都在，谁都没被覆盖 ----
    expect(await offlineB.syncNow()).toBe(true)
    await settle()

    const titles = [...cloud.rows.values()].map((row) => row.todo.title).sort()
    expect(titles).toEqual(['A 离线加的', 'B 离线加的', '共同起点'])
  })
})
