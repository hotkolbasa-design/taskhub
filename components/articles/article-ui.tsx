'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ArticleCategory, ArticleStatus } from '@/types'

export const CATEGORIES: { value: ArticleCategory; label: string }[] = [
  { value: 'taskhub',   label: 'Работа в TaskHub' },
  { value: 'processes', label: 'Процессы компании' },
  { value: 'hr',        label: 'Кадры' },
  { value: 'sales',     label: 'Продажи и маркетинг' },
  { value: 'other',     label: 'Прочее' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

export const STATUS_META: Record<ArticleStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Черновик',    color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  review:    { label: 'На проверке', color: '#F7C04F', bg: 'rgba(247,192,79,0.15)' },
  published: { label: 'Опубликована',color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)' },
}

/** Промпт для своего ИИ: задаёт единый вид инструкций, кто бы их ни писал. */
export const AI_PROMPT = `Напиши инструкцию для сотрудников компании.

Тема: [ОПИШИ, О ЧЁМ ИНСТРУКЦИЯ]

Требования к тексту:
- Пиши по-русски, простым языком, на «вы», без канцелярита
- Начни с одного абзаца: зачем это нужно и когда применяется
- Дальше пронумерованные шаги — что нажать и что произойдёт
- Важные предупреждения выделяй жирным
- В конце — раздел «Частые вопросы» с 3–5 вопросами и короткими ответами
- Не выдумывай кнопки и разделы, которых нет: если чего-то не знаешь, напиши [УТОЧНИТЬ]

Формат ответа — разметка Markdown:
## для заголовков разделов, ### для подзаголовков,
1. 2. 3. для шагов, - для списков, **жирный** для важного,
| таблицы | если нужно сравнение |

Выдай только текст инструкции, без вступлений вроде «Конечно, вот инструкция».`

export function StatusBadge({ status }: { status: ArticleStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md whitespace-nowrap"
      style={{ color: meta.color, background: meta.bg }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function RequiredBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md whitespace-nowrap"
      style={{ color: '#F75C6E', background: 'rgba(247,92,110,0.15)' }}>
      Обязательная
    </span>
  )
}

/** Разметка из ИИ приходит обычным Markdown — рендерим её в стиле платформы. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: props => <h1 className="text-2xl font-semibold mt-6 mb-3" style={{ color: 'var(--text)' }} {...props} />,
          h2: props => <h2 className="text-xl font-semibold mt-6 mb-3" style={{ color: 'var(--text)' }} {...props} />,
          h3: props => <h3 className="text-base font-semibold mt-5 mb-2" style={{ color: 'var(--text)' }} {...props} />,
          p: props => <p className="mb-3 leading-relaxed" style={{ color: 'var(--text)' }} {...props} />,
          ul: props => <ul className="mb-3 pl-5 list-disc space-y-1.5" style={{ color: 'var(--text)' }} {...props} />,
          ol: props => <ol className="mb-3 pl-5 list-decimal space-y-1.5" style={{ color: 'var(--text)' }} {...props} />,
          li: props => <li className="leading-relaxed" {...props} />,
          strong: props => <strong className="font-semibold" style={{ color: 'var(--text)' }} {...props} />,
          a: props => <a className="underline" style={{ color: 'var(--accent)' }} target="_blank" rel="noreferrer" {...props} />,
          blockquote: props => (
            <blockquote className="my-4 pl-4 py-2 rounded-r-lg"
              style={{ borderLeft: '3px solid var(--accent)', background: 'rgba(124,92,246,0.06)', color: 'var(--text2)' }} {...props} />
          ),
          code: props => (
            <code className="px-1.5 py-0.5 rounded text-[0.9em]"
              style={{ background: 'var(--surface2)', fontFamily: 'var(--font-mono)', color: 'var(--text)' }} {...props} />
          ),
          table: props => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }} {...props} />
            </div>
          ),
          th: props => (
            <th className="px-3 py-2 text-left text-xs font-medium"
              style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }} {...props} />
          ),
          td: props => (
            <td className="px-3 py-2 align-top"
              style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }} {...props} />
          ),
          hr: () => <hr className="my-6" style={{ border: 'none', borderTop: '1px solid var(--border)' }} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className="rounded-full border-2 animate-spin inline-block"
      style={{ width: size, height: size, borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} />
  )
}
