'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createComment, getComments, uploadAttachment } from '@/app/(dashboard)/projects/[id]/backlog/actions'

type Attachment = { url: string; name: string; size: number }

type CommentAuthor = {
  id: string
  full_name: string | null
  login: string
  avatar_url: string | null
}

type Comment = {
  id: string
  task_id: string
  author_id: string
  text: string
  attachments: Attachment[]
  created_at: string
  author: CommentAuthor | null
}

type PendingFile = { file: File; previewUrl: string }

function Avatar({ name, login, size = 28 }: { name: string | null; login: string; size?: number }) {
  const initial = (name || login)[0].toUpperCase()
  const colors = ['#4F8EF7', '#2DD4A0', '#F7C04F', '#F75C6E', '#A78BFA', '#FB923C']
  const color = colors[(name || login).charCodeAt(0) % colors.length]
  return (
    <span className="rounded-full flex items-center justify-center font-medium shrink-0"
      style={{ width: size, height: size, background: color, color: '#fff', fontSize: size * 0.4 }}>
      {initial}
    </span>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ч назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
        onClick={onClose}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <img src={url} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

type Props = {
  taskId: string
  projectId: string
  initialComments?: unknown[]
}

export default function CommentsSection({ taskId, projectId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>((initialComments ?? []) as Comment[])
  const [loading, setLoading] = useState((initialComments ?? []).length === 0)
  const [collapsed, setCollapsed] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CommentAuthor | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUserId(session.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, login, avatar_url')
          .eq('id', session.user.id)
          .single()
        if (profile) setCurrentUser(profile)
      }

      if ((initialComments ?? []).length === 0) {
        try {
          const data = await getComments(taskId)
          setComments(data as Comment[])
        } catch { /* молча */ }
        setLoading(false)
      }
    }

    init()

    const channel = supabase
      .channel(`comments-${taskId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        async () => {
          try {
            const data = await getComments(taskId)
            setComments(data as Comment[])
          } catch { /* игнорируем */ }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, loading])

  // Paste изображений (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items)
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean) as File[]

    if (files.length === 0) return
    e.preventDefault()
    addFiles(files)
  }, [])

  function addFiles(files: File[]) {
    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
    const newPending: PendingFile[] = valid.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPendingFiles(prev => [...prev, ...newPending].slice(0, 5))
  }

  function removePending(index: number) {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function uploadFiles(files: PendingFile[]): Promise<Attachment[]> {
    const results: Attachment[] = []
    for (const { file } of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('taskId', taskId)
        const url = await uploadAttachment(formData)
        results.push({ url, name: file.name || 'image.png', size: file.size })
      } catch (err) {
        console.error('Upload error:', err)
      }
    }
    return results
  }

  async function handleSend() {
    if ((!text.trim() && pendingFiles.length === 0) || sending) return

    const filesToUpload = [...pendingFiles]
    const messageText = text.trim()

    setText('')
    setPendingFiles([])

    // Оптимистичный комментарий
    const tempId = `temp-${Date.now()}`
    const optimistic: Comment = {
      id: tempId,
      task_id: taskId,
      author_id: currentUserId ?? '',
      text: messageText,
      attachments: filesToUpload.map(f => ({ url: f.previewUrl, name: f.file.name, size: f.file.size })),
      created_at: new Date().toISOString(),
      author: currentUser,
    }
    setComments(prev => [...prev, optimistic])
    setSending(true)

    try {
      setUploading(filesToUpload.length > 0)
      const attachments = filesToUpload.length > 0 ? await uploadFiles(filesToUpload) : []
      setUploading(false)
      await createComment(taskId, projectId, messageText, attachments)

      // Заменяем оптимистичный на реальный
      const fresh = await getComments(taskId)
      setComments(fresh as Comment[])
      filesToUpload.forEach(f => URL.revokeObjectURL(f.previewUrl))
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId))
      setText(messageText)
      setPendingFiles(filesToUpload)
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isSendDisabled = (!text.trim() && pendingFiles.length === 0) || sending

  return (
    <>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <div className="flex flex-col" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Заголовок */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2 px-5 py-3 shrink-0 w-full text-left transition-colors"
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ color: 'var(--text2)', transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Комментарии</span>
          {comments.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--accent)' }}>
              {comments.length}
            </span>
          )}
        </button>

        {/* Список + инпут (сворачиваемые) */}
        {!collapsed && <div className="overflow-y-auto px-5 flex flex-col gap-4"
          style={{ maxHeight: 280, minHeight: comments.length > 0 ? 80 : 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <span className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(136,146,164,0.3)', borderTopColor: 'var(--text2)' }} />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs pb-2" style={{ color: 'var(--text2)' }}>Пока нет комментариев</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-2.5"
                style={{ opacity: comment.id.startsWith('temp-') ? 0.6 : 1 }}>
                <Avatar name={comment.author?.full_name ?? null}
                  login={comment.author?.login ?? '?'} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                      {comment.author?.full_name || comment.author?.login || 'Пользователь'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  {comment.text && (
                    <p className="text-sm whitespace-pre-wrap break-words mb-2"
                      style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                      {comment.text}
                    </p>
                  )}
                  {comment.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {comment.attachments.map((att, i) => (
                        <button key={i} onClick={() => setLightboxUrl(att.url)}
                          className="rounded-lg overflow-hidden shrink-0 transition-opacity hover:opacity-80"
                          style={{ width: 120, height: 90 }}>
                          <img src={att.url} alt={att.name}
                            className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>}

        {/* Инпут */}
        {!collapsed && <div className="px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>

          {/* Превью файлов */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingFiles.map((pf, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden shrink-0"
                  style={{ width: 64, height: 64 }}>
                  <img src={pf.previewUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePending(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            {currentUser && <Avatar name={currentUser.full_name} login={currentUser.login} size={28} />}
            <div className="flex-1 rounded-xl px-3 py-2"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Написать комментарий..."
                rows={1}
                className="w-full bg-transparent outline-none resize-none text-sm"
                style={{ color: 'var(--text)', lineHeight: 1.5, maxHeight: 100 }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }}
              />
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  {/* Прикрепить файл */}
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: 'var(--text2)' }}
                    title="Прикрепить изображение"
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M12.5 6.5L6.5 12.5C5.1 13.9 2.9 13.9 1.5 12.5 0.1 11.1 0.1 8.9 1.5 7.5L7.5 1.5C8.5 0.5 10.1 0.5 11.1 1.5 12.1 2.5 12.1 4.1 11.1 5.1L5.1 11.1C4.5 11.7 3.5 11.7 2.9 11.1 2.3 10.5 2.3 9.5 2.9 8.9L8.5 3.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>
                    Enter — отправить · Shift+Enter — новая строка
                  </span>
                </div>
                <button onClick={handleSend} disabled={isSendDisabled}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {sending || uploading
                    ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 6h10M6 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                  }
                </button>
              </div>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => {
              if (e.target.files) addFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
        </div>}
      </div>
    </>
  )
}
