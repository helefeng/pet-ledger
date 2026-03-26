<template>
  <div class="account-container">
    <!-- 账号信息卡片 -->
    <div class="account-hero">
      <div class="account-avatar">{{ avatarLetter }}</div>
      <div class="account-info">
        <div class="account-name">{{ authStore.currentAccount?.accountName || '未选择账号' }}</div>
        <div class="account-email">{{ authStore.currentAccount?.gameEmail }}</div>
      </div>
      <div v-if="authStore.userAccounts.length > 1" class="account-switcher">
        <select @change="switchAccount" :value="authStore.currentAccount?.id" class="account-select">
          <option v-for="acc in authStore.userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.accountName }} ({{ acc.gameEmail }})
          </option>
        </select>
      </div>
    </div>

    <!-- 今日概览 -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value trade-balance">{{ authStore.currentAccount?.tradeBalance !== undefined ? formatNumber(authStore.currentAccount.tradeBalance) : '--' }}</span>
        <span class="stat-label">余额</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ todayBuyCount }}</span>
        <span class="stat-label">今日买入</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ todaySellCount }}</span>
        <span class="stat-label">今日卖出</span>
      </div>
      <div class="stat-card">
        <span class="stat-value profit" :class="{ negative: todayProfit < 0 }">{{ todayProfit >= 0 ? '+' : '' }}{{ formatNumber(Math.abs(todayProfit)) }}</span>
        <span class="stat-label">今日收益</span>
      </div>
      <div class="stat-card">
        <span class="stat-value profit" :class="{ negative: yesterdayProfit < 0 }">{{ yesterdayProfit >= 0 ? '+' : '' }}{{ formatNumber(Math.abs(yesterdayProfit)) }}</span>
        <span class="stat-label">昨日卖出</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ taskProgress.completed }}/{{ taskProgress.total }}</span>
        <span class="stat-label">今日任务</span>
      </div>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-actions">
      <div class="section-title">快捷操作</div>
      <div class="action-grid">
        <div class="action-card" @click="router.push('/account/add')">
          <span class="action-icon">➕</span>
          <span class="action-label">添加交易</span>
          <span class="action-desc">记录买入/卖出</span>
        </div>
        <div class="action-card" @click="router.push('/account/diary')">
          <span class="action-icon">📔</span>
          <span class="action-label">星球日记</span>
          <span class="action-desc">记录游戏日常</span>
        </div>
        <div class="action-card" @click="router.push('/account/calendar')">
          <span class="action-icon">🗓️</span>
          <span class="action-label">日历页</span>
          <span class="action-desc">按日查看汇总明细</span>
        </div>
        <div class="action-card" @click="router.push('/account/task')">
          <span class="action-icon">✅</span>
          <span class="action-label">日常任务</span>
          <span class="action-desc">查看任务看板</span>
        </div>
        <div class="action-card" @click="router.push('/settings')">
          <span class="action-icon">⚙️</span>
          <span class="action-label">账号设置</span>
          <span class="action-desc">管理账号信息</span>
        </div>
      </div>
    </div>

    <!-- 待确认卖出 -->
    <div class="recent-section">
      <div class="section-header" @click="showPending = !showPending" style="cursor:pointer">
        <span class="section-title">待确认卖出 <span class="collapse-arrow">{{ showPending ? '▾' : '▸' }}</span></span>
        <div class="section-header-right" @click.stop>
          <span class="pending-count">共 {{ pendingAccountTrades.length }} 条</span>
        </div>
      </div>
      <div v-show="showPending">
        <div v-if="pendingAccountTrades.length === 0" class="empty-tip">暂无待确认卖出</div>
        <div v-else class="table-wrap">
          <el-table :data="pagedPendingTrades" stripe size="small">
            <el-table-column prop="itemName" label="物品" min-width="120" />
            <el-table-column label="金额" width="110" align="right">
              <template #default="{ row }">¥{{ formatAmountRaw(row.price * row.quantity) }}</template>
            </el-table-column>
            <el-table-column prop="tradeDate" label="日期" width="110" align="center" />
            <el-table-column label="操作" width="130" align="center">
              <template #default="{ row }">
                <el-button link type="success" size="small" @click="confirmTrade(row.id)">确认</el-button>
                <el-button link type="primary" size="small" @click="router.push(`/edit/${row.id}`)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="recent-pagination">
            <el-pagination
              v-model:current-page="pendingPage"
              :page-size="pendingPageSize"
              layout="prev, pager, next"
              :total="pendingAccountTrades.length"
              size="small" background
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏数据导入 -->
    <div class="recent-section">
      <div class="section-header">
        <span class="section-title">🎮 拉取交易记录</span>
        <button class="btn-link" @click="readTokenFromGame">{{ gameToken ? '✓ 已有Token' : '获取 Token' }} ></button>
      </div>
      <div class="import-row">
        <div class="import-date-item">
          <label>开始日期</label>
          <input v-model="importDateFrom" type="date" class="date-input" />
        </div>
        <div class="import-date-item">
          <label>截止日期</label>
          <input v-model="importDateTo" type="date" class="date-input" />
        </div>
        <button class="btn-import" :disabled="importing || !gameToken" @click="importFromGame">
          {{ importing ? importProgress : '🚀 一键导入' }}
        </button>
      </div>
      <div v-if="importing" class="import-loading">
        <span class="loading-dot"></span>
        <span>正在读取记录，请稍候… {{ importProgress }}</span>
      </div>
      <div v-if="!gameToken" class="token-tip">请先点击「获取 Token」登录游戏账号</div>
      <div v-if="importLog.length" class="import-log">
        <div v-for="(line, i) in importLog" :key="i" :class="['log-line', line.type]">{{ line.msg }}</div>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <div v-if="showLoginDialog" class="modal-overlay" @click.self="showLoginDialog = false">
      <div class="modal-box">
        <h4>登录游戏账号获取 Token</h4>
        <p class="modal-sub">{{ authStore.currentAccount?.accountName }}（{{ authStore.currentAccount?.gameEmail }}）</p>
        <input v-model="loginEmail" type="email" placeholder="游戏邮箱" class="modal-input" />
        <input v-model="loginPassword" type="password" placeholder="密码" class="modal-input" @keyup.enter="loginAndGetToken" />
        <div v-if="loginError" class="login-error">{{ loginError }}</div>
        <div class="modal-actions">
          <button @click="showLoginDialog = false" class="btn-cancel">取消</button>
          <button @click="loginAndGetToken" :disabled="loginLoading" class="btn-confirm">
            {{ loginLoading ? '登录中...' : '登录并获取 Token' }}
          </button>
        </div>
        <hr style="margin: 12px 0; border-color: #333" />
        <p class="modal-tip">如自动登录失败，在游戏网站 F12 → Console 运行：<br><code>copy(localStorage.getItem('token'))</code></p>
        <input v-model="manualToken" type="text" placeholder="粘贴 Token" class="modal-input" />
        <button v-if="manualToken" @click="saveManualToken" class="btn-confirm" style="width:100%;margin-top:0">保存 Token</button>
      </div>
    </div>

    <!-- 最近交易 -->
    <div class="recent-section">
      <div class="section-header" @click="showRecentTrades = !showRecentTrades" style="cursor:pointer">
        <span class="section-title">最近交易 <span class="collapse-arrow">{{ showRecentTrades ? '▾' : '▸' }}</span></span>
        <div class="section-header-right" @click.stop>
          <div class="trade-tabs">
            <button :class="['tab-btn', { active: accountTradeTab === 'sell' }]" @click="accountTradeTab = 'sell'; recentPage = 1">卖出 <span class="tab-count">{{ confirmedSellTrades.length }}</span></button>
            <button :class="['tab-btn', { active: accountTradeTab === 'buy' }]" @click="accountTradeTab = 'buy'; recentPage = 1">买入 <span class="tab-count">{{ confirmedBuyTrades.length }}</span></button>
          </div>
          <div class="sort-btns">
            <button :class="['sort-btn', { active: accountSortBy === 'time' }]" @click="accountSortBy = 'time'">时间</button>
            <button :class="['sort-btn', { active: accountSortBy === 'amount' }]" @click="accountSortBy = 'amount'">金额</button>
          </div>
        </div>
      </div>
      <div v-show="showRecentTrades">
        <div v-if="recentTrades.length === 0" class="empty-tip">暂无{{ accountTradeTab === 'buy' ? '买入' : '卖出' }}记录</div>
        <div v-else>
          <div class="table-wrap">
            <el-table :data="recentTrades" stripe size="small">
              <el-table-column prop="itemName" label="物品" min-width="100" show-overflow-tooltip />
              <el-table-column label="金额" width="110" align="right">
                <template #default="{ row }">¥{{ formatAmountRaw(row.price * row.quantity) }}</template>
              </el-table-column>
              <el-table-column prop="tradeDate" label="日期" width="110" align="center" />
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="router.push(`/edit/${row.id}`)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="recent-pagination">
            <el-pagination v-model:current-page="recentPage" :page-size="recentPageSize" layout="prev, pager, next" :total="sortedAccountTrades.length" size="small" background />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { useTaskStore } from '@/stores/task'
