import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, validateUploadFile } from './upload-file'

function file(name: string, size: number) {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
}

describe('upload file validation', () => {
  it('accepts supported image extensions', () => {
    expect(validateUploadFile(file('coat.JPG', 10))).toBeNull()
    expect(validateUploadFile(file('shoe.webp', 10))).toBeNull()
  })

  it('rejects unsupported extensions and oversized files', () => {
    expect(validateUploadFile(file('notes.txt', 10))).toContain('仅支持')
    expect(validateUploadFile(file('coat.jpg', MAX_UPLOAD_BYTES + 1))).toBe('文件过大（>8MB）')
  })
})
