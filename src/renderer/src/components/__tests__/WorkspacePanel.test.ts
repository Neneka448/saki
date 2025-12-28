import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WorkspacePanel from '../WorkspacePanel.vue'

// Mock CodeMirrorEditor 组件，避免 CodeMirror 在测试中运行
vi.mock('../../editor', () => ({
    CodeMirrorEditor: {
        name: 'CodeMirrorEditor',
        template: '<div class="mock-editor"><slot /></div>',
        props: ['modelValue', 'placeholder', 'autoFocus', 'referenceCandidates', 'currentCardId'],
        emits: ['update:modelValue', 'save'],
    },
}))

// Mock window.card API
const mockCardApi = {
    getListByProject: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    getTags: vi.fn(),
}

// Mock window.asset API
const mockAssetApi = {
    saveImage: vi.fn(),
    getAssetPath: vi.fn(),
    deleteAsset: vi.fn(),
}

const mockTagApi = {
    getAllUserTags: vi.fn(),
}

vi.stubGlobal('window', {
    card: mockCardApi,
    asset: mockAssetApi,
    tag: mockTagApi,
})

const defaultProps = {
    projectId: 1,
}

describe('WorkspacePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: [] })
        mockCardApi.create.mockResolvedValue({
            success: true,
            data: { id: 1, projectId: 1, content: '# 新卡片', title: '新卡片', createdAt: new Date(), updatedAt: new Date() }
        })
        mockCardApi.getById.mockResolvedValue({
            success: true,
            data: { id: 1, projectId: 1, content: '# 测试卡片', title: '测试卡片', createdAt: new Date(), updatedAt: new Date() }
        })
        mockCardApi.update.mockResolvedValue({
            success: true,
            data: { id: 1, projectId: 1, content: '# 更新后', title: '更新后', createdAt: new Date(), updatedAt: new Date() }
        })
        mockCardApi.getTags.mockResolvedValue({ success: true, data: [] })
        mockTagApi.getAllUserTags.mockResolvedValue({ success: true, data: [] })
    })

    it('should render workspace panel', async () => {
        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        expect(wrapper.find('.workspace').exists()).toBe(true)
        expect(wrapper.find('.workspace-header').exists()).toBe(true)
        expect(wrapper.find('.workspace-content').exists()).toBe(true)
    })

    it('should show tabs', async () => {
        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const tabs = wrapper.findAll('.workspace-header__tab')
        expect(tabs.length).toBe(2)
        expect(tabs[0].text()).toBe('时间流')
        expect(tabs[1].text()).toBe('标签')
    })

    it('should show new card button', async () => {
        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const newButton = wrapper.find('.workspace-header__btn')
        expect(newButton.exists()).toBe(true)
        expect(newButton.text()).toContain('新建')
    })

    it('should show empty state when no cards', async () => {
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: [] })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        expect(wrapper.find('.workspace-empty').exists()).toBe(true)
        expect(wrapper.find('.workspace-empty__title').text()).toBe('还没有卡片')
    })

    it('should show loading state initially', () => {
        mockCardApi.getListByProject.mockImplementation(() => new Promise(() => { })) // Never resolves

        const wrapper = mount(WorkspacePanel, { props: defaultProps })

        expect(wrapper.find('.workspace-loading').exists()).toBe(true)
    })

    it('should display cards when data loaded', async () => {
        const mockCards = [
            { id: 1, projectId: 1, title: '测试卡片1', summary: '摘要1', wordCount: 100, createdAt: new Date(), updatedAt: new Date() },
            { id: 2, projectId: 1, title: '测试卡片2', summary: '摘要2', wordCount: 200, createdAt: new Date(), updatedAt: new Date() },
        ]
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: mockCards })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const cardItems = wrapper.findAll('.card-item')
        expect(cardItems.length).toBe(2)
        expect(cardItems[0].find('.card-item__title').text()).toBe('测试卡片1')
        expect(cardItems[1].find('.card-item__title').text()).toBe('测试卡片2')
    })

    it('should call create API when new card button clicked', async () => {
        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        // createCard 现在只是切换到创建模式，不直接调用 API
        const vm = wrapper.vm as any
        vm.createCard()
        await wrapper.vm.$nextTick()

        // 验证进入了创建模式
        expect(vm.isCreating).toBe(true)
    })

    it('should select card when clicked', async () => {
        const mockCards = [
            { id: 1, projectId: 1, title: '测试卡片', summary: null, wordCount: 50, createdAt: new Date(), updatedAt: new Date() },
        ]
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: mockCards })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        // 直接调用选择方法
        const vm = wrapper.vm as any
        vm.selectCard(1)
        await wrapper.vm.$nextTick()

        const cardItem = wrapper.find('.card-item')
        expect(cardItem.classes()).toContain('card-item--selected')
    })

    it('should display "无标题" for cards without title', async () => {
        const mockCards = [
            { id: 1, projectId: 1, title: null, summary: null, wordCount: 50, createdAt: new Date(), updatedAt: new Date() },
        ]
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: mockCards })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const title = wrapper.find('.card-item__title')
        expect(title.text()).toBe('无标题')
    })

    it('should display word count', async () => {
        const mockCards = [
            { id: 1, projectId: 1, title: '测试', summary: null, wordCount: 150, createdAt: new Date(), updatedAt: new Date() },
        ]
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: mockCards })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const meta = wrapper.find('.card-item__meta')
        expect(meta.text()).toContain('150')
    })

    it('should format time correctly', async () => {
        const now = new Date()
        const mockCards = [
            { id: 1, projectId: 1, title: '刚刚创建', summary: null, wordCount: 10, createdAt: now, updatedAt: now },
        ]
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: mockCards })

        const wrapper = mount(WorkspacePanel, { props: defaultProps })
        await flushPromises()

        const time = wrapper.find('.card-item__time')
        expect(time.text()).toBe('刚刚')
    })
})
