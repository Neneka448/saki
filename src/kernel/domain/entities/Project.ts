/**
 * 项目实体定义
 */

export interface Project {
    id: number
    name: string
    description: string | null
    color: string | null
    icon: string | null
    extra: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

export interface CreateProjectInput {
    name: string
    description?: string
    color?: string
    icon?: string
    extra?: Record<string, unknown>
}

export interface UpdateProjectInput {
    id: number
    name?: string
    description?: string
    color?: string
    icon?: string
    extra?: Record<string, unknown>
}
