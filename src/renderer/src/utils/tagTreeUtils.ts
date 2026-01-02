import type { TagWithUsageCount } from '../../../shared/ipc/types'

/**
 * 标签树节点
 */
export interface TagTreeNode {
    /** 节点名称（不含路径） */
    name: string
    /** 完整路径 */
    fullPath: string
    /** 深度（0 开始） */
    depth: number
    /** 是否为叶子节点（对应真实标签） */
    isTag: boolean
    /** 如果是叶子节点，对应的标签 */
    tag?: TagWithUsageCount
    /** 子节点 */
    children: TagTreeNode[]
    /** 该节点及所有子节点的卡片数量总和 */
    totalCount: number
}

/**
 * 将平铺的标签列表转换为树形结构
 * 使用 `/` 作为路径分隔符
 */
export function buildTagTree(tags: TagWithUsageCount[]): TagTreeNode[] {
    const root: TagTreeNode[] = []
    const nodeMap = new Map<string, TagTreeNode>()

    // 对标签按名称排序，确保父节点先被创建
    const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name))

    for (const tag of sortedTags) {
        const parts = tag.name.split('/')
        let currentPath = ''
        let currentLevel = root

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isLast = i === parts.length - 1
            currentPath = currentPath ? `${currentPath}/${part}` : part

            let node = nodeMap.get(currentPath)

            if (!node) {
                node = {
                    name: part,
                    fullPath: currentPath,
                    depth: i,
                    isTag: false,
                    children: [],
                    totalCount: 0,
                }
                nodeMap.set(currentPath, node)
                currentLevel.push(node)
            }

            // 如果是最后一个部分，标记为真实标签
            if (isLast) {
                node.isTag = true
                node.tag = tag
                node.totalCount = tag.usageCount
            }

            currentLevel = node.children
        }
    }

    // 计算每个节点的 totalCount（包含子节点）
    const calculateTotalCount = (nodes: TagTreeNode[]): number => {
        let total = 0
        for (const node of nodes) {
            const childrenCount = calculateTotalCount(node.children)
            node.totalCount = (node.tag?.usageCount || 0) + childrenCount
            total += node.totalCount
        }
        return total
    }

    calculateTotalCount(root)

    return root
}

/**
 * 扁平化树节点用于渲染（带缩进信息）
 */
export interface FlatTagTreeNode extends TagTreeNode {
    /** 是否展开 */
    expanded: boolean
    /** 是否可见（父节点展开时才可见） */
    visible: boolean
}

/**
 * 将树形结构扁平化，便于列表渲染
 */
export function flattenTagTree(
    nodes: TagTreeNode[],
    expandedPaths: Set<string>,
    parentVisible = true
): FlatTagTreeNode[] {
    const result: FlatTagTreeNode[] = []

    for (const node of nodes) {
        const hasChildren = node.children.length > 0
        const expanded = expandedPaths.has(node.fullPath)
        const visible = parentVisible

        result.push({
            ...node,
            expanded,
            visible,
        })

        if (hasChildren) {
            const childNodes = flattenTagTree(node.children, expandedPaths, visible && expanded)
            result.push(...childNodes)
        }
    }

    return result
}

/**
 * 获取标签的显示名称（去掉路径前缀）
 */
export function getTagDisplayName(tagName: string): string {
    const parts = tagName.split('/')
    return parts[parts.length - 1]
}

/**
 * 检查标签名是否为嵌套标签
 */
export function isNestedTag(tagName: string): boolean {
    return tagName.includes('/')
}
