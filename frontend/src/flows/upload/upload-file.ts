export const ACCEPTED_IMAGE_TYPES = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const acceptedExtensions = ['jpg', 'jpeg', 'png', 'webp']

export function validateUploadFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!acceptedExtensions.includes(extension)) return `仅支持 ${acceptedExtensions.join('/')} 格式`
  if (file.size > MAX_UPLOAD_BYTES) return '文件过大（>8MB）'
  return null
}
