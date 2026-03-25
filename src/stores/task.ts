import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/db'
import { useAuthStore } from './auth'
import type { TaskTemplate, TaskRecord, TaskCategory } from '@/types'

export const useTaskStore = defineStore('task', () => {
  const authStore = useAuthStore()
  const templates = ref<TaskTemplate[]>([])
  const records = ref<TaskRecord[]>([])
  const loading = ref(false)

  const today = () => new Date().toISOString().split('T')[0]

  // 加载任务模板（当前用户）
  const loadTemplates = async () => {
    if (!authStore.currentUser?.id) return
    try {
      const all = await db.taskTemplates.toArray()
      templates.value = all
        .filter(t => t.userId === authStore.currentUser!.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } catch (error) {
      console.error('加载任务模板失败:', error)
    }
  }

  // 加载今日任务记录（当前账号）
  const loadTodayRecords = async () => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return
    try {
      const all = await db.taskRecords.toArray()
      records.value = all.filter(r =>
        r.userId === authStore.currentUser!.id &&
        r.accountId === authStore.currentAccount!.id &&
        r.date === today()
      )
    } catch (error) {
      console.error('加载任务记录失败:', error)
    }
  }

  // 添加任务模板
  const addTemplate = async (title: string, category: TaskCategory, expireAt?: string) => {
    if (!authStore.currentUser?.id) return { success: false }
    try {
      const template: TaskTemplate = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: authStore.currentUser.id,
        title,
        category,
        expireAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await db.taskTemplates.add(template)
      templates.value.push(template)
      return { success: true, template }
    } catch (error) {
      console.error('添加任务失败:', error)
      return { success: false, error }
    }
  }

  // 编辑任务模板
  const updateTemplate = async (id: string, updates: Partial<TaskTemplate>) => {
    try {
      const updated = { ...updates, updatedAt: new Date().toISOString() }
      await db.taskTemplates.update(id, updated)
      const idx = templates.value.findIndex(t => t.id === id)
      if (idx !== -1) templates.value[idx] = { ...templates.value[idx], ...updated }
      return { success: true }
    } catch (error) {
      console.error('更新任务失败:', error)
      return { success: false, error }
    }
  }

  // 删除任务模板（同时删除相关记录）
  const deleteTemplate = async (id: string) => {
    try {
      await db.taskTemplates.delete(id)
      const relatedRecords = await db.taskRecords.where('taskId').equals(id).toArray()
      for (const r of relatedRecords) await db.taskRecords.delete(r.id)
      templates.value = templates.value.filter(t => t.id !== id)
      records.value = records.value.filter(r => r.taskId !== id)
      return { success: true }
    } catch (error) {
      console.error('删除任务失败:', error)
      return { success: false, error }
    }
  }

  // 切换任务完成状态
  const toggleRecord = async (taskId: string) => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return
    try {
      const existing = records.value.find(r => r.taskId === taskId && r.date === today())
      if (existing) {
        const updated = {
          completed: !existing.completed,
          completedAt: !existing.completed ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        }
        await db.taskRecords.update(existing.id, updated)
        const idx = records.value.findIndex(r => r.id === existing.id)
        if (idx !== -1) records.value[idx] = { ...existing, ...updated }
      } else {
        const newRecord: TaskRecord = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: authStore.currentUser.id,
          accountId: authStore.currentAccount.id,
          taskId,
          completed: true,
          completedAt: new Date().toISOString(),
          date: today(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await db.taskRecords.add(newRecord)
        records.value.push(newRecord)
      }
    } catch (error) {
      console.error('切换任务状态失败:', error)
    }
  }

  // 一键发布：为当前用户的所有账号生成今日任务记录
  const publishToAllAccounts = async () => {
    if (!authStore.currentUser?.id) return { success: false }
    try {
      const accounts = authStore.userAccounts
      const allRecords = await db.taskRecords.toArray()
      let count = 0

      for (const account of accounts) {
        for (const template of templates.value) {
          const exists = allRecords.find(r =>
            r.accountId === account.id &&
            r.taskId === template.id &&
            r.date === today()
          )
          if (!exists) {
            const newRecord: TaskRecord = {
              id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${account.id}`,
              userId: authStore.currentUser!.id,
              accountId: account.id,
              taskId: template.id,
              completed: false,
              date: today(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            await db.taskRecords.add(newRecord)
            count++
          }
        }
      }
      await loadTodayRecords()
      return { success: true, count }
    } catch (error) {
      console.error('发布任务失败:', error)
      return { success: false, error }
    }
  }

  // 今日任务完成情况
  const todayProgress = computed(() => {
    const total = templates.value.length
    const completed = records.value.filter(r => r.completed && r.date === today()).length
    return { total, completed }
  })

  // 判断某任务今日是否已完成
  const isCompleted = (taskId: string) => {
    return records.value.some(r => r.taskId === taskId && r.completed && r.date === today())
  }

  return {
    templates,
    records,
    loading,
    loadTemplates,
    loadTodayRecords,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleRecord,
    publishToAllAccounts,
    todayProgress,
    isCompleted,
  }
})
