 <template>
  <div class="home-container">
    <!-- 欢迎头部 -->
    <div class="welcome-section">
      <div>
        <span class="greeting">{{ greeting }}，</span>
        <span class="username">{{ authStore.currentUser?.username }}</span>
      </div>
      <div class="welcome-date">{{ todayStr }}</div>
    </div>

    <!-- 用户总收益概览 -->
    <div class="stats-overview">
      <div class="stat-card">
        <span class="stat-value">¥{{ formatNumber(userTotalStats.totalBuy) }}</span>
        <span class="stat-label">总买入</span>
      </div>
      <div class="stat-card">
        <span class="stat-value sell">¥{{ formatNumber(userTotalStats.totalSell) }}</span>
        <span class="stat-label">总卖出</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" :class="userTotalStats.totalProfit >= 0 ? 'profit' : 'loss'">
          {{ userTotalStats.totalProfit >= 0 ? '+' : '' }}¥{{ formatNumber(userTotalStats.totalProfit) }}
        </span>
        <span class="stat-label">总利润</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ userTotalStats.tradeCount }}</span>
        <span class="stat-label">总交易数</span>
      </div>
    </div>

    <!-- 账号列表 -->
    <div class="section-block">
      <div class="section-header" @click="showAccounts = !showAccounts" style="cursor:pointer">
        <h3>账号列表 <span class="collapse-arrow">{{ showAccounts ? '▾' : '▸' }}</span></h3>
        <button @click.stop="router.push('/settings')" class="btn-link">管理 ></button>
      </div>
      <div v-show="showAccounts">
        <div v-if="authStore.userAccounts.length === 0" class="empty-state">暂无账号</div>
        <div v-else class="account-grid">
          <div
            v-for="account in authStore.userAccounts"
            :key="account.id"
            class="account-card"
            :class="{ active: authStore.currentAccount?.id === account.id }"
            @click="switchAccount(account.id)"
          >
            <div class="ac-name">{{ account.accountName }}</div>
            <div class="ac-email">{{ account.gameEmail }}</div>
            <div v-if="account.tradeBalance !== undefined" class="ac-balance">余额：{{ formatNumber(account.tradeBalance) }}</div>
            <div class="ac-stats">
              <span>买: ¥{{ formatNumber(getAccountStats(account.id).buy) }}</span>
              <span>卖: ¥{{ formatNumber(getAccountStats(account.id).sell) }}</span>
              <span :class="getAccountStats(account.id).profit >= 0 ? 'profit' : 'loss'">
                利: ¥{{ formatNumber(getAccountStats(account.id).profit) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 待确认卖出 -->
    <div class="section-block">
      <div class="section-header" @click="showPending = !showPending" style="cursor:pointer">
        <h3>待确认卖出 <span class="collapse-arrow">{{ showPending ? '▾' : '▸' }}</span></h3>
        <div class="section-header-right">
          <span class="pending-count">共 {{ pendingTrades.length }} 条</span>
        </div>
      </div>
      <div v-show="showPending">
        <div v-if="pendingTrades.length === 0" class="empty-state">暂无待确认卖出</div>
        <div v-else class="table-wrap">
          <el-table :data="pagedPendingTrades" stripe size="small" class="home-table" style="min-width: 760px">
            <el-table-column prop="itemName" label="物品" min-width="120" />
            <el-table-column label="账号邮箱" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="cell-nowrap">{{ getAccountEmailById(row.accountId) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="110" align="right">
              <template #default="{ row }">¥{{ formatAmountRaw((row.price || 0) * (row.quantity || 0)) }}</template>
            </el-table-column>
            <el-table-column prop="tradeDate" label="交易日期" width="120" align="center" />
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button link type="success" size="small" @click="confirmPendingTrade(row.id)">确认</el-button>
                <el-button link type="primary" size="small" @click="editTrade(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              v-model:current-page="currentPendingPage"
              :page-size="pendingPageSize"
              layout="prev, pager, next"
              :total="pendingTrades.length"
              size="small"
              background
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 最近交易 -->
    <div class="section-block">
      <div class="section-header" @click="showRecentTrades = !showRecentTrades" style="cursor:pointer">
        <h3>最近交易 <span class="collapse-arrow">{{ showRecentTrades ? '▾' : '▸' }}</span></h3>
        <div class="section-header-right" @click.stop>
          <div class="trade-tabs">
            <button :class="['tab-btn', { active: tradeTab === 'sell' }]" @click="tradeTab = 'sell'; currentRecentTradePage = 1">
              卖出 <span class="tab-count">{{ allSellTrades.length }}</span>
            </button>
            <button :class="['tab-btn', { active: tradeTab === 'buy' }]" @click="tradeTab = 'buy'; currentRecentTradePage = 1">
              买入 <span class="tab-count">{{ allBuyTrades.length }}</span>
            </button>
          </div>
          <div class="sort-btns">
            <button :class="['sort-btn', { active: tradeSortBy === 'time' }]" @click="tradeSortBy = 'time'">时间</button>
            <button :class="['sort-btn', { active: tradeSortBy === 'amount' }]" @click="tradeSortBy = 'amount'">金额</button>
          </div>
        </div>
      </div>
      <div v-show="showRecentTrades">
        <div v-if="allRecentTrades.length === 0" class="empty-state">暂无{{ tradeTab === 'buy' ? '买入' : '卖出' }}记录</div>
        <div v-else class="table-wrap">
          <el-table :data="pagedRecentTrades" stripe size="small" class="home-table" style="min-width: 860px">
            <el-table-column prop="itemName" label="物品" min-width="120" />
            <el-table-column label="账号邮箱" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="cell-nowrap">{{ getAccountEmailById(row.accountId) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="110" align="right">
              <template #default="{ row }">¥{{ formatAmountRaw((row.price || 0) * (row.quantity || 0)) }}</template>
            </el-table-column>
            <el-table-column prop="tradeDate" label="交易日期" width="120" align="center" />
            <el-table-column label="操作" width="90" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="editTrade(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              v-model:current-page="currentRecentTradePage"
              :page-size="recentTradePageSize"
              layout="prev, pager, next"
              :total="allRecentTrades.length"
              size="small"
              background
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 铁皮日记 -->
    <div class="section-block">
      <div class="section-header" @click="showDiaries = !showDiaries" style="cursor:pointer">
        <h3>铁皮日记 <span class="collapse-arrow">{{ showDiaries ? '▾' : '▸' }}</span></h3>
        <div class="section-header-right" @click.stop>
          <span class="section-count">共 {{ recentDiaries.length }} 条</span>
          <button @click="router.push('/account/diary')" class="btn-link">全部 ></button>
        </div>
      </div>
      <div v-show="showDiaries">
        <div v-if="recentDiaries.length === 0" class="empty-state">暂无日记</div>
        <div v-else class="table-wrap">
          <el-table
            :data="pagedRecentDiaries"
            stripe
            size="small"
            class="home-table"
            style="min-width: 920px"
            @row-click="goToDiary"
          >
            <el-table-column prop="title" label="日记标题" min-width="220" show-overflow-tooltip />
            <el-table-column prop="planet" label="星球号" min-width="120" show-overflow-tooltip />
            <el-table-column label="事件类型" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="row.diaryType === 'shiny' ? 'warning' : 'info'" size="small">
                  {{ row.diaryType === 'shiny' ? '异色' : '日常' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="账号邮箱" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="cell-nowrap">{{ getAccountEmailById(row.accountId) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="140" align="center">
              <template #default="{ row }">{{ formatDateTime(row.eventTime || row.updatedAt || row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click.stop="goToDiary(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              v-model:current-page="currentDiaryPage"
              :page-size="diaryPageSize"
              layout="prev, pager, next"
              :total="recentDiaries.length"
              size="small"
              background
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { db } from '@/services/db'
import { formatNumber } from '@/constants/pet'
import type { PetTrade, PlanetDiary } from '@/types'

const formatAmountRaw = (num: number) =>
  Number(num).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

// 问候语
const hour = new Date().getHours()
const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
const todayStr = new Date().toLocaleDateString('zh-CN', { 
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
})

// 全量历史交易（用于总统计、账号卡片、待确认、最近交易）
const allHistoryTrades = ref<PetTrade[]>([])
const allDiaries = ref<PlanetDiary[]>([])

const currentPendingPage = ref(1)
const pendingPageSize = 5
const currentRecentTradePage = ref(1)
const recentTradePageSize = 5
const currentDiaryPage = ref(1)
const diaryPageSize = 5

// 折叠状态
const showAccounts = ref(true)
const showPending = ref(true)
const showRecentTrades = ref(true)
const showDiaries = ref(true)

let midnightWatcher: ReturnType<typeof setTimeout> | null = null

const loadAllData = async () => {
  if (!authStore.currentUser?.id) return
  const userId = authStore.currentUser.id

  // 先读本地，保证首页秒开
  const [localTrades, localDiaries] = await Promise.all([
    db.petTrades.toArray(),
    db.planetDiaries.toArray(),
  ])

  allHistoryTrades.value = localTrades.filter(t => t.userId === userId)
  allDiaries.value = localDiaries.filter(d => d.userId === userId)

  if (currentDiaryPage.value > Math.max(1, Math.ceil(allDiaries.value.length / diaryPageSize))) {
    currentDiaryPage.value = 1
  }
}

const scheduleMidnightRefresh = () => {
  if (midnightWatcher) clearTimeout(midnightWatcher)

  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  const delay = next.getTime() - now.getTime()

  midnightWatcher = setTimeout(async () => {
    // 同时触发 ledgerStore 里的日数据重置
    await ledgerStore.initialize()
    await loadAllData()
    scheduleMidnightRefresh()
  }, delay)
}

// 用户总统计（所有账号合并，全量历史）
const userTotalStats = computed(() => {
  const stats = allHistoryTrades.value.reduce((acc, t) => {
    if (t.type === 'buy') {
      acc.totalBuy += t.price * t.quantity
    } else if (t.status === 'confirmed') {
      acc.totalSell += t.price * t.quantity * 0.95
    }
    acc.tradeCount++
    return acc
  }, { totalBuy: 0, totalSell: 0, totalProfit: 0, tradeCount: 0 })
  
  stats.totalProfit = stats.totalSell - stats.totalBuy
  return stats
})

// 单个账号统计（全量历史）
const getAccountStats = (accountId: string) => {
  const trades = allHistoryTrades.value.filter(t => t.accountId === accountId)
  const buy = trades.filter(t => t.type === 'buy').reduce((s, t) => s + t.price * t.quantity, 0)
  const sell = trades.filter(t => t.type === 'sell' && t.status === 'confirmed').reduce((s, t) => s + t.price * t.quantity * 0.95, 0)
  return { buy, sell, profit: sell - buy }
}

// 账号名查找
const getAccountEmailById = (accountId: string) => {
  return authStore.userAccounts.find(a => a.id === accountId)?.gameEmail || '未知邮箱'
}

const formatDateTime = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mi = `${d.getMinutes()}`.padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

// 待确认卖出（全账号全量历史）
const pendingTrades = computed(() =>
  allHistoryTrades.value
    .filter(t => t.type === 'sell' && t.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
)

const pagedPendingTrades = computed(() => {
  const start = (currentPendingPage.value - 1) * pendingPageSize
  return pendingTrades.value.slice(start, start + pendingPageSize)
})

const confirmPendingTrade = async (id: string) => {
  await ledgerStore.updateTrade(id, { status: 'confirmed' })
  await loadAllData()
}

const editTrade = (trade: PetTrade) => {
  authStore.switchAccount(trade.accountId)
  router.push(`/edit/${trade.id}`)
}

const goToDiary = (diary: PlanetDiary) => {
  authStore.switchAccount(diary.accountId)
  router.push(`/account/diary?focus=${diary.id}`)
}

// 所有账号最近交易 - 分买入/卖出，支持排序
const tradeTab = ref<'buy' | 'sell'>('sell')
const tradeSortBy = ref<'time' | 'amount'>('time')

const allBuyTrades = computed(() =>
  allHistoryTrades.value.filter(t => t.type === 'buy')
)
const allSellTrades = computed(() =>
  allHistoryTrades.value.filter(t => t.type === 'sell' && t.status === 'confirmed')
)

const sortedTrades = computed(() => {
  const list = tradeTab.value === 'buy' ? [...allBuyTrades.value] : [...allSellTrades.value]
  if (tradeSortBy.value === 'amount') {
    return list.sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity))
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const allRecentTrades = computed(() => sortedTrades.value)

const pagedRecentTrades = computed(() => {
  const start = (currentRecentTradePage.value - 1) * recentTradePageSize
  return allRecentTrades.value.slice(start, start + recentTradePageSize)
})

// 最近日记
const recentDiaries = computed(() =>
  [...allDiaries.value]
    .sort((a, b) => new Date(b.eventTime || b.updatedAt || b.createdAt).getTime() - new Date(a.eventTime || a.updatedAt || a.createdAt).getTime())
)

const pagedRecentDiaries = computed(() => {
  const start = (currentDiaryPage.value - 1) * diaryPageSize
  return recentDiaries.value.slice(start, start + diaryPageSize)
})

// 切换账号
const switchAccount = (accountId: string) => {
  authStore.switchAccount(accountId)
  ledgerStore.loadTrades()
}

onMounted(async () => {
  await authStore.loadUserAccounts()

  // 检查是否跨天，跨天则重置 ledgerStore
  const todayCheck = new Date().toISOString().split('T')[0]
  const lastVisit = localStorage.getItem('pet-ledger:last-visit-day')
  if (lastVisit && lastVisit !== todayCheck) {
    await ledgerStore.initialize()
  }
  localStorage.setItem('pet-ledger:last-visit-day', todayCheck)

  await loadAllData()
  scheduleMidnightRefresh()
})

onUnmounted(() => {
  if (midnightWatcher) {
    clearTimeout(midnightWatcher)
    midnightWatcher = null
  }
})
</script>

<style scoped>
.home-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-section {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.greeting { font-size: 16px; opacity: 0.9; }
.username { font-size: 20px; font-weight: 700; margin-left: 4px; }
.welcome-date { font-size: 12px; opacity: 0.8; margin-top: 4px; }

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--n-text-color-1);
}

.stat-value.sell { color: #52c41a; }
.stat-value.profit { color: #52c41a; }
.stat-value.loss { color: #ff4d4f; }

.stat-label {
  font-size: 11px;
  color: var(--n-text-color-2);
}

.section-block {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 14px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  font-size: 14px;
  margin: 0;
  color: var(--n-text-color-1);
  font-weight: 600;
}

.collapse-arrow {
  font-size: 11px;
  color: var(--n-text-color-2);
  margin-left: 4px;
  transition: transform 0.2s;
}

.trade-tabs {
  display: flex;
  gap: 2px;
  background: var(--n-border-color);
  border-radius: 6px;
  padding: 2px;
}
.tab-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--n-text-color-2);
  transition: all 0.15s;
  font-weight: 500;
}
.tab-btn.active {
  background: var(--n-color);
  color: var(--n-text-color-1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.tab-count {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 2px;
}
.sort-btns {
  display: flex;
  gap: 2px;
}
.sort-btn {
  padding: 3px 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  background: transparent;
  color: var(--n-text-color-2);
  transition: all 0.15s;
}
.sort-btn.active {
  border-color: #667eea;
  color: #667eea;
  background: rgba(102,126,234,0.08);
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

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

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.home-table {
  font-size: 12px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.cell-nowrap {
  white-space: nowrap;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pending-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(250, 140, 22, 0.08);
  border: 1px solid rgba(250, 140, 22, 0.2);
  font-size: 13px;
}

.pending-name { color: var(--n-text-color-1); font-weight: 500; }
.pending-account, .pending-date { color: var(--n-text-color-2); font-size: 12px; }
.pending-amount { color: #fa8c16; font-weight: 700; }
.pending-actions { display: flex; gap: 6px; }

.btn-confirm {
  border: none;
  background: #52c41a;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-confirm:hover { background: #389e0d; }

.btn-edit {
  border: none;
  background: #1890ff;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-edit:hover { background: #0050b3; }

.empty-state {
  font-size: 13px;
  color: var(--n-text-color-2);
  text-align: center;
  padding: 12px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.account-card {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.account-card:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.account-card.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.ac-name { font-size: 13px; font-weight: 600; color: var(--n-text-color-1); }
.ac-email { font-size: 11px; color: var(--n-text-color-2); margin-top: 2px; }
.ac-balance { font-size: 11px; color: #00b894; font-weight: 600; margin-top: 2px; }

.ac-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--n-text-color-2);
}

.ac-stats .profit { color: #52c41a; }
.ac-stats .loss { color: #ff4d4f; }

.trades-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trade-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: var(--n-color-hover);
  font-size: 13px;
}

.trade-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.trade-badge.buy { background: rgba(24, 144, 255, 0.1); color: #1890ff; }
.trade-badge.sell { background: rgba(82, 196, 26, 0.1); color: #52c41a; }

.trade-name { flex: 1; color: var(--n-text-color-1); font-weight: 500; }
.trade-account { font-size: 11px; color: var(--n-text-color-2); }
.trade-amount { font-weight: 600; color: var(--n-text-color-1); }
.trade-date { font-size: 11px; color: var(--n-text-color-2); }
.btn-row-edit {
  border: none;
  background: #1890ff;
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-row-edit:hover { background: #0050b3; }

.diaries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diary-card {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.diary-card:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.diary-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
}

.diary-planet { color: var(--n-text-color-1); font-weight: 600; }

.diary-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.diary-type.daily { background: rgba(102, 126, 234, 0.1); color: #667eea; }
.diary-type.event { background: rgba(255, 165, 0, 0.1); color: #fa8c16; }

.diary-date { color: var(--n-text-color-2); }
.diary-account { color: #667eea; font-weight: 600; }

.diary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color-1);
  margin-bottom: 4px;
}

.diary-preview {
  font-size: 12px;
  color: var(--n-text-color-2);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .stats-overview { grid-template-columns: repeat(2, 1fr); }
  .account-grid { grid-template-columns: 1fr; }
  .pending-row {
    grid-template-columns: 1fr 1fr;
    row-gap: 6px;
  }
}
</style>
