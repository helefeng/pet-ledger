import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/db'
import { useAuthStore } from './auth'
import type { PlanetDiary } from '@/types'

export const useDiaryStore = defineStore('diary', () => {
  const authStore = useAuthStore()
  const diaries = ref<PlanetDiary[]>([])
  const loading = ref(false)

  // 加载日记（本地）
  const loadDiaries = async () => {
    if (!authStore.currentUser?.id || !authStore.currentAccount?.id) return

    const userId = authStore.currentUser.id
    const accountId = authStore.currentAccount.id

    try {
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

      return { success: true }
    } catch (error) {
      console.error('删除日记失败:', error)
      return { success: false, error }
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
    diariesByPlanet,
    recentDiaries,
  }
})
