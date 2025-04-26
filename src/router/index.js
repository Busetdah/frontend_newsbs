import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '@/components/DashboardPage.vue'
import SmartStitchDetectionPage from '@/views/SmartStitchDetectionPage.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardPage,
  },
  {
    path: '/smartstitchdetectionpage',
    name: 'SmartStitchDetection',
    component: SmartStitchDetectionPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
