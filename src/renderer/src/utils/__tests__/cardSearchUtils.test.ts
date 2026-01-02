import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    normalizeText,
    compactText,
    buildMatchSnippet,
    searchCardsInMemory,
} from '../cardSearchUtils'
import type { CardListItem } from '../../../../shared/ipc/types'

const createCard = (
    id: number,
    title: string | null,
    summary: string | null = null,
    content?: string
): CardListItem & { content?: string } => ({
    id,
    projectId: 1,
    title,
    summary,
    wordCount: content?.length || summary?.length || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    extra: null,
    content,
})

describe('cardSearchUtils', () => {
    describe('normalizeText', () => {
        it('should convert text to lowercase', () => {
            expect(normalizeText('Hello World')).toBe('hello world')
            expect(normalizeText('UPPERCASE')).toBe('uppercase')
        })
    })

    describe('compactText', () => {
        it('should collapse multiple spaces', () => {
            expect(compactText('hello   world')).toBe('hello world')
            expect(compactText('  hello  \n  world  ')).toBe('hello world')
        })
    })

    describe('buildMatchSnippet', () => {
        it('should extract snippet around match', () => {
            const text = 'This is a long text with some content inside it'
            const snippet = buildMatchSnippet(text, 20, 4, 10)
            expect(snippet).toContain('some')
        })

        it('should add ellipsis when truncated', () => {
            const text = 'This is a long text with some content inside it'
            const snippet = buildMatchSnippet(text, 20, 4, 5)
            expect(snippet.startsWith('...')).toBe(true)
            expect(snippet.endsWith('...')).toBe(true)
        })

        it('should not add leading ellipsis at start', () => {
            const text = 'Hello world'
            const snippet = buildMatchSnippet(text, 0, 5, 3)
            expect(snippet.startsWith('...')).toBe(false)
        })
    })

    describe('searchCardsInMemory', () => {
        const cards = [
            createCard(1, 'Vue 响应式原理', '这是关于 Vue 的响应式系统'),
            createCard(2, 'React Hooks', 'useState 和 useEffect 的使用'),
            createCard(3, null, null, '这是正文内容，包含了 TypeScript 的类型系统'),
            createCard(4, '无标题', '普通卡片'),
        ]

        it('should return empty array for empty query', () => {
            expect(searchCardsInMemory(cards, '')).toEqual([])
            expect(searchCardsInMemory(cards, '   ')).toEqual([])
        })

        it('should search in title', () => {
            const results = searchCardsInMemory(cards, 'vue')
            expect(results).toHaveLength(1)
            expect(results[0].card.id).toBe(1)
        })

        it('should search in summary', () => {
            const results = searchCardsInMemory(cards, 'useState')
            expect(results).toHaveLength(1)
            expect(results[0].card.id).toBe(2)
        })

        it('should search in content', () => {
            const results = searchCardsInMemory(cards, 'TypeScript')
            expect(results).toHaveLength(1)
            expect(results[0].card.id).toBe(3)
        })

        it('should be case insensitive', () => {
            const results = searchCardsInMemory(cards, 'VUE')
            expect(results).toHaveLength(1)
            expect(results[0].card.id).toBe(1)
        })

        it('should limit results', () => {
            const manyCards = Array.from({ length: 50 }, (_, i) =>
                createCard(i, `Card ${i}`, `Content with keyword search`)
            )
            const results = searchCardsInMemory(manyCards, 'keyword', 5)
            expect(results).toHaveLength(5)
        })

        it('should include snippet in results', () => {
            const results = searchCardsInMemory(cards, 'Vue')
            expect(results[0].snippet).toBeDefined()
            expect(results[0].snippet.length).toBeGreaterThan(0)
        })
    })
})
