<template>
  <div class="settings-container">
    <div class="page-header">
      <h2>设置</h2>
    </div>

    <div class="settings-section">
      <h3>账户信息</h3>
      <div class="setting-item">
        <span class="label">用户名:</span>
        <span class="value">{{ authStore.currentUser?.username }}</span>
      </div>
      <div class="setting-item">
        <span class="label">当前账号:</span>
        <span class="value">{{ authStore.currentAccount?.gameEmail }}</span>
      </div>
    </div>

    <div class="settings-section">
      <h3>账号管理</h3>
      <div class="account-list">
        <div v-for="account in authStore.userAccounts" :key="account.id" class="account-item">
          <span class="account-name">{{ account.gameEmail }}</span>
          <button
            v-if="authStore.userAccounts.length > 1"
            @click="deleteAccount(account.id)"
            class="btn-delete"
          >
            删除
          </button>
        </div>
      </div>
      <button @click="showNewAccountDialog = true" class="btn-add-account">
        ➕ 新建账号
      </button>
      <button @click="syncToCloud" class="btn-action">☁️ 同步本地到云端</button>
      <button @click="deleteAllAccounts" class="btn-delete-all">🗑️ 删除所有账号</button>
    </div>

    <div class="settings-section">
      <h3>数据管理</h3>
      <button @click="exportJSON" class="btn-action">📥 导出 JSON</button>
      <button @click="exportCSV" class="btn-action">📊 导出 CSV</button>
      <button @click="importData" class="btn-action">📤 导入数据</button>
    </div>

    <div class="settings-section">
      <h3>🎮 游戏数据导入</h3>
      <p class="section-desc">直接从交易行拉取历史记录并导入，需要填写各账号的 Token（从浏览器抓包获取）。</p>

      <!-- 日期选择 -->
      <div class="import-date-row">
        <div class="import-date-item">
          <label>开始日期</label>
          <input v-model="importDateFrom" type="date" class="modal-input" />
        </div>
        <div class="import-date-item">
          <label>截止日期</label>
          <input v-model="importDateTo" type="date" class="modal-input" />
        </div>
      </div>

      <!-- 账号 Token 配置 -->
      <div class="import-accounts">
        <div v-for="account in authStore.userAccounts" :key="account.id" class="import-account-row">
          <span class="import-account-name">{{ account.accountName }}（{{ account.gameEmail }}）</span>
          <div class="token-row">
            <input
              v-model="accountTokenMap[account.id]"
              type="text"
              :placeholder="`${account.accountName} 的 Token`"
              class="modal-input token-input"
              @change="saveTokens"
            />
            <button class="btn-read-token" @click="readTokenFromGame(account.id)" title="从游戏网站读取 Token">读取</button>
          </div>
          <span v-if="accountTokenMap[account.id]" class="token-saved">✓ 已保存</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <button @click="importFromGame" :disabled="importing" class="btn-action btn-import">
        {{ importing ? `导入中... ${importProgress}` : '🚀 一键拉取并导入' }}
      </button>

      <!-- 日志输出 -->
      <div v-if="importLog.length" class="import-log">
        <div v-for="(line, i) in importLog" :key="i" :class="['log-line', line.type]">{{ line.msg }}</div>
      </div>
    </div>

    <div class="settings-section danger">
      <h3>危险操作</h3>
      <button @click="clearAllData" class="btn-clear-data">🗑️ 清除交易记录</button>
      <button @click="logout" class="btn-logout">🚪 登出</button>
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

    <input ref="fileInput" type="file" accept=".json" style="display: none" @change="handleFileImport" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { db } from '@/services/db'
import { SyncService } from '@/services/sync'
import type { PetTrade } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const showNewAccountDialog = ref(false)
const newAccountName = ref('')
const newAccountEmail = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// 游戏数据导入
const today = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const importDateFrom = ref(yesterday)
const importDateTo = ref(today)
const accountTokenMap = ref<Record<string, string>>({})
const importing = ref(false)
const importProgress = ref('')
const importLog = ref<{ msg: string; type: string }[]>([])

// 从 localStorage 恢复已保存的 Token
const TOKEN_STORAGE_KEY = 'game-tokens'
const loadSavedTokens = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}')
    accountTokenMap.value = saved
  } catch {}
}
loadSavedTokens()

const saveTokens = () => {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(accountTokenMap.value))
}

const GAME_URL = 'http://61.160.213.26:12347'
let gameWin: Window | null = null
let pendingAccountId: string | null = null

