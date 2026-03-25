<template>
  <div class="diary-container">
    <div class="page-header">
      <h2>星球日记</h2>
      <div class="account-info">
        邮箱: <strong>{{ authStore.currentAccount?.gameEmail }}</strong>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="showNewDiaryDialog = true" class="btn-primary">✍️ 新建日记</button>
      <button @click="handleSync" :disabled="diaryStore.loading" class="btn-secondary">
        {{ diaryStore.loading ? '同步中...' : '☁️ 云同步' }}
      </button>
    </div>

    <!-- 日记列表 -->
    <div v-if="diaryStore.diaries.length === 0" class="empty-state">
      暂无日记，开始记录你的冒险吧！
    </div>

    <div v-else class="diary-table">
      <div class="diary-table-header">
        <span>标题</span>
        <span>事件类型</span>
        <span>所在星球</span>
        <span>操作</span>
      </div>
      <div v-for="diary in diaryStore.recentDiaries" :key="diary.id" class="diary-table-row">
        <span class="diary-title-cell">{{ diary.title }}</span>
        <span>
          <span :class="['diary-type-badge', diary.diaryType === 'shiny' ? 'shiny' : 'daily']">
            {{ diary.diaryType === 'shiny' ? '✨ 异色' : '📅 日常' }}
          </span>
        </span>
        <span class="diary-planet-cell">🌍 {{ diary.planet }}</span>
        <span class="diary-actions">
          <button @click="showDetail(diary)" class="btn-small btn-detail">详细</button>
          <button @click="editDiary(diary)" class="btn-small btn-edit">编辑</button>
          <button @click="deleteDiary(diary.id)" class="btn-small btn-delete">删除</button>
        </span>
      </div>
    </div>

    <!-- 详情对话框 -->
    <div v-if="detailDiary" class="modal-overlay" @click="detailDiary = null">
      <div class="modal-content" @click.stop>
        <h3>{{ detailDiary.title }}</h3>
        <div class="detail-meta">
          <span :class="['diary-type-badge', detailDiary.diaryType === 'shiny' ? 'shiny' : 'daily']">
            {{ detailDiary.diaryType === 'shiny' ? '✨ 异色' : '📅 日常' }}
          </span>
          <span>🌍 {{ detailDiary.planet }}</span>
          <span v-if="detailDiary.eventTime">⏰ {{ formatDate(detailDiary.eventTime) }}</span>
        </div>
        <div class="detail-content">{{ detailDiary.content || '（无内容）' }}</div>
        <div v-if="detailDiary.images.length > 0" class="diary-images">
          <img v-for="(img, idx) in detailDiary.images" :key="idx" :src="img" class="diary-image" />
        </div>
        <div class="modal-actions">
          <button @click="detailDiary = null" class="btn-confirm">关闭</button>
        </div>
      </div>
    </div>

    <!-- 新建/编辑日记对话框 -->
    <div v-if="showNewDiaryDialog" class="modal-overlay" @click="showNewDiaryDialog = false">
      <div class="modal-content" @click.stop>
        <h3>{{ editingDiary ? '编辑日记' : '新建日记' }}</h3>
        
        <div class="form-group">
          <label>日记标题 *</label>
          <input v-model="form.title" type="text" placeholder="输入日记标题" />
        </div>

        <div class="form-group">
          <label>事件类型 *</label>
          <div class="type-selector">
            <button
              type="button"
              :class="['type-btn', { active: form.diaryType === 'daily' }]"
              @click="form.diaryType = 'daily'"
            >📅 日常事件</button>
            <button
              type="button"
              :class="['type-btn', { active: form.diaryType === 'shiny' }]"
              @click="form.diaryType = 'shiny'"
            >✨ 异色事件</button>
          </div>
        </div>

        <div class="form-group">
          <label>所在星球 *</label>
          <input v-model="form.planet" type="text" placeholder="输入星球名称" />
        </div>

        <div class="form-group">
          <label>事件时间 *</label>
          <input v-model="form.eventTime" type="datetime-local" />
        </div>

        <div class="form-group">
          <label>日记内容 <span class="optional">（选填）</span></label>
          <textarea v-model="form.content" placeholder="输入日记内容（可选）" rows="6"></textarea>
        </div>

        <div class="form-group">
          <label>上传图片</label>
          <div class="image-upload">
            <input
              ref="fileInput"
              type="file"
              multiple
              accept="image/*"
              @change="handleImageUpload"
              style="display: none"
            />
            <button @click="fileInput?.click()" class="btn-upload">📷 选择图片</button>
            <div v-if="form.images.length > 0" class="image-preview">
              <div v-for="(img, idx) in form.images" :key="idx" class="preview-item">
                <img :src="img" />
                <button @click="removeImage(idx)" class="btn-remove">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="showNewDiaryDialog = false" class="btn-cancel">取消</button>
          <button @click="saveDiary" class="btn-confirm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import type { PlanetDiary } from '@/types'

const authStore = useAuthStore()
const diaryStore = useDiaryStore()
const route = useRoute()

const showNewDiaryDialog = ref(false)
const editingDiary = ref<PlanetDiary | null>(null)
const detailDiary = ref<PlanetDiary | null>(null)
const fileInput = ref<HTMLInputElement>()

const form = ref({
  title: '',
  planet: '',
  diaryType: 'daily' as 'shiny' | 'daily',
  content: '',
  images: [] as string[],
  eventTime: new Date().toISOString().slice(0, 16),
})

