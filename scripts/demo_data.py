"""Вымышленные данные для демо-копии TaskHub.

Компания придуманная. Имена сверены с боевой базой 24.10.2026 — ни одного полного
совпадения; имена, совпавшие с реальными сотрудниками хотя бы частично, выброшены.

Даты считаются от дня запуска: текущий спринт всегда идёт на этой неделе, за ним —
десять закрытых недель истории. Поэтому пересборка раз в неделю держит демо «живым»:
дедлайны не уезжают в прошлое, аналитика всегда показывает последние недели.

Таблицы, которых здесь нет (call_reviews, script_suggestions, access_settings,
app_settings), в демо остаются пустыми: это служебные данные Globalos.
"""

import datetime as dt
import random
import uuid

# Пространство имён для стабильных id проектов: ссылки на проекты не меняются от пересборки
NS = uuid.UUID('6f1c2a52-3c1e-4c55-9d5e-1a7e0b2d6d10')

DOMEN = 'taskhub.local'

# key — логин и часть почты; первый в списке — учётка для показа (её логин и пароль раздаём)
LYUDI = [
    dict(key='demo',   name='Дана Алиева',        role='admin',    pos='Операционный директор',      dept='Управление', approve=True),
    dict(key='erlan',  name='Ерлан Касымов',      role='employee', pos='Руководитель отдела продаж',  dept='Отдел продаж'),
    dict(key='madina', name='Мадина Нурланова',   role='employee', pos='Менеджер по продажам',        dept='Отдел продаж'),
    dict(key='timur',  name='Тимур Беков',        role='employee', pos='Менеджер по продажам',        dept='Отдел продаж'),
    dict(key='kamila', name='Камила Рахимова',    role='employee', pos='Менеджер по продажам',        dept='Отдел продаж'),
    dict(key='asel',   name='Асель Жумабаева',    role='employee', pos='Маркетолог',                  dept='Маркетинг'),
    dict(key='igor',   name='Игорь Ким',          role='employee', pos='Таргетолог',                  dept='Маркетинг'),
    dict(key='anna',   name='Анна Литвинова',     role='employee', pos='Дизайнер',                    dept='Маркетинг'),
    dict(key='saule',  name='Сауле Оспанова',     role='employee', pos='HR-менеджер',                 dept='HR'),
    dict(key='dauren', name='Даурен Сейткали',    role='admin',    pos='Ведущий разработчик',         dept='Разработка'),
    dict(key='maksim', name='Максим Орлов',       role='employee', pos='Разработчик',                 dept='Разработка'),
    dict(key='nurlan', name='Нурлан Абенов',      role='employee', pos='Бухгалтер',                   dept='Финансы', pay=True),
    dict(key='zhanna', name='Жанна Тулеуова',     role='employee', pos='Менеджер по качеству',        dept='Операции'),
    dict(key='ruslan', name='Руслан Мухамедов',   role='employee', pos='Куратор',                     dept='Операции'),
    dict(key='aidos',  name='Айдос Жаксылыков',   role='employee', pos='Куратор',                     dept='Операции', status='inactive'),
    # заявка на регистрацию, которую ещё не подтвердили — видно бейдж в админке
    dict(key='olga',   name='Ольга Смирнова',     role='employee', pos=None,                          dept=None, status='pending'),
]

STD_COLS = [('К выполнению', '#7C5CF6', 'todo'), ('В работе', '#F7C04F', None), ('Готово', '#2DD4A0', 'done')]
DAY_COLS = [('К выполнению', '#2DD4A0', 'todo'), ('Новые', '#8892A4', None), ('Понедельник', '#7C5CF6', None),
            ('Вторник', '#A78BFA', None), ('Среда', '#2DD4A0', None), ('Четверг', '#F7C04F', None),
            ('Пятница', '#F75C6E', None), ('Суббота', '#60C0E8', None), ('Готово', '#2DD4A0', 'done')]
HR_COLS = [('К выполнению', '#4F8EF7', 'todo'), ('Вакансия', '#F75C6E', None), ('Ищу кандидата', '#F7C04F', None),
           ('Собеседование', '#A78BFA', None), ('Готово', '#2DD4A0', 'done')]

