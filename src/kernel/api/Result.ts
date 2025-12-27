/**
 * 统一结果类型
 */
export type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string }

/**
 * 创建成功结果
 */
export function ok<T>(data: T): Result<T> {
    return { success: true, data }
}

/**
 * 创建失败结果
 */
export function err<T>(error: string): Result<T> {
    return { success: false, error }
}