const formatDate = (date: string) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const handleImageUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return

  for (const file of files) {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        form.value.images.push(e.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }
}

const removeImage = (idx: number) => {
  form.value.images.splice(idx, 1)
}

const saveDiary = async () => {
  if (!form.value.title || !form.value.planet) {
    alert('请填写标题和星球')
    return
  }

  if (editingDiary.value) {
    await diaryStore.updateDiary(editingDiary.value.id, {
      title: form.value.title,
      planet: form.value.planet,
      diaryType: form.value.diaryType,
      content: form.value.content,
      images: form.value.images,
      eventTime: form.value.eventTime,
    })
  } else {
    await diaryStore.addDiary({
      title: form.value.title,
      planet: form.value.planet,
      diaryType: form.value.diaryType,
      content: form.value.content,
      images: form.value.images,
      eventTime: form.value.eventTime,
    })
  }

  resetForm()
  showNewDiaryDialog.value = false
}

const editDiary = (diary: PlanetDiary) => {
  editingDiary.value = diary
  form.value = {
    title: diary.title,
    planet: diary.planet,
    diaryType: diary.diaryType || 'daily',
    content: diary.content,
    images: [...diary.images],
    eventTime: diary.eventTime || new Date().toISOString().slice(0, 16),
  }
  showNewDiaryDialog.value = true
}

const deleteDiary = async (id: string) => {
  if (confirm('确定删除这篇日记吗？')) {
    await diaryStore.deleteDiary(id)
  }
}

const showDetail = (diary: PlanetDiary) => {
  detailDiary.value = diary
}

const resetForm = () => {
  form.value = {
    title: '',
    planet: '',
    diaryType: 'daily',
    content: '',
    images: [],
    eventTime: new Date().toISOString().slice(0, 16),
  }
  editingDiary.value = null
}

// 初始化
onMounted(async () => {
  // 确保账号已加载
  if (authStore.userAccounts.length === 0) {
    await authStore.loadUserAccounts()
  }
  await diaryStore.loadDiaries()
  await diaryStore.syncWithCloud()

  const focusId = route.query.focus as string | undefined
  if (focusId) {
    const target = diaryStore.diaries.find(d => d.id === focusId)
    if (target) {
      detailDiary.value = target
    }
  }
})

const handleSync = async () => {
  await diaryStore.syncWithCloud()
}
</script>

<style scoped>
.diary-container {
  max-width: 1200px;
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

.account-info {
  font-size: 12px;
  color: var(--n-text-color-2);
  margin-top: 4px;
}

.action-bar {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background: #667eea;
  border: none;
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  color: var(--n-text-color-1);
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--n-color-hover);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--n-text-color-2);
  font-size: 14px;
}

.diary-table {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.diary-table-header,
.diary-table-row {
  display: grid;
  grid-template-columns: 1.8fr 1fr 1fr 1.2fr;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
}

.diary-table-header {
  background: var(--n-color-hover);
  font-size: 12px;
  font-weight: 700;
  color: var(--n-text-color-2);
}

.diary-table-row {
  border-top: 1px solid var(--n-border-color);
  font-size: 13px;
}

.diary-table-row:hover {
  background: var(--n-color-hover);
}

.diary-title-cell {
  color: var(--n-text-color-1);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.diary-planet-cell {
  color: var(--n-text-color-2);
}

.diary-type-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.diary-type-badge.shiny {
  background: rgba(255, 215, 0, 0.15);
  color: #d4a400;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.diary-type-badge.daily {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.btn-detail {
  background: #667eea;
  color: white;
}

.btn-detail:hover {
  background: #5568d3;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--n-text-color-2);
}

.detail-content {
  font-size: 13px;
  color: var(--n-text-color-1);
  line-height: 1.6;
  margin-bottom: 12px;
  white-space: pre-wrap;
}

.type-selector {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color);
  color: var(--n-text-color-1);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  font-weight: 600;
}

.optional {
  font-size: 11px;
  color: var(--n-text-color-2);
  font-weight: normal;
}

.diary-images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.diary-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}

.diary-content {
  font-size: 13px;
  color: var(--n-text-color-1);
  line-height: 1.5;
}

.diary-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--n-border-color);
}

.diary-times {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diary-event-time {
  font-size: 12px;
  color: #667eea;
  font-weight: 600;
}

.diary-date {
  font-size: 11px;
  color: var(--n-text-color-2);
}

.diary-actions {
  display: flex;
  gap: 6px;
}

.btn-small {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit {
  background: #1890ff;
  color: white;
}

.btn-edit:hover {
  background: #0050b3;
}

.btn-delete {
  background: #ff4d4f;
  color: white;
}

.btn-delete:hover {
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--n-text-color-1);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.form-group input,
.form-group textarea {
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--n-color);
  color: var(--n-text-color-1);
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.image-upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-upload {
  padding: 8px 12px;
  border: 1px dashed var(--n-border-color);
  background: transparent;
  color: var(--n-text-color-1);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.image-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-item {
  position: relative;
  width: 80px;
  height: 80px;
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.btn-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border: none;
  background: #ff4d4f;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  background: #ff7875;
}
@media (max-width: 768px) {
  .diary-table-header,
  .diary-table-row {
    grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
    font-size: 12px;
  }
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
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
</style>
