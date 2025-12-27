import { describe, it, expect } from 'vitest'
import { normalizeCardReferences, assertReferenceInvariant } from '../referenceUtils'

describe('referenceUtils', () => {
    it('adds ref comment when missing', () => {
        const input = 'see [[Card]](点击这里)'
        const result = normalizeCardReferences(input)
        expect(result.content).toMatch(/\[\[Card\]\]\(点击这里\)<!--ref:/)
        expect(result.references.length).toBe(1)
        expect(result.references[0].refId.length).toBeGreaterThan(0)
    })

    it('keeps existing ref id', () => {
        const input = '[[Card]](link)<!--ref:abc123-->'
        const result = normalizeCardReferences(input)
        expect(result.content).toBe(input)
        expect(result.references[0].refId).toBe('abc123')
    })

    it('throws on orphan ref comment', () => {
        expect(() => assertReferenceInvariant('text <!--ref:bad-->')).toThrow()
    })

    it('throws when ref comment is separated by space', () => {
        expect(() => normalizeCardReferences('[[Card]](link) <!--ref:bad-->')).toThrow()
    })
})