// 监听游戏网站发回的 Token
window.addEventListener('message', (event) => {
  if (event.origin !== GAME_URL.replace(/\/$/, '')) return
  if (event.data?.type === 'game_token' && event.data?.token && pendingAccountId) {
    accountTokenMap.value[pendingAccountId] = event.data.token
    saveTokens()
    addLog(`✓ 自动获取 Token 成功！`, 'ok')
    pendingAccountId = null
    gameWin?.close()
  }
})

const readTokenFromGame = (accountId: string) => {
  const account = authStore.userAccounts.find(a => a.id === accountId)
  pendingAccountId = accountId
  importLog.value = []

  // 注入脚本的 URL：打开游戏网站并附带回调指令
  const injectScript = encodeURIComponent(`
    setTimeout(() => {
      const token = localStorage.getItem('token')
      if (token) {
        window.opener?.postMessage({ type: 'game_token', token }, '*')
        document.title = '✓ Token 已发送，可关闭此窗口'
      } else {
        alert('未检测到登录状态，请先登录后刷新页面')
      }
    }, 1500)
  `)

  gameWin = window.open(
    GAME_URL + '?_inject=1',
    'game_login',
    'width=1200,height=800'
  )

  if (!gameWin) {
    addLog('弹出窗口被阻止，请允许后重试', 'warn')
    return
  }

  addLog(`已打开游戏网站，请登录【${account?.accountName || ''}】账号`, 'info')
  addLog('登录成功后 Token 将自动发回，无需手动操作', 'info')
  addLog('如果等待超过 10 秒未自动填入，请手动复制 Token', 'warn')

  // 轮询检查弹窗是否已登录（同域时可直接读，跨域时 postMessage 接收）
  const check = setInterval(() => {
    if (!gameWin || gameWin.closed) {
      clearInterval(check)
      pendingAccountId = null
      return
    }
    try {
      // 尝试直接读取（如果同域）
      const token = gameWin.localStorage?.getItem('token')
      if (token && pendingAccountId) {
        accountTokenMap.value[pendingAccountId] = token
        saveTokens()
        addLog(`✓ 自动获取 Token 成功！`, 'ok')
        pendingAccountId = null
        clearInterval(check)
        gameWin.close()
      }
    } catch {
      // 跨域时无法直接读取，等待 postMessage
    }
  }, 1000)
}

const API_HOST = 'http://140.210.17.123:8211'
const FRONT_HOST = 'http://61.160.213.26:12347'

const addLog = (msg: string, type = 'info') => {
  importLog.value.push({ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type })
}

