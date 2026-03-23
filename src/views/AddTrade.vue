<template>
  <div class="add-trade-container">
    <div class="page-header">
      <h2>{{ isEditing ? '编辑交易' : '添加交易' }}</h2>
      <div class="account-info">
        邮箱: <strong>{{ authStore.currentAccount?.gameEmail }}</strong>
      </div>
    </div>

    <div class="form-card">
      <form @submit.prevent="handleSubmit" class="trade-form">
        <!-- 交易类型 -->
        <div class="form-row">
          <div class="form-group">
            <label>交易类型 *</label>
            <div class="type-selector">
              <button
                type="button"
                :class="['type-btn', { active: form.type === 'buy' }]"
                @click="form.type = 'buy'"
              >
                📥 买入
              </button>
              <button
                type="button"
                :class="['type-btn', { active: form.type === 'sell' }]"
                @click="form.type = 'sell'"
              >
                📤 卖出
              </button>
            </div>
          </div>
        </div>

        <!-- 卖出时的状态选项 -->
        <div v-if="form.type === 'sell'" class="form-row">
          <div class="form-group">
            <label>订单状态 *</label>
            <select v-model="form.status" required>
              <option value="pending">待确认（预计收入）</option>
              <option value="confirmed">已确认（已到账）</option>
            </select>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="form-row">
          <div class="form-group">
            <label>物品名称 *</label>
            <input
              v-model="form.petName"
              type="text"
              placeholder="输入物品名称（宠物或道具）"
              @input="handlePetNameInput"
              required
            />
            <div v-if="petSuggestions.length > 0" class="pet-suggestions">
              <div
                v-for="pet in petSuggestions"
                :key="pet.id"
                class="suggestion-item"
                @click="selectPet(pet)"
              >
                {{ pet.name }}
              </div>
            </div>
            <div v-if="form.petName && selectedPet" class="pet-preview">
              ✓ 已选择: {{ selectedPet.name }}
            </div>
          </div>
          <div class="form-group">
            <label>等级</label>
            <input
              v-model.number="form.level"
              type="number"
              placeholder="1-100（-1表示不考虑）"
              min="-1"
              max="100"
            />
          </div>
        </div>

        <!-- 价格和数量 -->
        <div class="form-row">
          <div class="form-group">
            <label>单价 *</label>
            <input
              v-model.number="form.price"
              type="number"
              placeholder="输入价格"
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
              placeholder="数量"
              min="1"
              step="1"
              required
            />
          </div>
        </div>

        <!-- 性格和特性 -->
        <div class="form-row">
          <div class="form-group">
            <label>性格</label>
            <select v-model="form.nature">
              <option value="">不考虑</option>
              <option v-for="nature in NATURES" :key="nature" :value="nature">
                {{ nature }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>特性</label>
            <select v-model="form.ability">
              <option value="">不考虑</option>
              <option v-for="ability in ABILITIES" :key="ability" :value="ability">
                {{ ability }}
              </option>
            </select>
          </div>
        </div>

        <!-- 个体值和异色 -->
        <div class="form-row">
          <div class="form-group">
            <label>个体值</label>
            <input
              v-model.number="form.individual"
              type="number"
              placeholder="0-31（-1表示不考虑）"
              min="-1"
              max="31"
              required
            />
          </div>
          <div class="form-group">
            <label>异色 *</label>
            <select v-model="form.isShiny" required>
              <option value="否">否</option>
              <option value="是">是</option>
            </select>
          </div>
        </div>

        <!-- 交易日期 -->
        <div class="form-row">
          <div class="form-group">
            <label>交易日期 *</label>
            <input
              v-model="form.tradeDate"
              type="date"
              required
            />
          </div>
        </div>

        <!-- 费用计算 -->
        <div v-if="form.type === 'sell'" class="commission-info">
          <div class="info-row">
            <span>单价:</span>
            <strong>¥{{ formatNumber(form.price) }}</strong>
          </div>
          <div class="info-row">
            <span>数量:</span>
            <strong>{{ form.quantity }}</strong>
          </div>
          <div class="info-row">
            <span>总价:</span>
            <strong>¥{{ formatNumber(form.price * form.quantity) }}</strong>
          </div>
          <div class="info-row">
            <span>交易行提成 (5%):</span>
            <strong class="commission">-¥{{ formatNumber(form.price * form.quantity * 0.05) }}</strong>
          </div>
          <div class="info-row total">
            <span>实际收益:</span>
            <strong>¥{{ formatNumber(form.price * form.quantity * 0.95) }}</strong>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="goBack">取消</button>
          <button type="submit" class="btn-submit" :disabled="loading">
            {{ loading ? '保存中...' : (isEditing ? '更新交易' : '保存交易') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { NATURES, ABILITIES, formatNumber } from '@/constants/pet'
import { PETS_DATABASE } from '@/constants/petDatabase'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const loading = ref(false)
const error = ref('')
const isEditing = ref(false)
const editId = ref('')

const form = ref({
  type: 'buy' as 'buy' | 'sell',
  status: 'pending' as 'pending' | 'confirmed',
  petName: '',
  price: 0,
  quantity: 1,
  nature: '',
  level: -1,
  individual: -1,
  ability: '',
  tradeDate: new Date().toISOString().split('T')[0],
  isShiny: '否' as '是' | '否',
})

// 初始化编辑模式
onMounted(() => {
  if (route.params.id) {
    isEditing.value = true
    editId.value = route.params.id as string
    const trade = ledgerStore.trades.find(t => t.id === editId.value)
    if (trade) {
      form.value = {
        type: trade.type as 'buy' | 'sell',
        status: trade.status as 'pending' | 'confirmed',
        petName: trade.itemName,
        price: trade.price,
        quantity: trade.quantity,
        nature: trade.nature,
        level: trade.level,
        individual: trade.individual,
        ability: trade.ability,
        tradeDate: trade.tradeDate,
        isShiny: trade.isShiny,
      }
    }
  }
})

const selectedPet = ref<any>(null)
const petSuggestions = ref<any[]>([])

const handlePetNameInput = () => {
  const input = form.value.petName.trim()
  if (!input) {
    petSuggestions.value = []
    selectedPet.value = null
    return
  }

  // 模糊搜索精灵
  petSuggestions.value = PETS_DATABASE.filter(pet =>
    pet.name.includes(input)
  ).slice(0, 10) // 最多显示10个建议
}

const selectPet = (pet: any) => {
  selectedPet.value = pet
  form.value.petName = pet.name
  petSuggestions.value = []
}

const handleSubmit = async () => {
  error.value = ''
  
  if (!form.value.petName || form.value.price === 0) {
    error.value = '请填写物品名称和价格'
    return
  }

  if (form.value.type === 'sell' && !form.value.status) {
    error.value = '请选择订单状态'
    return
  }

  loading.value = true

  try {
    const tradeData: any = {
      itemName: form.value.petName,
      type: form.value.type,
      price: form.value.price,
      quantity: form.value.quantity,
      nature: form.value.nature || '不考虑',
      level: form.value.level,
      individual: form.value.individual,
      ability: form.value.ability || '不考虑',
      tradeDate: form.value.tradeDate,
      isShiny: form.value.isShiny,
    }

    // 卖出时添加状态字段
    if (form.value.type === 'sell') {
      tradeData.status = form.value.status
    }

    let result
    if (isEditing.value) {
      // 编辑模式：只更新指定字段，保持原有状态
      const originalTrade = ledgerStore.trades.find(t => t.id === editId.value)
      if (originalTrade && originalTrade.type === 'sell') {
        // 保持原有的状态
        tradeData.status = originalTrade.status
      }
      result = await ledgerStore.updateTrade(editId.value, tradeData)
    } else {
      // 新增模式
      result = await ledgerStore.addTrade(tradeData)
    }

    if (result.success) {
      router.push('/')
    } else {
      error.value = '保存失败，请重试'
    }
  } catch (err) {
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
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
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
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.pet-preview {
  font-size: 12px;
  color: #667eea;
  margin-top: 4px;
  font-weight: 600;
}

.pet-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.suggestion-item {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--n-text-color-1);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid var(--n-border-color);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: var(--n-color-hover);
  color: #667eea;
}

.type-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.type-btn {
  padding: 8px;
  border: 2px solid var(--n-border-color);
  background: var(--n-color);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--n-text-color-1);
}

.type-btn.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.commission-info {
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 4px;
  padding: 10px;
  font-size: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: var(--n-text-color-2);
}

.info-row strong {
  color: var(--n-text-color-1);
}

.info-row.total {
  border-top: 1px solid rgba(102, 126, 234, 0.2);
  padding-top: 6px;
  margin-top: 6px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.commission {
  color: #ff4d4f;
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
  font-size: 12px;
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

.btn-submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .add-trade-container {
    padding: 8px;
  }

  .form-card {
    padding: 12px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .type-selector {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
