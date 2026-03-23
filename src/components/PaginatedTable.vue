<template>
  <div class="paginated-table">
    <div class="table-wrapper">
      <table class="data-table">
        <colgroup>
          <col v-for="(col, index) in columns" :key="index" :style="{ width: col.width }">
        </colgroup>
        <thead>
          <tr>
            <th v-for="(col, index) in columns" :key="index">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in paginatedData" :key="row.id" :class="row.rowClass">
            <td v-for="(col, index) in columns" :key="index" :class="col.cellClass">
              <slot :name="`cell-${col.key}`" :row="row" :col="col">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-page">◀</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-page">▶</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Column {
  key: string
  label: string
  width: string
  cellClass?: string
}

interface Props {
  data: any[]
  columns: Column[]
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 5,
})

const currentPage = ref(1)

const totalPages = computed(() => Math.ceil(props.data.length / props.pageSize))

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize
  return props.data.slice(start, start + props.pageSize)
})
</script>

<style scoped>
.paginated-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-wrapper {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
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
}

.data-table th {
  padding: 12px 8px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-1);
  border-right: 1px solid var(--n-border-color);
  word-break: break-word;
}

.data-table th:last-child {
  border-right: none;
}

.data-table td {
  padding: 12px 8px;
  font-size: 13px;
  color: var(--n-text-color-1);
  border-right: 1px solid var(--n-border-color);
  border-bottom: 1px solid var(--n-border-color);
  word-break: break-word;
  overflow-wrap: break-word;
}

.data-table td:last-child {
  border-right: none;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--n-color-hover);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
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
</style>
