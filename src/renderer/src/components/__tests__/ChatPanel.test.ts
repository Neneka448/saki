import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'

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
})
