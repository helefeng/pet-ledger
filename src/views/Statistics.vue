<template>
  <div class="stats-container">
    <div class="page-header">
      <h2>统计分析</h2>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">总买入</div>
        <div class="stat-value">¥{{ formatNumber(statistics.totalBuy) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">总卖出</div>
        <div class="stat-value sell">¥{{ formatNumber(statistics.totalSell) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">交易行提成</div>
        <div class="stat-value commission">-¥{{ formatNumber(statistics.totalCommission) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">总利润</div>
        <div class="stat-value profit">¥{{ formatNumber(statistics.totalProfit) }}</div>
      </div>
    </div>

    <div class="trades-section">
      <h3>交易明细</h3>
      <div v-if="ledgerStore.trades.length === 0" class="empty-state">
        暂无交易记录
      </div>
      <div v-else class="trades-table">
        <div class="table-header">
          <div class="col-pet-img"></div>
          <div class="col-type">类型</div>
          <div class="col-pet">宠物</div>
          <div class="col-level">等级</div>
          <div class="col-nature">性格</div>
          <div class="col-ability">特性</div>
          <div class="col-price">价格</div>
          <div class="col-qty">数量</div>
          <div class="col-commission">提成</div>
          <div class="col-profit">收益</div>
        </div>
        <div v-for="trade in ledgerStore.trades" :key="trade.id" class="table-row">
          <div class="col-pet-img">
            <img :src="getPetImageUrl(parseInt(trade.itemName) || 0)" :alt="trade.itemName" @error="handleImageError" />
          </div>
          <div class="col-type">
            <span class="badge" :class="trade.type">{{ trade.type === 'buy' ? '买' : '卖' }}</span>
          </div>
          <div class="col-pet">{{ trade.itemName }}</div>
          <div class="col-level">Lv.{{ trade.level === -1 ? '-' : trade.level }}</div>
          <div class="col-nature">{{ trade.nature === '不考虑' ? '-' : trade.nature }}</div>
          <div class="col-ability">{{ trade.ability === '不考虑' ? '-' : trade.ability }}</div>
          <div class="col-price">¥{{ formatNumber(trade.price) }}</div>
          <div class="col-qty">{{ trade.quantity }}</div>
          <div class="col-commission">-¥{{ formatNumber(trade.commission) }}</div>
          <div class="col-profit" :class="trade.type">
            {{ trade.type === 'buy' ? '-' : '+' }}¥{{ formatNumber(trade.type === 'buy' ? trade.price * trade.quantity : trade.actualProfit) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLedgerStore } from '@/stores/ledger'
import { formatNumber } from '@/constants/pet'
import { getPetImageUrl } from '@/constants/petDatabase'

const ledgerStore = useLedgerStore()

const statistics = computed(() => ledgerStore.statistics)

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped>
.stats-container {
  max-width: 1000px;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.stat-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-title {
  font-size: 12px;
  color: var(--n-text-color-2);
  margin-bottom: 6px;
  font-weight: 600;
}

.stat-value {
  font-size: 18px;
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

.trades-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trades-section h3 {
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

.trades-table {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 40px 35px 70px 50px 60px 60px 60px 40px 60px 70px;
  gap: 0;
  background: var(--n-color-hover);
  border-bottom: 1px solid var(--n-border-color);
  padding: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--n-text-color-1);
  overflow-x: auto;
}

.table-row {
  display: grid;
  grid-template-columns: 40px 35px 70px 50px 60px 60px 60px 40px 60px 70px;
  gap: 0;
  padding: 6px;
  border-bottom: 1px solid var(--n-border-color);
  font-size: 11px;
  align-items: center;
  overflow-x: auto;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--n-color-hover);
}

.col-type {
  text-align: center;
}

.col-pet-img {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.col-pet-img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.col-pet {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-level,
.col-nature,
.col-ability,
.col-qty,
.col-price,
.col-commission,
.col-profit {
  text-align: right;
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  color: white;
}

.badge.buy {
  background: #ff4d4f;
}

.badge.sell {
  background: #52c41a;
}

.col-profit.buy {
  color: #ff4d4f;
}

.col-profit.sell {
  color: #52c41a;
}

@media (max-width: 768px) {
  .stats-container {
    padding: 8px;
    gap: 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 10px;
  }

  .stat-title {
    font-size: 11px;
  }

  .stat-value {
    font-size: 16px;
  }

  .table-header,
  .table-row {
    grid-template-columns: 35px 60px 55px 55px 65px 80px;
    padding: 6px;
    font-size: 11px;
  }

  .col-date {
    font-size: 10px;
  }
}
</style>
