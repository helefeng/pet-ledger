import { createClient } from '@supabase/supabase-js'
import type { PetTrade, PlanetDiary } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

let supabase: any = null

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
}

export const isSupabaseConfigured = () => !!supabase

export class SyncService {
  // ==================== 交易记录同步 ====================

  static async uploadTrade(trade: PetTrade) {
    if (!supabase) return { success: true, skipped: true }

    try {
      const { error } = await supabase
        .from('pet_trades')
        .upsert([trade], { onConflict: 'id' })

      if (error) throw error
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

    try {
      const { error } = await supabase
        .from('pet_trades')
        .upsert(unsynced, { onConflict: 'id' })

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