import { db } from '@/services/db'
import { SyncService } from '@/services/sync'
import { formatNumber } from '@/constants/pet'
import type { PetTrade } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()
const taskStore = useTaskStore()

// 游戏数据导入
const TOKEN_KEY = 'game-tokens'
const getLocalDate = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = getLocalDate()
const yesterday = getLocalDate(new Date(Date.now() - 86400000))
const importDateFrom = ref(yesterday)
const importDateTo = ref(today)
const importing = ref(false)
const importProgress = ref('')
const importLog = ref<{ msg: string; type: string }[]>([])

const API_HOST = 'http://140.210.17.123:8211'
const FRONT_HOST = 'http://61.160.213.26:12347'

const gameToken = ref('')

const loadSavedToken = () => {
  const accountId = authStore.currentAccount?.id
  if (!accountId) { gameToken.value = ''; return }
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
    gameToken.value = saved[accountId] || ''
  } catch { gameToken.value = '' }
}

const saveToken = (token: string) => {
  const accountId = authStore.currentAccount?.id
  if (!accountId) return
  try {
    const cleanToken = token.replace(/^"|"$/g, '').trim()
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
    saved[accountId] = cleanToken
    localStorage.setItem(TOKEN_KEY, JSON.stringify(saved))
    gameToken.value = cleanToken
  } catch {}
}

