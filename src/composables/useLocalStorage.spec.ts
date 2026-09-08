import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useLocalStorage } from './useLocalStorage'

const KEY = 'test-key'

function createMockStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, v)
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k)
    }),
  }
}

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('无存储时返回默认值', () => {
    const storage = createMockStorage() as unknown as Storage
    const value = useLocalStorage<string>(KEY, 'hello', storage)
    expect(value.value).toBe('hello')
  })

  it('值变化后写入 JSON', async () => {
    const storage = createMockStorage() as unknown as Storage
    const value = useLocalStorage<{ n: number }>(KEY, { n: 0 }, storage)
    value.value = { n: 42 }
    await nextTick()
    expect(storage.setItem).toHaveBeenCalledWith(KEY, '{"n":42}')
  })

  it('再次读取时恢复已存值', async () => {
    const storage = createMockStorage() as unknown as Storage
    const first = useLocalStorage<number>(KEY, 0, storage)
    first.value = 7
    await nextTick()
    const second = useLocalStorage<number>(KEY, 0, storage)
    expect(second.value).toBe(7)
  })

  it('损坏 JSON 回退默认值', () => {
    const storage = {
      getItem: vi.fn(() => '{oops'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage
    const value = useLocalStorage<number>(KEY, 1, storage)
    expect(value.value).toBe(1)
  })
})
