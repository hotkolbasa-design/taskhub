/** Общее для сервера и клиента: файл с 'use server' может экспортировать только функции. */
export const BUCKET = 'task-attachments'

/** Столько же стоит в самом бакете (file_size_limit) — держать синхронно. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** Куда разрешено класть файлы. Белый список, потому что папка приходит с клиента. */
export const UPLOAD_FOLDERS = ['tasks', 'expenses', 'articles'] as const
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number]
