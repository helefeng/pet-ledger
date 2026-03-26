<template>
  <n-config-provider :theme="theme">
    <div v-if="authStore.isLoggedIn" class="app-container">
      <n-layout has-sider>
        <!-- 侧边栏 -->
        <n-layout-sider
          v-if="!isMobile"
          collapse-mode="width"
          :collapsed-width="64"
          :width="200"
          :collapsed="sidebarCollapsed"
          show-trigger="bar"
          @collapse="sidebarCollapsed = true"
          @expand="sidebarCollapsed = false"
        >
          <div class="sidebar-header">
            <h1 v-if="!sidebarCollapsed">🎮 铁皮交易记录</h1>
            <span v-else>🎮</span>
          </div>
          <n-menu
            :value="activeMenu"
            :options="menuOptions"
            :expanded-keys="expandedKeys"
            @update:expanded-keys="handleExpandedKeys"
            @update:value="handleMenuSelect"
          />
          <div class="sidebar-footer">
            <n-button text type="error" size="small" @click="handleLogout" class="logout-btn">
              <template #icon>
                <n-icon><LogoutIcon /></n-icon>
              </template>
              <span v-if="!sidebarCollapsed">登出</span>
            </n-button>
          </div>
        </n-layout-sider>

        <!-- 主内容区 -->
        <n-layout>
          <!-- 顶部导航 -->
          <n-layout-header class="header">
            <div class="header-content">
              <div class="header-left">
                <h1 v-if="isMobile">🎮 铁皮交易记录</h1>
              </div>
              <div class="header-center" v-if="authStore.userAccounts.length > 1">
                <select
                  :value="authStore.currentAccount?.id"
                  @change="handleAccountSwitch"
                  class="header-account-select"
                >
                  <option v-for="acc in authStore.userAccounts" :key="acc.id" :value="acc.id">
                    {{ acc.gameEmail }}
                  </option>
                </select>
              </div>
              <div v-else-if="authStore.currentAccount" class="header-account-name">
                {{ authStore.currentAccount.gameEmail }}
              </div>
              <div class="header-right">
                <n-button
                  v-if="isMobile"
                  text
                  type="primary"
                  @click="showMobileMenu = !showMobileMenu"
                >
                  <template #icon>
                    <n-icon><MenuIcon /></n-icon>
                  </template>
                </n-button>
                <n-button text type="primary" @click="toggleTheme">
                  <template #icon>
                    <n-icon>
                      <component :is="theme === 'light' ? MoonIcon : SunIcon" />
                    </n-icon>
                  </template>
                </n-button>
                <n-button v-if="isMobile" text type="error" @click="handleLogout">
                  <template #icon>
                    <n-icon><LogoutIcon /></n-icon>
                  </template>
                </n-button>
              </div>
            </div>
          </n-layout-header>

          <!-- 移动端菜单 -->
          <n-drawer
            v-model:show="showMobileMenu"
            :width="200"
            placement="left"
            :show-mask="true"
          >
            <n-menu
              :value="activeMenu"
              :options="menuOptions"
              :expanded-keys="expandedKeys"
              @update:expanded-keys="handleExpandedKeys"
              @update:value="handleMenuSelect"
            />
          </n-drawer>

          <!-- 页面内容 -->
          <n-layout-content class="content">
            <router-view v-slot="{ Component }">
              <component :is="Component" />
            </router-view>
          </n-layout-content>
        </n-layout>
      </n-layout>
    </div>
    <div v-else>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { useDiaryStore } from '@/stores/diary'
import { NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu, NButton, NIcon, NDrawer } from 'naive-ui'
import { Menu as MenuIcon, Moon as MoonIcon, Sun as SunIcon, Logout as LogoutIcon } from '@vicons/carbon'
import type { MenuOption } from 'naive-ui'

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()
const diaryStore = useDiaryStore()

const theme = ref<'light' | 'dark'>('light')
const sidebarCollapsed = ref(false)
const showMobileMenu = ref(false)
const isMobile = ref(false)
const expandedKeys = ref<string[]>(['account-group'])

const activeMenu = computed(() => {
  const path = router.currentRoute.value.path
  if (path === '/') return 'home'
  if (path === '/account') return 'account-home'
  if (path === '/account/add') return 'account-add'
  if (path === '/account/diary') return 'account-diary'
  if (path === '/account/task') return 'account-task'
  if (path === '/account/calendar') return 'account-calendar'
  if (path === '/settings') return 'settings'
  return 'home'
})

const menuOptions: MenuOption[] = [
  {
    label: '首页',
    key: 'home',
    icon: () => '📊',
  },
  {
    label: '账号中心',
    key: 'account-group',
    icon: () => '👤',
    children: [
      { label: '账号总览', key: 'account-home' },
      { label: '添加交易', key: 'account-add' },
      { label: '星球日记', key: 'account-diary' },
      { label: '日常任务', key: 'account-task' },
      { label: '日历页', key: 'account-calendar' },
    ],
  },
  {
    label: '设置',
    key: 'settings',
    icon: () => '⚙️',
  },
]

const handleMenuSelect = (key: string) => {
  showMobileMenu.value = false
  const routes: Record<string, string> = {
    home: '/',
    'account-home': '/account',
    'account-add': '/account/add',
    'account-diary': '/account/diary',
    'account-task': '/account/task',
    'account-calendar': '/account/calendar',
    settings: '/settings',
  }

  const target = routes[key]
  if (target) {
    router.push(target)
  }
}

const handleExpandedKeys = (keys: string[]) => {
  expandedKeys.value = keys
}

const handleAccountSwitch = (e: Event) => {
  const id = (e.target as HTMLSelectElement).value
  authStore.switchAccount(id)
  ledgerStore.loadTrades()
}

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

const handleLogout = () => {
  if (confirm('确定要登出吗？')) {
    authStore.logout()
    router.push('/login')
  }
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(async () => {
  await authStore.restoreSession()
  await ledgerStore.initialize()
  if (authStore.currentUser?.id && authStore.currentAccount?.id) {
    await diaryStore.loadDiaries()
  }
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
}

.sidebar-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid var(--n-border-color);
  font-size: 14px;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 16px;
}

.sidebar-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  border-top: 1px solid var(--n-border-color);
  display: flex;
  justify-content: center;
}

.logout-btn {
  width: 100%;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--n-border-color);
  height: 56px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.header-left h1 {
  margin: 0;
  font-size: 18px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-account-select {
  padding: 5px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  background: var(--n-color);
  color: var(--n-text-color-1);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  max-width: 220px;
}

.header-account-name {
  flex: 1;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color-2);
}

.header-right {
  display: flex;
  gap: 8px;
}

.content {
  padding: 0;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }

  .header {
    height: 48px;
    padding: 0 12px;
  }

  .content {
    padding: 0;
  }
}
</style>
