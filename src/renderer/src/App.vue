<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import ProjectSelector from './components/ProjectSelector.vue'
import ChatPanel from './components/ChatPanel.vue'
import WorkspacePanel from './components/WorkspacePanel.vue'
import type { Project } from '../../shared/ipc/types'

// 当前选中的项目
const currentProject = ref<Project | null>(null)
const isChatCollapsed = ref(false)
const chatWidth = ref(400)
const isResizing = ref(false)
const resizeState = ref({ startX: 0, startWidth: 400 })

const applyChatWidth = (value: number) => {
  const clamped = Math.min(560, Math.max(280, value))
  chatWidth.value = clamped
}

// 提供给子组件使用
provide('currentProject', currentProject)

// 选择项目
const selectProject = (project: Project) => {
  currentProject.value = project
}

// 返回项目选择页
const backToProjectSelector = () => {
  currentProject.value = null
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

onMounted(() => {
  const stored = Number(localStorage.getItem('saki.chat.width'))
  if (!Number.isNaN(stored) && stored > 0) {
    applyChatWidth(stored)
  }
})
</script>

<template>
  <!-- 未选择项目时显示项目选择器 -->
  <ProjectSelector v-if="!currentProject" @select="selectProject" />
  
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
}

.chat-resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
}

.chat-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 2px;
  background: var(--color-border);
  opacity: 0.6;
}

.chat-collapsed {
  width: 44px;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-collapsed__btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.chat-collapsed__btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
</style>
