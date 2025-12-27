import { ProjectService } from '../domain/services/ProjectService'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../domain/entities/Project'
import { Result, ok, err } from './Result'

export class ProjectApi {
    constructor(private projectService: ProjectService) { }

    create(input: CreateProjectInput): Result<Project> {
        try {
            const project = this.projectService.create(input)
            return ok(project)
        } catch (error) {
            return err(error instanceof Error ? error.message : 'Failed to create project')
        }
    }

    getById(id: number): Result<Project | undefined> {
        try {
            return ok(this.projectService.getById(id))
        } catch (error) {
            return err(error instanceof Error ? error.message : 'Failed to get project')
        }
    }

    getAll(): Result<Project[]> {
        try {
            return ok(this.projectService.getAll())
        } catch (error) {
            return err(error instanceof Error ? error.message : 'Failed to get projects')
        }
    }

    update(input: UpdateProjectInput): Result<Project | undefined> {
        try {
            return ok(this.projectService.update(input))
        } catch (error) {
            return err(error instanceof Error ? error.message : 'Failed to update project')
        }
    }

    delete(id: number): Result<boolean> {
        try {
            return ok(this.projectService.delete(id))
        } catch (error) {
            return err(error instanceof Error ? error.message : 'Failed to delete project')
        }
    }
}
