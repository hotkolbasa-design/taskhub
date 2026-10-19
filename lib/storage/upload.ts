'use client'

import { createClient } from '@/lib/supabase/client'
import { createUploadTicket } from '@/app/actions/storage'
import { BUCKET, MAX_UPLOAD_BYTES, type UploadFolder } from '@/lib/storage/const'

export type UploadedFile = { url: string; name: string; size: number }

export class FileTooLargeError extends Error {
  constructor() { super('Файл больше 25 МБ') }
}

/**
 * Загружает файл прямо в хранилище по одноразовой подписи.
 * Через сервер приложения идёт только запрос подписи — иначе упираемся в лимит
 * тела функции на Vercel (4.5 МБ) и получаем 413 на обычном снимке экрана.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder,
  subPath?: string,
): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new FileTooLargeError()

  const { path, token, publicUrl } = await createUploadTicket(folder, file.name || 'file', subPath)
  const { error } = await createClient().storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(error.message)

  return { url: publicUrl, name: file.name || 'файл', size: file.size }
}
