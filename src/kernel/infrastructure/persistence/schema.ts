import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * 项目表
 */
export const projects = sqliteTable('projects', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    extra: text('extra', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

/**
 * 卡片表 - 只存内容本体
 */
export const cards = sqliteTable('cards', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

/**
 * 卡片元信息表
 */
export const cardMetas = sqliteTable('card_metas', {
    cardId: integer('card_id').primaryKey(),
    title: text('title'),
    summary: text('summary'),
    wordCount: integer('word_count'),
    extra: text('extra', { mode: 'json' }).$type<Record<string, unknown>>(),
})

/**
 * 标签表
 */
export const tags = sqliteTable('tags', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id').notNull(),
    name: text('name').notNull(),
    namespace: text('namespace').notNull().default('user'),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

/**
 * 标签元信息表
 */
export const tagMetas = sqliteTable('tag_metas', {
    tagId: integer('tag_id').primaryKey(),
    description: text('description'),
    icon: text('icon'),
    extra: text('extra', { mode: 'json' }).$type<Record<string, unknown>>(),
})

/**
 * 关系表
 */
export const relations = sqliteTable('relations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id').notNull(),
    sourceType: text('source_type').notNull(),
    targetId: integer('target_id').notNull(),
    targetType: text('target_type').notNull(),
    relationType: text('relation_type').notNull(),
    meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
