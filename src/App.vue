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
            <h1 v-if="!sidebarCollapsed">🎮 交易平台</h1>
            <span v-else>🎮</span>
          </div>
          <n-menu
            :value="activeMenu"
            :options="menuOptions"
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
                <h1 v-if="isMobile">🎮 交易平台</h1>
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
import { NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu, NButton, NIcon, NDrawer } from 'naive-ui'
import { Menu as MenuIcon, Moon as MoonIcon, Sun as SunIcon, Logout as LogoutIcon } from '@vicons/carbon'
import type { MenuOption } from 'naive-ui'

const router = useRouter()
const authStore = useAuthStore()
const ledgerStore = useLedgerStore()

const theme = ref<'light' | 'dark'>('light')
const sidebarCollapsed = ref(false)
const showMobileMenu = ref(false)
const isMobile = ref(false)

const activeMenu = computed(() => {
  const path = router.currentRoute.value.path
  if (path === '/') return 'home'
  if (path === '/overview') return 'overview'
  if (path === '/add') return 'add'
  if (path === '/stats') return 'stats'
  if (path === '/diary') return 'diary'
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
    label: '总收益',
    key: 'overview',
    icon: () => '💰',
  },
  {
    label: '添加交易',
    key: 'add',
    icon: () => '➕',
  },
  {
    label: '统计分析',
    key: 'stats',
    icon: () => '📈',
  },
  {
    label: '星球日记',
    key: 'diary',
    icon: () => '📔',
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
    overview: '/overview',
    add: '/add',
    stats: '/stats',
    diary: '/diary',
    settings: '/settings',
  }
  router.push(routes[key])
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
  // 自动从云端拉取最新数据
  ledgerStore.syncWithCloud()
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
}

.header-left h1 {
  margin: 0;
  font-size: 18px;
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
