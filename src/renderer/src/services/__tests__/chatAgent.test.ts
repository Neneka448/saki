import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sendChatWithTools } from '../chatAgent'
import { createConversation, createMessage } from '../chatStorage'
import { getToolSchemas } from '../toolRegistry'

// Mock window.skill
const mockSkillApi = {
  getByName: vi.fn(),
  getNames: vi.fn(),
  formatActivatedSkill: vi.fn(),
}
vi.stubGlobal('skill', mockSkillApi)

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Skill Lifecycle Integration', () => {
  const settings = {
    endpoint: 'http://api.test',
    path: '/chat',
    apiKey: 'test-key',
    modelsText: 'gpt-4',
    systemPrompt: 'You are a helpful assistant',
    maxToolRounds: 5,
  }

  const projectId = 1
  const model = 'gpt-4'

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Default fetch response (empty content, no tool calls)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello', tool_calls: [] } }]
      })
    })
  })

  it('should filter tools when a skill is activated', async () => {
    const conversation = createConversation(projectId, model)
    const userMessage = createMessage('user', 'Activate translation skill')

    // 1. First LLM response: calls activate_skill
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'activate_skill', arguments: JSON.stringify({ name: 'Translator' }) }
            }]
          }
        }]
      })
    })

    // Mock skill API for activate_skill
    mockSkillApi.getByName.mockResolvedValue({
      success: true,
      data: {
        name: 'Translator',
        body: 'Translate everything to French',
        tools: ['get_current_time'] // Only allow get_current_time
      }
    })
    mockSkillApi.formatActivatedSkill.mockResolvedValue({ success: true, data: 'Formatted Skill Content' })

    // 2. Second LLM response (after tool execution): returns final answer
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Skill activated!', tool_calls: [] } }]
      })
    })

    const result = await sendChatWithTools({
      settings,
      conversation,
      userMessage,
      model,
      projectId
    })

    // Verify that the second fetch call (the one after tool execution) had filtered tools
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    const sentTools = secondCallBody.tools.map((t: any) => t.function.name)
    
    expect(sentTools).toContain('get_current_time')
    expect(sentTools).toContain('activate_skill')
    expect(sentTools).toContain('deactivate_skill')
    expect(sentTools).not.toContain('search_cards')
    expect(sentTools).not.toContain('list_tags')

    // Verify result state
    expect(result.activeSkillTools).toEqual(['get_current_time'])
  })

  it('should restore all tools when a skill is deactivated', async () => {
    // Start with an active skill
    const conversation = createConversation(projectId, model)
    conversation.activeSkillTools = ['get_current_time']
    
    const userMessage = createMessage('user', 'Deactivate skill')

    // 1. First LLM response: calls deactivate_skill
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call_2',
              type: 'function',
              function: { name: 'deactivate_skill', arguments: '{}' }
            }]
          }
        }]
      })
    })

    // 2. Second LLM response: final answer
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Skill deactivated!', tool_calls: [] } }]
      })
    })

    const result = await sendChatWithTools({
      settings,
      conversation,
      userMessage,
      model,
      projectId
    })

    // Verify that the second fetch call had ALL tools
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    const sentTools = secondCallBody.tools.map((t: any) => t.function.name)
    
    const allTools = getToolSchemas().map(t => t.name)
    expect(sentTools.length).toBe(allTools.length)
    expect(sentTools).toContain('search_cards')
    expect(sentTools).toContain('list_tags')

    // Verify result state
    expect(result.activeSkillTools).toBeNull()
  })
})
