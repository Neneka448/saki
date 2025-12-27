import type { Project, CreateProjectInput, UpdateProjectInput } from '../entities/Project'

export interface IProjectRepository {
    create(input: CreateProjectInput): Project
    getById(id: number): Project | undefined
    getAll(): Project[]
    update(input: UpdateProjectInput): Project | undefined
    delete(id: number): boolean
}
