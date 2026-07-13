/**
 * antd-mobile 收编层（包装收编策略，见 DESIGN.md §2）。
 *
 * 业务代码（src/flows/）不得直接 import 'antd-mobile'，一律从 src/ui 引入。
 * antd-mobile 是内部实现细节：这里再导出的组件未来可逐个换成自研实现，
 * 业务代码不需要改动。
 *
 * 注意：不导出 Toast —— 其命令式 API 在 React 19 下失效，用 ui/toast 的 showToast。
 */
export {
  Button,
  Dialog,
  SafeArea,
  Image,
  Tag,
  SpinLoading,
  ErrorBlock,
  Empty,
  PullToRefresh,
  NavBar,
  ActionSheet,
  Result,
  Swiper,
} from 'antd-mobile'

export type { SwiperRef } from 'antd-mobile/es/components/swiper'
export type { Action } from 'antd-mobile/es/components/action-sheet'