# Проект: участники (первый — владелец), колонки спринта, сколько задач в неделю, задачи
PROEKTY = [
    dict(key='sales', name='Отдел продаж', color='#4F8EF7', cols=STD_COLS, per_week=(7, 10),
         desc='Воронка, звонки, работа с возражениями и план продаж отдела.',
         members=['erlan', 'madina', 'timur', 'kamila', 'demo'],
         weekly=['Планёрка отдела продаж', 'Отчёт по воронке за неделю', 'Разбор недозвонов',
                 'Прослушать 10 звонков и дать обратную связь'],
         tasks=['Обновить скрипт первого звонка', 'Позвонить по заявкам с выставки',
                'Подготовить коммерческое предложение для корпоративного клиента',
                'Дожать сделки на стадии «Думают»', 'Провести обучение новичка по CRM',
                'Сверить оплаты с бухгалтерией', 'Собрать возражения за месяц',
                'Обзвонить клиентов без оплаты больше 14 дней', 'Подготовить акцию к концу месяца',
                'Созвон с партнёром по рекомендациям', 'Собрать отзывы довольных клиентов',
                'Разобрать потерянные сделки за квартал', 'Проверить заполнение полей в сделках',
                'Записать видео-инструкцию по оформлению договора',
                'Проверить новый оффер в скрипте на 30 звонках', 'Настроить напоминания о повторном звонке']),
    dict(key='marketing', name='Маркетинг', color='#F75C6E', cols=STD_COLS, per_week=(6, 9),
         desc='Реклама, контент и заявки: всё, что приводит клиентов в отдел продаж.',
         members=['asel', 'igor', 'anna', 'demo'],
         weekly=['Отчёт по рекламным кабинетам', 'Контент-план на неделю', 'Проверить стоимость заявки по каналам'],
         tasks=['Запустить кампанию в Instagram на новую аудиторию', 'Подготовить 5 креативов для таргета',
                'Обновить лендинг: блок с отзывами', 'Настроить UTM-метки для рассылки',
                'Ретаргетинг на посетителей сайта', 'Согласовать рекламный бюджет на месяц',
                'Снять рилс с отзывом клиента', 'Email-рассылка по базе', 'Разбор конкурентов: офферы и цены',
                'Обновить шапку профиля и хайлайты', 'Подготовить кейс для сайта', 'Протестировать лид-форму',
                'Собрать семантику для контекстной рекламы', 'Перезапустить кампании с CPL выше плана',
                'Дизайн баннера для акции', 'Презентация продукта для партнёров']),
    dict(key='hr', name='HR и найм', color='#A78BFA', cols=HR_COLS, per_week=(4, 6),
         desc='Подбор, адаптация и кадровые документы.',
         members=['saule', 'zhanna', 'demo'],
         weekly=['Сверить табель за неделю'],
         tasks=['Разместить вакансию менеджера по продажам', 'Провести 4 собеседования', 'Подготовить оффер кандидату',
                'Онбординг нового сотрудника', 'Обновить шаблон трудового договора',
                'Обратная связь после испытательного срока', 'Составить график отпусков на следующий год',
                'Опрос вовлечённости', 'Подготовить приказ о приёме', 'Найти куратора в отдел операций',
                'Обновить памятку для новичков', 'Провести exit-интервью', 'Организовать корпоратив']),
    dict(key='dev', name='Разработка платформы', color='#2DD4A0', cols=STD_COLS, per_week=(5, 8),
         desc='Доработки TaskHub и внутренних интеграций.',
         members=['dauren', 'maksim', 'anna', 'demo'],
         weekly=['Ревью кода и выкатка'],
         tasks=['Фильтр по отделам в разделе «Расходы»', 'Исправить сортировку в бэклоге', 'Кэш дашборда CRM',
                'Уведомления о дедлайне за день', 'Экспорт задач в CSV', 'Мобильная вёрстка карточки задачи',
                'Ротация ключей интеграций', 'Отдельная база для разработки', 'Журнал ошибок записи уведомлений',
                'Тёмная тема: проверить контраст', 'Ускорить загрузку «Моих задач»', 'Ревью RLS по новым таблицам',
                'Права на раздел CRM по отделам', 'Автотест входа и восстановления пароля',
                'Ежедневная резервная копия базы', 'Импорт задач из Google-таблицы']),
    dict(key='ops', name='Операции и качество', color='#F7C04F', cols=DAY_COLS, per_week=(6, 9),
         desc='Контроль качества обслуживания, регламенты и работа кураторов.',
         members=['zhanna', 'ruslan', 'demo'],
         weekly=['Проверка качества: 20 обращений', 'Еженедельный отчёт по качеству',
                 'Обновить базу ответов на частые вопросы'],
         tasks=['Разобрать жалобы клиентов за неделю', 'Обновить регламент обработки заявок',
                'Калибровка оценок с кураторами', 'Чек-лист для нового куратора', 'Сверить SLA ответа в чатах',
                'Шаблоны быстрых ответов', 'Проверить, все ли договоры подписаны', 'Разобрать повторные обращения',
                'Встреча с кураторами по итогам месяца', 'Обновить скрипт приветствия в чате']),
    dict(key='finance', name='Финансы', color='#60C0E8', cols=STD_COLS, per_week=(3, 5),
         desc='Платежи, сверки и отчётность.',
         members=['nurlan', 'demo'],
         weekly=['Оплатить согласованные заявки на расходы'],
         tasks=['Закрыть месяц: сверка банка и кассы', 'Платёжный календарь на месяц', 'Оплатить счета поставщиков',
                'Отчёт по расходам отделов', 'Акт сверки с подрядчиками', 'Данные для налоговой декларации',
                'Обновить бюджет на квартал']),
]

# Бэклог: эпики с подзадачами и отдельные задачи на будущее
BEKLOG = {
    'sales': [('Эпик: запуск нового тарифа', ['Посчитать экономику тарифа', 'Обновить скрипт под тариф',
                                              'Обучить менеджеров', 'Карточка тарифа в CRM']),
              'Разделить воронку на новых и повторных клиентов', 'Регламент передачи сделки между менеджерами',
              'Стандарт ответа в мессенджерах за 15 минут'],
    'marketing': [('Эпик: ребрендинг соцсетей', ['Новая сетка публикаций', 'Шаблоны сторис', 'Обложки хайлайтов']),
                  'Партнёрская программа для блогеров', 'Квиз на лендинге', 'Тест рекламы в Telegram'],
    'hr': ['Система наставничества', 'База знаний для новичков', 'Пересмотреть грейды и вилки'],
    'dev': [('Эпик: заявки на расходы', ['Таблица и права доступа', 'Форма заявки', 'Еженедельный разбор',
                                        'Отметка оплаты бухгалтерией', 'Уведомления по заявкам']),
            ('Эпик: аналитика эффективности v2', ['Сводка по проектам', 'График по неделям', 'Фильтр по отделам']),
            'Поиск по задачам во всех проектах', 'Вложения в комментариях перетаскиванием'],
    'ops': ['Оценка качества по чек-листу в TaskHub', 'Еженедельный NPS-опрос', 'Регламент эскалации жалоб'],
    'finance': ['Автоматическая сверка выписки', 'Шаблон отчёта для учредителя'],
}

