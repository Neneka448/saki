import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import * as chatAgent from '../../services/chatAgent'

// Mock chatAgent
vi.mock('../../services/chatAgent', () => ({
    sendChatWithTools: vi.fn(),
    resetSkillsPromptCache: vi.fn(),
}))

// Mock toolRegistry
vi.mock('../../services/toolRegistry', () => ({
    getToolNames: vi.fn().mockReturnValue(['tool1', 'tool2']),
    getToolSchemas: vi.fn().mockReturnValue([]),
}))

// Mock window APIs
const mockSkillApi = {
    getAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getByName: vi.fn(),
    getNames: vi.fn(),
    validate: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPromptXml: vi.fn(),
    formatActivatedSkill: vi.fn(),
}

const mockAppApi = {
    getQuickCaptureShortcut: vi.fn().mockResolvedValue({ shortcut: 'Alt+Space', defaultShortcut: 'Alt+Space' }),
    setQuickCaptureShortcut: vi.fn(),
}

// 使用 vi.stubGlobal 注入到 global/window
vi.stubGlobal('skill', mockSkillApi)
vi.stubGlobal('app', mockAppApi)

// Mock provide/inject
const mockBackToProjectSelector = vi.fn()

describe('ChatPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    const mockProject = {
        id: 1,
        name: '测试项目',
        description: null,
        color: null,
        icon: null,
        extra: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const mountOptions = {
        global: {
            provide: {
                backToProjectSelector: mockBackToProjectSelector,
                currentProject: { value: mockProject },
            },
        },
    }

    it('should render chat panel', () => {
        const wrapper = mount(ChatPanel, mountOptions)

        expect(wrapper.find('.chat-panel').exists()).toBe(true)
        expect(wrapper.find('.chat-header').exists()).toBe(true)
        expect(wrapper.find('.chat-messages').exists()).toBe(true)
        expect(wrapper.find('.chat-input').exists()).toBe(true)
    })

    it('should display initial welcome message', async () => {
        const wrapper = mount(ChatPanel, mountOptions)
        await flushPromises()
        await nextTick()

        const messages = wrapper.findAll('.chat-message')
        expect(messages.length).toBeGreaterThan(0)

        const firstMessage = messages[0]
        expect(firstMessage.classes()).toContain('chat-message--assistant')
    })

    it('should have input textarea', () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        expect(textarea.exists()).toBe(true)
        expect(textarea.attributes('placeholder')).toBe('输入消息...')
    })

    it('should disable send button when input is empty', () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const sendButton = wrapper.find('.chat-input__send')
        expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        await textarea.setValue('Hello')

        const sendButton = wrapper.find('.chat-input__send')
        expect(sendButton.attributes('disabled')).toBeUndefined()
    })

    it('should add user message when send button clicked', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        await textarea.setValue('Test message')

        const sendButton = wrapper.find('.chat-input__send')
        await sendButton.trigger('click')
        await flushPromises()

        // 应该有用户消息
        const userMessages = wrapper.findAll('.chat-message--user')
        expect(userMessages.length).toBe(1)
        expect(userMessages[0].find('.chat-message__content').text()).toBe('Test message')

        // 输入框应该清空
        expect((textarea.element as HTMLTextAreaElement).value).toBe('')
    })

    it('should send message on Enter key', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        await textarea.setValue('Enter test')
        await textarea.trigger('keydown', { key: 'Enter' })
        await flushPromises()

        const userMessages = wrapper.findAll('.chat-message--user')
        expect(userMessages.length).toBe(1)
    })

    it('should not send message on Shift+Enter', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        await textarea.setValue('Shift+Enter test')
        await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

        const userMessages = wrapper.findAll('.chat-message--user')
        expect(userMessages.length).toBe(0)
    })

    it('should append assistant response when message sent', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const textarea = wrapper.find('.chat-input__textarea')
        await textarea.setValue('Test')
        await wrapper.find('.chat-input__send').trigger('click')
        await flushPromises()

        const assistantMessages = wrapper.findAll('.chat-message--assistant')
        expect(assistantMessages.length).toBeGreaterThan(0)
    })

    it('should have new conversation button', () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const newButton = wrapper.find('.chat-header__action')
        expect(newButton.exists()).toBe(true)
    })

    it('should have back to project selector button', () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const backButton = wrapper.find('.chat-header__back')
        expect(backButton.exists()).toBe(true)
    })

    it('should call backToProjectSelector when back button clicked', async () => {
        const wrapper = mount(ChatPanel, mountOptions)

        const backButton = wrapper.find('.chat-header__back')
        await backButton.trigger('click')

        expect(mockBackToProjectSelector).toHaveBeenCalled()
    })

    describe('Skill Lifecycle UI', () => {
        it('should not show active skill banner initially', () => {
            const wrapper = mount(ChatPanel, mountOptions)
            expect(wrapper.find('.chat-active-skill').exists()).toBe(false)
        })

        it('should show active skill banner when a skill is activated', async () => {
            // Mock sendChatWithTools to return an activated skill state
            vi.mocked(chatAgent.sendChatWithTools).mockResolvedValue({
                messages: [
                    { id: '1', role: 'user', content: 'Activate skill', createdAt: Date.now() },
                    { id: '2', role: 'assistant', content: 'Skill activated!', createdAt: Date.now() }
                ],
                activeSkillId: 'skill-1',
                activeSkillTools: ['tool1']
            })

            const wrapper = mount(ChatPanel, mountOptions)

            // Send a message to trigger sendChatWithTools
            const textarea = wrapper.find('.chat-input__textarea')
            await textarea.setValue('Activate skill')
            await wrapper.find('.chat-input__send').trigger('click')
            await flushPromises()

            // Banner should be visible
            const banner = wrapper.find('.chat-active-skill')
            expect(banner.exists()).toBe(true)
            expect(banner.text()).toContain('tool1')
        })

        it('should hide banner and clear skill state when "退出技能模式" is clicked', async () => {
            // First, activate a skill
            vi.mocked(chatAgent.sendChatWithTools).mockResolvedValue({
                messages: [],
                activeSkillId: 'skill-1',
                activeSkillTools: ['tool1']
            })

            const wrapper = mount(ChatPanel, mountOptions)
            await wrapper.find('.chat-input__textarea').setValue('Activate')
            await wrapper.find('.chat-input__send').trigger('click')
            await flushPromises()

            expect(wrapper.find('.chat-active-skill').exists()).toBe(true)

            // Click exit button
            await wrapper.find('.chat-active-skill__close').trigger('click')
            await nextTick()

            // Banner should be gone
            expect(wrapper.find('.chat-active-skill').exists()).toBe(false)
        })
    })

    describe('Skill Editor Tools Sync', () => {
        it('should sync tools from frontmatter to checkboxes', async () => {
            const wrapper = mount(ChatPanel, mountOptions)

            // Open control panel
            await wrapper.find('.chat-header__control[title="控制面板"]').trigger('click')

            // Switch to skills tab
            const tabs = wrapper.findAll('.chat-control__tab')
            const skillsTab = tabs.find(t => t.text() === 'Skills')
            await skillsTab?.trigger('click')

            // Start new skill
            await wrapper.find('.chat-skills__add').trigger('click')

            const textarea = wrapper.find('.chat-skills__textarea')
            await textarea.setValue('---\nname: test\ndescription: test\ntools: tool1\n---\nbody')

            await nextTick()

            const checkbox = wrapper.find('input[type="checkbox"][value="tool1"]')
            expect((checkbox.element as HTMLInputElement).checked).toBe(true)

            const checkbox2 = wrapper.find('input[type="checkbox"][value="tool2"]')
            expect((checkbox2.element as HTMLInputElement).checked).toBe(false)
        })

        it('should sync tools from checkboxes to frontmatter', async () => {
            const wrapper = mount(ChatPanel, mountOptions)

            // Open control panel
            await wrapper.find('.chat-header__control[title="控制面板"]').trigger('click')

            // Switch to skills tab
            const tabs = wrapper.findAll('.chat-control__tab')
            const skillsTab = tabs.find(t => t.text() === 'Skills')
            await skillsTab?.trigger('click')

            await wrapper.find('.chat-skills__add').trigger('click')

            const checkbox = wrapper.find('input[type="checkbox"][value="tool2"]')
            await checkbox.setValue(true)

            await nextTick()

            const textarea = wrapper.find('.chat-skills__textarea')
            expect((textarea.element as HTMLTextAreaElement).value).toContain('tools: tool2')
        })
    })
})
