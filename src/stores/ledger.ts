import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PetTrade, Statistics } from '@/types'
import { db, initializeDefaultCategories } from '@/services/db'
import { useAuthStore } from './auth'

const getToday = () => new Date().toISOString().split('T')[0]
const LAST_LEDGER_DAY_KEY = 'pet-ledger:last-ledger-day'

export const useLedgerStore = defineStore('ledger', () => {
  const trades = ref<PetTrade[]>([])
  const loading = ref(false)
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
    // 日结汇总仅更新任务进度，不写入日记
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

  // 加载交易记录（本地）
  const loadTrades = async () => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount) return

    try {
      currentDay.value = getToday()

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
    generateDailySummaryForDate,
  }
})