OPISANIYA = [
    'Результат — ссылка в комментарии к задаче.',
    'Сверить с прошлым месяцем и отметить расхождения.',
    'Черновик показать до среды, финальную версию — к пятнице.',
    'Данные берём из CRM за последние 30 дней.',
    'Если не хватает доступа — написать в чат отдела.',
    'Критерий готовности: проверено руководителем.',
]

KOMMENTARII = [
    'Сделано, файл в папке отдела.', 'Посмотри, пожалуйста, до пятницы.', 'Жду данные от маркетинга.',
    'Согласовано, можно запускать.', 'Перенёс дедлайн: клиент попросил созвон в четверг.',
    'Готово, можно проверять.', 'Добавила скриншоты в описание.', 'Какой бюджет закладываем?',
    'Беру в работу.', 'Есть вопрос по формулировке — обсудим на планёрке.', 'Нужна ещё одна итерация правок.',
    'Цифры сходятся, закрываю.',
]

# имя ребёнка и род (0 — мужской, 1 — женский) → фамилия в нужной форме
DETI = [('Алихан', 0), ('Ансар', 0), ('Батыр', 0), ('Дамир', 0), ('Ержан', 0), ('Ильяс', 0), ('Мирас', 0),
        ('Санжар', 0), ('Тамерлан', 0), ('Эмир', 0), ('Айжан', 1), ('Амина', 1), ('Айсулу', 1), ('Дарина', 1),
        ('Жасмин', 1), ('Лейла', 1), ('Нурай', 1), ('Сафия', 1), ('Томирис', 1), ('Ясмина', 1)]
FAMILII = [('Сериков', 'Серикова', 'Сериковых'), ('Ахметов', 'Ахметова', 'Ахметовых'), ('Омаров', 'Омарова', 'Омаровых'),
           ('Ибраев', 'Ибраева', 'Ибраевых'), ('Тулегенов', 'Тулегенова', 'Тулегеновых'), ('Нуриев', 'Нуриева', 'Нуриевых'),
           ('Садыков', 'Садыкова', 'Садыковых'), ('Бекенов', 'Бекенова', 'Бекеновых'), ('Жаксыбеков', 'Жаксыбекова', 'Жаксыбековых')]

OCENKI = [15, 30, 30, 45, 60, 60, 60, 90, 120, 120, 180, 240]

ZAYAVKI = [
    # кто, что, категория, сумма, статус, дней назад, оплачено (сумма | None), заметка решения
    ('asel', 'Подписка на Canva Pro на год', 'software', 59000, 'approved', 26, 59000, None),
    ('igor', 'Пополнение рекламного кабинета', 'marketing', 350000, 'approved', 3, None, 'Согласовано, оплатить до пятницы'),
    ('dauren', 'Ноутбук для нового разработчика', 'equipment', 620000, 'needs_info', 5, None,
     'Пришли, пожалуйста, 2–3 варианта с ценами'),
    ('saule', 'Подарки сотрудникам на дни рождения (квартал)', 'other', 45000, 'pending', 2, None, None),
    ('zhanna', 'Гарнитуры для кураторов, 4 шт.', 'equipment', 96000, 'pending', 1, None, None),
    ('erlan', 'Тренинг по переговорам для отдела продаж', 'services', 280000, 'rejected', 12, None,
     'Переносим на следующий квартал: бюджет обучения на этот исчерпан'),
    ('anna', 'Фотосессия для рекламных креативов', 'services', 150000, 'approved', 19, 140000, None),
    ('maksim', 'Сервис мониторинга ошибок, месяц', 'software', 12500, 'approved', 33, 12500, None),
    ('madina', 'Канцелярия и бумага для офиса', 'office', 18000, 'approved', 15, 18000, None),
    ('ruslan', 'Кулер для воды в офис', 'office', 75000, 'cancelled', 9, None, None),
    ('demo', 'Продление домена и хостинга сайта', 'software', 42000, 'approved', 40, 42000, None),
    ('timur', 'Визитки для отдела продаж', 'office', 25000, 'pending', 0, None, None),
]

