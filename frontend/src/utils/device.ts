/* -------------------------------------------------- */
/*  设备类型判断                                       */
/* -------------------------------------------------- */
/* 用于区分手机浏览器与桌面浏览器：
 * 手机端上传 ActionSheet 会显示"拍照"按钮（调用手机相机），
 * 桌面端隐藏该项，避免用户点击后触发无意义的相机权限弹窗。
 *
 * 三级回退：
 *   1) navigator.userAgentData.mobile        （现代 Chromium，最准）
 *   2) (any-pointer: coarse) + max-width     （Safari / Firefox）
 *   3) UA 关键字                              （老浏览器兜底）
 */

interface UADataLike {
  mobile?: boolean
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  // 1) UA Client Hints
  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean') {
    return uaData.mobile
  }

  // 2) media query 组合
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const coarse = window.matchMedia('(any-pointer: coarse)').matches
    const narrow = window.matchMedia('(max-width: 900px)').matches
    if (coarse && narrow) return true
  }

  // 3) UA 关键字兜底
  return /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
