import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PetTrade, Statistics } from '@/types'
import { db, initializeDefaultCategories } from '@/services/db'
import { SyncService } from '@/services/sync'
import { useAuthStore } from './auth'

export const useLedgerStore = defineStore('ledger', () => {
  const trades = ref<PetTrade[]>([])
  const loading = ref(false)
  const lastSyncTime = ref<string | null>(null)

  // 初始化
  const initialize = async () => {
    loading.value = true
    try {
      await initializeDefaultCategories()
      await loadTrades()
    } finally {
      loading.value = false
    }
  }

  // 加载交易记录
  const loadTrades = async () => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount) return

    try {
      const allTrades = await db.petTrades.toArray()
      const accountTrades = allTrades.filter(t => t.accountId === authStore.currentAccount!.id)
      trades.value = accountTrades.sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())
    } catch (error) {
      console.error('加载交易记录失败:', error)
    }
  }

  // 添加交易
  const addTrade = async (trade: Omit<PetTrade, 'id' | 'createdAt' | 'updatedAt' | 'commission' | 'actualProfit' | 'userId' | 'accountId'>) => {
    const authStore = useAuthStore()
    if (!authStore.currentUser || !authStore.currentAccount) return

    const now = new Date().toISOString()
    const commission = trade.price * trade.quantity * 0.05 // 5% 提成
    const actualProfit = trade.type === 'sell' ? trade.price * trade.quantity - commission : 0

    const newTrade: PetTrade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random()}`,
      userId: authStore.currentUser.id,
      accountId: authStore.currentAccount.id,
      commission,
      actualProfit,
      createdAt: now,
      updatedAt: now,
      synced: false,
    }

    try {
      await db.petTrades.add(newTrade)
      trades.value.unshift(newTrade)

      // 异步上传到云端
      SyncService.uploadTrade(newTrade).then((result) => {
        if (result?.success) {
          newTrade.synced = true
          db.petTrades.update(newTrade.id, { synced: true })
        }
      })

      return { success: true, trade: newTrade }
    } catch (error) {
      console.error('添加交易失败:', error)
      return { success: false, error }
    }
  }

  // 删除交易
  const deleteTrade = async (id: string) => {
    try {
      await db.petTrades.delete(id)
      trades.value = trades.value.filter((t) => t.id !== id)
      await SyncService.deleteTrade(id)
      return { success: true }
    } catch (error) {
      console.error('删除交易失败:', error)
      return { success: false, error }
    }
  }

  // 更新交易
  const updateTrade = async (id: string, updates: Partial<PetTrade>) => {
    try {
      const trade = trades.value.find(t => t.id === id)
      if (!trade) return { success: false, error: '交易不存在' }

      const updatedTrade = {
        ...trade,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      await db.petTrades.update(id, updatedTrade)
      const index = trades.value.findIndex(t => t.id === id)
      if (index !== -1) {
        trades.value[index] = updatedTrade
      }
      await SyncService.updateTrade(updatedTrade)
      return { success: true }
    } catch (error) {
      console.error('更新交易失败:', error)
      return { success: false, error }
    }
  }

  // 统计数据
  const statistics = computed<Statistics>(() => {
    const stats = trades.value.reduce(
      (acc, t) => {
        const totalPrice = t.price * t.quantity
        if (t.type === 'buy') {
          acc.totalBuy += totalPrice
        } else if (t.status === 'confirmed') {
          // 只统计已确认的卖出
          acc.totalSell += totalPrice * 0.95
        }
        acc.tradeCount += 1
        return acc
      },
      {
        totalBuy: 0,
        totalSell: 0,
        totalCommission: 0,
        totalProfit: 0,
        tradeCount: 0,
        balance: 0,
      }
    )

    // 利润 = 卖出 - 买入
    stats.totalProfit = stats.totalSell - stats.totalBuy
    stats.balance = stats.totalProfit

    return stats
  })

  // 获取最近交易
  const recentTrades = computed(() => {
    return trades.value.slice(0, 20)
  })

  // 云同步
  const syncWithCloud = async () => {
    const authStore = useAuthStore()
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return { success: false }

    loading.value = true
    try {
      const userId = authStore.currentUser.id
      const accountId = authStore.currentAccount.id

      // 先上传本地未同步的记录
      await SyncService.uploadUnsyncedTrades(trades.value)

      // 拉取云端数据（增量同步）
      const result = await SyncService.fullSync(userId, accountId, lastSyncTime.value || undefined)

      if (result.success && result.trades.length > 0) {
        for (const remote of result.trades) {
          const local = trades.value.find(t => t.id === remote.id)
          if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
            await db.petTrades.put({ ...remote, synced: true })
          }
        }
        await loadTrades()
      }

      lastSyncTime.value = new Date().toISOString()
      return { success: true }
    } catch (error) {
      console.error('云同步失败:', error)
      return { success: false, error }
    } finally {
      loading.value = false
    }
  }

  // 清除所有交易记录
  const clearAllTrades = async () => {
    const authStore = useAuthStore()
    try {
      const accountId = authStore.currentAccount?.id
      if (!accountId) return { success: false }

      // 只删除当前账号的记录
      const accountTrades = await db.petTrades
        .filter(t => t.accountId === accountId)
        .toArray()
      
      for (const t of accountTrades) {
        await db.petTrades.delete(t.id)
      }
      trades.value = []

      // 云端同步清除
      if (authStore.currentUser?.id) {
        await SyncService.clearAllTrades(authStore.currentUser.id, accountId)
      }

      return { success: true }
    } catch (error) {
      console.error('清除交易记录失败:', error)
      return { success: false, error }
    }
  }

  return {
    trades,
    loading,
    statistics,
    recentTrades,
    initialize,
    loadTrades,
    addTrade,
    deleteTrade,
    updateTrade,
    clearAllTrades,
    syncWithCloud,
  }
})
