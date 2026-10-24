'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET, UPLOAD_FOLDERS, type UploadFolder } from '@/lib/storage/const'
import { t } from '@/lib/i18n'

type UploadTicket = { path: string; token: string; publicUrl: string }

/**
 * Разрешение на загрузку одного файла прямо в хранилище, в обход сервера приложения.
 *
 * Раньше файл шёл телом server action, а Vercel режет тело функции на 4.5 МБ и отвечает
 * 413 FUNCTION_PAYLOAD_TOO_LARGE — `bodySizeLimit` в next.config это не обходит, он про
 * собственный лимит Next. Снимок экрана с ретины весит больше, поэтому вложения в
 * комментариях не отправлялись. Теперь сервер только подписывает путь, а файл клиент
 * заливает в Supabase напрямую: через функцию идут несколько сотен байт.
 */
export async function createUploadTicket(
  folder: UploadFolder,
  fileName: string,
  subPath?: string,
): Promise<UploadTicket> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error(t('Не авторизован'))

  if (!UPLOAD_FOLDERS.includes(folder)) throw new Error(t('Недопустимая папка'))
  // Путь целиком собираем на сервере: с клиента приходит только имя файла
  const safeSub = subPath && /^[0-9a-f-]{36}$/i.test(subPath) ? `${subPath}/` : ''
  const ext = (fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`
  const path = `${folder}/${safeSub}${name}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)
  return { path, token: data.token, publicUrl }
}
