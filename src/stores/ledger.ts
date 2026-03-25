import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PetTrade, Statistics } from '@/types'
import { db, initializeDefaultCategories } from '@/services/db'
import { SyncService } from '@/services/sync'
import { useAuthStore } from './auth'

const getToday = () => new Date().toISOString().split('T')[0]
const LAST_LEDGER_DAY_KEY = 'pet-ledger:last-ledger-day'

export const useLedgerStore = defineStore('ledger', () => {
  const trades = ref<PetTrade[]>([])
  const loading = ref(false)
  const lastSyncTime = ref<string | null>(null)
  const currentDay = ref(getToday())

  let midnightTimer: ReturnType<typeof setTimeout> | null = null

  const ensureMidnightWatcher = () => {
    if (midnightTimer) clearTimeout(midnightTimer)

    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    const delay = nextMidnight.getTime() - now.getTime()

    midnightTimer = setTimeout(async () => {
      await handleDayChanged()
      ensureMidnightWatcher()
    }, delay)
  }

  const generateDailySummaryForDate = async (_date: string) => {
    // 日结汇总现在在日历页直接展示，不再写入星球日记
  }

  const handleDayChanged = async () => {
    const today = getToday()
    if (today === currentDay.value) return

    const previousDay = currentDay.value
    currentDay.value = today

    await generateDailySummaryForDate(previousDay)
    localStorage.setItem(LAST_LEDGER_DAY_KEY, today)
    await loadTrades()
  }

  // 初始化
  const initialize = async () => {
    loading.value = true
    try {
      const today = getToday()
      const lastDay = localStorage.getItem(LAST_LEDGER_DAY_KEY)
      currentDay.value = today

      await initializeDefaultCategories()

      if (lastDay && lastDay !== today) {
        await generateDailySummaryForDate(lastDay)
      }

      localStorage.setItem(LAST_LEDGER_DAY_KEY, today)

      await loadTrades()
      ensureMidnightWatcher()
    } finally {
      loading.value = false
    }
  }

  // 加载交易记录（先从云端同步）
  const loadTrades = async () => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount) return

    try {
      currentDay.value = getToday()

      // 先从云端拉取最新数据
      if (authStore.currentUser?.id && authStore.currentAccount?.id) {
        const remoteTrades = await SyncService.fetchTrades(
          authStore.currentUser.id,
          authStore.currentAccount.id
        )

        await db.petTrades.bulkPut(remoteTrades)
      }

      // 再从本地读取（仅当日数据，实现 0 点自动重置）
      const allTrades = await db.petTrades.toArray()
      const accountTrades = allTrades.filter(
        t => t.accountId === authStore.currentAccount!.id && t.tradeDate === currentDay.value
      )
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
      if (newTrade.tradeDate === currentDay.value) {
        trades.value.unshift(newTrade)
      }

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
      let trade = trades.value.find(t => t.id === id)

      if (!trade) {
        trade = await db.petTrades.get(id)
      }

      if (!trade) return { success: false, error: '交易不存在' }

      const updatedTrade: PetTrade = {
        ...trade,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      await db.petTrades.put(updatedTrade)

      const index = trades.value.findIndex(t => t.id === id)
      if (index !== -1) {
        if (updatedTrade.tradeDate === currentDay.value) {
          trades.value[index] = updatedTrade
        } else {
          trades.value.splice(index, 1)
        }
      }

      await SyncService.updateTrade(updatedTrade)
      return { success: true }
    } catch (error) {
      console.error('更新交易失败:', error)
      return { success: false, error }
    }
  }

  // 统计数据（当日）
  const statistics = computed<Statistics>(() => {
    const stats = trades.value.reduce(
      (acc, t) => {
        const totalPrice = t.price * t.quantity
        if (t.type === 'buy') {
          acc.totalBuy += totalPrice
        } else if (t.status === 'confirmed') {
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

    stats.totalProfit = stats.totalSell - stats.totalBuy
    stats.balance = stats.totalProfit

    return stats
  })

  const recentTrades = computed(() => trades.value.slice(0, 20))

  const syncWithCloud = async () => {
    const authStore = useAuthStore()
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return { success: false }

    loading.value = true
    try {
      const userId = authStore.currentUser.id
      const accountId = authStore.currentAccount.id

      const allAccountTrades = (await db.petTrades.toArray()).filter(t => t.accountId === accountId)
      await SyncService.uploadUnsyncedTrades(allAccountTrades)

      const result = await SyncService.fullSync(userId, accountId, lastSyncTime.value || undefined)

      if (result.success && result.trades.length > 0) {
        await db.petTrades.bulkPut(result.trades.map(remote => ({ ...remote, synced: true })))
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

  const clearAllTrades = async () => {
    const authStore = useAuthStore()
    try {
      const accountId = authStore.currentAccount?.id
      if (!accountId) return { success: false }

      const accountTrades = await db.petTrades
        .filter(t => t.accountId === accountId)
        .toArray()

      for (const t of accountTrades) {
        await db.petTrades.delete(t.id)
      }
      trades.value = []

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
    generateDailySummaryForDate,
  }
})
