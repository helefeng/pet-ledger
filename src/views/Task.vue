<template>
  <div class="task-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>日常任务</h2>
      </div>
      <div class="header-actions">
        <button @click="showAddDialog = true" class="btn-primary">➕ 新增任务</button>
      </div>
    </div>

    <!-- 账号任务看板 -->
    <div v-if="taskStore.templates.length > 0" class="accounts-board">
      <div class="section-header-row" @click="accountBoardExpanded = !accountBoardExpanded">
        <div class="section-title">今日账号任务看板</div>
        <span class="expand-arrow" :class="{ expanded: accountBoardExpanded }">▾</span>
      </div>
      <div v-if="accountBoardExpanded">
        <div v-if="authStore.userAccounts.length === 0" class="empty-tip">暂无账号</div>
        <div v-else class="account-cards">
          <div v-for="account in authStore.userAccounts" :key="account.id" class="account-card">
            <div class="account-card-header">
              <span class="account-email">{{ account.gameEmail }}</span>
            </div>
            <div class="progress-row">
              <span class="account-progress">
                {{ getAccountProgress(account.id).completed }}/{{ getAccountProgress(account.id).total }}
              </span>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: getProgressPercent(account.id) + '%' }"></div>
                <span
                  v-for="n in Math.max(taskStore.templates.length - 1, 0)"
                  :key="`seg-${account.id}-${n}`"
                  class="progress-segment"
                  :style="{ left: `${(n * 100) / Math.max(taskStore.templates.length, 1)}%` }"
                ></span>
              </div>
            </div>
            <div class="task-checklist">
              <div
                v-for="task in taskStore.templates"
                :key="task.id"
                class="check-item"
                :class="{ done: isAccountTaskDone(account.id, task.id) }"
                @click="toggleAccountTask(account.id, task.id)"
              >
                <span class="check-icon">{{ isAccountTaskDone(account.id, task.id) ? '✅' : '⬜' }}</span>
                <span class="check-label">{{ task.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务模板管理 -->
    <div class="template-section">
      <div class="section-header-row" @click="templateExpanded = !templateExpanded">
        <div class="section-title">任务模板 ({{ taskStore.templates.length }})</div>
        <span class="expand-arrow" :class="{ expanded: templateExpanded }">▾</span>
      </div>
      <div v-if="templateExpanded">
        <div v-if="taskStore.templates.length === 0" class="empty-tip">暂无任务，点击「新增任务」添加</div>
        <div v-else class="template-list">
          <div v-for="task in taskStore.templates" :key="task.id" class="template-item">
            <span :class="['cat-badge', task.category]">{{ task.category === 'permanent' ? '常驻' : '限时' }}</span>
            <span class="template-title">{{ task.title }}</span>
            <span v-if="task.expireAt" class="expire-date">截止 {{ task.expireAt }}</span>
            <div class="template-actions">
              <button @click="editTask(task)" class="btn-sm btn-edit">编辑</button>
              <button @click="deleteTask(task.id)" class="btn-sm btn-delete">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <div v-if="showAddDialog" class="modal-overlay" @click="closeDialog">
      <div class="modal-content" @click.stop>
        <h3>{{ editingTask ? '编辑任务' : '新增任务' }}</h3>
        <div class="form-group">
          <label>任务名称 *</label>
          <input v-model="form.title" type="text" placeholder="输入任务名称" />
        </div>
        <div class="form-group">
          <label>任务类型 *</label>
          <div class="type-selector">
            <button type="button" :class="['type-btn', { active: form.category === 'permanent' }]" @click="form.category = 'permanent'">📌 常驻</button>
            <button type="button" :class="['type-btn', { active: form.category === 'limited' }]" @click="form.category = 'limited'">⏰ 限时</button>
          </div>
        </div>
        <div v-if="form.category === 'limited'" class="form-group">
          <label>截止日期 <span class="optional">（选填）</span></label>
          <input v-model="form.expireAt" type="date" />
        </div>
        <div class="modal-actions">
          <button @click="closeDialog" class="btn-cancel">取消</button>
          <button @click="saveTask" class="btn-confirm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { db } from '@/services/db'
import type { TaskTemplate, TaskRecord, TaskCategory } from '@/types'

const authStore = useAuthStore()
const taskStore = useTaskStore()

const showAddDialog = ref(false)
const editingTask = ref<TaskTemplate | null>(null)
const allRecords = ref<TaskRecord[]>([])
const accountBoardExpanded = ref(true)
const templateExpanded = ref(true)

const form = ref({
  title: '',
  category: 'permanent' as TaskCategory,
  expireAt: '',
})

const loadAllRecords = async () => {
  if (!authStore.currentUser?.id) return
  const today = new Date().toISOString().split('T')[0]
  const all = await db.taskRecords.toArray()
  allRecords.value = all.filter(r =>
    r.userId === authStore.currentUser!.id && r.date === today
  )
}

const isAccountTaskDone = (accountId: string, taskId: string) =>
  allRecords.value.some(r => r.accountId === accountId && r.taskId === taskId && r.completed)

const toggleAccountTask = async (accountId: string, taskId: string) => {
  if (!authStore.currentUser?.id) return
  const today = new Date().toISOString().split('T')[0]
  const existing = allRecords.value.find(r =>
    r.accountId === accountId && r.taskId === taskId && r.date === today
  )
  if (existing) {
    const updated = {
      completed: !existing.completed,
      completedAt: !existing.completed ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    }
    await db.taskRecords.update(existing.id, updated)
    const idx = allRecords.value.findIndex(r => r.id === existing.id)
    if (idx !== -1) allRecords.value[idx] = { ...existing, ...updated }
  } else {
    const newRecord: TaskRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: authStore.currentUser!.id,
      accountId,
      taskId,
      completed: true,
      completedAt: new Date().toISOString(),
      date: today,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.taskRecords.add(newRecord)
    allRecords.value.push(newRecord)
  }
}

const getAccountProgress = (accountId: string) => {
  const today = new Date().toISOString().split('T')[0]
  const total = taskStore.templates.length
  const completed = allRecords.value.filter(r =>
    r.accountId === accountId && r.completed && r.date === today
  ).length
  return { total, completed }
}

const getProgressPercent = (accountId: string) => {
  const { total, completed } = getAccountProgress(accountId)
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

const closeDialog = () => {
  showAddDialog.value = false
  editingTask.value = null
  form.value = { title: '', category: 'permanent', expireAt: '' }
}

const editTask = (task: TaskTemplate) => {
  editingTask.value = task
  form.value = { title: task.title, category: task.category, expireAt: task.expireAt || '' }
  showAddDialog.value = true
}

const saveTask = async () => {
  if (!form.value.title.trim()) { alert('请输入任务名称'); return }
  if (editingTask.value) {
    await taskStore.updateTemplate(editingTask.value.id, {
      title: form.value.title.trim(),
      category: form.value.category,
      expireAt: form.value.expireAt || undefined,
    })
  } else {
    await taskStore.addTemplate(form.value.title.trim(), form.value.category, form.value.expireAt || undefined)
  }
  closeDialog()
}

const deleteTask = async (id: string) => {
  if (confirm('确定删除这个任务？')) await taskStore.deleteTemplate(id)
}

onMounted(async () => {
  await taskStore.loadTemplates()
  await loadAllRecords()
})
</script>

<style scoped>
.task-container {
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
.header-left h2 { font-size: 18px; margin: 0; color: var(--n-text-color-1); }
.header-actions { display: flex; gap: 8px; }
.btn-primary {
  background: #667eea; border: none; color: white;
  padding: 8px 14px; border-radius: 6px; font-size: 13px;
  font-weight: 600; cursor: pointer;
}
.btn-primary:hover { background: #5568d3; }
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  margin-bottom: 10px;
}
.section-title {
  font-size: 12px; font-weight: 700; color: var(--n-text-color-2);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.expand-arrow {
  font-size: 12px;
  color: var(--n-text-color-2);
  transition: transform 0.2s;
}
.expand-arrow.expanded {
  transform: rotate(180deg);
}
.template-section, .accounts-board {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 14px;
}
.empty-tip { font-size: 13px; color: var(--n-text-color-2); text-align: center; padding: 12px; }
.template-list { display: flex; flex-direction: column; gap: 6px; }
.template-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: 4px;
  background: var(--n-color-hover); font-size: 13px;
}
.cat-badge {
  font-size: 11px; font-weight: 700; padding: 2px 6px;
  border-radius: 8px; white-space: nowrap;
}
.cat-badge.permanent { background: rgba(102,126,234,0.1); color: #667eea; border: 1px solid rgba(102,126,234,0.3); }
.cat-badge.limited { background: rgba(255,165,0,0.1); color: #fa8c16; border: 1px solid rgba(255,165,0,0.3); }
.template-title { flex: 1; color: var(--n-text-color-1); }
.expire-date { font-size: 11px; color: #fa8c16; }
.template-actions { display: flex; gap: 4px; }
.account-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-items: stretch;
}
.account-card {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}
.account-card-header { display: flex; justify-content: space-between; align-items: center; }
.account-email { font-size: 13px; font-weight: 600; color: var(--n-text-color-1); }

.progress-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: 8px;
}

.account-progress {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
  text-align: left;
}

.progress-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--n-border-color);
}

.progress-fill {
  position: relative;
  z-index: 1;
  height: 100%;
  background: linear-gradient(90deg, #667eea, #52c41a);
  border-radius: 999px;
  transition: width 0.3s;
}

.progress-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.65);
  z-index: 2;
  pointer-events: none;
}
.task-checklist { display: flex; flex-direction: column; gap: 4px; }
.check-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 4px; border-radius: 4px;
  cursor: pointer; font-size: 13px; transition: background 0.15s;
}
.check-item:hover { background: var(--n-color-hover); }
.check-item.done .check-label { text-decoration: line-through; color: var(--n-text-color-2); }
.check-icon { font-size: 16px; flex-shrink: 0; }
.check-label { color: var(--n-text-color-1); }
.btn-sm { padding: 3px 8px; border: none; border-radius: 3px; font-size: 12px; cursor: pointer; }
.btn-edit { background: #1890ff; color: white; }
.btn-edit:hover { background: #0050b3; }
.btn-delete { background: #ff4d4f; color: white; }
.btn-delete:hover { background: #ff7875; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-content {
  background: var(--n-color); border-radius: 8px;
  padding: 20px; width: 90%; max-width: 400px;
}
.modal-content h3 { margin: 0 0 16px 0; font-size: 14px; color: var(--n-text-color-1); }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.form-group label { font-size: 12px; font-weight: 600; color: var(--n-text-color-1); }
.form-group input {
  padding: 8px 10px; border: 1px solid var(--n-border-color);
  border-radius: 4px; font-size: 13px;
  background: var(--n-color); color: var(--n-text-color-1);
}
.form-group input:focus { outline: none; border-color: #667eea; }
.type-selector { display: flex; gap: 8px; }
.type-btn {
  flex: 1; padding: 8px; border: 1px solid var(--n-border-color);
  background: var(--n-color); color: var(--n-text-color-1);
  border-radius: 4px; font-size: 13px; cursor: pointer;
}
.type-btn.active { border-color: #667eea; background: rgba(102,126,234,0.1); color: #667eea; font-weight: 600; }
.optional { font-size: 11px; color: var(--n-text-color-2); font-weight: normal; }
.modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.btn-cancel, .btn-confirm { padding: 8px; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-cancel { background: var(--n-color); border: 1px solid var(--n-border-color); color: var(--n-text-color-1); }
.btn-cancel:hover { background: var(--n-color-hover); }
.btn-confirm { background: #667eea; color: white; }
.btn-confirm:hover { background: #5568d3; }
</style>
