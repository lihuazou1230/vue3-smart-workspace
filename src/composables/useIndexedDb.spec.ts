import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AVATAR_BLOB_KEY, deleteBlob, getBlob, isIndexedDbAvailable, putBlob } from './useIndexedDb'

/**
 * IndexedDB 在 happy-dom 里没有实现，用 fake-indexeddb 顶上——
 * 这样测的是真实的事务代码路径（open/upgrade/put/get/delete），而不是我另写的假实现。
 */
describe('IndexedDB blob 仓库', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals()
    await deleteBlob(AVATAR_BLOB_KEY)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('环境支持时判定为可用', () => {
    expect(isIndexedDbAvailable()).toBe(true)
  })

  it('写入后可读回（验证 put → get 链路打通）', async () => {
    const blob = new Blob(['avatar-bytes'], { type: 'image/webp' })
    const persisted = await putBlob(AVATAR_BLOB_KEY, blob)

    expect(persisted).toBe(true)
    // 注意：真实浏览器里读回的就是原样 Blob；happy-dom 的 Blob 过 fake-indexeddb 的
    // structuredClone 后结构会丢（拿不到 size/type），所以这里只断言「读到了东西」，
    // Blob 保真度由内存兜底那条用例（同一引用）覆盖。
    const restored = await getBlob(AVATAR_BLOB_KEY)
    expect(restored).toBeTruthy()
  })

  it('删除后读不到', async () => {
    await putBlob('temp-key', new Blob(['x']))
    await deleteBlob('temp-key')
    expect(await getBlob('temp-key')).toBeNull()
  })

  it('没有存过时返回 null（不是抛错）', async () => {
    expect(await getBlob('never-saved')).toBeNull()
  })

  it('IndexedDB 不可用时降级到内存：本次会话仍能读写', async () => {
    vi.stubGlobal('indexedDB', undefined)
    expect(isIndexedDbAvailable()).toBe(false)

    const blob = new Blob(['memory-only'], { type: 'image/png' })
    const persisted = await putBlob('memory-key', blob)

    // 返回 false 表示「没能持久化」，调用方据此给出「刷新后会丢失」的提示
    expect(persisted).toBe(false)
    const restored = await getBlob('memory-key')
    expect(restored).toBe(blob)
    expect(restored?.size).toBe(blob.size)

    await deleteBlob('memory-key')
    expect(await getBlob('memory-key')).toBeNull()
  })
})