const addLog = (msg: string, type = 'info') => {
  importLog.value.push({ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type })
}

const formatAmountRaw = (num: number) => {
  if (num === undefined || num === null) return '--'
  return Number(num).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'game_token' && event.data?.token) {
    saveToken(event.data.token)
    addLog('✓ Token 自动获取成功！', 'ok')
  }
})

const showLoginDialog = ref(false)
const loginEmail = ref(authStore.currentAccount?.gameEmail || '')
const loginPassword = ref('')
const loginLoading = ref(false)
const loginError = ref('')
const manualToken = ref('')

const saveManualToken = () => {
  if (!manualToken.value.trim()) return
  saveToken(manualToken.value.trim())
  manualToken.value = ''
  showLoginDialog.value = false
  addLog('✓ Token 已手动保存', 'ok')
}

const loginAndGetToken = async () => {
  if (!loginEmail.value || !loginPassword.value) {
    loginError.value = '请填写邮箱和密码'
    return
  }
  loginLoading.value = true
  loginError.value = ''

  // 尝试直接用邮箱密码登录（无加密参数版本）
  try {
    const res = await fetch(`${FRONT_HOST}/seer/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': FRONT_HOST },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }),
    })
    const json = await res.json()
    const token = json?.token || json?.data?.token || json?.data
    if (token && typeof token === 'string' && token.length > 10) {
      saveToken(token)
      showLoginDialog.value = false
      loginPassword.value = ''
      addLog(`✓ 登录成功，Token 已保存`, 'ok')
      loginLoading.value = false
      return
    }
  } catch {}

  // 尝试后端 API
  try {
    const res = await fetch(`${API_HOST}/seer/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': FRONT_HOST },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }),
    })
    const json = await res.json()
    const token = json?.token || json?.data?.token || json?.data
    if (token && typeof token === 'string' && token.length > 10) {
      saveToken(token)
      showLoginDialog.value = false
      loginPassword.value = ''
      addLog(`✓ 登录成功，Token 已保存`, 'ok')
      loginLoading.value = false
      return
    }
    loginError.value = json?.msg || json?.message || '登录失败，服务器需要加密参数'
  } catch (e: any) {
    loginError.value = e.message
  }

  loginLoading.value = false
}

