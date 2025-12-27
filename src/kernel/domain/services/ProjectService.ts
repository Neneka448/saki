import type { IProjectRepository } from '../repositories/IProjectRepository'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../entities/Project'

export class ProjectService {
    constructor(private projectRepo: IProjectRepository) { }

    create(input: CreateProjectInput): Project {
        if (!input.name?.trim()) {
            throw new Error('Project name is required')
        }
        return this.projectRepo.create(input)
    }

    getById(id: number): Project | undefined {
        return this.projectRepo.getById(id)
    }

    getAll(): Project[] {
        return this.projectRepo.getAll()
    }

    update(input: UpdateProjectInput): Project | undefined {
        if (input.name !== undefined && !input.name.trim()) {
            throw new Error('Project name cannot be empty')
        }
        return this.projectRepo.update(input)
    }

    delete(id: number): boolean {
        return this.projectRepo.delete(id)
    }
}
