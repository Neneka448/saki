<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Project } from '../../../shared/ipc/types'

const emit = defineEmits<{
  'select': [project: Project]
}>()

const projects = ref<Project[]>([])
const isLoading = ref(true)
const showCreateDialog = ref(false)
const newProjectName = ref('')
const newProjectDescription = ref('')
const isCreating = ref(false)

// 加载项目列表
const loadProjects = async () => {
  isLoading.value = true
  try {
    const result = await window.project.getAll()
    if (result.success) {
      projects.value = result.data
    }
  } catch (e) {
    console.error('Failed to load projects:', e)
  } finally {
    isLoading.value = false
  }
}

// 选择项目
const selectProject = (project: Project) => {
  emit('select', project)
}

// 打开创建对话框
const openCreateDialog = () => {
  newProjectName.value = ''
  newProjectDescription.value = ''
  showCreateDialog.value = true
}

// 关闭创建对话框
const closeCreateDialog = () => {
  showCreateDialog.value = false
}

// 创建项目
const createProject = async () => {
  if (!newProjectName.value.trim()) return
  
  isCreating.value = true
  try {
    const result = await window.project.create({
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim() || undefined,
    })
    if (result.success) {
      closeCreateDialog()
      // 直接选择新创建的项目
      emit('select', result.data)
    }
  } catch (e) {
    console.error('Failed to create project:', e)
  } finally {
    isCreating.value = false
  }
}

// 获取项目图标
const getProjectIcon = (project: Project) => {
  return project.icon || '📁'
}

// 获取项目颜色
const getProjectColor = (project: Project) => {
  return project.color || '#3a6df6'
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="project-selector">
    <!-- 左侧：Logo 和创建按钮 -->
    <div class="project-selector__left">
      <div class="project-selector__brand">
        <div class="project-selector__logo">
          <span class="project-selector__logo-icon">🧠</span>
          <h1 class="project-selector__title">Saki</h1>
        </div>
        <p class="project-selector__subtitle">你的智能知识助手</p>
      </div>
      
      <button class="project-selector__create-btn" @click="openCreateDialog">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        创建知识库
      </button>
    </div>

    <!-- 右侧：项目列表 -->
    <div class="project-selector__right">
      <header class="project-selector__header">
        <h2 class="project-selector__section-title">我的知识库</h2>
        <span class="project-selector__count">{{ projects.length }} 个</span>
      </header>

      <div class="project-selector__content">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="project-selector__loading">
          <div class="project-selector__spinner"></div>
          <span>加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="projects.length === 0" class="project-selector__empty">
          <span class="project-selector__empty-icon">📚</span>
          <p class="project-selector__empty-text">还没有知识库</p>
          <p class="project-selector__empty-hint">点击左侧「创建知识库」开始</p>
        </div>

        <!-- 项目列表 -->
        <div v-else class="project-selector__list">
          <button
            v-for="project in projects"
            :key="project.id"
            class="project-card"
            @click="selectProject(project)"
          >
            <div 
              class="project-card__icon"
              :style="{ backgroundColor: getProjectColor(project) + '20', color: getProjectColor(project) }"
            >
              {{ getProjectIcon(project) }}
            </div>
            <div class="project-card__info">
              <h3 class="project-card__name">{{ project.name }}</h3>
              <p class="project-card__desc">{{ project.description || '暂无描述' }}</p>
            </div>
            <div class="project-card__arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 创建项目对话框 -->
    <Teleport to="body">
      <div v-if="showCreateDialog" class="dialog-overlay" @click.self="closeCreateDialog">
        <div class="dialog">
          <header class="dialog__header">
            <h2 class="dialog__title">创建知识库</h2>
            <button class="dialog__close" @click="closeCreateDialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="dialog__body">
            <div class="form-group">
              <label class="form-label">名称</label>
              <input
                v-model="newProjectName"
                type="text"
                class="form-input"
                placeholder="输入知识库名称"
                autofocus
                @keydown.enter="createProject"
              />
            </div>
            <div class="form-group">
              <label class="form-label">描述（可选）</label>
              <textarea
                v-model="newProjectDescription"
                class="form-textarea"
                placeholder="简单描述这个知识库的用途"
                rows="3"
              ></textarea>
            </div>
          </div>
          <footer class="dialog__footer">
            <button class="btn btn--secondary" @click="closeCreateDialog">取消</button>
            <button 
              class="btn btn--primary" 
              :disabled="!newProjectName.trim() || isCreating"
              @click="createProject"
            >
              {{ isCreating ? '创建中...' : '创建' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.project-selector {
  min-height: 100vh;
  display: flex;
  gap: 24px;
  padding: 24px;
  background: transparent;
  width: 100%;
}

/* 左侧面板 */
.project-selector__left {
  width: 320px;
  min-width: 320px;
  background:
    linear-gradient(160deg, rgba(58, 109, 246, 0.12), rgba(17, 183, 165, 0.08)),
    rgba(255, 255, 255, 0.88);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 28px;
  backdrop-filter: blur(12px);
  -webkit-app-region: drag;
}

.project-selector__brand {
  text-align: center;
  margin-bottom: 40px;
}

.project-selector__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.project-selector__logo-icon {
  font-size: 42px;
}

.project-selector__title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.project-selector__subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}

.project-selector__create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 200px;
  padding: 14px 24px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.25);
  -webkit-app-region: no-drag;
}

.project-selector__create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(58, 109, 246, 0.32);
}

/* 右侧面板 */
.project-selector__right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.project-selector__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-top: 8px;
}

.project-selector__section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.project-selector__count {
  font-size: 13px;
  color: var(--color-text-muted);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  padding: 4px 10px;
  border-radius: 12px;
}

.project-selector__content {
  flex: 1;
  overflow-y: auto;
}

.project-selector__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 0;
  color: var(--color-text-secondary);
}

.project-selector__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.project-selector__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.project-selector__empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.project-selector__empty-text {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 8px 0;
}

.project-selector__empty-hint {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}

.project-selector__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  box-shadow: var(--shadow-sm);
  animation: card-rise 0.35s ease both;
}

.project-card:hover {
  border-color: rgba(58, 109, 246, 0.45);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.project-card__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm);
}

.project-card__info {
  flex: 1;
  min-width: 0;
}

.project-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__arrow {
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.project-card:hover .project-card__arrow {
  color: var(--color-primary);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog {
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
}

.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.dialog__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.dialog__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.dialog__close:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.dialog__body {
  padding: 24px;
}

.dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: var(--color-bg-elevated);
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  background: var(--color-bg-elevated);
  color: var(--color-text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.16);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.2);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.28);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--secondary {
  background: var(--color-bg-elevated);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn--secondary:hover {
  background: white;
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.project-card:nth-child(2) {
  animation-delay: 0.03s;
}

.project-card:nth-child(3) {
  animation-delay: 0.06s;
}

.project-card:nth-child(4) {
  animation-delay: 0.09s;
}

.project-card:nth-child(5) {
  animation-delay: 0.12s;
}

@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