const readTokenFromGame = () => {
  loginEmail.value = authStore.currentAccount?.gameEmail || ''
  loginPassword.value = ''
  loginError.value = ''
  showLoginDialog.value = true
}

const importFromGame = async () => {
  if (importing.value) return
  const token = gameToken.value?.replace(/^"|"$/g, '').trim()
  if (!token) { addLog('请先获取 Token', 'warn'); return }
  const userId = authStore.currentUser?.id
  const account = authStore.currentAccount
  if (!userId || !account) { addLog('未选择账号', 'err'); return }

  importing.value = true
  importLog.value = []

  try {
    const result = await SyncService.importGameData({
      token,
      userId,
      account,
      dateFrom: importDateFrom.value,
      dateTo: importDateTo.value,
      onProgress: (msg) => { importProgress.value = msg },
    })

    addLog(`获取 ${result.recordCount} 条已完成记录`, 'ok')
    addLog(`新增 ${result.added} 条，跳过重复 ${result.skipped} 条`, 'ok')
    addLog(`上架中待售：${result.pendingCount} 条`, 'info')
    if (result.tradeBalance !== undefined) {
      addLog(`余额：${formatNumber(result.tradeBalance)}`, 'ok')
    }

    const allAccounts = await db.gameAccounts.toArray()
    const userAccounts = allAccounts.filter(a => a.userId === userId)
    authStore.userAccounts.splice(0, authStore.userAccounts.length, ...userAccounts)
    const fresh = userAccounts.find(a => a.id === account.id)
    if (fresh && authStore.currentAccount) Object.assign(authStore.currentAccount, fresh)
  } catch (e: any) {
    addLog(`导入失败：${e.message}`, 'err')
  }

  importing.value = false
  importProgress.value = ''
  await loadAllAccountTrades()
  await ledgerStore.loadTrades()
}

const avatarLetter = computed(() =>
  (authStore.currentAccount?.accountName || authStore.currentUser?.username || '?')[0].toUpperCase()
)

const switchAccount = (e: Event) => {
  const id = (e.target as HTMLSelectElement).value
  authStore.switchAccount(id)
  ledgerStore.loadTrades()
  taskStore.loadTodayRecords()
  recentPage.value = 1
  loadAllAccountTrades()
  loadSavedToken()
}

const todayRef = ref(getLocalDate())
const yesterdayRef = ref(getLocalDate(new Date(Date.now() - 86400000)))

// 每天零点自动刷新日期
const scheduleDayRefresh = () => {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  setTimeout(() => {
    todayRef.value = getLocalDate()
    yesterdayRef.value = getLocalDate(new Date(Date.now() - 86400000))
    taskStore.loadTodayRecords()
    scheduleDayRefresh()
  }, next.getTime() - now.getTime())
}
scheduleDayRefresh()

const todayTrades = computed(() =>
  allAccountTrades.value.filter(t => t.tradeDate === todayRef.value)
)

const yesterdayTrades = computed(() =>
  allAccountTrades.value.filter(t => t.tradeDate === yesterdayRef.value && t.status !== 'pending')
)

const todayBuyCount = computed(() =>
  todayTrades.value.filter(t => t.type === 'buy').length
)

const todaySellCount = computed(() =>
  todayTrades.value.filter(t => t.type === 'sell' && t.status === 'confirmed').length
)

const todayProfit = computed(() => {
  return todayTrades.value.reduce((acc, t) => {
    if (t.type === 'sell' && t.status === 'confirmed') return acc + t.price * t.quantity
    if (t.type === 'buy') return acc - t.price * t.quantity
    return acc
  }, 0)
})

const yesterdayProfit = computed(() => {
  return yesterdayTrades.value.reduce((acc, t) => {
    if (t.type === 'sell' && t.status === 'confirmed') return acc + t.price * t.quantity
    return acc
  }, 0)
})

