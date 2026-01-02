import { describe, it, expect } from 'vitest'
import {
    buildTagTree,
    flattenTagTree,
    getTagDisplayName,
    isNestedTag,
    type TagTreeNode,
} from '../tagTreeUtils'
import type { TagWithUsageCount } from '../../../../shared/ipc/types'

const createTag = (id: number, name: string, usageCount = 0): TagWithUsageCount => ({
    id,
    name,
    color: null,
    usageCount,
})

describe('tagTreeUtils', () => {
    describe('buildTagTree', () => {
        it('should return empty array for empty input', () => {
            const result = buildTagTree([])
            expect(result).toEqual([])
        })

        it('should create flat nodes for tags without slashes', () => {
            const tags = [
                createTag(1, '工作', 5),
                createTag(2, '学习', 3),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('学习')
            expect(result[0].isTag).toBe(true)
            expect(result[0].tag?.id).toBe(2)
            expect(result[0].totalCount).toBe(3)
            expect(result[1].name).toBe('工作')
            expect(result[1].isTag).toBe(true)
            expect(result[1].tag?.id).toBe(1)
            expect(result[1].totalCount).toBe(5)
        })

        it('should create nested structure for tags with slashes', () => {
            const tags = [
                createTag(1, '工作/项目A', 5),
                createTag(2, '工作/项目B', 3),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('工作')
            expect(result[0].isTag).toBe(false)
            expect(result[0].children).toHaveLength(2)
            expect(result[0].children[0].name).toBe('项目A')
            expect(result[0].children[0].isTag).toBe(true)
            expect(result[0].children[1].name).toBe('项目B')
            expect(result[0].children[1].isTag).toBe(true)
        })

        it('should handle deep nesting', () => {
            const tags = [
                createTag(1, 'src/core/reactivity/ref', 2),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('src')
            expect(result[0].depth).toBe(0)
            expect(result[0].isTag).toBe(false)

            const core = result[0].children[0]
            expect(core.name).toBe('core')
            expect(core.depth).toBe(1)
            expect(core.isTag).toBe(false)

            const reactivity = core.children[0]
            expect(reactivity.name).toBe('reactivity')
            expect(reactivity.depth).toBe(2)
            expect(reactivity.isTag).toBe(false)

            const ref = reactivity.children[0]
            expect(ref.name).toBe('ref')
            expect(ref.depth).toBe(3)
            expect(ref.isTag).toBe(true)
            expect(ref.tag?.id).toBe(1)
        })

        it('should handle mixed flat and nested tags', () => {
            const tags = [
                createTag(1, '待办', 10),
                createTag(2, '工作/项目A', 5),
                createTag(3, '工作/项目B', 3),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(2)

            const todoNode = result.find(n => n.name === '待办')
            expect(todoNode?.isTag).toBe(true)
            expect(todoNode?.totalCount).toBe(10)

            const workNode = result.find(n => n.name === '工作')
            expect(workNode?.isTag).toBe(false)
            expect(workNode?.children).toHaveLength(2)
        })

        it('should calculate totalCount including children', () => {
            const tags = [
                createTag(1, '工作', 2),
                createTag(2, '工作/项目A', 5),
                createTag(3, '工作/项目A/后端', 3),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(1)
            const workNode = result[0]
            expect(workNode.name).toBe('工作')
            expect(workNode.isTag).toBe(true) // '工作' 本身也是一个标签
            expect(workNode.totalCount).toBe(2 + 5 + 3) // 自身 + 项目A + 后端
        })

        it('should handle parent tag that is also a real tag', () => {
            const tags = [
                createTag(1, '工作', 10),
                createTag(2, '工作/项目A', 5),
            ]
            const result = buildTagTree(tags)

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('工作')
            expect(result[0].isTag).toBe(true)
            expect(result[0].tag?.id).toBe(1)
            expect(result[0].children).toHaveLength(1)
            expect(result[0].children[0].name).toBe('项目A')
        })
    })

    describe('flattenTagTree', () => {
        it('should flatten tree with visibility based on expanded state', () => {
            const tags = [
                createTag(1, '工作/项目A', 5),
                createTag(2, '工作/项目B', 3),
            ]
            const tree = buildTagTree(tags)

            // 未展开时
            const collapsed = flattenTagTree(tree, new Set())
            expect(collapsed).toHaveLength(3) // 工作 + 项目A + 项目B
            expect(collapsed[0].visible).toBe(true)
            expect(collapsed[1].visible).toBe(false) // 父节点未展开
            expect(collapsed[2].visible).toBe(false)

            // 展开后
            const expanded = flattenTagTree(tree, new Set(['工作']))
            expect(expanded).toHaveLength(3)
            expect(expanded[0].visible).toBe(true)
            expect(expanded[1].visible).toBe(true)
            expect(expanded[2].visible).toBe(true)
        })

        it('should set expanded property correctly', () => {
            const tags = [createTag(1, '工作/项目A', 5)]
            const tree = buildTagTree(tags)

            const result = flattenTagTree(tree, new Set(['工作']))
            expect(result[0].expanded).toBe(true)
            expect(result[1].expanded).toBe(false)
        })
    })

    describe('getTagDisplayName', () => {
        it('should return the last part of the tag name', () => {
            expect(getTagDisplayName('工作/项目A/后端')).toBe('后端')
            expect(getTagDisplayName('src/core/reactivity')).toBe('reactivity')
        })

        it('should return the full name for flat tags', () => {
            expect(getTagDisplayName('待办')).toBe('待办')
            expect(getTagDisplayName('工作')).toBe('工作')
        })
    })

    describe('isNestedTag', () => {
        it('should return true for nested tags', () => {
            expect(isNestedTag('工作/项目A')).toBe(true)
            expect(isNestedTag('src/core/reactivity')).toBe(true)
        })

        it('should return false for flat tags', () => {
            expect(isNestedTag('待办')).toBe(false)
            expect(isNestedTag('工作')).toBe(false)
        })
    })
})
