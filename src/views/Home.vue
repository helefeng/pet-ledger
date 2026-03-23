<template>
  <div class="home-container">
    <!-- 账号和统计 -->
    <div class="header-section">
      <div class="account-selector">
        <span class="label">账号:</span>
        <select v-model="selectedAccountId" @change="switchAccount" class="account-select">
          <option v-for="acc in authStore.userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.gameEmail }}
          </option>
        </select>
        <button @click="showNewAccountDialog = true" class="btn-new-account" title="新建账号">
          ➕
        </button>
      </div>

      <div class="stats-compact">
        <div class="stat-item">
          <span class="stat-label">买入</span>
          <span class="stat-value">¥{{ formatNumber(statistics.totalBuy) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">卖出</span>
          <span class="stat-value sell">¥{{ formatNumber(statistics.totalSell * 0.95) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">利润</span>
          <span class="stat-value profit">¥{{ formatNumber(statistics.totalSell * 0.95 - statistics.totalBuy) }}</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="goToAdd" class="btn-primary">➕ 添加交易</button>
      <button @click="syncWithCloud" :disabled="loading" class="btn-secondary">
        {{ loading ? '同步中...' : '☁️ 云同步' }}
      </button>
    </div>

    <!-- 待确认卖出记录 -->
    <div v-if="pendingTrades.length > 0 || filterPendingName || filterPendingStartDate || filterPendingEndDate" class="pending-section">
      <div class="section-header-with-filter">
        <h3>待确认卖出 ({{ pendingTrades.length }})</h3>
        <div class="filter-bar">
          <input
            v-model="filterPendingName"
            type="text"
            placeholder="🔍 搜索物品名称"
            class="filter-input filter-name"
          />
          <div class="filter-date-range">
            <input
              v-model="filterPendingStartDate"
              type="date"
              class="filter-input filter-date"
              title="开始日期"
            />
            <span class="filter-separator">~</span>
            <input
              v-model="filterPendingEndDate"
              type="date"
              class="filter-input filter-date"
              title="截止日期"
            />
          </div>
        </div>
      </div>

      <el-table :data="paginatedPendingTrades" stripe style="width: 100%">
        <el-table-column prop="empty" label="" width="60"></el-table-column>
        <el-table-column prop="itemName" label="名称"></el-table-column>
        <el-table-column prop="price" label="单价" width="100" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" align="center"></el-table-column>
        <el-table-column label="总计" width="120" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.price * row.quantity * 0.95) }}</template>
        </el-table-column>
        <el-table-column prop="tradeDate" label="时间" width="110" align="center"></el-table-column>
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button link type="success" size="small" @click="confirmTrade(row.id)">✓ 确认</el-button>
              <el-button link type="primary" size="small" @click="editTrade(row.id)">✎ 修改</el-button>
              <el-button link type="danger" size="small" @click="deleteTrade(row.id)">✕ 删除</el-button>
            </template>
            <template v-else>
              <el-tag type="success">已确认</el-tag>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="pendingPages > 1"
        v-model:current-page="pendingPage"
        :page-size="pageSize"
        :total="pendingTrades.length"
        layout="prev, pager, next"
        style="margin-top: 12px; text-align: center"
      />
    </div>

    <!-- 已确认交易记录 -->
    <div class="trades-section">
      <div class="section-header-with-filter">
        <h3>交易记录 ({{ confirmedTrades.length }})</h3>
        <div class="filter-bar">
          <input
            v-model="filterConfirmedName"
            type="text"
            placeholder="🔍 搜索物品名称"
            class="filter-input filter-name"
          />
          <div class="filter-date-range">
            <input
              v-model="filterConfirmedStartDate"
              type="date"
              class="filter-input filter-date"
              title="开始日期"
            />
            <span class="filter-separator">~</span>
            <input
              v-model="filterConfirmedEndDate"
              type="date"
              class="filter-input filter-date"
              title="截止日期"
            />
          </div>
        </div>
      </div>

      <div v-if="confirmedTrades.length === 0" class="empty-state">
        暂无交易记录
      </div>

      <template v-else>

        <el-table :data="paginatedConfirmedTrades" stripe style="width: 100%">
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'success' : 'info'">
                {{ row.type === 'buy' ? '买入' : '卖出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="itemName" label="名称"></el-table-column>
          <el-table-column prop="price" label="单价" width="100" align="right">
            <template #default="{ row }">{{ row.type === 'buy' ? '-' : '+' }}¥{{ formatNumber(row.price) }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" align="center"></el-table-column>
          <el-table-column label="总计" width="120" align="right">
            <template #default="{ row }">¥{{ formatNumber(row.price * row.quantity * (row.type === 'sell' ? 0.95 : 1)) }}</template>
          </el-table-column>
          <el-table-column prop="tradeDate" label="时间" width="110" align="center"></el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" size="small" @click="deleteTrade(row.id)">✕ 删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="confirmedPages > 1"
          v-model:current-page="confirmedPage"
          :page-size="pageSize"
          :total="confirmedTrades.length"
          layout="prev, pager, next"
          style="margin-top: 12px; text-align: center"
        />
      </template>
    </div>

    <!-- 新建账号对话框 -->
    <div v-if="showNewAccountDialog" class="modal-overlay" @click="showNewAccountDialog = false">
      <div class="modal-content" @click.stop>
        <h3>新建账号</h3>
        <input
          v-model="newAccountName"
          type="text"
          placeholder="输入账号名称"
          class="modal-input"
        />
        <input
          v-model="newAccountEmail"
          type="email"
          placeholder="输入游戏邮箱"
          class="modal-input"
        />
        <div class="modal-actions">
          <button @click="showNewAccountDialog = false" class="btn-cancel">取消</button>
          <button @click="createNewAccount" class="btn-confirm">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatNumber } from '@/constants/pet'
import { getPetImageUrl } from '@/constants/petDatabase'
import PaginatedTable from '@/components/PaginatedTable.vue'

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const selectedAccountId = ref('')
const loading = ref(false)
const showNewAccountDialog = ref(false)
const newAccountName = ref('')
const newAccountEmail = ref('')

// 分页
const pendingPage = ref(1)
const confirmedPage = ref(1)
const pageSize = 5

// 筛选
const filterPendingName = ref('')
const filterPendingStartDate = ref('')
const filterPendingEndDate = ref('')
const filterConfirmedName = ref('')
const filterConfirmedStartDate = ref('')
const filterConfirmedEndDate = ref('')

const statistics = computed(() => ledgerStore.statistics)
const recentTrades = computed(() => ledgerStore.recentTrades)

// 待确认卖出记录（包括已确认的，但只显示待确认的操作按钮）
const pendingTrades = computed(() => {
  let trades = ledgerStore.trades.filter(t => t.type === 'sell').sort((a, b) => {
    // 待确认的排在前面
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  // 应用筛选 - 物品名称模糊搜索
  if (filterPendingName.value) {
    trades = trades.filter(t => t.itemName.toLowerCase().includes(filterPendingName.value.toLowerCase()))
  }
  
  // 应用筛选 - 日期范围
  if (filterPendingStartDate.value) {
    trades = trades.filter(t => t.tradeDate >= filterPendingStartDate.value)
  }
  if (filterPendingEndDate.value) {
    trades = trades.filter(t => t.tradeDate <= filterPendingEndDate.value)
  }

  return trades
})

// 已确认交易记录
const confirmedTrades = computed(() => {
  let trades = ledgerStore.trades.filter(t => t.status === 'confirmed' || t.type === 'buy')

  // 应用筛选 - 物品名称模糊搜索
  if (filterConfirmedName.value) {
    trades = trades.filter(t => t.itemName.toLowerCase().includes(filterConfirmedName.value.toLowerCase()))
  }
  
  // 应用筛选 - 日期范围
  if (filterConfirmedStartDate.value) {
    trades = trades.filter(t => t.tradeDate >= filterConfirmedStartDate.value)
  }
  if (filterConfirmedEndDate.value) {
    trades = trades.filter(t => t.tradeDate <= filterConfirmedEndDate.value)
  }

  return trades
})

// 分页计算
const pendingPages = computed(() => Math.ceil(pendingTrades.value.length / pageSize))
const confirmedPages = computed(() => Math.ceil(confirmedTrades.value.length / pageSize))

const paginatedPendingTrades = computed(() => {
  const start = (pendingPage.value - 1) * pageSize
  return pendingTrades.value.slice(start, start + pageSize)
})

const paginatedConfirmedTrades = computed(() => {
  const start = (confirmedPage.value - 1) * pageSize
  return confirmedTrades.value.slice(start, start + pageSize)
})

// 待确认卖出表格列定义
const pendingColumns = computed(() => [
  {
    title: '',
    key: 'empty',
    width: 60,
  },
  {
    title: '名称',
    key: 'itemName',
  },
  {
    title: '单价',
    key: 'price',
    width: 100,
    render: (row: any) => `¥${formatNumber(row.price)}`,
  },
  {
    title: '数量',
    key: 'quantity',
    width: 80,
  },
  {
    title: '总计',
    key: 'total',
    width: 120,
    render: (row: any) => `¥${formatNumber(row.price * row.quantity)}`,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    align: 'center' as const,
    render: (row: any) => {
      if (row.status === 'pending') {
        return h('div', { class: 'actions-cell' }, [
          h('button', { class: 'btn-confirm', onClick: () => confirmTrade(row.id), title: '确认到款' }, '✓'),
          h('button', { class: 'btn-edit', onClick: () => editTrade(row.id), title: '修改' }, '✎'),
          h('button', { class: 'btn-delete', onClick: () => deleteTrade(row.id), title: '删除' }, '✕'),
        ])
      } else {
        return h('span', { class: 'status-text' }, '已确认')
      }
    },
  },
])

// 已确认交易表格列定义
const confirmedColumns = computed(() => [
  {
    title: '状态',
    key: 'type',
    width: 80,
    align: 'center' as const,
    render: (row: any) => h('span', { class: ['status-badge', row.type] }, row.type === 'buy' ? '买入' : '卖出'),
  },
  {
    title: '名称',
    key: 'itemName',
  },
  {
    title: '单价',
    key: 'price',
    width: 100,
    render: (row: any) => `${row.type === 'buy' ? '-' : '+'}¥${formatNumber(row.price)}`,
  },
  {
    title: '数量',
    key: 'quantity',
    width: 80,
  },
  {
    title: '总计',
    key: 'total',
    width: 120,
    render: (row: any) => `¥${formatNumber(row.price * row.quantity)}`,
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center' as const,
    render: (row: any) => h('button', { class: 'btn-delete', onClick: () => deleteTrade(row.id), title: '删除' }, '✕'),
  },
])

// 分页配置
const pendingPagination = computed(() => ({
  page: pendingPage.value,
  pageSize: pageSize,
  pageCount: pendingPages.value,
  prefix: (info: any) => `共 ${pendingTrades.value.length} 条`,
  onChange: (page: number) => {
    pendingPage.value = page
  },
}))

const confirmedPagination = computed(() => ({
  page: confirmedPage.value,
  pageSize: pageSize,
  pageCount: confirmedPages.value,
  prefix: (info: any) => `共 ${confirmedTrades.value.length} 条`,
  onChange: (page: number) => {
    confirmedPage.value = page
  },
}))

const goToAdd = () => {
  router.push('/add')
}

const switchAccount = async () => {
  authStore.switchAccount(selectedAccountId.value)
  await ledgerStore.loadTrades()
}

const syncWithCloud = async () => {
  loading.value = true
  await ledgerStore.syncWithCloud()
  loading.value = false
}

const deleteTrade = async (id: string) => {
  if (confirm('确定删除这条交易记录吗？')) {
    await ledgerStore.deleteTrade(id)
  }
}

const confirmTrade = async (id: string) => {
  if (confirm('确认这笔交易已到款吗？')) {
    await ledgerStore.updateTrade(id, { status: 'confirmed' })
  }
}

const editTrade = (id: string) => {
  // 跳转到编辑页面
  router.push(`/edit/${id}`)
}

const createNewAccount = async () => {
  if (!newAccountName.value.trim() || !newAccountEmail.value.trim()) return

  await authStore.createAccount(newAccountName.value, newAccountEmail.value)
  selectedAccountId.value = authStore.currentAccount?.id || ''
  newAccountName.value = ''
  newAccountEmail.value = ''
  showNewAccountDialog.value = false
  await ledgerStore.loadTrades()
}

const formatDate = (date: string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
}

const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

onMounted(async () => {
  selectedAccountId.value = authStore.currentAccount?.id || ''
  await ledgerStore.initialize()
  await ledgerStore.loadTrades()
})
</script>

<style scoped>
.home-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.account-selector .label {
  font-weight: 600;
  color: var(--n-text-color-1);
}

.account-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--n-color);
  color: var(--n-text-color-1);
  cursor: pointer;
}

.btn-new-account {
  padding: 4px 8px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-new-account:hover {
  background: var(--n-color-hover);
}

.stats-compact {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
}

.stat-label {
  font-size: 11px;
  color: var(--n-text-color-2);
  font-weight: 600;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--n-text-color-1);
}

.stat-value.sell {
  color: #52c41a;
}

.stat-value.commission {
  color: #ff4d4f;
}

.stat-value.profit {
  color: #1890ff;
}

.action-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-primary,
.btn-secondary {
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  color: var(--n-text-color-1);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--n-color-hover);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trades-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h3 {
  font-size: 14px;
  margin: 0;
  color: var(--n-text-color-1);
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: var(--n-text-color-2);
  font-size: 13px;
}

.trades-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trade-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  transition: all 0.2s;
}

.trade-item:hover {
  background: var(--n-color-hover);
  border-color: var(--n-border-color-hover);
}

.trade-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.pet-avatar {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--n-color-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.pet-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.trade-type-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.trade-type-badge.buy {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.trade-type-badge.sell {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-badge.pending {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.trade-info {
  min-width: 0;
}

.pet-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trade-date {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-top: 2px;
}

.trade-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;
}

.trade-price {
  font-size: 13px;
  font-weight: 700;
  min-width: 60px;
  text-align: right;
}

.trade-price.buy {
  color: #ff4d4f;
}

.trade-price.sell {
  color: #52c41a;
}

.trade-detail {
  font-size: 11px;
  color: var(--n-text-color-2);
  min-width: 50px;
  text-align: right;
}

.btn-delete {
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: var(--n-text-color-3);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-delete:hover {
  color: #ff4d4f;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--n-color);
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 300px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--n-text-color-1);
}

.modal-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--n-color);
  color: var(--n-text-color-1);
  margin-bottom: 12px;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: #667eea;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  color: var(--n-text-color-1);
}

.btn-cancel:hover {
  background: var(--n-color-hover);
}

.btn-confirm {
  background: #667eea;
  color: white;
}

.btn-confirm:hover {
  background: #5568d3;
}

.table-container {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.table-wrapper {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--n-color);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--n-color);
  table-layout: fixed;
}

.data-table thead {
  background: var(--n-color-hover);
  border-bottom: 2px solid var(--n-border-color);
  position: sticky;
  top: 0;
}

.data-table th {
  padding: 14px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-1);
  border-right: 1px solid var(--n-border-color);
}

