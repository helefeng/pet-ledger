// 赛尔号交易记录自动导入脚本
// 使用方法：node scripts/importTrades.js
// 说明：脚本会拉取所有账号的全部交易记录，生成可导入的 JSON 文件

import http from 'http'
import fs from 'fs'

// ============================================================
// 配置区：填写你的账号信息
// Token 从浏览器 F12 → Network → 任意请求的 Token 请求头获取
// 每次登录后 Token 会变化，失效后需重新获取
// ============================================================
const ACCOUNTS = [
  {
    accountName: '大号',
    gameEmail: '1349542119@qq.com',
    token: '6705dfd7-fcf7-4e53-8016-b8557ff41b1d',
  },
  {
    accountName: '小号',
    gameEmail: '1254706663@qq.com',
    token: '8dbc9dc3-5749-4509-bd29-3347f71e45bf',
  },
  {
    accountName: '小小号',
    gameEmail: '2934595638@qq.com',
    token: 'b2f1d0f0-3d83-4e1e-8888-cdb7c7db0740',
  },
]
// ============================================================

// ============================================================
// 日期过滤配置（留空则拉取全部）
// 格式：'YYYY-MM-DD'
const DATE_FROM = '2026-03-24'  // 开始日期，例如 '2026-03-01'
const DATE_TO = '2026-03-25'    // 结束日期，例如 '2026-03-25'
// ============================================================

const API_HOST = 'http://140.210.17.123:8211'
const FRONT_HOST = 'http://61.160.213.26:12347'
const PAGE_SIZE = 50

// tradeType 映射（根据探测结果：2=卖出，推测1=买入）
// 如果导入后发现买卖方向反了，把下面的 1 和 2 对调
const TRADE_TYPE_MAP = {
  1: 'buy',
  2: 'sell',
}

function postJSON(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json, text/plain, */*',
        'Origin': FRONT_HOST,
        'Referer': FRONT_HOST + '/',
        'User-Agent': 'Mozilla/5.0',
        ...headers,
      },
    }
    const req = http.request(options, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, data: null, raw }) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// 拉取单个账号的全部交易记录
async function fetchAllTrades(account) {
  console.log(`\n拉取账号：${account.accountName} (${account.gameEmail})`)
  const all = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    process.stdout.write(`  第 ${page}/${totalPages} 页...`)
    const body = { currentPage: page, limit: PAGE_SIZE }
    if (DATE_FROM) body.startTime = DATE_FROM + ' 00:00:00'
    if (DATE_TO) body.endTime = DATE_TO + ' 23:59:59'

    const res = await postJSON(
      `${API_HOST}/seer/trade/tradeRecord`,
      body,
      { Token: account.token }
    )

    if (res.status !== 200 || !res.data?.data) {
      console.log(`\n  错误: HTTP ${res.status}`, res.data)
      break
    }

    const { list, totalPage, totalCount } = res.data.data
    totalPages = totalPage || 1
    all.push(...(list || []))
    console.log(` 获取 ${list?.length || 0} 条（共 ${totalCount} 条）`)
    page++
    await sleep(300)
  }

  console.log(`  共获取 ${all.length} 条原始记录`)
  return all
}

// 转换为 App 格式
function convert(record, account, userId, accountId) {
  const type = TRADE_TYPE_MAP[record.tradeType] || 'buy'
  // amount 是交易总金额
  const total = Number(record.amount || 0)
  const quantity = 1  // 接口未返回数量，默认1；如有需要可从 itemDesc 解析
  const price = total  // 单价 = 总价（quantity=1时）

  const tradeDate = record.create_time
    ? record.create_time.split('T')[0]
    : new Date().toISOString().split('T')[0]

  const commission = type === 'sell' ? total * 0.05 : 0
  const actualProfit = type === 'sell' ? total - commission : 0

  // 解析 itemDesc 获取精灵详情
  let desc = ''
  try {
    const d = JSON.parse(record.itemDesc || '{}')
    const parts = []
    if (d.level) parts.push(`Lv${d.level}`)
    if (d.nature) parts.push(d.nature)
    if (d.iv !== undefined) parts.push(`个体${d.iv}`)
    if (d.isShiny) parts.push('闪光')
    desc = parts.join(' ')
  } catch { }

  return {
    id: `import_${record.orderId || record.recordId}`,
    userId,
    accountId,
    itemName: record.itemName || '未知',
    price,
    quantity,
    type,
    status: 'confirmed',
    tradeDate,
    commission,
    actualProfit,
    notes: desc ? `${desc} | 订单:${record.orderId}` : `订单:${record.orderId}`,
    synced: false,
    createdAt: record.create_time ? new Date(record.create_time).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // 保留原始数据供调试
    _raw: {
      recordId: record.recordId,
      itemId: record.itemId,
      tradeType: record.tradeType,
      account: record.account,
    }
  }
}

async function main() {
  console.log('===== 赛尔号交易记录导入工具 =====')
  console.log(`账号数量：${ACCOUNTS.length}`)

  // 读取 App 的用户数据（从 pet-ledger 数据库）
  // 如果有多个账号，需要填写对应的 userId 和 accountId
  // 获取方式：App 里 F12 → Application → IndexedDB → pet-ledger-db
  const USER_ID = 'user_1774230869213_87hn7vnj1'
  const ACCOUNT_ID_MAP = {
    '1349542119@qq.com': 'account_1774232673449_xhitiqwww',
    '1254706663@qq.com': 'account_1774232717451_wcnn6z4eq',
    '2934595638@qq.com': 'account_1774232728132_79956u24t',
  }

  const allTrades = []

  for (const account of ACCOUNTS) {
    try {
      const raw = await fetchAllTrades(account)
      const accountId = ACCOUNT_ID_MAP[account.gameEmail] || `game_account_${account.gameEmail}`
      const converted = raw.map(r => convert(r, account, USER_ID, accountId))
      allTrades.push(...converted)
      console.log(`  转换完成：${converted.length} 条`)
    } catch (err) {
      console.error(`  账号 ${account.accountName} 失败:`, err.message)
    }
  }

  // 按日期排序
  allTrades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const output = {
    exportTime: new Date().toISOString(),
    totalCount: allTrades.length,
    accounts: ACCOUNTS.map(a => ({ accountName: a.accountName, gameEmail: a.gameEmail })),
    trades: allTrades,
  }

  fs.writeFileSync('scripts/imported_trades.json', JSON.stringify(output, null, 2))
  console.log(`\n===== 完成 =====`)
  console.log(`共导入 ${allTrades.length} 条交易记录`)
  console.log('结果已保存到: scripts/imported_trades.json')
  console.log('\n下一步：运行 node scripts/injectTrades.js 将数据写入 App 数据库')
}

main().catch(console.error)
