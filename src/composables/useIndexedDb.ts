/**
 * 极简 IndexedDB blob 仓库 —— 未登录阶段的本地头像存放
 *
 * 为什么不用 localStorage：头像图片转成 base64 塞进 localStorage，5MB 配额几下就爆，
 * 而且读写是同步的、会阻塞主线程。IndexedDB 可以原样存 Blob，容量大、异步、不阻塞。
 *
 * IndexedDB 在少数环境不可用（Safari 无痕、部分内嵌 WebView、SSR），
 * 这时降级到内存 Map：功能仍在（本次会话内可预览），只是刷新后不再保留。
 */

export const BLOB_DB_NAME = 'smart-workspace'
export const BLOB_STORE = 'blobs'
export const BLOB_DB_VERSION = 1

/** 本地头像的固定键（一个浏览器只存一份当前头像） */
export const AVATAR_BLOB_KEY = 'avatar'

/** IndexedDB 不可用时的内存兜底 */
const memoryFallback = new Map<string, Blob>()

/** 当前环境是否可用 IndexedDB */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

/** 打开数据库（失败/被阻断一律返回 null，交给内存兜底） */
function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null)

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(BLOB_DB_NAME, BLOB_DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** 在事务里跑一段操作，统一成 Promise */
function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(BLOB_STORE, mode)
          const request = run(transaction.objectStore(BLOB_STORE))
          request.onsuccess = () => resolve(request.result as T)
          request.onerror = () => resolve(null)
          transaction.oncomplete = () => db.close()
        } catch {
          db.close()
          resolve(null)
        }
      }),
  )
}

/** 写入 blob（同时写内存兜底，便于 IndexedDB 失败时本次会话仍能显示） */
export async function putBlob(key: string, blob: Blob): Promise<boolean> {
  if (!isIndexedDbAvailable()) {
    memoryFallback.set(key, blob)
    return false
  }
  const result = await withStore(
    'readwrite',
    (store) => store.put(blob, key) as IDBRequest<IDBValidKey>,
  )
  if (result === null) {
    memoryFallback.set(key, blob)
    return false
  }
  memoryFallback.set(key, blob)
  return true
}

/** 读取 blob（IndexedDB 优先，其次内存兜底） */
export async function getBlob(key: string): Promise<Blob | null> {
  if (isIndexedDbAvailable()) {
    const result = await withStore<Blob>('readonly', (store) => store.get(key) as IDBRequest<Blob>)
    if (result) return result
  }
  return memoryFallback.get(key) ?? null
}

/** 删除 blob（两处都删，避免内存兜底里的旧头像又“复活”） */
export async function deleteBlob(key: string): Promise<void> {
  memoryFallback.delete(key)
  if (!isIndexedDbAvailable()) return
  await withStore('readwrite', (store) => store.delete(key) as IDBRequest<undefined>)
}
