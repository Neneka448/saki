<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import ProjectSelector from './components/ProjectSelector.vue'
import ChatPanel from './components/ChatPanel.vue'
import WorkspacePanel from './components/WorkspacePanel.vue'
import type { Project } from '../../shared/ipc/types'

// 当前选中的项目
const currentProject = ref<Project | null>(null)
const isInitializing = ref(true)
const isChatCollapsed = ref(false)
const chatWidth = ref(320)
const isResizing = ref(false)
const resizeState = ref({ startX: 0, startWidth: 320 })

const applyChatWidth = (value: number) => {
  const clamped = Math.min(420, Math.max(240, value))
  chatWidth.value = clamped
}

// 提供给子组件使用
provide('currentProject', currentProject)

// 选择项目
const selectProject = (project: Project) => {
  currentProject.value = project
  window.app?.setActiveProjectId?.(project.id)
}

// 返回项目选择页
const backToProjectSelector = () => {
  currentProject.value = null
  window.app?.setActiveProjectId?.(null)
}

// 暴露给子组件
provide('backToProjectSelector', backToProjectSelector)

const toggleChat = () => {
  isChatCollapsed.value = !isChatCollapsed.value
}

const expandChat = () => {
  isChatCollapsed.value = false
}

const startResize = (event: MouseEvent) => {
  if (isChatCollapsed.value) return
  isResizing.value = true
  resizeState.value = {
    startX: event.clientX,
    startWidth: chatWidth.value,
  }
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing.value) return
  const delta = event.clientX - resizeState.value.startX
  applyChatWidth(resizeState.value.startWidth + delta)
}

const stopResize = () => {
  if (!isResizing.value) return
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  try {
    localStorage.setItem('saki.chat.width', String(chatWidth.value))
  } catch {
    // ignore
  }
}

onMounted(async () => {
  // 恢复聊天宽度
  const stored = Number(localStorage.getItem('saki.chat.width'))
  if (!Number.isNaN(stored) && stored > 0) {
    applyChatWidth(stored)
  }
  
  // 尝试恢复上次打开的项目
  try {
    const lastProjectId = await window.app?.getLastProjectId?.()
    if (lastProjectId) {
      const result = await window.project?.getById?.(lastProjectId)
      if (result?.success && result.data) {
        currentProject.value = result.data
        window.app?.setActiveProjectId?.(result.data.id)
      }
    }
  } catch (e) {
    console.error('Failed to restore last project:', e)
  } finally {
    isInitializing.value = false
  }
})
</script>

<template>
  <!-- 初始化加载中 -->
  <div v-if="isInitializing" class="app-loading">
    <div class="app-loading__spinner"></div>
  </div>
  
  <!-- 未选择项目时显示项目选择器 -->
  <ProjectSelector v-else-if="!currentProject" @select="selectProject" />
  
  <!-- 选择项目后显示主界面 -->
  <div v-else class="app-layout" :style="{ '--chat-width': `${chatWidth}px` }">
    <ChatPanel v-if="!isChatCollapsed" @toggle-collapse="toggleChat" />
    <div v-else class="chat-collapsed">
      <button class="chat-collapsed__btn" @click="expandChat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
    <div v-if="!isChatCollapsed" class="chat-resizer" @mousedown="startResize"></div>
    <WorkspacePanel :project-id="currentProject.id" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  padding: 12px;
}

.chat-resizer {
  width: 10px;
  margin: 0 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
}

.chat-resizer::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, var(--color-border-strong), var(--color-border));
  opacity: 0.45;
  border-radius: 999px;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.chat-resizer:hover::before,
.chat-resizer:active::before {
  opacity: 0.9;
  background: linear-gradient(180deg, var(--color-primary), var(--color-accent));
}

.chat-collapsed {
  width: 52px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.chat-collapsed__btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}

.chat-collapsed__btn:hover {
  background: white;
  color: var(--color-text);
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: var(--color-bg);
}

.app-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
