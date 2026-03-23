<template>
  <div class="overview-container">
    <div class="page-header">
      <h2>总收益统计</h2>
    </div>

    <!-- 用户总统计 -->
    <div class="user-total-section">
      <h3>用户总计</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">总买入</div>
          <div class="stat-value">¥{{ formatNumber(userTotalStats.totalBuy) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总卖出</div>
          <div class="stat-value sell">¥{{ formatNumber(userTotalStats.totalSell) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">交易行提成</div>
          <div class="stat-value commission">-¥{{ formatNumber(userTotalStats.totalCommission) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总利润</div>
          <div class="stat-value profit">¥{{ formatNumber(userTotalStats.totalProfit) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总交易数</div>
          <div class="stat-value">{{ userTotalStats.tradeCount }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">账户余额</div>
          <div class="stat-value balance">¥{{ formatNumber(userTotalStats.balance) }}</div>
        </div>
      </div>
    </div>

    <!-- 账号详细统计 -->
    <div class="accounts-section">
      <h3>账号详细统计</h3>
      <div v-if="allAccountsStats.length === 0" class="empty-state">
        暂无账号
      </div>
      <div v-else class="accounts-table">
        <div class="table-header">
          <div class="col-email">邮箱</div>
          <div class="col-buy">买入</div>
          <div class="col-sell">卖出</div>
          <div class="col-commission">提成</div>
          <div class="col-profit">利润</div>
          <div class="col-count">交易数</div>
          <div class="col-balance">余额</div>
        </div>
        <div v-for="account in allAccountsStats" :key="account.accountId" class="table-row">
          <div class="col-email">{{ account.accountEmail }}</div>
          <div class="col-buy">¥{{ formatNumber(account.totalBuy) }}</div>
          <div class="col-sell sell">¥{{ formatNumber(account.totalSell) }}</div>
          <div class="col-commission commission">-¥{{ formatNumber(account.totalCommission) }}</div>
          <div class="col-profit profit">¥{{ formatNumber(account.totalProfit) }}</div>
          <div class="col-count">{{ account.tradeCount }}</div>
          <div class="col-balance balance">¥{{ formatNumber(account.balance) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { formatNumber } from '@/constants/pet'

const statsStore = useStatsStore()

const userTotalStats = computed(() => statsStore.userTotalStats)
const allAccountsStats = computed(() => statsStore.allAccountsStats)
</script>

<style scoped>
.overview-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  margin-bottom: 8px;
}

.page-header h2 {
  font-size: 18px;
  margin: 0;
  color: var(--n-text-color-1);
}

.user-total-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-total-section h3 {
  font-size: 14px;
  margin: 0;
  color: var(--n-text-color-1);
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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
  font-size: 16px;
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

.stat-value.balance {
  color: #722ed1;
}

.accounts-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.accounts-section h3 {
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

.accounts-table {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 120px 80px 80px 80px 80px 60px 80px;
  gap: 0;
  background: var(--n-color-hover);
  border-bottom: 1px solid var(--n-border-color);
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.table-row {
  display: grid;
  grid-template-columns: 120px 80px 80px 80px 80px 60px 80px;
  gap: 0;
  padding: 8px;
  border-bottom: 1px solid var(--n-border-color);
  font-size: 12px;
  align-items: center;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--n-color-hover);
}

.col-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-buy,
.col-sell,
.col-commission,
.col-profit,
.col-count,
.col-balance {
  text-align: right;
}

.col-sell {
  color: #52c41a;
}

.col-commission {
  color: #ff4d4f;
}

.col-profit {
  color: #1890ff;
}

.col-balance {
  color: #722ed1;
  font-weight: 600;
}

@media (max-width: 768px) {
  .overview-container {
    padding: 8px;
    gap: 16px;
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
    font-size: 14px;
  }

  .table-header,
  .table-row {
    grid-template-columns: 80px 60px 60px 60px 60px 50px 60px;
    padding: 6px;
    font-size: 11px;
  }

  .col-email {
    font-size: 10px;
  }
}
</style>