const fetchTrades = async (token: string, dateFrom: string, dateTo: string) => {
  const all: any[] = []
  let page = 1
  let totalPages = 1
  const PAGE_SIZE = 50

  while (page <= totalPages) {
    importProgress.value = `第 ${page}/${totalPages} 页`
    const body: any = { currentPage: page, limit: PAGE_SIZE }
    if (dateFrom) body.startTime = dateFrom + ' 00:00:00'
    if (dateTo) body.endTime = dateTo + ' 00:00:00'

    const res = await fetch(`${API_HOST}/seer/trade/tradeRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': FRONT_HOST,
        'Token': token,
      },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!json?.data?.list) break

    const { list, totalPage } = json.data
    totalPages = totalPage || 1
    all.push(...list)
    page++
    await new Promise(r => setTimeout(r, 200))
  }
  return all
}

const convertRecord = (record: any, userId: string, accountId: string): Omit<PetTrade, never> => {
  const type = record.tradeType === 1 ? 'buy' : 'sell'
  const total = Number(record.amount || 0)
  const tradeDate = record.create_time?.split('T')[0] || today
  const commission = type === 'sell' ? total * 0.05 : 0
  const actualProfit = type === 'sell' ? total - commission : 0

  let desc = ''
  try {
    const d = JSON.parse(record.itemDesc || '{}')
    const parts = []
    if (d.level) parts.push(`Lv${d.level}`)
    if (d.nature) parts.push(d.nature)
    if (d.iv !== undefined) parts.push(`个体${d.iv}`)
    if (d.isShiny) parts.push('闪光')
    desc = parts.join(' ')
  } catch {}

  return {
    id: `import_${record.orderId || record.recordId}`,
    userId,
    accountId,
    itemName: record.itemName || '未知',
    price: total,
    quantity: 1,
    type,
    status: 'confirmed' as const,
    tradeDate,
    commission,
    actualProfit,
    notes: desc ? `${desc} | 订单:${record.orderId}` : `订单:${record.orderId}`,
    synced: false,
    createdAt: record.create_time ? new Date(record.create_time).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const importFromGame = async () => {
  if (importing.value) return
  importing.value = true
  importLog.value = []

  const userId = authStore.currentUser?.id
  if (!userId) { addLog('未登录', 'err'); importing.value = false; return }

  const accounts = authStore.userAccounts
  if (accounts.length === 0) { addLog('没有账号', 'err'); importing.value = false; return }

  let totalAdded = 0
  let totalSkipped = 0

  for (const account of accounts) {
    const token = accountTokenMap.value[account.id]?.replace(/^"|"$/g, '').trim()
    if (!token) { addLog(`跳过 ${account.accountName}：未填写 Token`, 'warn'); continue }

    addLog(`开始拉取 ${account.accountName}（${account.gameEmail}）...`)
    try {
      const result = await SyncService.importGameData({
        token,
        userId,
        account,
        dateFrom: importDateFrom.value,
        dateTo: importDateTo.value,
        onProgress: (msg) => { importProgress.value = `${account.accountName}：${msg}` },
      })

      totalAdded += result.added
      totalSkipped += result.skipped
      addLog(`${account.accountName}：获取 ${result.recordCount} 条已完成记录`, 'ok')
      addLog(`${account.accountName}：上架中 ${result.pendingCount} 条`, 'ok')
      addLog(`${account.accountName}：新增 ${result.added} 条，跳过重复 ${result.skipped} 条`, 'ok')
      if (result.tradeBalance !== undefined) {
        addLog(`${account.accountName}：余额 ${(result.tradeBalance / 10000).toFixed(4)}w`, 'ok')
      }
    } catch (err: any) {
      addLog(`${account.accountName} 拉取失败：${err.message}`, 'err')
    }
  }

  // 刷新账号缓存（确保首页余额更新）
  const allAccounts = await db.gameAccounts.toArray()
  const userAccounts = allAccounts.filter(a => a.userId === userId)
  authStore.userAccounts.splice(0, authStore.userAccounts.length, ...userAccounts)
  if (authStore.currentAccount) {
    const fresh = userAccounts.find(a => a.id === authStore.currentAccount!.id)
    if (fresh) Object.assign(authStore.currentAccount, fresh)
  }

  addLog(`全部完成！共新增 ${totalAdded} 条，跳过 ${totalSkipped} 条`, 'ok')
  importing.value = false
  importProgress.value = ''

  await ledgerStore.loadTrades()
}

const deleteAccount = async (accountId: string) => {
  if (confirm('确定删除这个账号吗？此操作不可撤销。')) {
    await authStore.deleteAccount(accountId)
    await ledgerStore.loadTrades()
  }
}

const deleteAllAccounts = async () => {
  if (!confirm('确定删除当前用户的所有账号吗？此操作不可撤销！')) return
  if (!confirm('再次确认：删除所有账号？')) return
  const result = await authStore.deleteAllAccounts()
  if (result?.success) {
    alert('所有账号已删除')
    await ledgerStore.loadTrades()
  } else {
    alert(result?.error || '删除失败')
  }
}

const syncToCloud = async () => {
  const result = await authStore.syncLocalToCloud()
  if (result?.success) {
    alert('本地数据已同步到云端')
  } else {
    alert('同步失败，请检查网络')
  }
}

const createNewAccount = async () => {
  if (!newAccountName.value.trim() || !newAccountEmail.value.trim()) {
    alert('请填写账号名称和游戏邮箱')
    return
  }

  const result = await authStore.createAccount(newAccountName.value.trim(), newAccountEmail.value.trim())
  if (result?.success) {
    newAccountName.value = ''
    newAccountEmail.value = ''
    showNewAccountDialog.value = false
  } else {
    alert(result?.error || '创建失败')
  }
}

const exportData = async () => {
  try {
    const trades = await db.petTrades.toArray()
    const accounts = await db.gameAccounts.toArray()
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      trades,
      accounts,
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pet-trade-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    alert('导出失败')
  }
}

const exportJSON = exportData

const exportCSV = async () => {
  try {
    const trades = await db.petTrades.toArray()
    
    // CSV 表头
    const headers = ['交易ID', '宠物名称', '类型', '单价', '数量', '总价', '性格', '特性', '个体值', '等级', '异色', '提成', '实际收益', '交易日期']
    
    // CSV 数据行
    const rows = trades.map(t => [
      t.id,
      t.itemName,
      t.type === 'buy' ? '买入' : '卖出',
      t.price,
      t.quantity,
      t.price * t.quantity,
      t.nature,
      t.ability || '',
      t.individual,
      t.level,
      t.isShiny,
      t.commission,
      t.actualProfit,
      t.tradeDate,
    ])
    
    // 组合 CSV 内容
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pet-trade-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    alert('导出失败')
  }
}

const importData = () => {
  fileInput.value?.click()
}

const handleFileImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (data.trades && Array.isArray(data.trades)) {
      for (const trade of data.trades) {
        const existing = await db.petTrades.get(trade.id)
        if (!existing) {
          await db.petTrades.add(trade)
        }
      }
    }

    await ledgerStore.loadTrades()
    alert('导入成功')
  } catch (error) {
    alert('导入失败，请检查文件格式')
  }

  // 重置 input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const logout = () => {
  if (confirm('确定要登出吗？')) {
    authStore.logout()
    router.push('/login')
  }
}

const clearAllData = async () => {
  if (!confirm('确定要清除当前账号的所有交易记录吗？此操作不可撤销！')) return
  if (!confirm('再次确认：清除所有交易记录？')) return

  try {
    // 只清除当前账号的交易记录
    const result = await ledgerStore.clearAllTrades()
    if (result.success) {
      alert('交易记录已清除')
    } else {
      alert('清除失败')
    }
  } catch (error) {
    alert('清除失败')
  }
}
</script>

<style scoped>
.settings-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  margin-bottom: 8px;
}

.page-header h2 {
  font-size: 18px;
  margin: 0;
  color: var(--n-text-color-1);
}

.settings-section {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-section.danger {
  border-color: #ffcccc;
  background: rgba(255, 77, 79, 0.05);
}

.settings-section h3 {
  font-size: 13px;
  margin: 0 0 8px 0;
  color: var(--n-text-color-1);
  font-weight: 600;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--n-border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.label {
  color: var(--n-text-color-2);
  font-weight: 600;
}

.value {
  color: var(--n-text-color-1);
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--n-color-hover);
  border-radius: 4px;
  font-size: 13px;
}

.account-name {
  color: var(--n-text-color-1);
  font-weight: 600;
}

.btn-delete {
  padding: 4px 8px;
  border: 1px solid #ffcccc;
  background: transparent;
  color: #ff4d4f;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: rgba(255, 77, 79, 0.1);
}

.btn-add-account,
.btn-action,
.btn-logout,
.btn-clear-data {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-account,
.btn-action {
  background: var(--n-color-hover);
  color: var(--n-text-color-1);
  border: 1px solid var(--n-border-color);
}

.btn-add-account:hover,
.btn-action:hover {
  background: var(--n-color);
}

.btn-logout,
.btn-clear-data {
  background: #ff4d4f;
  color: white;
}

.btn-logout:hover,
.btn-clear-data:hover {
  background: #ff7875;
}

.btn-delete-all {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #ff7700;
  color: white;
}

.btn-delete-all:hover {
  background: #ff9933;
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

@media (max-width: 480px) {
  .settings-container {
    padding: 8px;
    gap: 12px;
  }

  .settings-section {
    padding: 10px;
  }

  .settings-section h3 {
    font-size: 12px;
  }

  .setting-item,
  .account-item {
    font-size: 12px;
  }

  .btn-add-account,
  .btn-action,
  .btn-logout {
    padding: 6px 10px;
    font-size: 12px;
  }
}

.section-desc {
  font-size: 12px;
  color: var(--n-text-color-2);
  margin: 0;
}
.import-date-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.import-date-item label {
  font-size: 12px;
  color: var(--n-text-color-2);
  display: block;
  margin-bottom: 4px;
}
.import-accounts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.import-account-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.import-account-name {
  font-size: 12px;
  color: var(--n-text-color-2);
  font-weight: 600;
}
.token-input {
  font-size: 12px;
  font-family: monospace;
}
.token-saved {
  font-size: 11px;
  color: #2ecc71;
  font-weight: 600;
}
.token-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.token-row .modal-input {
  flex: 1;
  margin-bottom: 0;
}
.btn-read-token {
  padding: 8px 12px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-read-token:hover { background: #219a52; }
.btn-import {
  background: #667eea !important;
  color: white !important;
  border-color: #667eea !important;
}
.btn-import:hover {
  background: #5568d3 !important;
}
.btn-import:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.import-log {
  background: #0f0f1a;
  border-radius: 6px;
  padding: 10px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.8;
}
.log-line { color: #aaa; }
.log-line.ok { color: #2ecc71; }
.log-line.err { color: #e74c3c; }
.log-line.warn { color: #f39c12; }
</style>
