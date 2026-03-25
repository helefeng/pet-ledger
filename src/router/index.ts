import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/overview',
    name: 'Overview',
    component: () => import('@/views/Overview.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/add',
    redirect: '/account/add',
  },
  {
    path: '/stats',
    redirect: '/account/stats',
  },
  {
    path: '/diary',
    redirect: '/account/diary',
  },
  {
    path: '/task',
    redirect: '/account/task',
  },
  {
    path: '/calendar',
    redirect: '/account/calendar',
  },
  {
    path: '/account',
    name: 'Account',
    component: () => import('@/views/Account.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account/add',
    name: 'AccountAddTrade',
    component: () => import('@/views/AddTrade.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account/stats',
    name: 'AccountStatistics',
    component: () => import('@/views/Statistics.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account/diary',
    name: 'AccountDiary',
    component: () => import('@/views/Diary.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account/task',
    name: 'AccountTask',
    component: () => import('@/views/Task.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/account/calendar',
    name: 'AccountCalendar',
    component: () => import('@/views/Calendar.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/edit/:id',
    name: 'EditTrade',
    component: () => import('@/views/AddTrade.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !authStore.isLoggedIn) {
    return '/login'
  }
  if (to.path === '/login' && authStore.isLoggedIn) {
    return '/'
  }
  return true
})

export default router