STATI = [
    dict(title='Как ставить задачи коллегам', category='taskhub', required=True, author='demo',
         summary='Постановщик, исполнитель, дедлайн и оценка времени — что заполнять обязательно.',
         content="""Задача без исполнителя и срока — это пожелание. Ниже — что заполнить, чтобы задачу сделали вовремя.

## Шаги

1. Откройте проект и нажмите **«+ Задача»** в бэклоге или прямо в колонке спринта.
2. Напишите название глаголом: «Подготовить отчёт», а не «Отчёт».
3. Выберите **исполнителя**. Постановщиком автоматически становитесь вы.
4. Поставьте **дедлайн** и **оценку времени** — без них неделю нельзя честно зафиксировать.
5. Если задача большая, сделайте из неё эпик и разбейте на подзадачи.

## Частые вопросы

**Можно ли поставить задачу человеку из другого отдела?** Да, если он участник проекта.

**Что будет, если дедлайн прошёл?** Исполнитель и постановщик получат уведомление, задача подсветится в «Моих задачах».
"""),
    dict(title='Фиксация недели и эффективность', category='taskhub', required=False, author='dauren',
         summary='Почему спринт фиксируют в понедельник и как считается процент.',
         content="""В понедельник команда фиксирует список задач недели. С этим списком потом сравнивается факт.

## Как считается эффективность

| Что входит | Как учитывается |
|---|---|
| Выполненные задачи | время по оценке идёт в числитель |
| Невыполненные | время идёт в знаменатель |
| Отменённые и эпики | не учитываются |

**Эффективность = время выполненных / время всех задач недели.** Если оценок нет — считаем по количеству.

## Частые вопросы

**Можно ли добавить задачу после фиксации?** Да, но в план недели она уже не попадёт.
"""),
    dict(title='Заявки на расходы: от просьбы до оплаты', category='processes', required=True, author='nurlan',
         summary='Кто одобряет, когда разбираем заявки и как отмечается оплата.',
         content="""Любая покупка за счёт компании начинается с заявки в разделе **«Расходы»**.

## Шаги

1. Нажмите **«Новая заявка»**, укажите сумму, категорию и зачем это нужно.
2. Заявки разбираются раз в неделю. Решение — «Одобрено», «Отклонено» или «Нужны уточнения».
3. Одобренную заявку бухгалтерия оплачивает и отмечает фактическую сумму.

**Важно:** фактическая сумма может отличаться от запрошенной — это нормально, она хранится отдельно.
"""),
    dict(title='Первая неделя нового сотрудника', category='hr', required=False, author='saule',
         summary='Что сделать в первые пять дней: доступы, знакомство, первые задачи.',
         content="""## День 1
- Получить доступы к почте, TaskHub и CRM.
- Познакомиться с наставником.

## Дни 2–3
- Прочитать обязательные инструкции в разделе «Инструкции».
- Взять 2–3 небольшие задачи в спринте своего отдела.

## Дни 4–5
- Первая встреча с руководителем: что понятно, что нет.
"""),
    dict(title='Стандарт ответа клиенту в мессенджере', category='sales', required=False, author='erlan',
         summary='Черновик на проверке у руководителя продаж.', status='review',
         content="""## Сроки
Ответ в рабочее время — **не позже 15 минут**.

## Структура ответа
1. Поздороваться по имени.
2. Ответить на вопрос.
3. Предложить следующий шаг: созвон, расчёт, встречу.
"""),
]


def pn(d: dt.date) -> dt.date:
    """Понедельник недели."""
    return d - dt.timedelta(days=d.weekday())


def ts(d: dt.date, h: int, m: int = 0) -> str:
    # Время в UTC+5 (Алматы): так оно ложится в рабочий день на экране
    return dt.datetime(d.year, d.month, d.day, h, m, tzinfo=dt.timezone(dt.timedelta(hours=5))).isoformat()


def project_id(key: str) -> str:
    return str(uuid.uuid5(NS, f'project:{key}'))


