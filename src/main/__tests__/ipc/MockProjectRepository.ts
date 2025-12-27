import type { IProjectRepository } from '../../../kernel/domain/repositories/IProjectRepository'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../kernel/domain/entities/Project'

/**
 * Mock 项目仓储 - 用于单元测试
 */
export class MockProjectRepository implements IProjectRepository {
    private projects: Map<number, Project> = new Map()
    private nextId = 1

    create(input: CreateProjectInput): Project {
        const id = this.nextId++
        const now = new Date()

        const project: Project = {
            id,
            name: input.name,
            description: input.description ?? null,
            color: input.color ?? null,
            icon: input.icon ?? null,
            extra: input.extra ?? null,
            createdAt: now,
            updatedAt: now,
        }
        this.projects.set(id, project)

        return project
    }

    getById(id: number): Project | undefined {
        return this.projects.get(id)
    }

    getAll(): Project[] {
        return Array.from(this.projects.values()).sort((a, b) =>
            b.updatedAt.getTime() - a.updatedAt.getTime()
        )
    }

    update(input: UpdateProjectInput): Project | undefined {
        const project = this.projects.get(input.id)
        if (!project) return undefined

        if (input.name !== undefined) project.name = input.name
        if (input.description !== undefined) project.description = input.description
        if (input.color !== undefined) project.color = input.color
        if (input.icon !== undefined) project.icon = input.icon
        if (input.extra !== undefined) project.extra = input.extra
        project.updatedAt = new Date()

        return project
    }

    delete(id: number): boolean {
        return this.projects.delete(id)
    }

    // 测试辅助方法
    clear(): void {
        this.projects.clear()
        this.nextId = 1
    }
}
