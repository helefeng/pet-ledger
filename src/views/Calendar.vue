<template>
  <div class="calendar-container">
    <div class="page-header">
      <h2>日历页</h2>
      <div class="header-filters">
        <input v-model="selectedDate" type="date" class="date-input" @change="loadDayData" />
        <select v-model="selectedAccountId" class="account-select" @change="loadDayData">
          <option v-for="acc in authStore.userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.accountName }} ({{ acc.gameEmail }})
          </option>
        </select>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">总买入</div>
        <div class="stat-value">¥{{ formatNumber(dayStats.totalBuy) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总卖出</div>
        <div class="stat-value sell">¥{{ formatNumber(dayStats.totalSell) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总收益</div>
        <div class="stat-value" :class="dayStats.totalProfit >= 0 ? 'profit' : 'loss'">
          {{ dayStats.totalProfit >= 0 ? '+' : '' }}¥{{ formatNumber(dayStats.totalProfit) }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">交易条数</div>
        <div class="stat-value">{{ dayTrades.length }}</div>
      </div>
    </div>

    <div class="section-block summary-block">
      <div class="section-title">日结汇总</div>
      <pre class="summary-content">{{ daySummaryText }}</pre>
    </div>

    <div class="section-block">
      <div class="section-title">当日交易</div>
      <div v-if="dayTrades.length === 0" class="empty-tip">当天暂无交易</div>
      <div v-else class="table-wrap">
        <el-table :data="dayTrades" stripe size="small">
          <el-table-column label="类型" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'success' : 'warning'" size="small">
                {{ row.type === 'buy' ? '买入' : '卖出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="itemName" label="物品" min-width="120" />
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">¥{{ formatNumber((row.price || 0) * (row.quantity || 0)) }}</template>
          </el-table-column>
          <el-table-column prop="tradeDate" label="日期" width="120" align="center" />
        </el-table>
      </div>
    </div>

    <div class="section-block">
      <div class="section-title">当日日记</div>
      <div v-if="dayDiaries.length === 0" class="empty-tip">当天暂无日记</div>
      <div v-else class="table-wrap">
        <el-table :data="dayDiaries" stripe size="small">
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.diaryType === 'shiny' ? 'warning' : 'info'" size="small">
                {{ row.diaryType === 'shiny' ? '异色' : '日常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="planet" label="星球" min-width="140" show-overflow-tooltip />
          <el-table-column label="事件时间" width="150" align="center">
            <template #default="{ row }">{{ formatDateTime(row.eventTime || row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="section-block post-block">
      <div class="post-header">
        <span class="section-title">趣味帖子</span>
        <button class="btn-gen" @click="generatePost">✨ 生成帖子</button>
      </div>
      <div v-if="!postText" class="empty-tip">点击「生成帖子」，基于当日数据生成一段趣味内容</div>
      <div v-else class="post-content-wrap">
        <pre class="post-content">{{ postText }}</pre>
        <button class="btn-copy" @click="copyPost">{{ copied ? '✅ 已复制' : '📋 复制' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/services/db'
import { formatNumber } from '@/constants/pet'
import type { PetTrade, PlanetDiary } from '@/types'

const authStore = useAuthStore()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const selectedAccountId = ref('')

const dayTrades = ref<PetTrade[]>([])
const dayDiaries = ref<PlanetDiary[]>([])

const formatDateTime = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mi = `${d.getMinutes()}`.padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

const loadDayData = async () => {
  if (!authStore.currentUser?.id || !selectedAccountId.value) {
    dayTrades.value = []
    dayDiaries.value = []
    return
  }

  const userId = authStore.currentUser.id
  const accountId = selectedAccountId.value

  const [allTrades, allDiaries] = await Promise.all([
    db.petTrades.toArray(),
    db.planetDiaries.toArray(),
  ])

  dayTrades.value = allTrades
    .filter(t => t.userId === userId && t.accountId === accountId && t.tradeDate === selectedDate.value)
    .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())

  dayDiaries.value = allDiaries
    .filter(d => {
      if (d.userId !== userId || d.accountId !== accountId) return false
      const day = (d.eventTime || d.createdAt).split('T')[0]
      return day === selectedDate.value
    })
    .sort((a, b) => new Date(b.eventTime || b.createdAt).getTime() - new Date(a.eventTime || a.createdAt).getTime())
}

const dayStats = computed(() => {
  const totalBuy = dayTrades.value
    .filter(t => t.type === 'buy')
    .reduce((sum, t) => sum + t.price * t.quantity, 0)

  const totalSell = dayTrades.value
    .filter(t => t.type === 'sell' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.price * t.quantity * 0.95, 0)

  return {
    totalBuy,
    totalSell,
    totalProfit: totalSell - totalBuy,
  }
})

const daySummaryText = computed(() => {
  const acc = authStore.userAccounts.find(a => a.id === selectedAccountId.value)
  const accountName = acc?.accountName || ''
  const accountEmail = acc?.gameEmail || ''
  const date = selectedDate.value
  const { totalBuy, totalSell, totalProfit } = dayStats.value

  const tradeLines = dayTrades.value.length
    ? dayTrades.value
        .slice()
        .map(t => `  - [${t.type === 'buy' ? '买入' : (t.status === 'confirmed' ? '卖出已确认' : '卖出待确认')}] ${t.itemName} × ${t.quantity} @ ¥${formatNumber(t.price * t.quantity)}`)
        .join('\n')
    : '  - 无交易记录'

  const diaryLines = dayDiaries.value.length
    ? dayDiaries.value
        .slice()
        .map(d => `  - [${d.diaryType === 'shiny' ? '异色' : '日常'}] ${d.title}（${d.planet}）`)
        .join('\n')
    : '  - 无日记记录'

  return [
    `账号：${accountName}（${accountEmail}）`,
    `日期：${date}`,
    '',
    `总买入：¥${formatNumber(totalBuy)}`,
    `总卖出：¥${formatNumber(totalSell)}`,
    `总收益：${totalProfit >= 0 ? '+' : ''}¥${formatNumber(Math.abs(totalProfit))}`,
    '',
    '【当日交易】',
    tradeLines,
    '',
    '【当日日记】',
    diaryLines,
  ].join('\n')
})

const postText = ref('')
const copied = ref(false)

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const generatePost = () => {
  const acc = authStore.userAccounts.find(a => a.id === selectedAccountId.value)
  const email = acc?.gameEmail || '未知账号'
  const { totalBuy, totalSell, totalProfit } = dayStats.value
  const tradeCount = dayTrades.value.length
  const shinyCount = dayDiaries.value.filter(d => d.diaryType === 'shiny').length
  const diaryCount = dayDiaries.value.length
  const date = selectedDate.value

  const profitStr = `${totalProfit >= 0 ? '+' : ''}¥${formatNumber(Math.abs(totalProfit))}（${totalProfit >= 0 ? '盈' : '亏'}）`

  const openings = [
    `【${date} 日报 · ${email}】`,
    `🗓️ ${date} 的星际交易日报来啦～`,
    `📦 ${date} 账号 ${email} 收盘复盘：`,
  ]

  const profitLines = totalProfit > 0
    ? pick([
        `今日收益 ${profitStr}，小赚一笔，继续冲！💰`,
        `盈利 ${profitStr}，交易行今天没白跑～ 🎉`,
        `今天进账 ${profitStr}，感谢星球馈赠！✨`,
      ])
    : totalProfit < 0
    ? pick([
        `今日亏损 ${profitStr}，市场有风险，明天再战！💪`,
        `${profitStr}，今天割肉了，但韭菜会重生的 🌱`,
        `今日浮亏 ${profitStr}，放平心态，长线看好！📉`,
      ])
    : pick([
        `今日收益持平，零利润的一天，修身养性中～ 🧘`,
        `不亏不赚，刚好保本，也挺好的 😌`,
      ])

  const tradeLine = tradeCount > 0
    ? `今日共完成 ${tradeCount} 笔交易，买入 ¥${formatNumber(totalBuy)}，卖出 ¥${formatNumber(totalSell)}。`
    : `今天没有交易记录，歇一天也挺好的。`

  const diaryLine = shinyCount > 0
    ? pick([
        `🌈 今日竟然遇到 ${shinyCount} 条异色事件！运气爆棚！`,
        `✨ ${shinyCount} 条异色入账，今天是幸运日！`,
      ])
    : diaryCount > 0
    ? pick([
        `📔 今天记录了 ${diaryCount} 篇日记，充实的一天。`,
        `记了 ${diaryCount} 篇日记，日积月累，宝贵的回忆～`,
      ])
    : `今天没有日记，安静的一天。`

  const closings = [
    `明天继续加油！🚀`,
    `愿明天的交易行更繁荣～ 🌟`,
    `休息好，明天再战！💤`,
    `感谢陪伴，明天见！👋`,
  ]

  postText.value = [
    pick(openings),
    '',
    profitLines,
    tradeLine,
    diaryLine,
    '',
    pick(closings),
  ].join('\n')

  copied.value = false
}

const copyPost = async () => {
  if (!postText.value) return
  try {
    await navigator.clipboard.writeText(postText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback
    const el = document.createElement('textarea')
    el.value = postText.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

onMounted(async () => {
  await authStore.loadUserAccounts()
  selectedAccountId.value = authStore.currentAccount?.id || authStore.userAccounts[0]?.id || ''
  await loadDayData()
})
</script>

<style scoped>
.calendar-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
}

.header-filters {
  display: flex;
  gap: 8px;
}

.date-input,
.account-select {
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  background: var(--n-color);
  color: var(--n-text-color-1);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px 10px;
}

.stat-label {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.stat-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
}

.stat-value.sell { color: #52c41a; }
.stat-value.profit { color: #52c41a; }
.stat-value.loss { color: #ff4d4f; }

.section-block {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}

.empty-tip {
  font-size: 13px;
  color: var(--n-text-color-2);
  text-align: center;
  padding: 12px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.summary-block {
  background: var(--n-color);
}

.summary-content {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.8;
  color: var(--n-text-color-1);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  padding: 4px 0;
}

.post-block {
  background: var(--n-color);
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.btn-gen {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: white;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-gen:hover { opacity: 0.85; }

.post-content-wrap {
  position: relative;
}

.post-content {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.9;
  color: var(--n-text-color-1);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  padding: 12px;
  background: var(--n-color-hover);
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
}

.btn-copy {
  margin-top: 8px;
  background: none;
  border: 1px solid var(--n-border-color);
  color: var(--n-text-color-2);
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy:hover {
  border-color: #667eea;
  color: #667eea;
}
</style>
