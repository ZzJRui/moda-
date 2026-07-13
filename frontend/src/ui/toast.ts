/**
 * Moda 自研轻量 Toast（见 DESIGN.md §2.1 规则 3）。
 *
 * 背景：antd-mobile v5 的命令式 Toast.show 在 React 19 下静默失效
 * （closet 页曾手写 flashToast 绕过），全应用统一改用本实现。
 * 纯 DOM 实现，不依赖 React 渲染树，样式在 index.css 的 .moda-toast。
 */

let el: HTMLDivElement | null = null
let timer = 0

export function showToast(message: string, durationMs = 1800): void {
  if (typeof document === 'undefined') return
  if (!el) {
    el = document.createElement('div')
    el.className = 'moda-toast'
    el.setAttribute('role', 'status')
  }
  el.textContent = message
  if (!el.isConnected) document.body.appendChild(el)
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    el?.remove()
  }, durationMs)
}
