import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
    { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { public: true } },
    { path: '/', component: () => import('../views/ProjectsView.vue') },
    { path: '/projects/new', component: () => import('../views/NewProjectView.vue') },
    { path: '/projects/:id', component: () => import('../views/ProjectView.vue') },
    { path: '/sources', component: () => import('../views/SourcesView.vue') },
    { path: '/assistant', component: () => import('../views/AssistantView.vue') },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) return '/login';
  if (to.meta.public && auth.isAuthenticated) return '/';
});
