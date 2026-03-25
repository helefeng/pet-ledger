import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/services/db'
import { useAuthStore } from './auth'

export interface AccountStats {
  accountId: string
  accountEmail: string
  totalBuy: number
  totalSell: number
  totalCommission: number
  totalProfit: number
  tradeCount: number
  balance: number
}

export interface StatsState {
  allAccountsStats: AccountStats[]
  userTotalStats: {
    totalBuy: number
    totalSell: number
    totalCommission: number
    totalProfit: number
    tradeCount: number
    balance: number
  }
}

export const useStatsStore = defineStore('stats', () => {
  const authStore = useAuthStore()

  const allAccountsStats = ref<AccountStats[]>([])
  const userTotalStats = ref<StatsState['userTotalStats']>({
    totalBuy: 0,
    totalSell: 0,
    totalCommission: 0,
    totalProfit: 0,
    tradeCount: 0,
    balance: 0,
  })

  // 从本地 DB 加载全量历史统计（不受当日过滤影响）
  const loadStats = async () => {
    if (!authStore.currentUser?.id) return

    const userId = authStore.currentUser.id
    const allTrades = await db.petTrades.toArray()
    const userTrades = allTrades.filter(t => t.userId === userId)

    const stats: AccountStats[] = []

    authStore.userAccounts.forEach(account => {
      const accountTrades = userTrades.filter(t => t.accountId === account.id)

      const accountStat = accountTrades.reduce(
        (acc, t) => {
          const totalPrice = t.price * t.quantity
          if (t.type === 'buy') {
            acc.totalBuy += totalPrice
          } else {
            acc.totalSell += totalPrice
            acc.totalCommission += t.commission || 0
            acc.totalProfit += t.actualProfit || 0
          }
          acc.tradeCount += 1
          return acc
        },
        {
          accountId: account.id,
          accountEmail: account.gameEmail,
          totalBuy: 0,
          totalSell: 0,
          totalCommission: 0,
          totalProfit: 0,
          tradeCount: 0,
          balance: 0,
        }
      )

      accountStat.balance = accountStat.totalSell - accountStat.totalBuy - accountStat.totalCommission
      stats.push(accountStat)
    })

    allAccountsStats.value = stats

    userTotalStats.value = stats.reduce(
      (acc, s) => {
        acc.totalBuy += s.totalBuy
        acc.totalSell += s.totalSell
        acc.totalCommission += s.totalCommission
        acc.totalProfit += s.totalProfit
        acc.tradeCount += s.tradeCount
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
    userTotalStats.value.balance =
      userTotalStats.value.totalSell -
      userTotalStats.value.totalBuy -
      userTotalStats.value.totalCommission
  }

  return {
    allAccountsStats,
    userTotalStats,
    loadStats,
  }
})
