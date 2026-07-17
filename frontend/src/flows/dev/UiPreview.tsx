import { Button, EmptyState, IconButton, PageHeader, Surface } from '@moda/ui'
import './UiPreview.css'

export function UiPreview() {
  return (
    <div className="ui-preview">
      <PageHeader title="Moda UI" />
      <div className="ui-preview__content">
        <Surface tone="raised" className="ui-preview__surface">
          <strong>操作</strong>
          <Button>上传衣物</Button>
          <Button variant="secondary">次要操作</Button>
          <Button variant="ghost">文字操作</Button>
          <div className="ui-preview__icon-row"><IconButton label="收藏" icon="heart" /><IconButton label="关闭" icon="x" /></div>
        </Surface>
        <Surface><EmptyState title="衣柜还是空的" description="真实产品里的空状态必须说明下一步。" action={<Button block>上传衣物</Button>} /></Surface>
      </div>
    </div>
  )
}
