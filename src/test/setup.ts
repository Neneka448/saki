/**
 * Vitest 全局 setup
 * 为测试环境提供必要的浏览器 API mock
 */

import { vi } from 'vitest'

// Mock getComputedStyle（CodeMirror 需要）- 强制覆盖
const mockGetComputedStyle = vi.fn().mockImplementation(() => ({
  getPropertyValue: vi.fn().mockReturnValue(''),
  lineHeight: '20px',
  fontSize: '14px',
  fontFamily: 'monospace',
  font: '14px monospace',
  padding: '0px',
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  border: 'none',
  borderTop: 'none',
  borderRight: 'none',
  borderBottom: 'none',
  borderLeft: 'none',
  boxSizing: 'border-box',
  display: 'block',
  width: '100px',
  height: '100px',
  letterSpacing: 'normal',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflow: 'visible',
  tabSize: '4',
}))

// 强制覆盖 window.getComputedStyle
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
    configurable: true,
  })
}

// Mock ResizeObserver（CodeMirror 可能需要）
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

// Mock MutationObserver（如果不存在）
if (typeof window !== 'undefined' && !window.MutationObserver) {
  window.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
  }))
}

// Mock requestAnimationFrame
if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
  window.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
    return setTimeout(cb, 0)
  })
}

// Mock cancelAnimationFrame
if (typeof window !== 'undefined' && !window.cancelAnimationFrame) {
  window.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
    clearTimeout(id)
  })
}

// Mock document.createRange（某些编辑器需要）
if (typeof document !== 'undefined' && !document.createRange) {
  document.createRange = vi.fn().mockReturnValue({
    setStart: vi.fn(),
    setEnd: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    }),
    getClientRects: vi.fn().mockReturnValue([]),
    commonAncestorContainer: document.body,
  })
}

// Mock Selection API
if (typeof window !== 'undefined' && !window.getSelection) {
  window.getSelection = vi.fn().mockReturnValue({
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: vi.fn().mockReturnValue(null),
    rangeCount: 0,
  })
}
