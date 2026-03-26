<template>
  <div class="add-trade-container">
    <div class="page-header">
      <h2>{{ isEditing ? '编辑交易记录' : '添加交易记录' }}</h2>
      <div class="account-info">
        邮箱: <strong>{{ authStore.currentAccount?.gameEmail }}</strong>
      </div>
    </div>

    <div class="form-card">
      <form @submit.prevent="handleSubmit" class="trade-form">
        <div class="form-row">
          <div class="form-group">
            <label>物品名称 *</label>
            <input
              v-model.trim="form.itemName"
              type="text"
              placeholder="输入物品名称"
              required
            />
          </div>
        </div>

        <div class="form-row two-col">
          <div class="form-group">
            <label>单价 *</label>
            <input
              v-model.number="form.price"
              type="number"
              placeholder="输入单价"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div class="form-group">
            <label>数量 *</label>
            <input
              v-model.number="form.quantity"
              type="number"
              placeholder="输入数量"
              min="1"
              step="1"
              required
            />
          </div>
        </div>

        <div class="form-row two-col">
          <div class="form-group">
            <label>交易方向 *</label>
            <select v-model="form.type">
              <option value="buy">买入（支出）</option>
              <option value="sell">卖出（收入）</option>
            </select>
          </div>
          <div class="form-group">
            <label>交易类型 *</label>
            <select v-model="form.tradeCurrency">
              <option value="bean">豆子</option>
              <option value="rmb">RMB</option>
            </select>
          </div>
        </div>

        <div class="form-row two-col">
          <div class="form-group">
            <label>交易日期 *</label>
            <input v-model="form.tradeDate" type="date" required />
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="goBack">取消</button>
          <button type="submit" class="btn-submit" :disabled="loading">
            {{ loading ? '保存中...' : (isEditing ? '更新记录' : '保存记录') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { db } from '@/services/db'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const loading = ref(false)
const error = ref('')
const isEditing = ref(false)
const editId = ref('')

const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const form = ref({
  itemName: '',
  type: 'buy' as 'buy' | 'sell',
  price: 0,
  quantity: 1,
  tradeDate: today(),
  tradeCurrency: 'bean' as 'bean' | 'rmb',
})

onMounted(async () => {
  if (route.params.id) {
    isEditing.value = true
    editId.value = route.params.id as string

    let trade = ledgerStore.trades.find(t => t.id === editId.value)
    if (!trade) {
      trade = await db.petTrades.get(editId.value)
      if (trade?.accountId) authStore.switchAccount(trade.accountId)
    }

    if (trade) {
      form.value = {
        itemName: trade.itemName,
        type: trade.type,
        price: trade.price,
        quantity: trade.quantity,
        tradeDate: trade.tradeDate,
        tradeCurrency: trade.tradeCurrency || 'bean',
      }
    } else {
      error.value = '未找到要编辑的记录'
    }
  }
})

const handleSubmit = async () => {
  error.value = ''

  if (!form.value.itemName || form.value.price <= 0 || form.value.quantity <= 0) {
    error.value = '请填写完整且有效的内容'
    return
  }

  loading.value = true
  try {
    const tradeData = {
      itemName: form.value.itemName,
      type: form.value.type,
      price: form.value.price,
      quantity: form.value.quantity,
      tradeCurrency: form.value.tradeCurrency,
      showInRmbPanel: true,
      nature: '不考虑',
      level: -1,
      individual: -1,
      ability: '不考虑',
      tradeDate: form.value.tradeDate,
      isShiny: '否' as const,
    }

    const result = isEditing.value
      ? await ledgerStore.updateTrade(editId.value, tradeData)
      : await ledgerStore.addTrade(tradeData)

    if (result.success) {
      const returnTo = String(route.query.returnTo || '')
      if (returnTo === 'account' || route.path.startsWith('/account')) {
        router.push({ path: '/account', query: { refreshTrades: '1' } })
      } else {
        router.push({ path: '/', query: { refreshTrades: '1' } })
      }
    } else {
      error.value = '保存失败，请重试'
    }
  } catch {
    error.value = '保存失败，请重试'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.add-trade-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 12px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  font-size: 18px;
  margin: 0 0 6px 0;
  color: var(--n-text-color-1);
}

.account-info {
  font-size: 12px;
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.form-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 16px;
}

.trade-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.form-row.two-col {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.form-group input,
.form-group select {
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--n-color);
  color: var(--n-text-color-1);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.error-message {
  padding: 8px 10px;
  background: #fee;
  color: #c33;
  border-radius: 4px;
  font-size: 12px;
}

.form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.btn-cancel,
.btn-submit {
  padding: 8px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  background: var(--n-color-hover);
  color: var(--n-text-color-1);
  border: 1px solid var(--n-border-color);
}

.btn-submit {
  background: #667eea;
  color: #fff;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .form-row.two-col {
    grid-template-columns: 1fr;
  }
}
</style>