const taskProgress = computed(() => taskStore.todayProgress)

const allAccountTrades = ref<PetTrade[]>([])
const recentPage = ref(1)
const recentPageSize = 5
const pendingPage = ref(1)
const pendingPageSize = 5

const loadAllAccountTrades = async () => {
  if (!authStore.currentAccount?.id || !authStore.currentUser?.id) return
  const accountId = authStore.currentAccount.id
  const userId = authStore.currentUser.id
  allAccountTrades.value = await db.petTrades
    .where('accountId').equals(accountId)
    .filter(t => t.userId === userId)
    .sortBy('tradeDate')
    .then(arr => arr.reverse())
}

const pendingAccountTrades = computed(() =>
  allAccountTrades.value.filter(t => t.type === 'sell' && t.status === 'pending')
)

const pagedPendingTrades = computed(() => {
  const start = (pendingPage.value - 1) * pendingPageSize
  return pendingAccountTrades.value.slice(start, start + pendingPageSize)
})

const confirmedTrades = computed(() =>
  allAccountTrades.value.filter(t => t.status === 'confirmed')
)

// Tab 与排序
const accountTradeTab = ref<'buy' | 'sell'>('sell')
const accountSortBy = ref<'time' | 'amount'>('time')
const showPending = ref(true)
const showRecentTrades = ref(true)

const confirmedBuyTrades = computed(() => confirmedTrades.value.filter(t => t.type === 'buy'))
const confirmedSellTrades = computed(() => confirmedTrades.value.filter(t => t.type === 'sell'))

const sortedAccountTrades = computed(() => {
  const list = accountTradeTab.value === 'buy' ? [...confirmedBuyTrades.value] : [...confirmedSellTrades.value]
  if (accountSortBy.value === 'amount') return list.sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity))
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const recentTrades = computed(() => {
  const start = (recentPage.value - 1) * recentPageSize
  return sortedAccountTrades.value.slice(start, start + recentPageSize)
})

const confirmTrade = async (id: string) => {
  await ledgerStore.updateTrade(id, { status: 'confirmed' })
  await loadAllAccountTrades()
}

onMounted(async () => {
  await ledgerStore.loadTrades()
  await taskStore.loadTemplates()
  await taskStore.loadTodayRecords()
  await loadAllAccountTrades()
  loadSavedToken()
})
</script>

