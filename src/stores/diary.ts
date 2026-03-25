import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/db'
import { SyncService } from '@/services/sync'
import { useAuthStore } from './auth'
import type { PlanetDiary } from '@/types'

export const useDiaryStore = defineStore('diary', () => {
  const authStore = useAuthStore()
  const diaries = ref<PlanetDiary[]>([])
  const loading = ref(false)
  const lastSyncTime = ref<string | null>(null)

  // 加载日记（先从云端同步，再从本地读取）
  const loadDiaries = async () => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return

    const userId = authStore.currentUser.id
    const accountId = authStore.currentAccount.id

    try {
      // 先从云端拉取最新数据
      try {
        const remoteDiaries = await SyncService.fetchDiaries(userId, accountId)
        // 严格校验：只写入属于当前 userId + accountId 的数据
        for (const diary of remoteDiaries) {
          if (diary.userId === userId && diary.accountId === accountId) {
            await db.planetDiaries.put(diary)
          }
        }
      } catch (syncErr) {
        console.warn('云端拉取日记失败，使用本地缓存:', syncErr)
      }

      // 从本地读取（无论云端是否成功）
      const allDiaries = await db.planetDiaries.toArray()

      diaries.value = allDiaries
        .filter(d => d.userId === userId && d.accountId === accountId)
        .sort((a, b) => new Date(b.eventTime || b.updatedAt || b.createdAt).getTime() - new Date(a.eventTime || a.updatedAt || a.createdAt).getTime())
    } catch (error) {
      console.error('加载日记失败:', error)
    }
  }

  // 添加日记
  const addDiary = async (diary: Omit<PlanetDiary, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) {
      return { success: false, error: '未登录' }
    }

    try {
      const newDiary: PlanetDiary = {
        ...diary,
        id: `diary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: authStore.currentUser.id,
        accountId: authStore.currentAccount.id,
        images: Array.from(diary.images || []), // 确保是普通数组
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await db.planetDiaries.add(newDiary)
      diaries.value.unshift(newDiary)

      // 异步上传到云端
      SyncService.uploadDiary(newDiary)

      return { success: true }
    } catch (error) {
      console.error('添加日记失败:', error)
      return { success: false, error }
    }
  }

  // 更新日记
  const updateDiary = async (id: string, updates: Partial<PlanetDiary>) => {
    try {
      const diary = diaries.value.find(d => d.id === id)
      if (!diary) return { success: false, error: '日记不存在' }

      const updatedDiary = {
        ...diary,
        ...updates,
        images: Array.from(updates.images || diary.images || []), // 确保是普通数组
        updatedAt: new Date().toISOString(),
      }

      await db.planetDiaries.update(id, updatedDiary)
      const index = diaries.value.findIndex(d => d.id === id)
      if (index !== -1) {
        diaries.value[index] = updatedDiary
      }

      // 异步上传到云端
      SyncService.updateDiary(updatedDiary)

      return { success: true }
    } catch (error) {
      console.error('更新日记失败:', error)
      return { success: false, error }
    }
  }

  // 删除日记
  const deleteDiary = async (id: string) => {
    try {
      await db.planetDiaries.delete(id)
      diaries.value = diaries.value.filter(d => d.id !== id)

      // 云端删除
      SyncService.deleteDiary(id)

      return { success: true }
    } catch (error) {
      console.error('删除日记失败:', error)
      return { success: false, error }
    }
  }

  // 云同步
  const syncWithCloud = async () => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return { success: false }

    loading.value = true
    try {
      const userId = authStore.currentUser.id
      const accountId = authStore.currentAccount.id

      const remoteDiaries = await SyncService.fetchDiaries(userId, accountId, lastSyncTime.value || undefined)

      for (const remote of remoteDiaries) {
        // 严格校验，只写入属于当前账号的数据
        if (remote.userId !== userId || remote.accountId !== accountId) continue
        const local = diaries.value.find(d => d.id === remote.id)
        if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
          await db.planetDiaries.put(remote)
        }
      }

      await loadDiaries()
      lastSyncTime.value = new Date().toISOString()
      return { success: true }
    } catch (error) {
      console.error('日记云同步失败:', error)
      return { success: false, error }
    } finally {
      loading.value = false
    }
  }

  // 按星球分组
  const diariesByPlanet = computed(() => {
    const grouped: Record<string, PlanetDiary[]> = {}
    diaries.value.forEach(diary => {
      if (!grouped[diary.planet]) {
        grouped[diary.planet] = []
      }
      grouped[diary.planet].push(diary)
    })
    return grouped
  })

  // 最近的日记
  const recentDiaries = computed(() => {
    return [...diaries.value].sort((a, b) =>
      new Date(b.eventTime || b.updatedAt || b.createdAt).getTime() - new Date(a.eventTime || a.updatedAt || a.createdAt).getTime()
    ).slice(0, 20)
  })

  return {
    diaries,
    loading,
    loadDiaries,
    addDiary,
    updateDiary,
    deleteDiary,
    syncWithCloud,
    diariesByPlanet,
    recentDiaries,
  }
})
