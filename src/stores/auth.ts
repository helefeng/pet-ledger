import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, GameAccount } from '@/types'
import { db } from '@/services/db'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const currentAccount = ref<GameAccount | null>(null)
  const userAccounts = ref<GameAccount[]>([])
  const loading = ref(false)

  const isLoggedIn = computed(() => !!currentUser.value)

  // 注册
  const register = async (username: string, password: string) => {
    loading.value = true
    try {
      const allUsers = await db.users.toArray()
      const existing = allUsers.find(u => u.username === username)
      if (existing) {
        throw new Error('用户名已存在')
      }

      const user: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username,
        password,
        createdAt: new Date().toISOString(),
      }

      await db.users.add(user)
      currentUser.value = user
      localStorage.setItem('currentUser', JSON.stringify(user))
      return { success: true }
    } catch (error) {
      console.error('注册失败:', error)
      return { success: false, error: (error as Error).message }
    } finally {
      loading.value = false
    }
  }

  // 登录
  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const allUsers = await db.users.toArray()
      const user = allUsers.find(u => u.username === username)
      if (!user || user.password !== password) {
        throw new Error('用户名或密码错误')
      }

      currentUser.value = user
      localStorage.setItem('currentUser', JSON.stringify(user))
      await loadUserAccounts()
      return { success: true }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: (error as Error).message }
    } finally {
      loading.value = false
    }
  }

  // 登出
  const logout = () => {
    currentUser.value = null
    currentAccount.value = null
    userAccounts.value = []
    localStorage.removeItem('currentUser')
    localStorage.removeItem('currentAccountId')
  }

  // 加载用户的所有账号
  const loadUserAccounts = async () => {
    if (!currentUser.value) return

    try {
      const allAccounts = await db.gameAccounts.toArray()
      // 去重：同一 userId 下相同 id 只保留一条
      const seen = new Set<string>()
      const accounts = allAccounts.filter(a => {
        if (a.userId !== currentUser.value!.id) return false
        if (seen.has(a.id)) return false
        seen.add(a.id)
        return true
      })
      userAccounts.value = accounts

      if (accounts.length > 0) {
        const savedAccountId = localStorage.getItem('currentAccountId')
        const matched = savedAccountId
          ? accounts.find(a => a.id === savedAccountId)
          : null
        // 优先用持久化的账号，其次保持当前，最后才 fallback 到第一个
        const resolved = matched || (currentAccount.value?.userId === currentUser.value!.id ? currentAccount.value : null) || accounts[0]
        currentAccount.value = resolved
        // 确保 localStorage 始终和实际账号同步
        if (resolved) {
          localStorage.setItem('currentAccountId', resolved.id)
        }
      } else {
        currentAccount.value = null
        localStorage.removeItem('currentAccountId')
      }
    } catch (error) {
      console.error('加载账号失败:', error)
    }
  }

  // 创建新账号
  const createAccount = async (accountName: string, gameEmail: string) => {
    if (!currentUser.value) return { success: false, error: '未登录' }

    try {
      // 检查本地是否已有相同邮箱（只检查当前用户）
      const allAccounts = await db.gameAccounts.toArray()
      const existingLocal = allAccounts.find(a => a.gameEmail === gameEmail && a.userId === currentUser.value!.id)
      if (existingLocal) {
        return { success: false, error: '该游戏邮箱已被使用' }
      }

      const account: GameAccount = {
        id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: currentUser.value.id,
        accountName,
        gameEmail,
        createdAt: new Date().toISOString(),
      }

      await db.gameAccounts.add(account)

      userAccounts.value.push(account)
      currentAccount.value = account
      localStorage.setItem('currentAccountId', account.id)
      return { success: true }
    } catch (error) {
      console.error('创建账号失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 删除账号
  const deleteAccount = async (accountId: string) => {
    try {
      await db.gameAccounts.delete(accountId)
      userAccounts.value = userAccounts.value.filter((a) => a.id !== accountId)

      if (currentAccount.value?.id === accountId) {
        currentAccount.value = userAccounts.value[0] || null
      }
      return { success: true }
    } catch (error) {
      console.error('删除账号失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 删除当前用户的所有账号
  const deleteAllAccounts = async () => {
    if (!currentUser.value) return { success: false, error: '未登录' }
    try {
      const allAccounts = await db.gameAccounts.toArray()
      const myAccounts = allAccounts.filter(a => a.userId === currentUser.value!.id)

      for (const account of myAccounts) {
        await db.gameAccounts.delete(account.id)
      }
      userAccounts.value = []
      currentAccount.value = null
      return { success: true }
    } catch (error) {
      console.error('删除所有账号失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 切换账号
  const switchAccount = (accountId: string) => {
    const account = userAccounts.value.find((a) => a.id === accountId)
    if (account) {
      currentAccount.value = account
      localStorage.setItem('currentAccountId', account.id)
    }
  }

  // 恢复登录状态
  const restoreSession = async () => {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as User
        currentUser.value = user
        await loadUserAccounts()
      } catch (error) {
        console.error('恢复登录状态失败:', error)
        localStorage.removeItem('currentUser')
      }
    }
  }

  return {
    currentUser,
    currentAccount,
    userAccounts,
    loading,
    isLoggedIn,
    register,
    login,
    logout,
    loadUserAccounts,
    createAccount,
    deleteAccount,
    deleteAllAccounts,
    switchAccount,
    restoreSession,
  }
})
