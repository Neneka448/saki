import { describe, it, expect } from 'vitest'
import {
    normalizeCardReferences,
    assertReferenceInvariant,
    createReferenceId,
    REFERENCE_NAMESPACE,
    REFERENCE_META_TYPE,
} from '../referenceUtils'

describe('referenceUtils', () => {
    describe('createReferenceId', () => {
        it('generates unique ids', () => {
            const ids = new Set<string>()
            for (let i = 0; i < 100; i++) {
                ids.add(createReferenceId())
            }
            expect(ids.size).toBe(100)
        })

        it('generates alphanumeric ids', () => {
            const id = createReferenceId()
            expect(id).toMatch(/^[a-z0-9]+$/i)
            expect(id.length).toBeGreaterThan(8)
        })
    })

    describe('normalizeCardReferences', () => {
        it('adds ref comment when missing', () => {
            const input = 'see [[Card]](点击这里)'
            const result = normalizeCardReferences(input)
            expect(result.content).toMatch(/\[\[Card\]\]\(点击这里\)<!--ref:[a-z0-9]+-->/i)
            expect(result.references.length).toBe(1)
            expect(result.references[0].refId.length).toBeGreaterThan(0)
            expect(result.references[0].title).toBe('Card')
            expect(result.references[0].placeholder).toBe('点击这里')
        })

        it('keeps existing ref id', () => {
            const input = '[[Card]](link)<!--ref:abc123-->'
            const result = normalizeCardReferences(input)
            expect(result.content).toBe(input)
            expect(result.references[0].refId).toBe('abc123')
        })

        it('handles empty placeholder', () => {
            const input = '[[Card]]()<!--ref:id1-->'
            const result = normalizeCardReferences(input)
            expect(result.references[0].placeholder).toBe('')
            expect(result.references[0].title).toBe('Card')
        })

        it('handles multiple references', () => {
            const input = '[[A]](x)<!--ref:id1--> and [[B]](y)<!--ref:id2-->'
            const result = normalizeCardReferences(input)
            expect(result.references.length).toBe(2)
            expect(result.references[0].title).toBe('A')
            expect(result.references[1].title).toBe('B')
        })

        it('trims title but preserves placeholder whitespace', () => {
            const input = '[[  Card  ]](  text  )<!--ref:id1-->'
            const result = normalizeCardReferences(input)
            expect(result.references[0].title).toBe('Card')
            expect(result.references[0].placeholder).toBe('  text  ')
        })

        it('throws on orphan ref comment', () => {
            expect(() => normalizeCardReferences('text <!--ref:bad-->')).toThrow('Orphan ref comment')
        })

        it('throws when ref comment is separated by space', () => {
            expect(() => normalizeCardReferences('[[Card]](link) <!--ref:bad-->')).toThrow('Orphan ref comment')
        })

        it('throws when allowInsert is false and ref id missing', () => {
            expect(() => normalizeCardReferences('[[Card]](link)', { allowInsert: false }))
                .toThrow('Reference missing ref id comment')
        })

        it('preserves content around references', () => {
            const input = 'before [[Card]](link)<!--ref:id1--> after'
            const result = normalizeCardReferences(input)
            expect(result.content).toBe(input)
        })

        it('handles references with special characters in title', () => {
            const input = '[[Card & Notes]](link)<!--ref:id1-->'
            const result = normalizeCardReferences(input)
            expect(result.references[0].title).toBe('Card & Notes')
        })

        it('handles unicode in title and placeholder', () => {
            const input = '[[笔记标题]](查看详情)<!--ref:id1-->'
            const result = normalizeCardReferences(input)
            expect(result.references[0].title).toBe('笔记标题')
            expect(result.references[0].placeholder).toBe('查看详情')
        })

        it('records correct index for references', () => {
            const input = 'start [[A]](x)<!--ref:id1--> mid [[B]](y)<!--ref:id2--> end'
            const result = normalizeCardReferences(input)
            expect(result.references[0].index).toBe(6) // position of [[A]]
            expect(result.references[1].index).toBeGreaterThan(result.references[0].index)
        })
    })

    describe('assertReferenceInvariant', () => {
        it('does not throw for valid content', () => {
            expect(() => assertReferenceInvariant('[[Card]](link)<!--ref:id1-->')).not.toThrow()
        })

        it('does not throw for content without references', () => {
            expect(() => assertReferenceInvariant('plain text')).not.toThrow()
        })

        it('throws for missing ref id', () => {
            expect(() => assertReferenceInvariant('[[Card]](link)')).toThrow()
        })
    })

    describe('constants', () => {
        it('exports REFERENCE_NAMESPACE', () => {
            expect(REFERENCE_NAMESPACE).toBe('system:card_ref')
        })

        it('exports REFERENCE_META_TYPE', () => {
            expect(REFERENCE_META_TYPE).toBe('card_ref')
        })
    })
})
