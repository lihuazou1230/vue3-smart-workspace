import { describe, expect, it } from 'vitest'

import {
  INITIAL_SYNC_NOTICE_STATE,
  OFFLINE_NOTICE_TEXT,
  SYNC_RESTORED_NOTICE_TEXT,
  decideSyncNotice,
  describeSyncMessage,
} from './syncNotice'
import type { SyncNoticeState } from './syncNotice'
import type { SyncState } from './todoSync'

/** 连续推进若干状态，返回每次的提示（null 表示没提示） */
function run(states: SyncState[]): (string | null)[] {
  let state: SyncNoticeState = { ...INITIAL_SYNC_NOTICE_STATE }
  const texts: (string | null)[] = []
  for (const next of states) {
    const decision = decideSyncNotice(next, state)
    state = decision.state
    texts.push(decision.notice ? decision.notice.text : null)
  }
  return texts
}

describe('decideSyncNotice（同步状态 → Toast）', () => {
  it('跨入离线：给出离线警告', () => {
    const decision = decideSyncNotice('offline', { wasOffline: false })
    expect(decision.notice).toEqual({ tone: 'warning', text: OFFLINE_NOTICE_TEXT })
    expect(decision.state.wasOffline).toBe(true)
  })

  it('已在离线：重复的 offline 不再提示（避免每次推送失败都弹一个）', () => {
    const decision = decideSyncNotice('offline', { wasOffline: true })
    expect(decision.notice).toBeNull()
    expect(decision.state.wasOffline).toBe(true)
  })

  it('恢复同步：离线后回到 synced 提示一次', () => {
    const decision = decideSyncNotice('synced', { wasOffline: true })
    expect(decision.notice).toEqual({ tone: 'success', text: SYNC_RESTORED_NOTICE_TEXT })
    expect(decision.state.wasOffline).toBe(false)
  })

  it('未离线过的 synced 不提示（正常同步不该打扰用户）', () => {
    expect(decideSyncNotice('synced', { wasOffline: false }).notice).toBeNull()
  })

  it('syncing 是中间态：不提示也不清除离线标记', () => {
    const decision = decideSyncNotice('syncing', { wasOffline: true })
    expect(decision.notice).toBeNull()
    expect(decision.state.wasOffline).toBe(true)
  })

  it('完整链路 offline → syncing → synced：只在断网与恢复各提示一次', () => {
    expect(run(['syncing', 'synced', 'offline', 'syncing', 'synced'])).toEqual([
      null, // 首次进入同步中
      null, // 正常同步完成
      OFFLINE_NOTICE_TEXT, // 断网
      null, // 补发的中间态
      SYNC_RESTORED_NOTICE_TEXT, // 恢复
    ])
  })

  it('登出（回到 local）复位标记：下次登录断网时会重新提示', () => {
    const afterLogout = decideSyncNotice('local', { wasOffline: true })
    expect(afterLogout.notice).toBeNull()
    expect(afterLogout.state.wasOffline).toBe(false)
    expect(run(['syncing', 'synced', 'local', 'syncing', 'offline']).at(-1)).toBe(
      OFFLINE_NOTICE_TEXT,
    )
  })

  it('反复断网/恢复：每次都各提示一次（用户确实经历了两次断网）', () => {
    expect(run(['syncing', 'offline', 'synced', 'offline', 'synced'])).toEqual([
      null,
      OFFLINE_NOTICE_TEXT,
      SYNC_RESTORED_NOTICE_TEXT,
      OFFLINE_NOTICE_TEXT,
      SYNC_RESTORED_NOTICE_TEXT,
    ])
  })
})

describe('describeSyncMessage（一次性事件）', () => {
  it('旧数据迁移完成：以成功提示告知迁移了多少条', () => {
    expect(describeSyncMessage('已把本地 3 条任务迁移到云端')).toEqual({
      tone: 'success',
      text: '已把本地 3 条任务迁移到云端',
    })
  })

  it('其他消息不弹 Toast（离线/报错已有常驻文案，交给设置页与侧边栏）', () => {
    expect(describeSyncMessage('当前处于离线模式：改动已保存在本地，恢复网络后自动同步')).toBeNull()
    expect(describeSyncMessage('网络不可用，请检查连接')).toBeNull()
    expect(describeSyncMessage('')).toBeNull()
  })
})
