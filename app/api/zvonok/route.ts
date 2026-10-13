// Расшифровка звонка отдела продаж — открывается по ссылке «открыть» из таблицы «Интеграция B24 звонки».
// Страницу собирает Apps Script (просмотрщик «Расшифровки звонков — просмотр»), подпись k проверяет он же.
// Ходим к нему с сервера, а не из браузера: в браузере с несколькими аккаунтами Google сам дописывает
// /u/N/ к адресу script.google.com и показывает «Не удалось открыть файл».

import { getCachedReview, makeReview, type Call } from '@/lib/zvonok/review'

const json = (o: unknown) =>
  new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

const VIEWER =
  'https://script.google.com/macros/s/AKfycbxraJKGlRUmVSU_D7GVfycgZMUUUWVHo6aS3dR3alsV9c8B5SWTAxXteUl75KZzHLCy/exec'

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

function message(text: string, status: number) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Расшифровка звонка</title><p style="font-family:sans-serif;padding:24px">${safe}</p>`,
    { status, headers: HEADERS },
  )
}

// Разбор звонка ИИ занимает до минуты — запрос ?review=1 идёт отдельно от страницы
export const maxDuration = 120

// Колонка разбора справа от реплик: строится в браузере из ?review=1, расшифровка открывается сразу
const REVIEW_UI = `<style>
.w{max-width:1280px}
.row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;border-bottom:1px solid #E4E9E7}
.rv{font-size:13.5px;line-height:1.45;padding:8px 10px;border-radius:8px;margin:4px 0}
.rv b{display:block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px}
.rv.ok{background:#E3F4EC;color:#14533F}.rv.mid{background:#FDF4E3;color:#6B4A0E}.rv.bad{background:#FBEDEB;color:#7A2A22}
.rv i{display:block;font-style:normal;margin-top:4px;color:#141D1A}
.sum{background:#fff;border:1px solid #DBE2E0;border-radius:10px;padding:12px 14px;margin:12px 0;font-size:14.5px;line-height:1.5}
.sum h2{font-size:15px;margin:0 0 6px}.sum p{margin:4px 0}.sum .sc{font-size:22px;font-weight:700;float:right}
.hd{display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8A9994;margin:10px 0 0}
@media(max-width:860px){.row,.hd{grid-template-columns:1fr}.hd span:last-child{display:none}}
</style>
<script>
(function(){
var ts=document.getElementById('ts'); if(!ts) return;
var list=[].slice.call(ts.querySelectorAll('.t'));
list.forEach(function(t,i){var r=document.createElement('div');r.className='row';t.parentNode.insertBefore(r,t);r.appendChild(t);var c=document.createElement('div');c.id='rv'+i;r.appendChild(c)});
var hd=document.createElement('div');hd.className='hd';hd.innerHTML='<span>Расшифровка</span><span>Разбор по скрипту</span>';ts.parentNode.insertBefore(hd,ts);
var sum=document.createElement('div');sum.className='sum';sum.textContent='Разбираю звонок по скрипту — до минуты при первом открытии…';hd.parentNode.insertBefore(sum,hd);
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
fetch(location.pathname+location.search+'&review=1').then(function(r){return r.json()}).then(function(j){
 if(!j.ok){sum.textContent=j.error||'Разбор недоступен.';return}
 var v=j.review;
 sum.innerHTML='<span class="sc">'+e(v.ball)+'/10</span><h2>Разбор по скрипту</h2><p>'+e(v.itog)+'</p><p><b>Сильное:</b> '+e(v.silno)+'</p><p><b>Отработать:</b> '+e(v.glavnoe)+'</p>';
 v.repliki.forEach(function(x){var c=document.getElementById('rv'+x.i);if(!c)return;
  var cls=x.ocenka==='хорошо'?'ok':(x.ocenka==='ошибка'?'bad':'mid');
  c.innerHTML='<div class="rv '+cls+'"><b>'+e(x.ocenka)+'</b>'+e(x.pochemu)+(x.kak_luchshe?'<i>Лучше сказать: «'+e(x.kak_luchshe)+'»</i>':'')+'</div>'});
}).catch(function(){sum.textContent='Разбор временно недоступен, обновите страницу.'});
})();
</script>`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''
  const k = searchParams.get('k') ?? ''
  if (!/^\d{1,12}$/.test(id) || !/^[0-9a-f]{20}$/.test(k)) {
    return message('Откройте расшифровку по ссылке «открыть» из таблицы.', 400)
  }

  const wantReview = searchParams.get('review') === '1'
  if (wantReview) {
    const cached = await getCachedReview(id).catch(() => null)
    if (cached) return json({ ok: true, review: cached })
  }

  try {
    const res = await fetch(`${VIEWER}?fmt=json&id=${id}&k=${k}`, { cache: 'no-store', redirect: 'follow' })
    const data = (await res.json()) as { ok: boolean; html?: string; error?: string; call?: Call }
    if (wantReview) {
      if (!data.ok || !data.call) return json({ ok: false, error: data.error || 'Расшифровка недоступна.' })
      try {
        const r = await makeReview(id, data.call)
        return 'error' in r ? json({ ok: false, error: r.error }) : json({ ok: true, review: r })
      } catch {
        return json({ ok: false, error: 'ИИ сейчас не отвечает — обновите страницу через минуту.' })
      }
    }
    if (!data.ok || !data.html) return message(data.error || 'Расшифровка недоступна.', 404)
    const html = data.html.replace(
      '<meta charset="utf-8">',
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    ) + (data.call ? REVIEW_UI : '')
    return new Response(html, { status: 200, headers: HEADERS })
  } catch {
    return message('Расшифровка временно недоступна, обновите страницу через минуту.', 502)
  }
}