<style scoped>
.account-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.account-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
}
.account-avatar {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; flex-shrink: 0;
}
.account-info { flex: 1; }
.account-name { font-size: 16px; font-weight: 700; }
.account-email { font-size: 12px; opacity: 0.8; margin-top: 2px; }
.account-select {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.account-select option { background: #764ba2; color: white; }
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.stat-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px 8px;
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
}
.stat-value {
  font-size: 20px; font-weight: 700;
  color: var(--n-text-color-1);
}
.stat-value.profit { color: #52c41a; }
.stat-value.negative { color: #ff4d4f; }
.stat-label { font-size: 11px; color: var(--n-text-color-2); }
.section-title {
  font-size: 12px; font-weight: 700;
  color: var(--n-text-color-2);
  margin-bottom: 10px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.quick-actions, .recent-section {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 14px;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.action-card {
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding: 14px 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.action-card:hover {
  border-color: #667eea;
  background: rgba(102,126,234,0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102,126,234,0.15);
}
.action-icon { font-size: 24px; }
.action-label { font-size: 13px; font-weight: 600; color: var(--n-text-color-1); }
.action-desc { font-size: 11px; color: var(--n-text-color-2); }
.empty-tip { font-size: 13px; color: var(--n-text-color-2); text-align: center; padding: 12px; }
.trade-balance { color: #00b894; }
.collapse-arrow { font-size: 11px; color: var(--n-text-color-2); margin-left: 4px; }
.trade-tabs { display: flex; gap: 2px; background: var(--n-border-color); border-radius: 6px; padding: 2px; }
.tab-btn { padding: 4px 12px; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; background: transparent; color: var(--n-text-color-2); font-weight: 500; }
.tab-btn.active { background: var(--n-color); color: var(--n-text-color-1); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.tab-count { font-size: 11px; opacity: 0.7; margin-left: 2px; }
.sort-btns { display: flex; gap: 2px; }
.sort-btn { padding: 3px 8px; border: 1px solid var(--n-border-color); border-radius: 4px; font-size: 11px; cursor: pointer; background: transparent; color: var(--n-text-color-2); }
.sort-btn.active { border-color: #667eea; color: #667eea; background: rgba(102,126,234,0.08); }
.recent-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.import-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.import-date-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.import-date-item label {
  font-size: 11px;
  color: var(--n-text-color-2);
}
.date-input {
  padding: 6px 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--n-color);
  color: var(--n-text-color-1);
}
.btn-import {
  padding: 7px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-import:hover { background: #5568d3; }
.btn-import:disabled { opacity: 0.5; cursor: not-allowed; }
.token-tip {
  font-size: 12px;
  color: #fa8c16;
  margin-top: 4px;
}
.import-loading {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(24, 144, 255, 0.08);
  color: #1677ff;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1677ff;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.4); opacity: 1; }
}
.import-log {
  background: #0f0f1a;
  border-radius: 6px;
  padding: 10px;
  max-height: 160px;
  overflow-y: auto;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.8;
  margin-top: 8px;
}
.login-error { font-size: 12px; color: #e74c3c; margin: -8px 0 4px; }
.modal-sub { font-size: 12px; color: var(--n-text-color-2); margin: -8px 0 12px; }
.modal-tip { font-size: 11px; color: var(--n-text-color-2); margin: 0 0 8px; line-height: 1.6; }
.modal-tip code { background: #222; padding: 2px 4px; border-radius: 3px; font-size: 11px; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: var(--n-color); border-radius: 10px;
  padding: 20px; width: 90%; max-width: 360px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; gap: 10px;
}
.modal-box h4 { margin: 0; font-size: 15px; }
.modal-input {
  width: 100%; padding: 8px 10px; border: 1px solid var(--n-border-color);
  border-radius: 4px; font-size: 13px; background: var(--n-color);
  color: var(--n-text-color-1); box-sizing: border-box;
}
.modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.btn-cancel {
  padding: 8px; border: 1px solid var(--n-border-color);
  background: var(--n-color); color: var(--n-text-color-1);
  border-radius: 4px; font-size: 13px; cursor: pointer;
}
.btn-confirm {
  padding: 8px; background: #667eea; color: white;
  border: none; border-radius: 4px; font-size: 13px;
  font-weight: 600; cursor: pointer;
}
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-confirm:hover:not(:disabled) { background: #5568d3; }
.btn-link {
  background: none;
  border: none;
  color: #667eea;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.btn-link:hover { color: #5568d3; }
.section-count {
  font-size: 12px;
  color: var(--n-text-color-2);
  font-weight: 600;
}
.pending-count {
  font-size: 12px;
  color: #fa8c16;
  font-weight: 600;
}
.table-wrap { width: 100%; overflow-x: auto; }
.clickable { cursor: pointer; transition: background 0.15s; }
.clickable:hover { background: rgba(102,126,234,0.08) !important; border-radius: 6px; }
.trade-type.pending { background: rgba(250,140,22,0.12); color: #fa8c16; }
.trade-goto { font-size: 11px; color: #667eea; margin-left: auto; flex-shrink: 0; }
.recent-list { display: flex; flex-direction: column; gap: 6px; }
.recent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: 6px;
  background: var(--n-color-hover); font-size: 13px;
}
.trade-type {
  font-size: 11px; font-weight: 700;
  padding: 2px 6px; border-radius: 4px;
  flex-shrink: 0;
}
.trade-type.buy { background: rgba(24,144,255,0.1); color: #1890ff; }
.trade-type.sell { background: rgba(82,196,26,0.1); color: #52c41a; }
.trade-name { flex: 1; color: var(--n-text-color-1); font-weight: 500; }
.trade-price { color: var(--n-text-color-2); }
.trade-date { font-size: 11px; color: var(--n-text-color-2); }
@media (max-width: 480px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .action-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
