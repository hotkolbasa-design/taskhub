// Правка скрипта прямо со страницы подсказчика. Редакторы — админы TaskHub и почты из
// app_settings.podskazchik_editors (через запятую): имён в коде не держим, репозиторий открытый.
// Каждая изменённая ячейка — строка в script_suggestions со статусом «внесено» (было / стало,
// адрес ячейки в решении): правки видны в разделе «Предложения», по ним можно вернуть прежний текст.
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemo } from '@/lib/demo/mode'
import { SHEET_ID, client, loadBaza } from './baza'

let edCache: { at: number; list: string[] } | null = null

async function editorEmails(): Promise<string[]> {
  if (edCache && Date.now() - edCache.at < 300_000) return edCache.list
  const { data } = await createAdminClient().from('app_settings').select('value').eq('key', 'podskazchik_editors').maybeSingle()
  const list = String(data?.value ?? '').split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
  edCache = { at: Date.now(), list }
  return list
}

export async function isEditor(profile: { role?: string | null }, email: string | null | undefined): Promise<boolean> {
  if (isDemo()) return false
  if (profile.role === 'admin') return true
  if (!email) return false
  return (await editorEmails().catch((): string[] => [])).includes(email.trim().toLowerCase())
}

// Какие листы и колонки можно править со страницы; остальное (настройки, хантеры, журнал) — только в таблице
const ETAP = ['Текст RU', 'Текст KZ', 'Пометка', 'Цель', 'Тон']
const LISTS: Record<string, { idCol: string; fields: string[] }> = {
  'Этапы': { idCol: 'Этап ID', fields: ETAP },
  'Этапы v2': { idCol: 'Этап ID', fields: ETAP },
  'Чек-листы': { idCol: 'Этап ID', fields: ['Текст'] },
  'Чек-листы v2': { idCol: 'Этап ID', fields: ['Текст'] },
  'Мотивы': { idCol: 'ID', fields: ['Текст RU', 'Текст KZ', 'Оговорка', 'Тон'] },
  'Ситуации': {
    idCol: 'ID',
    fields: ['Коротко RU', 'Коротко KZ', 'Фразы клиента RU', 'Фразы клиента KZ', 'Что за этим', 'Уточнить RU', 'Уточнить KZ',
      'Ответ RU', 'Ответ KZ', 'Вернуть к записи RU', 'Вернуть к записи KZ', 'Если повторяет', 'Если повторяет KZ', 'После', 'Тон', 'Нельзя'],
  },
}

export type EditRef = { list: string; id: string; blok?: string; tip?: string }
export type EditChange = { field: string; old: string; value: string }

// Сравнение «то ли ещё в ячейке»: страница получает тексты обрезанными, а фразы клиента — построчно
const norm = (s: string) => String(s ?? '').split('\n').map(x => x.trim()).filter(Boolean).join('\n')
const col = (i: number) => String.fromCharCode(65 + i)

export class EditError extends Error {}

export async function applyEdit(ref: EditRef, changes: EditChange[], who: { id?: string; name: string }, meta: { gde: string; comment: string }) {
  if (isDemo()) throw new EditError('В демо-копии правка выключена.')
  const spec = LISTS[ref.list]
  if (!spec) throw new EditError('Этот лист со страницы не правится.')
  const todo = changes.filter(c => spec.fields.includes(c.field) && norm(c.value) !== norm(c.old))
  if (!todo.length) throw new EditError('Ничего не изменилось.')

  const sh = client()
  const values = ((await sh.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${ref.list}'!A1:Z1000` })).data.values ?? []) as unknown[][]
  const head = (values[0] ?? []).map(v => String(v ?? '').trim())
  const ci = (h: string) => head.indexOf(h)
  const cell = (r: unknown[], h: string) => String(r[ci(h)] ?? '')
  const idx = values.map((_, i) => i).slice(1).filter(i => cell(values[i], spec.idCol).trim() === ref.id)
  if (!idx.length) throw new EditError('Строка не найдена — обновите страницу.')

  const writes: { range: string; value: string; c: EditChange }[] = []
  for (const c of todo) {
    const k = ci(c.field)
    if (k < 0) throw new EditError(`В листе «${ref.list}» нет колонки «${c.field}».`)
    let rows = idx
    if (ref.list.startsWith('Этапы')) {
      if (c.field === 'Цель' || c.field === 'Тон') {
        // Цель и тон этапа берутся из первой строки этапа, где они заполнены (как в baza.ts)
        const filled = idx.filter(i => cell(values[i], c.field).trim())
        rows = [filled[0] ?? idx[0]]
      } else rows = idx.filter(i => cell(values[i], 'Блок').trim() === (ref.blok ?? '').trim())
    } else if (ref.list.startsWith('Чек-листы')) {
      rows = idx.filter(i => cell(values[i], 'Тип').trim() === (ref.tip ?? '') && norm(cell(values[i], 'Текст')) === norm(c.old)).slice(0, 1)
    }
    if (rows.length !== 1) throw new EditError('Не удалось однозначно найти место правки — обновите страницу.')
    const r = rows[0]
    if (norm(cell(values[r], c.field)) !== norm(c.old)) throw new EditError('Этот текст уже успели поменять — обновите страницу и поправьте ещё раз.')
    writes.push({ range: `'${ref.list}'!${col(k)}${r + 1}`, value: c.value.trim(), c })
  }

  await sh.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: writes.map(w => ({ range: w.range, values: [[w.value]] })) },
  })

  const now = new Date().toISOString()
  const { data } = await createAdminClient().from('script_suggestions').insert(writes.map(w => ({
    author_id: who.id ?? null, author_name: who.name, gde: meta.gde.slice(0, 200), pole: w.c.field,
    lang: / KZ$/.test(w.c.field) ? 'kz' : 'ru', frag: w.c.old.slice(0, 8000), variant: w.value.slice(0, 8000),
    comment: meta.comment.slice(0, 2000), status: 'applied',
    decision: `Внесено со страницы подсказчика · ${w.range.replace(/'/g, '')}`, decided_by: who.name, decided_at: now,
  }))).select('id')

  await loadBaza(true).catch(() => {})
  return { n: (data ?? []).map(x => x.id as number), cells: writes.map(w => w.range) }
}
