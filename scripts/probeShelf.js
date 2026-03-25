// 探测「我的上架」接口
import http from 'http'

const TOKEN = '8dbc9dc3-5749-4509-bd29-3347f71e45bf' // 填你的当前 Token
const API_HOST = 'http://140.210.17.123:8211'
const FRONT_HOST = 'http://61.160.213.26:12347'

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const body = options.body ? JSON.stringify(options.body) : undefined
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': FRONT_HOST,
        'Token': TOKEN,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }
    const req = http.request(reqOptions, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw), raw }) }
        catch { resolve({ status: res.statusCode, data: null, raw }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function probe() {
  // 可能的「我的上架/挂单」接口路径
  const candidates = [
    // 交易相关
    { method: 'POST', path: '/seer/trade/myShelf', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/shelf', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/myListing', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/listing', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/myOrder', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/sellRecord', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/mySell', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/onSale', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/pending', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/trade/tradeRecord', body: { currentPage: 1, limit: 20, tradeType: 2 } },
    { method: 'POST', path: '/seer/trade/tradeRecord', body: { currentPage: 1, limit: 20, status: 0 } },
    { method: 'POST', path: '/seer/trade/tradeRecord', body: { currentPage: 1, limit: 20, status: 'pending' } },
    // 商城/集市
    { method: 'POST', path: '/seer/market/myShelf', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/market/shelf', body: { currentPage: 1, limit: 20 } },
    { method: 'POST', path: '/seer/market/myListing', body: { currentPage: 1, limit: 20 } },
    { method: 'GET',  path: '/seer/trade/myShelf', body: null },
    { method: 'GET',  path: '/seer/trade/shelf', body: null },
    { method: 'GET',  path: '/seer/market/shelf', body: null },
  ]

  for (const c of candidates) {
    const url = API_HOST + c.path
    const label = `${c.method} ${url}` + (c.body ? ` body=${JSON.stringify(c.body)}` : '')
    process.stdout.write(`  ${label} ... `)
    try {
      const res = await request(url, { method: c.method, body: c.body })
      console.log(`HTTP ${res.status}`)
      if (res.status === 200 && res.data) {
        const preview = JSON.stringify(res.data, null, 2).slice(0, 600)
        console.log('  ✓ 响应:', preview)
        // 如果有 list 或 records 字段，打印第一条
        const list = res.data?.data?.list || res.data?.data?.records || res.data?.list
        if (list?.length) {
          console.log('  ✓ 第一条记录:', JSON.stringify(list[0], null, 2))
        }
        console.log()
      }
    } catch (e) {
      console.log(`  错误: ${e.message}`)
    }
  }

  console.log('\n===== 探测完成 =====')
}

probe().catch(console.error)
