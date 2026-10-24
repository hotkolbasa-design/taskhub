// Демо-копия для показа платформы: отдельный проект Vercel на базе taskhub-dev с DEMO_MODE=1.
// В ней не трогаются внешние системы Globalos: CRM читает выдуманные листы из
// lib/demo/crm-sheets.ts, синхронизация учеников с Битриксом выключена.
export function isDemo(): boolean {
  return process.env.DEMO_MODE === '1'
}
