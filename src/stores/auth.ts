import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, GameAccount } from '@/types'
import { db } from '@/services/db'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const currentAccount = ref<GameAccount | null>(null)
  const userAccounts = ref<GameAccount[]>([])
  const loading = ref(false)

  // 检查是否已登录
  const isLoggedIn = computed(() => !!currentUser.value)

  // 注册
  const register = async (username: string, password: string) => {
    loading.value = true
    try {
      // 检查用户是否已存在
      const allUsers = await db.users.toArray()
      const existing = allUsers.find(u => u.username === username)
      if (existing) {
        throw new Error('用户名已存在')
      }

      const user: User = {
        id: `user_${Date.now()}_${Math.random()}`,
        username,
        password,
        createdAt: new Date().toISOString(),
      }

      await db.users.add(user)
      currentUser.value = user
      
      // 保存到 localStorage
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
      
      // 保存到 localStorage
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
  }

  // 加载用户的所有账号
  const loadUserAccounts = async () => {
    if (!currentUser.value) return

    try {
      const allAccounts = await db.gameAccounts.toArray()
      const accounts = allAccounts.filter(a => a.userId === currentUser.value!.id)
      userAccounts.value = accounts

      // 选择第一个账号（不自动创建）
      if (accounts.length > 0 && !currentAccount.value) {
        currentAccount.value = accounts[0]
      }
    } catch (error) {
      console.error('加载账号失败:', error)
    }
  }

  // 创建新账号
  const createAccount = async (accountName: string, gameEmail: string) => {
    if (!currentUser.value) return

    try {
      const account: GameAccount = {
        id: `account_${Date.now()}_${Math.random()}`,
        userId: currentUser.value.id,
        accountName,
        gameEmail,
        createdAt: new Date().toISOString(),
      }

      await db.gameAccounts.add(account)
      userAccounts.value.push(account)
      currentAccount.value = account
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

  // 切换账号
  const switchAccount = (accountId: string) => {
    const account = userAccounts.value.find((a) => a.id === accountId)
    if (account) {
      currentAccount.value = account
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
    switchAccount,
    restoreSession,
  }
})
