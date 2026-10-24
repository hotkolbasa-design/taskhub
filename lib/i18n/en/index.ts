// Английский словарь демо-копии: ключ — русская строка интерфейса как есть.
// Разделы лежат отдельными файлами, чтобы их можно было переводить независимо.
import { common, commonPlurals } from './common'
import { shell, shellPlurals } from './shell'
import { tasks, tasksPlurals } from './tasks'
import { workspace, workspacePlurals } from './workspace'
import { crm, crmPlurals } from './crm'
import { demo, demoPlurals } from './demo'

export const EN: Record<string, string> = { ...common, ...shell, ...tasks, ...workspace, ...crm, ...demo }

export const EN_PLURALS: Record<string, [string, string]> = {
  ...commonPlurals, ...shellPlurals, ...tasksPlurals, ...workspacePlurals, ...crmPlurals, ...demoPlurals,
}
