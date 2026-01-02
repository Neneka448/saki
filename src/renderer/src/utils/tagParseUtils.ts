/**
 * 正文标签解析工具
 * 
 * 语法规则：
 * - `#tagName` - 紧跟文字，无空格
 * - `# 标题` - Markdown 标题（不解析）
 * 
 * 标签名规则：
 * - 允许：字母、数字、中文、下划线、连字符、斜杠(用于嵌套)
 * - 不允许：空格、特殊符号
 */

/**
 * 匹配正文中标签的正则表达式
 * 
 * 规则说明：
 * - (?:^|[^\w\u4e00-\u9fa5#]) - 开头或非标签字符前
 * - #(?!#) - # 后面不能紧跟另一个 #（避免匹配 ## 标题）
 * - ([^\s#]+) - 标签内容：非空白非#的连续字符
 */
const TAG_PATTERN = /(?:^|[\s\n])#([^\s#\[\](){}]+)/g

/**
 * 判断是否为 Markdown 标题语法
 * Markdown 标题要求 # 后有空格
 */
const isMarkdownHeading = (line: string, hashIndex: number): boolean => {
    // 检查是否在行首（允许前面有空白）
    const beforeHash = line.slice(0, hashIndex).trim()
    if (beforeHash !== '') return false

    // 检查 # 后面是否有空格
    const afterHash = line.slice(hashIndex + 1)
    return afterHash.length > 0 && afterHash[0] === ' '
}

export interface ParsedTag {
    name: string
    start: number
    end: number
}

/**
 * 获取内容中所有代码区域的范围（代码块和行内代码）
 * 这些区域内的内容不应该被解析为标签
 */
const getCodeRanges = (content: string): Array<{ start: number; end: number }> => {
    const ranges: Array<{ start: number; end: number }> = []

    // 匹配围栏代码块 ```...```
    const fencePattern = /```[\s\S]*?```/g
    let match
    while ((match = fencePattern.exec(content)) !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }

    // 匹配行内代码 `...`（但不匹配 ```）
    const inlinePattern = /(?<!`)`(?!``)[^`\n]+`(?!`)/g
    while ((match = inlinePattern.exec(content)) !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }

    return ranges
}

/**
 * 检查位置是否在代码区域内
 */
const isInCodeRange = (pos: number, ranges: Array<{ start: number; end: number }>): boolean => {
    return ranges.some(r => pos >= r.start && pos < r.end)
}

/**
 * 从正文中提取所有标签
 */
export const parseTagsFromContent = (content: string): ParsedTag[] => {
    const tags: ParsedTag[] = []
    const codeRanges = getCodeRanges(content)
    const lines = content.split('\n')
    let offset = 0

    for (const line of lines) {
        // 检查每个 # 的位置
        let searchStart = 0
        while (true) {
            const hashIndex = line.indexOf('#', searchStart)
            if (hashIndex === -1) break

            const absolutePos = offset + hashIndex

            // 跳过代码区域内的 #
            if (isInCodeRange(absolutePos, codeRanges)) {
                searchStart = hashIndex + 1
                continue
            }

            // 跳过 Markdown 标题
            if (isMarkdownHeading(line, hashIndex)) {
                searchStart = hashIndex + 1
                continue
            }

            // 检查 # 前面是否为空白或行首
            const charBefore = hashIndex > 0 ? line[hashIndex - 1] : ' '
            if (!/\s/.test(charBefore) && hashIndex > 0) {
                searchStart = hashIndex + 1
                continue
            }

            // 检查 # 后面是否紧跟标签内容
            const afterHash = line.slice(hashIndex + 1)
            const match = afterHash.match(/^([^\s#\[\](){}]+)/)

            if (match) {
                const tagName = match[1]
                const absoluteStart = absolutePos
                const absoluteEnd = absoluteStart + 1 + tagName.length

                tags.push({
                    name: tagName,
                    start: absoluteStart,
                    end: absoluteEnd,
                })
            }

            searchStart = hashIndex + 1
        }

        offset += line.length + 1 // +1 for newline
    }

    return tags
}

/**
 * 获取去重后的标签名列表
 */
export const extractUniqueTagNames = (content: string): string[] => {
    const parsed = parseTagsFromContent(content)
    const names = new Set(parsed.map(t => t.name))
    return Array.from(names)
}

/**
 * 验证标签名是否有效
 */
export const isValidTagName = (name: string): boolean => {
    if (!name || name.length === 0) return false
    if (name.length > 100) return false
    // 不能以斜杠开头或结尾
    if (name.startsWith('/') || name.endsWith('/')) return false
    // 不能有连续斜杠
    if (name.includes('//')) return false
    // 不能是纯数字
    if (/^\d+$/.test(name)) return false
    // 不能以数字开头（避免和 Markdown 语法冲突，如 #1、#2）
    if (/^\d/.test(name)) return false
    return true
}

/**
 * 检测当前光标位置是否在输入标签
 * 用于触发自动补全
 */
export const detectTagTrigger = (
    content: string,
    cursorPos: number
): { active: boolean; query: string; triggerPos: number } => {
    // 向前查找 #
    let start = cursorPos - 1
    while (start >= 0) {
        const char = content[start]
        if (char === '#') {
            // 检查 # 前面是否为空白或行首
            const charBefore = start > 0 ? content[start - 1] : '\n'
            if (/[\s\n]/.test(charBefore) || start === 0) {
                const query = content.slice(start + 1, cursorPos)
                // 确保 query 中没有空格（空格意味着标签结束）
                if (!/\s/.test(query)) {
                    return {
                        active: true,
                        query,
                        triggerPos: start,
                    }
                }
            }
            break
        }
        // 遇到空白或换行，停止搜索
        if (/[\s\n]/.test(char)) break
        start--
    }

    return { active: false, query: '', triggerPos: 0 }
}
