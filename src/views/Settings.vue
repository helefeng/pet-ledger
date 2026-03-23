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
    </div>

    <div class="settings-section">
      <h3>数据管理</h3>
      <button @click="exportJSON" class="btn-action">📥 导出 JSON</button>
      <button @click="exportCSV" class="btn-action">📊 导出 CSV</button>
      <button @click="importData" class="btn-action">📤 导入数据</button>
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

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const showNewAccountDialog = ref(false)
const newAccountName = ref('')
const newAccountEmail = ref('')
const fileInput = ref<HTMLInputElement>()

const deleteAccount = async (accountId: string) => {
  if (confirm('确定删除这个账号吗？此操作不可撤销。')) {
    await authStore.deleteAccount(accountId)
    await ledgerStore.loadTrades()
  }
}

const createNewAccount = async () => {
  if (!newAccountName.value.trim() || !newAccountEmail.value.trim()) return

  await authStore.createAccount(newAccountName.value, newAccountEmail.value)
  newAccountName.value = ''
  newAccountEmail.value = ''
  showNewAccountDialog.value = false
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
</style>
