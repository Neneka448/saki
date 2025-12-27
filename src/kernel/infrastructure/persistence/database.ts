import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type DrizzleDB = BetterSQLite3Database<typeof schema>

/**
 * 数据库管理器
 */
export class DatabaseManager {
  private db: DrizzleDB | null = null
  private sqlite: Database.Database | null = null

  constructor(private dbPath: string) { }

  /**
   * 初始化数据库
   */
  init(): DrizzleDB {
    if (this.db) return this.db

    console.log(`[DB] Initializing database at: ${this.dbPath}`)

    this.sqlite = new Database(this.dbPath)
    this.sqlite.pragma('journal_mode = WAL')

    this.db = drizzle(this.sqlite, { schema })
    this.runMigrations()

    return this.db
  }

  /**
   * 获取数据库实例
   */
  getDb(): DrizzleDB {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.sqlite) {
      this.sqlite.close()
      this.sqlite = null
      this.db = null
      console.log('[DB] Database closed')
    }
  }

  /**
   * 执行迁移
   */
  private runMigrations(): void {
    if (!this.sqlite) return

    // 创建 projects 表
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        extra TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS card_metas (
        card_id INTEGER PRIMARY KEY,
        title TEXT,
        summary TEXT,
        word_count INTEGER,
        extra TEXT,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
      )
    `)

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        namespace TEXT NOT NULL DEFAULT 'user',
        color TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tag_metas (
        tag_id INTEGER PRIMARY KEY,
        description TEXT,
        icon TEXT,
        extra TEXT,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        meta TEXT,
        created_at INTEGER NOT NULL
      )
    `)

    // 索引
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id, source_type)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id, target_type)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tags_namespace ON tags(namespace)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(project_id)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cards_project ON cards(project_id)`)
    this.sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_card_metas_title ON card_metas(title)`)

    console.log('[DB] Migrations completed')
  }
}

export { schema }
