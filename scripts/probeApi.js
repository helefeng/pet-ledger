// 接口探测脚本：自动发现登录接口和交易记录接口结构
// 使用方法：node scripts/probeApi.js
// 说明：只需填写一个账号的邮箱和密码，脚本会自动探测所有接口

import http from 'http'

// ============================================================
// 填写你的一个游戏账号（只用于本地探测，不会上传任何信息）
// ============================================================
const EMAIL = ' 1254706663@qq.com'
const PASSWORD = ' Hh1234567'
// 如果自动登录失败，直接填写从浏览器抓包获取的 Token（跳过登录步骤）
const MANUAL_TOKEN = '8dbc9dc3-5749-4509-bd29-3347f71e45bf'
// ============================================================

const FRONT_HOST = 'http://61.160.213.26:12347'
const API_HOST = 'http://140.210.17.123:8211'

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
        'Accept': 'application/json, text/plain, */*',
        'Origin': FRONT_HOST,
        'Referer': FRONT_HOST + '/',
        'User-Agent': 'Mozilla/5.0',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }

    const req = http.request(reqOptions, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(raw), raw })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: null, raw })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function probe() {
  console.log('===== 赛尔号接口探测脚本 =====')
  console.log('注意：此脚本仅在本地运行，不会上传任何数据\n')

  // Step 1: 探测常见登录接口
  console.log('【Step 1】探测登录接口...')
  const loginPaths = [
    '/seer/user/login',
    '/seer/user/loginByPassword',
    '/seer/login',
    '/api/user/login',
    '/api/login',
    '/user/login',
  ]

  let token = null
  let loginUrl = null

  for (const path of loginPaths) {
    const url = API_HOST + path
    process.stdout.write(`  尝试 ${url} ... `)
    try {
      const res = await request(url, {
        body: { email: EMAIL, password: PASSWORD },
      })
      console.log(`HTTP ${res.status}`)
      if (res.status === 200 && res.data) {
        console.log('  响应:', JSON.stringify(res.data, null, 2).slice(0, 400))
        // 尝试提取 token
        const d = res.data
        token = d.token || d.data?.token || d.result?.token || d.access_token
        if (token) {
          loginUrl = url
          console.log(`\n  ✓ 登录成功！Token: ${token}`)
          break
        }
      } else if (res.status !== 404) {
        console.log('  响应:', JSON.stringify(res.data || res.raw, null, 2).slice(0, 200))
      }
    } catch (e) {
      console.log(`  错误: ${e.message}`)
    }
  }

  // Step 2: 也尝试前端服务器的登录
  if (!token) {
    console.log('\n  尝试前端服务器登录接口...')
    const frontPaths = ['/api/user/login', '/api/login', '/login']
    for (const path of frontPaths) {
      const url = FRONT_HOST + path
      process.stdout.write(`  尝试 ${url} ... `)
      try {
        const res = await request(url, {
          body: { email: EMAIL, password: PASSWORD, username: EMAIL },
        })
        console.log(`HTTP ${res.status}`)
        if (res.status === 200) {
          console.log('  响应:', JSON.stringify(res.data || res.raw, null, 2).slice(0, 400))
          const d = res.data || {}
          token = d.token || d.data?.token || d.result?.token
          if (token) {
            loginUrl = url
            console.log(`\n  ✓ 登录成功！Token: ${token}`)
            break
          }
        }
      } catch (e) {
        console.log(`  错误: ${e.message}`)
      }
    }
  }

  if (!token) {
    if (MANUAL_TOKEN && MANUAL_TOKEN.length > 10) {
      token = MANUAL_TOKEN
      console.log(`\n  使用手动填写的 Token: ${token}`)
    } else {
      console.log('\n  ✗ 未能自动登录，请在脚本顶部填写 MANUAL_TOKEN')
      process.exit(1)
    }
  }

  // Step 3: 用 Token 测试交易记录接口
  console.log('\n【Step 2】测试交易记录接口...')
  const res = await request(`${API_HOST}/seer/trade/tradeRecord`, {
    body: { currentPage: 1, limit: 50 },
    headers: { Token: token },
  })

  console.log(`HTTP ${res.status}`)
  console.log('完整响应结构：')
  console.log(JSON.stringify(res.data || res.raw, null, 2).slice(0, 2000))

  if (res.data?.data?.records?.length || res.data?.data?.list?.length) {
    const records = res.data.data.records || res.data.data.list
    console.log('\n【第一条记录的所有字段】')
    console.log(JSON.stringify(records[0], null, 2))
    console.log(`\n总记录数: ${res.data.data.total || res.data.data.totalCount || '未知'}`)
  }

  // Step 4: 获取用户信息
  console.log('\n【Step 3】获取用户信息...')
  const userPaths = [
    '/seer/user/info',
    '/seer/user/profile',
    '/seer/user/detail',
    '/seer/user/userInfo',
    '/seer/member/info',
    '/api/user/info',
    '/seer/account/info',
  ]
  for (const path of userPaths) {
    process.stdout.write(`  尝试 ${API_HOST + path} ... `)
    try {
      const r = await request(API_HOST + path, {
        method: 'GET',
        headers: { Token: token },
      })
      console.log(`HTTP ${r.status}`)
      if (r.status === 200 && r.data) {
        console.log('  用户信息:', JSON.stringify(r.data, null, 2).slice(0, 400))
        break
      }
    } catch (e) {
      console.log(`  错误: ${e.message}`)
    }
  }

  console.log('\n===== 探测完成 =====')
  console.log('请将以上输出发送给 AI，以便完成脚本配置')
}

probe().catch(console.error)
