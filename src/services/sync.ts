import { createClient } from '@supabase/supabase-js'
import { db } from '@/services/db'
import type { PetTrade, PlanetDiary, User, GameAccount } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

let supabase: any = null

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
}

const GAME_API_HOST = 'http://140.210.17.123:8211'
const GAME_FRONT_HOST = 'http://61.160.213.26:12347'

export const isSupabaseConfigured = () => !!supabase

export class SyncService {
  // ==================== 用户同步 ====================

  static async uploadUser(user: User) {
    if (!supabase) return { success: true, skipped: true }
    try {
      const { error } = await supabase.from('users').upsert([user], { onConflict: 'id' })
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('上传用户失败:', error)
      return { success: false, error }
    }
  }

  static async fetchUserByUsername(username: string) {
    if (!supabase) return null
    try {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).single()
      if (error) return null
      return data as User
    } catch {
      return null
    }
  }

  static async fetchUserById(id: string) {
    if (!supabase) return null
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
      if (error) return null
      return data as User
    } catch {
      return null
    }
  }

  // ==================== 游戏账号同步 ====================

  static async uploadAccount(account: GameAccount) {
    if (!supabase) return { success: true, skipped: true }
    try {
      const { tradeBalance: _tb, tradeBalanceUpdatedAt: _tbu, ...accountToUpload } = account
      const { error } = await supabase.from('game_accounts').upsert([accountToUpload], { onConflict: 'id' })
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('上传游戏账号失败:', error)
      return { success: false, error }
    }
  }

  static async fetchAccountsByUserId(userId: string) {
    if (!supabase) return []
    try {
      const { data, error } = await supabase.from('game_accounts').select('*').eq('userId', userId)
      if (error) throw error
      return (data || []) as GameAccount[]
    } catch {
      return []
    }
  }

  static async fetchAccountsByEmail(gameEmail: string) {
    if (!supabase) return []
    try {
      const { data, error } = await supabase.from('game_accounts').select('*').eq('gameEmail', gameEmail)
      if (error) throw error
      return (data || []) as GameAccount[]
    } catch {
      return []
    }
  }

  static async deleteAccount(id: string) {
    if (!supabase) return { success: true, skipped: true }
    try {
      const { error } = await supabase.from('game_accounts').delete().eq('id', id)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('删除游戏账号失败:', error)
      return { success: false, error }
    }
  }

  static async uploadTrade(trade: PetTrade) {
    if (!supabase) {
      console.warn('Supabase 未配置，跳过上传')
      return { success: true, skipped: true }
    }

    try {
      console.log('上传交易到 Supabase:', trade.id)
      const { data, error } = await supabase
        .from('pet_trades')
        .upsert([trade], { onConflict: 'id' })
        .select()

      if (error) {
        console.error('Supabase 上传错误:', error)
        throw error
      }
      console.log('上传成功:', data)
      return { success: true }
    } catch (error) {
      console.error('上传交易失败:', error)
      return { success: false, error }
    }
  }

  static async fetchTrades(userId: string, accountId: string, since?: string) {
    if (!supabase) return []

    try {
      let query = supabase
        .from('pet_trades')
        .select('*')
        .eq('userId', userId)
        .eq('accountId', accountId)

      if (since) {
        query = query.gt('updatedAt', since)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('拉取交易失败:', error)
      return []
    }
  }

  static async deleteTrade(id: string) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('pet_trades')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('删除交易失败:', error)
      return { success: false, error }
    }
  }

  static async updateTrade(trade: PetTrade) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('pet_trades')
        .upsert([trade], { onConflict: 'id' })

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('更新交易失败:', error)
      return { success: false, error }
    }
  }

  static async clearAllTrades(userId: string, accountId: string) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('pet_trades')
        .delete()
        .eq('userId', userId)
        .eq('accountId', accountId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('清除交易失败:', error)
      return { success: true } // 本地清除成功即可
    }
  }

  // 批量上传未同步的交易
  static async uploadUnsyncedTrades(trades: PetTrade[]) {
    if (!supabase) return { success: true, skipped: true }

    const unsynced = trades.filter(t => !t.synced)
    if (unsynced.length === 0) return { success: true }

    // 只上传 Supabase 表中存在的字段，过滤掉本地扩展字段
    const toUpload = unsynced.map(({ notes: _n, ...rest }) => rest)

    try {
      const { error } = await supabase
        .from('pet_trades')
        .upsert(toUpload, { onConflict: 'id' })

      if (error) throw error
      return { success: true, count: unsynced.length }
    } catch (error) {
      console.error('批量上传失败:', error)
      return { success: false, error }
    }
  }

  // ==================== 日记同步 ====================

  static async uploadDiary(diary: PlanetDiary) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('planet_diaries')
        .upsert([diary], { onConflict: 'id' })

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('上传日记失败:', error)
      return { success: false, error }
    }
  }

  static async fetchDiaries(userId: string, accountId: string, since?: string) {
    if (!supabase) return []

    try {
      let query = supabase
        .from('planet_diaries')
        .select('*')
        .eq('userId', userId)
        .eq('accountId', accountId)

      if (since) {
        query = query.gt('updatedAt', since)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('拉取日记失败:', error)
      return []
    }
  }

  // 按用户拉取全部日记（首页聚合展示用）
  static async fetchDiariesByUserId(userId: string, since?: string) {
    if (!supabase) return []

    try {
      let query = supabase
        .from('planet_diaries')
        .select('*')
        .eq('userId', userId)

      if (since) {
        query = query.gt('updatedAt', since)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('按用户拉取日记失败:', error)
      return []
    }
  }

  static async deleteDiary(id: string) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('planet_diaries')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('删除日记失败:', error)
      return { success: false, error }
    }
  }

  static async updateDiary(diary: PlanetDiary) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('planet_diaries')
        .upsert([diary], { onConflict: 'id' })

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('更新日记失败:', error)
      return { success: false, error }
    }
  }

  // ==================== 游戏数据导入（共享逻辑） ====================

  static async importGameData(params: {
    token: string
    userId: string
    account: GameAccount
    dateFrom?: string
    dateTo?: string
    onProgress?: (msg: string) => void
  }) {
    const { token, userId, account, dateFrom, dateTo, onProgress } = params
    const cleanToken = token.replace(/^"|"$/g, '').trim()
    const today = new Date().toISOString().split('T')[0]

    // 1) 拉取已完成交易
    const records: any[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      onProgress?.(`拉取交易记录 第 ${page}/${totalPages} 页...`)
      const body: any = { currentPage: page, limit: 50 }
      if (dateFrom) body.startTime = `${dateFrom} 00:00:00`
      if (dateTo) body.endTime = `${dateTo} 00:00:00`

      const res = await fetch(`${GAME_API_HOST}/seer/trade/tradeRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': GAME_FRONT_HOST,
          'Token': cleanToken,
        },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json?.data?.list) break
      const { list, totalPage } = json.data
      totalPages = totalPage || 1
      records.push(...list)
      page++
      await new Promise(r => setTimeout(r, 200))
    }

    // 2) 拉取上架中
    onProgress?.('拉取上架中记录...')
    let myTradeList: any[] = []
    try {
      const res = await fetch(`${GAME_API_HOST}/seer/trade/myTrade`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': GAME_FRONT_HOST,
          'Referer': GAME_FRONT_HOST + '/',
          'Token': cleanToken,
        },
      })
      const json = await res.json()
      if (json?.code === 200 && Array.isArray(json?.data)) {
        myTradeList = json.data
      }
    } catch {
      // 忽略上架拉取失败，仅导入已完成交易
    }

    // 3) 写入交易记录
    const existing = new Set((await db.petTrades.toArray()).map(t => t.id))
    let added = 0
    let skipped = 0

    for (const r of records) {
      const type = r.tradeType === 1 ? 'buy' : 'sell'
      const total = Number(r.amount || 0)
      const tradeDate = r.create_time?.split('T')[0] || today
      const commission = type === 'sell' ? total * 0.05 : 0

      let desc = ''
      try {
        const d = JSON.parse(r.itemDesc || '{}')
        const parts: string[] = []
        if (d.level) parts.push(`Lv${d.level}`)
        if (d.nature) parts.push(d.nature)
        if (d.iv !== undefined) parts.push(`个体${d.iv}`)
        if (d.isShiny) parts.push('闪光')
        desc = parts.join(' ')
      } catch {}

      const trade: PetTrade = {
        id: `import_${r.orderId || r.recordId}`,
        userId,
        accountId: account.id,
        itemName: r.itemName || '未知',
        price: total,
        quantity: 1,
        type,
        status: 'confirmed',
        tradeDate,
        commission,
        actualProfit: type === 'sell' ? total - commission : 0,
        notes: desc ? `${desc} | 订单:${r.orderId}` : `订单:${r.orderId}`,
        synced: false,
        createdAt: r.create_time ? new Date(r.create_time).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (existing.has(trade.id)) {
        skipped++
        continue
      }
      await db.petTrades.add(trade)
      added++
    }

    // 4) 刷新上架中记录（按账号全量替换）
    const oldListings = await db.petTrades
      .filter(t => t.accountId === account.id && t.id.startsWith('listing_'))
      .toArray()
    await db.petTrades.bulkDelete(oldListings.map(t => t.id))

    for (const r of myTradeList) {
      const total = Number(r.unitPrice || 0)
      const tradeDate = r.listTime?.split('T')[0] || today
      let desc = ''
      try {
        const d = JSON.parse(r.itemDesc || '{}')
        const parts: string[] = []
        if (d.level) parts.push(`Lv${d.level}`)
        if (d.nature) parts.push(d.nature)
        if (d.iv !== undefined) parts.push(`个体${d.iv}`)
        if (d.isShiny) parts.push('闪光')
        desc = parts.join(' ')
      } catch {}

      const trade: PetTrade = {
        id: `listing_${r.listingId}`,
        userId,
        accountId: account.id,
        itemName: r.itemName || '未知',
        price: total,
        quantity: r.quantity || 1,
        type: 'sell',
        status: 'pending',
        tradeDate,
        commission: total * 0.05,
        actualProfit: 0,
        nature: '',
        level: 0,
        individual: 0,
        ability: '',
        isShiny: '否',
        notes: desc ? `${desc} | 上架中` : '上架中',
        synced: false,
        createdAt: r.listTime ? new Date(r.listTime).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await db.petTrades.put(trade)
      if (existing.has(trade.id)) skipped++
      else added++
    }

    // 5) 拉取余额
    let tradeBalance: number | undefined
    try {
      onProgress?.('拉取余额...')
      const res = await fetch(`${GAME_API_HOST}/seer/customer/balance`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Origin': GAME_FRONT_HOST,
          'Referer': GAME_FRONT_HOST + '/',
          'Token': cleanToken,
        },
      })
      const json = await res.json()
      if (json?.code === 200 && json?.data?.tradeBalance !== undefined) {
        tradeBalance = Number(json.data.tradeBalance)
        await db.gameAccounts.update(account.id, {
          tradeBalance,
          tradeBalanceUpdatedAt: new Date().toISOString(),
        })
      }
    } catch {
      // 忽略余额失败，不影响交易导入
    }

    return {
      added,
      skipped,
      pendingCount: myTradeList.length,
      tradeBalance,
      recordCount: records.length,
    }
  }

  // ==================== 全量同步 ====================

  // 从云端拉取并合并到本地（以 updatedAt 最新为准）
  static async fullSync(userId: string, accountId: string, since?: string) {
    if (!supabase) return { success: true, skipped: true, trades: [], diaries: [] }

    try {
      const [trades, diaries] = await Promise.all([
        SyncService.fetchTrades(userId, accountId, since),
        SyncService.fetchDiaries(userId, accountId, since),
      ])

      return { success: true, trades, diaries }
    } catch (error) {
      console.error('全量同步失败:', error)
      return { success: false, error, trades: [], diaries: [] }
    }
  }
}
