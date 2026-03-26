import { db } from '@/services/db'
import type { PetTrade, GameAccount } from '@/types'

const GAME_API_HOST = 'http://140.210.17.123:8211'
const GAME_FRONT_HOST = 'http://61.160.213.26:12347'

export class SyncService {
  // 游戏数据导入（共享逻辑）
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
      if (dateTo) body.endTime = `${dateTo} 23:59:59`

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
        sourceAmount: total,
        tradeCurrency: 'bean',
        showInRmbPanel: true,
        type,
        status: 'confirmed',
        tradeDate,
        commission,
        actualProfit: type === 'sell' ? total - commission : 0,
        nature: '',
        level: 0,
        individual: 0,
        ability: '',
        isShiny: '否',
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
      const quantity = Number(r.quantity || 1)
      const amount = Number(r.amount || r.totalAmount || 0)
      const total = amount > 0 ? amount : Number(r.unitPrice || 0) * quantity
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
        price: Number(r.unitPrice || 0),
        quantity,
        sourceAmount: total,
        tradeCurrency: 'bean',
        showInRmbPanel: true,
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
}