.data-table th:last-child {
  border-right: none;
}

.data-table td {
  padding: 14px 12px;
  font-size: 13px;
  color: var(--n-text-color-1);
  border-right: 1px solid var(--n-border-color);
  border-bottom: 1px solid var(--n-border-color);
  word-break: break-word;
  overflow-wrap: break-word;
}

.data-table td.text-right {
  text-align: right;
  font-weight: 500;
}

.data-table td.text-center {
  text-align: center;
}

.data-table td.status-cell {
  text-align: center;
}

.data-table td:last-child {
  border-right: none;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--n-color-hover);
  transition: background-color 0.2s;
}

.data-table tbody tr.confirmed {
  background: rgba(82, 196, 26, 0.05);
}

.data-table tbody tr.confirmed:hover {
  background: rgba(82, 196, 26, 0.1);
}

.status-cell {
  text-align: center;
}

.actions-cell {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px;
}

.btn-page {
  padding: 6px 10px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-page:hover:not(:disabled) {
  background: var(--n-color-hover);
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: var(--n-text-color-2);
  min-width: 50px;
  text-align: center;
}

.status-text {
  font-size: 11px;
  color: #52c41a;
  font-weight: 600;
}

.actions-cell {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-confirm,
.btn-edit,
.btn-delete {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-confirm {
  background: #52c41a;
  color: white;
}

.btn-confirm:hover {
  background: #45a049;
  transform: translateY(-1px);
}

.btn-edit {
  background: #1890ff;
  color: white;
}

.btn-edit:hover {
  background: #0050b3;
  transform: translateY(-1px);
}

.btn-delete {
  background: #ff4d4f;
  color: white;
}

.btn-delete:hover {
  background: #ff7875;
  transform: translateY(-1px);
}

.pending-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--n-border-color);
}

.section-header {
  margin-bottom: 12px;
}

.actions-cell {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-confirm,
.btn-edit,
.btn-delete {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-confirm {
  background: #52c41a;
  color: white;
}

.btn-confirm:hover {
  background: #45a049;
  transform: translateY(-1px);
}

.btn-edit {
  background: #1890ff;
  color: white;
}

.btn-edit:hover {
  background: #0050b3;
  transform: translateY(-1px);
}

.btn-delete {
  background: #ff4d4f;
  color: white;
}

.btn-delete:hover {
  background: #ff7875;
  transform: translateY(-1px);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.buy {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.status-badge.sell {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.trade-actions {
  display: flex;
  gap: 4px;
}

.btn-confirm,
.btn-edit {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #52c41a;
  color: white;
}

.btn-confirm:hover {
  background: #45a049;
}

.btn-edit {
  background: #1890ff;
}

.btn-edit:hover {
  background: #0050b3;
}

.btn-delete {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #ff4d4f;
  color: white;
}

.btn-delete:hover {
  background: #ff7875;
}

@media (max-width: 480px) {
  .home-container {
    padding: 8px;
    gap: 8px;
  }

  .stats-compact {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .stat-item {
    padding: 6px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-value {
    font-size: 12px;
  }

  .trade-item {
    padding: 8px;
  }

  .trade-type-badge {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .pet-name {
    font-size: 12px;
  }

  .trade-date {
    font-size: 10px;
  }

  .trade-price {
    font-size: 12px;
    min-width: 50px;
  }

  .trade-detail {
    font-size: 10px;
    min-width: 45px;
  }
}
</style>
