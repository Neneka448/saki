/**
 * IPC 通道定义
 * 所有主进程和渲染进程之间的通信通道
 */
export const channels = {
  // 应用相关
  app: {
    ping: 'app:ping',
    getActiveProjectId: 'app:getActiveProjectId',
    setActiveProjectId: 'app:setActiveProjectId',
    getLastProjectId: 'app:getLastProjectId',
    activeProjectChanged: 'app:activeProjectChanged',
    showQuickCapture: 'app:showQuickCapture',
    hideQuickCapture: 'app:hideQuickCapture',
    setQuickCapturePinned: 'app:setQuickCapturePinned',
    isQuickCapturePinned: 'app:isQuickCapturePinned',
    getQuickCaptureShortcut: 'app:getQuickCaptureShortcut',
    setQuickCaptureShortcut: 'app:setQuickCaptureShortcut',
    resetQuickCaptureShortcut: 'app:resetQuickCaptureShortcut',
  },

  // 项目相关
  project: {
    create: 'project:create',
    getById: 'project:getById',
    getAll: 'project:getAll',
    update: 'project:update',
    delete: 'project:delete',
  },

  // 卡片相关
  card: {
    create: 'card:create',
    getById: 'card:getById',
    getListByProject: 'card:getListByProject',
    update: 'card:update',
    updateMeta: 'card:updateMeta',
    delete: 'card:delete',
    changed: 'card:changed',
    // 标签操作
    getTags: 'card:getTags',
    addTag: 'card:addTag',
    removeTag: 'card:removeTag',
    // 引用操作
    addReference: 'card:addReference',
    getReferencedCards: 'card:getReferencedCards',
    getReferencingCards: 'card:getReferencingCards',
    // 筛选
    getByTag: 'card:getByTag',
    getByTags: 'card:getByTags',
    batchUpdate: 'card:batchUpdate',
  },

  // 标签相关
  tag: {
    create: 'tag:create',
    getById: 'tag:getById',
    getByName: 'tag:getByName',
    getOrCreate: 'tag:getOrCreate',
    getAllUserTags: 'tag:getAllUserTags',
    getAllWithUsageCount: 'tag:getAllWithUsageCount',
    update: 'tag:update',
    updateMeta: 'tag:updateMeta',
    delete: 'tag:delete',
    merge: 'tag:merge',
  },

  // 关系相关
  relation: {
    create: 'relation:create',
    getById: 'relation:getById',
    find: 'relation:find',
    delete: 'relation:delete',
  },

  // 资源文件相关
  asset: {
    saveImage: 'asset:saveImage',
    getAssetPath: 'asset:getAssetPath',
    deleteAsset: 'asset:deleteAsset',
  },
} as const