def build(ids: dict[str, str], today: dt.date) -> dict[str, list[dict]]:
    """Все строки демо-базы. ids — логин → uuid пользователя (созданного через Auth)."""
    rnd = random.Random(today.isoformat())
    new = lambda: str(uuid.uuid4())  # noqa: E731
    m0 = pn(today)
    nedeli = 10
    start = m0 - dt.timedelta(weeks=nedeli + 1)
    now = dt.datetime.now(dt.timezone.utc)

    out: dict[str, list[dict]] = {k: [] for k in (
        'profiles', 'projects', 'project_members', 'sprints', 'sprint_columns', 'tasks', 'comments',
        'task_activities', 'notifications', 'expense_requests', 'expense_request_comments',
        'expense_request_activities', 'articles', 'article_reads', 'student_baseline', 'student_moves')}

    rodilsya = [dt.date(1988, 3, 14), dt.date(1992, 7, 2), dt.date(1995, 11, 23), dt.date(1990, 1, 9),
                dt.date(1997, 5, 30), dt.date(1993, 9, 17), dt.date(1985, 12, 5), dt.date(1999, 4, 21)]
    for i, p in enumerate(LYUDI):
        bd = rodilsya[i % len(rodilsya)]
        if p['key'] == 'madina':  # день рождения на этой неделе
            bd = dt.date(1996, (m0 + dt.timedelta(days=3)).month, (m0 + dt.timedelta(days=3)).day)
        out['profiles'].append(dict(
            id=ids[p['key']], full_name=p['name'], login=p['key'], role=p['role'],
            status=p.get('status', 'active'), position=p['pos'], department=p['dept'],
            birth_date=None if p.get('status') == 'pending' else bd.isoformat(),
            can_approve_expenses=bool(p.get('approve')), can_pay_expenses=bool(p.get('pay')),
            created_at=ts(today if p.get('status') == 'pending' else start, 10)))

    # человек → базовая доля выполненного: у кого-то неделя всегда закрыта, кто-то не успевает
    nadezhnost = {p['key']: rnd.uniform(0.72, 0.97) for p in LYUDI}

    zadachi_po_lyudyam: dict[str, list[dict]] = {}
    vse_zadachi: list[dict] = []

    def zadacha(pr, **kw) -> dict:
        t = dict(id=new(), project_id=pr['id'], type='task', status='backlog', workflow_status='new',
                 assignee_id=None, creator_id=ids[pr['members'][0]], description=None, deadline=None,
                 time_estimate=rnd.choice(OCENKI), parent_task_id=None, sprint_id=None, column_id=None,
                 column_order=0, backlog_order=0, priority=None, closed_at=None, tags=[],
                 created_at=ts(start, 10), updated_at=ts(start, 10))
        t.update(kw)
        if t['description'] is None and rnd.random() < 0.3:
            t['description'] = rnd.choice(OPISANIYA)
        if t['priority'] is None and rnd.random() < 0.25:
            t['priority'] = rnd.choice(['high', 'high', 'medium'])
        out['tasks'].append(t)
        vse_zadachi.append(t)
        if t['assignee_id']:
            zadachi_po_lyudyam.setdefault(t['assignee_id'], []).append(t)
        return t

    for pr in PROEKTY:
        pr['id'] = project_id(pr['key'])
        owner = pr['members'][0]
        out['projects'].append(dict(
            id=pr['id'], name=pr['name'], description=pr['desc'], color=pr['color'],
            default_assignee_mode='specific', default_assignee_id=ids[owner], week_cycle_type='mon-sun',
            default_deadline='last-day', auto_recurring=False, created_by=ids[owner], created_at=ts(start, 9)))
        for k in pr['members']:
            role = 'owner' if k == owner else ('manager' if k == 'demo' else 'member')
            out['project_members'].append(dict(id=new(), project_id=pr['id'], user_id=ids[k], role=role))
        ispolniteli = [k for k in pr['members'] if k != 'demo'] or pr['members']

        for n in range(nedeli + 1):
            d_from = start + dt.timedelta(weeks=n + 1)
            d_to = d_from + dt.timedelta(days=6)
            tekushiy = d_from == m0
            sp = dict(id=new(), project_id=pr['id'], name=f'Спринт {n + 1}', date_from=d_from.isoformat(),
                      date_to=d_to.isoformat(), status='active' if tekushiy else 'closed', created_by=ids[owner],
                      created_at=ts(d_from, 9, 30), is_fixed=True, fixed_at=ts(d_from, 11), fixed_task_ids=[])
            out['sprints'].append(sp)
            cols = []
            for i, (name, color, role) in enumerate(pr['cols']):
                c = dict(id=new(), sprint_id=sp['id'], name=name, color=color, order_index=i, role=role)
                cols.append(c)
                out['sprint_columns'].append(c)
            col_todo = next(c for c in cols if c['role'] == 'todo')
            col_done = next(c for c in cols if c['role'] == 'done')
            srednie = [c for c in cols if c['role'] is None]
            dni = {c['name']: i for i, c in enumerate(srednie) if c['name'] in
                   ('Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота')}

            nazvaniya = list(pr['weekly']) + rnd.sample(pr['tasks'], k=min(len(pr['tasks']), rnd.randint(*pr['per_week'])))
            nazvaniya = nazvaniya[:pr['per_week'][1]]
            for order, title in enumerate(nazvaniya):
                kto = rnd.choice(ispolniteli)
                den = rnd.choice([0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5])
                deadline = d_from + dt.timedelta(days=den)
                created = d_from - dt.timedelta(days=rnd.randint(0, 3))
                t = zadacha(pr, title=title, status='sprint', sprint_id=sp['id'], assignee_id=ids[kto],
                            creator_id=ids[rnd.choice([owner, owner, 'demo'])], deadline=deadline.isoformat(),
                            column_order=order, created_at=ts(created, rnd.randint(9, 18), rnd.randint(0, 59)))
                p_done = nadezhnost[kto] + rnd.uniform(-0.12, 0.08)
                if tekushiy:
                    # прошедшие дни недели в основном закрыты, сегодняшние — наполовину, будущие только начаты
                    r = rnd.random()
                    dolya = p_done if deadline < today else (0.5 if deadline == today else 0.15)
                    if r < dolya:
                        t['workflow_status'] = 'done'
                    elif r < dolya + 0.35:
                        t['workflow_status'] = rnd.choice(['in_progress', 'in_progress', 'review'])
                else:
                    r = rnd.random()
                    t['workflow_status'] = 'done' if r < p_done else ('cancelled' if r < p_done + 0.03 else 'new')

                if t['workflow_status'] == 'done':
                    closed = min(dt.datetime.fromisoformat(ts(deadline, rnd.randint(10, 19), rnd.randint(0, 59))),
                                 now - dt.timedelta(hours=1))
                    t['closed_at'] = closed.isoformat()
                    t['updated_at'] = t['closed_at']
                    t['column_id'] = col_done['id']
                elif t['workflow_status'] in ('in_progress', 'review'):
                    t['column_id'] = (next((c['id'] for c in srednie if c['name'] == 'В работе'), None)
                                      or srednie[min(len(srednie) - 1, 1)]['id'])
                    if dni:
                        t['column_id'] = srednie[dni[list(dni)[min(deadline.weekday(), 5)]]]['id']
                else:
                    t['column_id'] = col_todo['id']
                    if dni and tekushiy:
                        t['column_id'] = srednie[dni[list(dni)[min(deadline.weekday(), 5)]]]['id']
                sp['fixed_task_ids'].append(t['id'])

                # невыполненное в закрытом спринте closeSprint возвращает в бэклог
                if not tekushiy and t['workflow_status'] == 'new':
                    sdvig = rnd.randint(-3, 0) if rnd.random() < 0.25 else rnd.randint(3, 14)
                    t.update(status='backlog', sprint_id=None, column_id=None, column_order=0,
                             deadline=(today + dt.timedelta(days=sdvig)).isoformat())

        # бэклог: эпики и задачи на будущее
        poryadok = 0
        for item in BEKLOG.get(pr['key'], []):
            poryadok += 1
            if isinstance(item, tuple):
                epic_title, subs = item
                epic = zadacha(pr, title=epic_title, type='epic', time_estimate=0, backlog_order=poryadok,
                               priority='high', created_at=ts(m0 - dt.timedelta(weeks=3), 11))
                for j, s in enumerate(subs):
                    gotovo = j < len(subs) // 2
                    sub = zadacha(pr, title=s, parent_task_id=epic['id'], assignee_id=ids[rnd.choice(ispolniteli)],
                                  backlog_order=j + 1, created_at=ts(m0 - dt.timedelta(weeks=3), 11, 30),
                                  deadline=(m0 + dt.timedelta(days=rnd.randint(2, 20))).isoformat())
                    if gotovo:
                        sub.update(status='done', workflow_status='done',
                                   closed_at=ts(m0 - dt.timedelta(days=rnd.randint(1, 12)), 15))
            else:
                zadacha(pr, title=item, backlog_order=poryadok,
                        assignee_id=ids[rnd.choice(ispolniteli)] if rnd.random() < 0.7 else None,
                        deadline=(m0 + dt.timedelta(days=rnd.randint(5, 30))).isoformat() if rnd.random() < 0.6 else None,
                        created_at=ts(m0 - dt.timedelta(days=rnd.randint(3, 40)), 12))
        for t in out['tasks']:
            if t['project_id'] == pr['id'] and t['status'] == 'backlog' and not t['backlog_order']:
                poryadok += 1
                t['backlog_order'] = poryadok

    # задачи, лично поставленные демо-пользователю: чтобы «Мои задачи» были заполнены во всех колонках
    for title, sdvig, proekt in [('Согласовать план отделов на месяц', -2, 'sales'),
                                 ('Проверить отчёт по эффективности команд', 0, 'dev'),
                                 ('Встреча с учредителем: итоги недели', 1, 'finance'),
                                 ('Утвердить бюджет маркетинга', 3, 'marketing'),
                                 ('Одобрить кандидата на позицию куратора', 6, 'hr'),
                                 ('Квартальный разбор качества', 15, 'ops')]:
        pr = next(p for p in PROEKTY if p['key'] == proekt)
        zadacha(pr, title=title, assignee_id=ids['demo'], creator_id=ids[pr['members'][0]], priority='high',
                deadline=(today + dt.timedelta(days=sdvig)).isoformat(), backlog_order=0,
                created_at=ts(today - dt.timedelta(days=4), 10))

    # корзина: удалённые недавно
    for t in rnd.sample([t for t in vse_zadachi if t['status'] == 'backlog' and t['type'] == 'task'
                         and not t['parent_task_id']], k=3):
        t.update(status='deleted', deleted_at=ts(today - dt.timedelta(days=rnd.randint(1, 10)), 16),
                 deleted_by=t['creator_id'])

    # история изменений и комментарии
    for t in vse_zadachi:
        if t['type'] == 'epic':
            continue
        actor = t['assignee_id'] or t['creator_id']
        sozdana = dt.datetime.fromisoformat(t['created_at'])
        if t['closed_at']:
            konec = dt.datetime.fromisoformat(t['closed_at'])
            nachalo = sozdana + (konec - sozdana) * rnd.uniform(0.3, 0.8)
            out['task_activities'] += [
                dict(id=new(), task_id=t['id'], actor_id=actor, type='status_change', old_value='new',
                     new_value='in_progress', created_at=nachalo.isoformat()),
                dict(id=new(), task_id=t['id'], actor_id=actor, type='status_change', old_value='in_progress',
                     new_value='done', created_at=konec.isoformat())]
        elif t['workflow_status'] in ('in_progress', 'review'):
            out['task_activities'].append(dict(id=new(), task_id=t['id'], actor_id=actor, type='status_change',
                                               old_value='new', new_value=t['workflow_status'],
                                               created_at=(sozdana + dt.timedelta(hours=20)).isoformat()))
        if t['deadline'] and rnd.random() < 0.18:
            staryy = dt.date.fromisoformat(t['deadline']) - dt.timedelta(days=rnd.randint(1, 3))
            out['task_activities'].append(dict(id=new(), task_id=t['id'], actor_id=t['creator_id'],
                                               type='deadline_change', old_value=staryy.isoformat(),
                                               new_value=t['deadline'],
                                               created_at=(sozdana + dt.timedelta(hours=3)).isoformat()))
        if t['assignee_id'] and rnd.random() < 0.15:
            out['task_activities'].append(dict(id=new(), task_id=t['id'], actor_id=t['creator_id'],
                                               type='assignee_change', old_value=None, new_value=t['assignee_id'],
                                               created_at=(sozdana + dt.timedelta(minutes=5)).isoformat()))
        if rnd.random() < 0.12:
            out['task_activities'].append(dict(id=new(), task_id=t['id'], actor_id=t['creator_id'],
                                               type='time_change', old_value=None, new_value=str(t['time_estimate']),
                                               created_at=(sozdana + dt.timedelta(minutes=7)).isoformat()))
        if rnd.random() < 0.22:
            avtory = [a for a in {t['creator_id'], t['assignee_id']} if a]
            for k in range(rnd.randint(1, 3)):
                kogda = min(sozdana + dt.timedelta(hours=4 + 9 * k + rnd.randint(0, 6)), now - dt.timedelta(minutes=30))
                out['comments'].append(dict(id=new(), task_id=t['id'], author_id=avtory[k % len(avtory)],
                                            text=rnd.choice(KOMMENTARII), attachments=[], created_at=kogda.isoformat()))

    # уведомления: у демо-пользователя свежая лента, у остальных — понемногу
    def uved(user, tip, task=None, actor=None, data=None, kogda=None, prochitano=True, zayavka=None, statya=None):
        out['notifications'].append(dict(
            id=new(), user_id=user, type=tip, task_id=task and task['id'], actor_id=actor, data=data or {},
            is_read=prochitano, expense_request_id=zayavka, article_id=statya,
            created_at=(kogda or now - dt.timedelta(hours=rnd.randint(1, 300))).isoformat()))

    moi = [t for t in vse_zadachi if t['assignee_id'] == ids['demo'] and t['status'] != 'deleted']
    postavlennye = [t for t in vse_zadachi if t['creator_id'] == ids['demo'] and t['assignee_id']
                    and t['assignee_id'] != ids['demo'] and t['status'] in ('sprint', 'backlog')]
    for i, t in enumerate(rnd.sample(moi, k=min(5, len(moi)))):
        uved(ids['demo'], 'task_assigned', t, t['creator_id'], {'task_title': t['title']},
             kogda=now - dt.timedelta(hours=6 + 20 * i), prochitano=i > 1)
    svezhie = sorted(postavlennye, key=lambda t: t['updated_at'], reverse=True)[:6]
    for i, t in enumerate(svezhie):
        if t['workflow_status'] == 'done':
            uved(ids['demo'], 'status_changed', t, t['assignee_id'],
                 {'task_title': t['title'], 'old_status': 'in_progress', 'new_status': 'done'},
                 kogda=now - dt.timedelta(hours=2 + 9 * i), prochitano=i > 2)
        else:
            uved(ids['demo'], 'comment_added', t, t['assignee_id'],
                 {'task_title': t['title'], 'comment_preview': rnd.choice(KOMMENTARII)},
                 kogda=now - dt.timedelta(hours=3 + 11 * i), prochitano=i > 1)
    for t in [t for t in moi if t['deadline'] and t['workflow_status'] not in ('done', 'cancelled')][:3]:
        d = dt.date.fromisoformat(t['deadline'])
        if d <= today:
            uved(ids['demo'], 'deadline_overdue', t, None, {'task_title': t['title']},
                 kogda=now - dt.timedelta(hours=5), prochitano=False)
        elif d == today + dt.timedelta(days=1):
            uved(ids['demo'], 'deadline_soon', t, None, {'task_title': t['title']},
                 kogda=now - dt.timedelta(hours=4), prochitano=False)
    for p in LYUDI[1:]:
        if p.get('status') in ('pending', 'inactive'):
            continue
        svoi = [t for t in vse_zadachi if t['assignee_id'] == ids[p['key']] and t['status'] == 'sprint'][-3:]
        for t in svoi:
            uved(ids[p['key']], 'task_assigned', t, t['creator_id'], {'task_title': t['title']},
                 prochitano=rnd.random() < 0.6)

    # заявки на расходы
    po_klyuchu = {p['key']: p for p in LYUDI}
    for kto, title, cat, summa, status, dney, oplata, zametka in ZAYAVKI:
        sozdana = now - dt.timedelta(days=dney, hours=rnd.randint(1, 6))
        z = dict(id=new(), requester_id=ids[kto], title=title, category=cat, amount=summa, currency='KZT',
                 department=po_klyuchu[kto]['dept'], status=status,
                 justification=rnd.choice(['Нужно для текущих задач отдела.', 'Старое вышло из строя.',
                                           'Без этого не запустим кампанию в срок.', 'Плановая покупка.']),
                 needed_by=(sozdana.date() + dt.timedelta(days=rnd.randint(5, 14))).isoformat(),
                 attachments=[], created_at=sozdana.isoformat(), updated_at=sozdana.isoformat())
        out['expense_requests'].append(z)
        out['expense_request_activities'].append(dict(id=new(), request_id=z['id'], actor_id=ids[kto], type='created',
                                                      old_value=None, new_value=None, created_at=z['created_at']))
        if status in ('approved', 'rejected', 'needs_info'):
            reshenie = sozdana + dt.timedelta(days=min(dney, 2) or 0, hours=3)
            z.update(decided_by=ids['demo'], decided_at=reshenie.isoformat(), decision_note=zametka,
                     updated_at=reshenie.isoformat())
            out['expense_request_activities'].append(dict(id=new(), request_id=z['id'], actor_id=ids['demo'],
                                                          type='status_changed', old_value='pending', new_value=status,
                                                          created_at=reshenie.isoformat()))
            uved(ids[kto], 'expense_decided', actor=ids['demo'], zayavka=z['id'],
                 data={'title': title, 'number': '', 'status': status}, kogda=reshenie)
        if status == 'cancelled':
            out['expense_request_activities'].append(dict(id=new(), request_id=z['id'], actor_id=ids[kto],
                                                          type='status_changed', old_value='pending',
                                                          new_value='cancelled',
                                                          created_at=(sozdana + dt.timedelta(hours=20)).isoformat()))
        if oplata:
            oplacheno = sozdana + dt.timedelta(days=min(dney, 4), hours=5)
            z.update(paid_at=oplacheno.isoformat(), paid_by=ids['nurlan'], paid_amount=oplata,
                     paid_note='Оплачено со счёта компании' if oplata == summa else 'Нашли дешевле у другого подрядчика')
            out['expense_request_activities'].append(dict(id=new(), request_id=z['id'], actor_id=ids['nurlan'],
                                                          type='paid', old_value=None, new_value=str(oplata),
                                                          created_at=oplacheno.isoformat()))
        if status == 'needs_info':
            out['expense_request_comments'].append(dict(
                id=new(), request_id=z['id'], author_id=ids[kto], attachments=[],
                text='Добавил три варианта в описание, самый дешёвый — второй.',
                created_at=(sozdana + dt.timedelta(days=1)).isoformat()))
        if status == 'pending':
            uved(ids['demo'], 'expense_submitted', actor=ids[kto], zayavka=z['id'], data={'title': title},
                 kogda=sozdana, prochitano=dney > 1)

    # инструкции
    for i, s in enumerate(STATI):
        status = s.get('status', 'published')
        sozdana = now - dt.timedelta(days=30 - i * 5)
        a = dict(id=new(), title=s['title'], summary=s['summary'], content=s['content'], category=s['category'],
                 status=status, is_required=s['required'], departments=[], version=1, author_id=ids[s['author']],
                 published_by=ids['demo'] if status == 'published' else None,
                 published_at=(sozdana + dt.timedelta(days=1)).isoformat() if status == 'published' else None,
                 attachments=[], created_at=sozdana.isoformat(), updated_at=(sozdana + dt.timedelta(days=1)).isoformat())
        out['articles'].append(a)
        if status == 'published' and s['required']:
            for p in LYUDI:
                if p.get('status', 'active') == 'active' and rnd.random() < 0.7:
                    out['article_reads'].append(dict(id=new(), article_id=a['id'], user_id=ids[p['key']], version=1,
                                                     read_at=(sozdana + dt.timedelta(days=rnd.randint(1, 6))).isoformat()))

    # CRM → Ученики: отметка численности и движения после неё. Ссылки на сделки в демо не ведут
    # никуда (students-view прячет их при DEMO_MODE), номера сделок выдуманные
    otmetka = dt.date(today.year, today.month, 1) - dt.timedelta(days=1)
    for _ in range(5):
        otmetka = otmetka.replace(day=1) - dt.timedelta(days=1)
    out['student_baseline'].append(dict(id=new(), as_of=otmetka.isoformat(), total=520,
                                        note='Отметка по выгрузке платформы'))
    istoriya, sdelka = 500001, 90001
    den = otmetka + dt.timedelta(days=1)
    while den <= today:
        if den.weekday() < 5:
            for _ in range(rnd.randint(3, 7)):
                rebyonok = rnd.choice(DETI)
                fam = rnd.choice(FAMILII)
                imena = [f'{fam[rebyonok[1]]} {rebyonok[0]}']
                if rnd.random() < 0.15:
                    vtoroy = rnd.choice(DETI)
                    imena.append(f'{fam[vtoroy[1]]} {vtoroy[0]}')
                propusk = rnd.random() < 0.06
                out['student_moves'].append(dict(
                    id=new(), history_id=istoriya, deal_id=sdelka, kind='enroll',
                    happened_at=dt.datetime(den.year, den.month, den.day, rnd.randint(4, 12), rnd.randint(0, 59),
                                            tzinfo=dt.timezone.utc).isoformat(),
                    students=0 if propusk else len(imena), student_names=imena,
                    deal_title=f'{rebyonok[0]}, {rnd.randint(1, 11)} класс' if len(imena) == 1 else f'Семья {fam[2]}',
                    counted=not propusk, origin_stage='C4:NEW' if propusk else 'WON',
                    skip_reason='сделка пришла из «Неразобранное», а не из «Полная оплата есть»' if propusk else None))
                istoriya += 1
                sdelka += 1
            for _ in range(rnd.randint(3, 6)):
                rebyonok = rnd.choice(DETI)
                fam = rnd.choice(FAMILII)
                propusk = rnd.random() < 0.3
                out['student_moves'].append(dict(
                    id=new(), history_id=istoriya, deal_id=sdelka - rnd.randint(200, 900), kind='expel',
                    happened_at=dt.datetime(den.year, den.month, den.day, rnd.randint(5, 13), rnd.randint(0, 59),
                                            tzinfo=dt.timezone.utc).isoformat(),
                    students=0 if propusk else 1, student_names=[f'{fam[rebyonok[1]]} {rebyonok[0]}'],
                    deal_title=f'{rebyonok[0]}, {rnd.randint(1, 11)} класс', counted=not propusk, origin_stage='C10:NEW',
                    skip_reason=rnd.choice(['отчисление по этой сделке уже отмечали раньше',
                                            'пришёл из «Архив должников» — там ученик уже не числится'])
                    if propusk else None))
                istoriya += 1
        den += dt.timedelta(days=1)

    return out
