import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { PetTrade } from '@/types'
import { useLedgerStore } from './ledger'
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

export const useStatsStore = defineStore('stats', () => {
  const ledgerStore = useLedgerStore()
  const authStore = useAuthStore()

  // 获取所有账号的统计数据
  const allAccountsStats = computed(() => {
    const stats: AccountStats[] = []

    authStore.userAccounts.forEach(account => {
      const accountTrades = ledgerStore.trades.filter(t => t.accountId === account.id)

      const accountStat = accountTrades.reduce(
        (acc, t) => {
          const totalPrice = t.price * t.quantity
          if (t.type === 'buy') {
            acc.totalBuy += totalPrice
          } else {
            acc.totalSell += totalPrice
            acc.totalCommission += t.commission
            acc.totalProfit += t.actualProfit
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

    return stats
  })

  // 获取用户总统计
  const userTotalStats = computed(() => {
    const stats = allAccountsStats.value.reduce(
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

    stats.balance = stats.totalSell - stats.totalBuy - stats.totalCommission
    return stats
  })

  return {
    allAccountsStats,
    userTotalStats,
  }
})
