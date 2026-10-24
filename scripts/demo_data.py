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

# key — логин и часть почты; первый в списке — учётка для показа (её логин и пароль раздаём).
# Демо показывают иностранным работодателям, поэтому данные по-английски; компания — казахстанская,
# имена латиницей. Отделы «Sales» и «Marketing» дают доступ к CRM (lib/utils/crm-access.ts).
LYUDI = [
    dict(key='demo',   name='Dana Aliyeva',        role='admin',    pos='Chief Operating Officer',  dept='Management', approve=True),
    dict(key='erlan',  name='Yerlan Kassymov',     role='employee', pos='Head of Sales',            dept='Sales'),
    dict(key='madina', name='Madina Nurlanova',    role='employee', pos='Sales Development Rep',    dept='Sales'),
    dict(key='timur',  name='Timur Bekov',         role='employee', pos='Sales Development Rep',    dept='Sales'),
    dict(key='kamila', name='Kamila Rakhimova',    role='employee', pos='Sales Development Rep',    dept='Sales'),
    dict(key='asel',   name='Assel Zhumabayeva',   role='employee', pos='Marketer',                 dept='Marketing'),
    dict(key='igor',   name='Igor Kim',            role='employee', pos='Performance Marketer',     dept='Marketing'),
    dict(key='anna',   name='Anna Litvinova',      role='employee', pos='Designer',                 dept='Marketing'),
    dict(key='saule',  name='Saule Ospanova',      role='employee', pos='HR Manager',               dept='HR'),
    dict(key='dauren', name='Dauren Seitkali',     role='admin',    pos='Lead Developer',           dept='Engineering'),
    dict(key='maksim', name='Maxim Orlov',         role='employee', pos='Developer',                dept='Engineering'),
    dict(key='nurlan', name='Nurlan Abenov',       role='employee', pos='Accountant',               dept='Finance', pay=True),
    dict(key='zhanna', name='Zhanna Tuleuova',     role='employee', pos='Quality Manager',          dept='Operations'),
    dict(key='ruslan', name='Ruslan Mukhamedov',   role='employee', pos='Student Success Manager',  dept='Operations'),
    dict(key='aidos',  name='Aidos Zhaksylykov',   role='employee', pos='Student Success Manager',  dept='Operations', status='inactive'),
    # заявка на регистрацию, которую ещё не подтвердили — видно бейдж в админке
    dict(key='olga',   name='Olga Smirnova',       role='employee', pos=None,                       dept=None, status='pending'),
]

STD_COLS = [('To do', '#7C5CF6', 'todo'), ('In progress', '#F7C04F', None), ('Done', '#2DD4A0', 'done')]
DAY_COLS = [('To do', '#2DD4A0', 'todo'), ('New', '#8892A4', None), ('Monday', '#7C5CF6', None),
            ('Tuesday', '#A78BFA', None), ('Wednesday', '#2DD4A0', None), ('Thursday', '#F7C04F', None),
            ('Friday', '#F75C6E', None), ('Saturday', '#60C0E8', None), ('Done', '#2DD4A0', 'done')]
HR_COLS = [('To do', '#4F8EF7', 'todo'), ('Open role', '#F75C6E', None), ('Sourcing', '#F7C04F', None),
           ('Interviewing', '#A78BFA', None), ('Done', '#2DD4A0', 'done')]
DNI = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
V_RABOTE = 'In progress'

# Проект: участники (первый — владелец), колонки спринта, сколько задач в неделю, задачи
PROEKTY = [
    dict(key='sales', name='Sales', color='#4F8EF7', cols=STD_COLS, per_week=(7, 10),
         desc='Pipeline, calls, objection handling and the monthly sales plan.',
         members=['erlan', 'madina', 'timur', 'kamila', 'demo'],
         weekly=['Sales team stand-up', 'Weekly pipeline report', 'Review missed calls',
                 'Listen to 10 calls and give feedback'],
         tasks=['Update the first-call script', 'Call back leads from the education fair',
                'Prepare a proposal for a corporate client',
                'Follow up on deals stuck in “Thinking it over”', 'Onboard a new rep to the CRM',
                'Reconcile payments with accounting', 'Collect this month’s objections',
                'Call clients with no payment for 14+ days', 'Prepare the end-of-month promo',
                'Call with the referral partner', 'Collect testimonials from happy clients',
                'Review lost deals for the quarter', 'Check required fields in deals',
                'Record a video guide on contract paperwork',
                'Test the new offer in the script on 30 calls', 'Set up follow-up call reminders']),
    dict(key='marketing', name='Marketing', color='#F75C6E', cols=STD_COLS, per_week=(6, 9),
         desc='Ads, content and lead generation — everything that brings clients to Sales.',
         members=['asel', 'igor', 'anna', 'demo'],
         weekly=['Ad account report', 'Weekly content plan', 'Check cost per lead by channel'],
         tasks=['Launch an Instagram campaign for a new audience', 'Prepare 5 ad creatives',
                'Landing page: add a testimonials block', 'Set up UTM tags for the newsletter',
                'Retarget website visitors', 'Approve next month’s ad budget',
                'Shoot a client testimonial reel', 'Email campaign to the client base', 'Competitor review: offers and prices',
                'Refresh profile header and highlights', 'Write a case study for the website', 'Test the lead form',
                'Build a keyword list for search ads', 'Relaunch campaigns with CPL above target',
                'Banner design for the promo', 'Product deck for partners']),
    dict(key='hr', name='HR & Hiring', color='#A78BFA', cols=HR_COLS, per_week=(4, 6),
         desc='Recruiting, onboarding and HR paperwork.',
         members=['saule', 'zhanna', 'demo'],
         weekly=['Reconcile the weekly timesheet'],
         tasks=['Post a Sales Development Rep vacancy', 'Run 4 interviews', 'Prepare an offer for the candidate',
                'Onboard a new hire', 'Update the employment contract template',
                'Probation period feedback', 'Draft next year’s vacation schedule',
                'Engagement survey', 'Prepare the hiring order', 'Find a Student Success Manager for Operations',
                'Update the new-hire handbook', 'Run an exit interview', 'Organize the team offsite']),
    dict(key='dev', name='Platform Development', color='#2DD4A0', cols=STD_COLS, per_week=(5, 8),
         desc='TaskHub improvements and internal integrations.',
         members=['dauren', 'maksim', 'anna', 'demo'],
         weekly=['Code review and release'],
         tasks=['Department filter in Expenses', 'Fix sorting in the backlog', 'Cache the CRM dashboard',
                'Due-tomorrow notifications', 'Export tasks to CSV', 'Mobile layout for the task card',
                'Rotate integration keys', 'Separate database for development', 'Log failed notification writes',
                'Dark theme: check contrast', 'Speed up “My tasks” loading', 'Review RLS on new tables',
                'CRM access by department', 'Automated test for sign-in and password reset',
                'Daily database backup', 'Import tasks from a Google Sheet']),
    dict(key='ops', name='Operations & Quality', color='#F7C04F', cols=DAY_COLS, per_week=(6, 9),
         desc='Service quality, procedures and the student success team.',
         members=['zhanna', 'ruslan', 'demo'],
         weekly=['Quality check: 20 conversations', 'Weekly quality report',
                 'Update the FAQ knowledge base'],
         tasks=['Review this week’s client complaints', 'Update the inquiry handling procedure',
                'Score calibration with the team', 'Checklist for a new team member', 'Check chat response SLA',
                'Quick reply templates', 'Make sure all contracts are signed', 'Review repeat inquiries',
                'Monthly team review meeting', 'Update the chat greeting script']),
    dict(key='finance', name='Finance', color='#60C0E8', cols=STD_COLS, per_week=(3, 5),
         desc='Payments, reconciliations and reporting.',
         members=['nurlan', 'demo'],
         weekly=['Pay approved expense requests'],
         tasks=['Month-end close: bank and cash reconciliation', 'Monthly payment calendar', 'Pay supplier invoices',
                'Expense report by department', 'Contractor reconciliation statements', 'Data for the tax return',
                'Update the quarterly budget']),
]

# Бэклог: эпики с подзадачами и отдельные задачи на будущее
BEKLOG = {
    'sales': [('Epic: launch the new plan', ['Model the plan economics', 'Update the script for the new plan',
                                             'Train the reps', 'Plan card in the CRM']),
              'Split the pipeline into new and returning clients', 'Deal handover procedure between reps',
              'Messenger reply standard: within 15 minutes'],
    'marketing': [('Epic: social media rebrand', ['New post grid', 'Story templates', 'Highlight covers']),
                  'Influencer partner program', 'Quiz on the landing page', 'Test ads in Telegram'],
    'hr': ['Mentorship program', 'Knowledge base for new hires', 'Review grades and salary bands'],
    'dev': [('Epic: expense requests', ['Table and access rights', 'Request form', 'Weekly review',
                                        'Payment mark by accounting', 'Request notifications']),
            ('Epic: efficiency analytics v2', ['Summary by project', 'Weekly chart', 'Department filter']),
            'Search across all projects', 'Drag-and-drop attachments in comments'],
    'ops': ['Checklist-based quality scoring in TaskHub', 'Weekly NPS survey', 'Complaint escalation procedure'],
    'finance': ['Automatic bank statement reconciliation', 'Report template for the founder'],
}

# Задачи, лично поставленные демо-пользователю: чтобы «Мои задачи» были заполнены во всех колонках
LICHNYE = [('Approve the department plans for the month', -2, 'sales'),
           ('Review the team efficiency report', 0, 'dev'),
           ('Founder meeting: weekly results', 1, 'finance'),
           ('Approve the marketing budget', 3, 'marketing'),
           ('Approve the Student Success Manager candidate', 6, 'hr'),
           ('Quarterly quality review', 15, 'ops')]

OPISANIYA = [
    'Post the result as a link in the task comments.',
    'Compare with last month and flag the differences.',
    'Draft by Wednesday, final version by Friday.',
    'Use CRM data for the last 30 days.',
    'If you are missing access, ask in the team chat.',
    'Definition of done: reviewed by the manager.',
]

KOMMENTARII = [
    'Done, the file is in the team folder.', 'Please take a look by Friday.', 'Waiting for data from Marketing.',
    'Approved, good to launch.', 'Moved the due date: the client asked for a call on Thursday.',
    'Ready for review.', 'Added screenshots to the description.', 'What budget are we planning?',
    'Taking this one.', 'One question on the wording — let’s discuss at the stand-up.', 'Needs one more round of edits.',
    'Numbers match, closing.',
]

OBOSNOVANIYA = ['Needed for the team’s current work.', 'The old one broke.',
                'We can’t launch the campaign on time without it.', 'Planned purchase.']

# имена детей и фамилии для раздела «Ученики» (CRM); род нужен для формы фамилии
DETI = [('Alikhan', 0), ('Ansar', 0), ('Batyr', 0), ('Damir', 0), ('Yerzhan', 0), ('Ilyas', 0), ('Miras', 0),
        ('Sanzhar', 0), ('Tamerlan', 0), ('Emir', 0), ('Aizhan', 1), ('Amina', 1), ('Aisulu', 1), ('Darina', 1),
        ('Jasmine', 1), ('Leila', 1), ('Nurai', 1), ('Safiya', 1), ('Tomiris', 1), ('Yasmina', 1)]
FAMILII = [('Serikov', 'Serikova', 'Serikov'), ('Akhmetov', 'Akhmetova', 'Akhmetov'), ('Omarov', 'Omarova', 'Omarov'),
           ('Ibrayev', 'Ibrayeva', 'Ibrayev'), ('Tulegenov', 'Tulegenova', 'Tulegenov'), ('Nuriyev', 'Nuriyeva', 'Nuriyev'),
           ('Sadykov', 'Sadykova', 'Sadykov'), ('Bekenov', 'Bekenova', 'Bekenov'), ('Zhaksybekov', 'Zhaksybekova', 'Zhaksybekov')]

OCENKI = [15, 30, 30, 45, 60, 60, 60, 90, 120, 120, 180, 240]

ZAYAVKI = [
    # кто, что, категория, сумма, статус, дней назад, оплачено (сумма | None), заметка решения
    ('asel', 'Canva Pro annual subscription', 'software', 59000, 'approved', 26, 59000, None),
    ('igor', 'Ad account top-up', 'marketing', 350000, 'approved', 3, None, 'Approved, please pay by Friday'),
    ('dauren', 'Laptop for the new developer', 'equipment', 620000, 'needs_info', 5, None,
     'Please send 2–3 options with prices'),
    ('saule', 'Birthday gifts for the team (quarter)', 'other', 45000, 'pending', 2, None, None),
    ('zhanna', 'Headsets for the success team, 4 pcs', 'equipment', 96000, 'pending', 1, None, None),
    ('erlan', 'Negotiation training for the sales team', 'services', 280000, 'rejected', 12, None,
     'Moving this to next quarter: this quarter’s training budget is used up'),
    ('anna', 'Photo shoot for ad creatives', 'services', 150000, 'approved', 19, 140000, None),
    ('maksim', 'Error monitoring service, 1 month', 'software', 12500, 'approved', 33, 12500, None),
    ('madina', 'Office stationery and paper', 'office', 18000, 'approved', 15, 18000, None),
    ('ruslan', 'Water cooler for the office', 'office', 75000, 'cancelled', 9, None, None),
    ('demo', 'Website domain and hosting renewal', 'software', 42000, 'approved', 40, 42000, None),
    ('timur', 'Business cards for the sales team', 'office', 25000, 'pending', 0, None, None),
]

STATI = [
    dict(title='How to assign tasks to colleagues', category='taskhub', required=True, author='demo',
         summary='Reporter, assignee, due date and estimate — what you must fill in.',
         content="""A task without an assignee and a due date is just a wish. Here is what to fill in so it gets done on time.

## Steps

1. Open the project and click **“+ Task”** in the backlog or right in a sprint column.
2. Start the title with a verb: “Prepare the report”, not “Report”.
3. Pick an **assignee**. You become the reporter automatically.
4. Set a **due date** and an **estimate** — without them the week can’t be locked honestly.
5. If the task is big, turn it into an epic and split it into subtasks.

## FAQ

**Can I assign a task to someone from another department?** Yes, if they are a project member.

**What happens when the due date passes?** The assignee and the reporter get a notification, and the task is highlighted in “My tasks”.
"""),
    dict(title='Locking the week and efficiency', category='taskhub', required=False, author='dauren',
         summary='Why the sprint is locked on Monday and how the percentage is calculated.',
         content="""On Monday the team locks the list of tasks for the week. The actual result is compared with this list later.

## How efficiency is calculated

| What counts | How |
|---|---|
| Completed tasks | their estimates go into the numerator |
| Not completed | their estimates go into the denominator |
| Cancelled tasks and epics | not counted |

**Efficiency = time of completed tasks / time of all tasks of the week.** Without estimates, we count tasks.

## FAQ

**Can I add a task after the week is locked?** Yes, but it won’t be part of the week’s plan.
"""),
    dict(title='Expense requests: from ask to payment', category='processes', required=True, author='nurlan',
         summary='Who approves, when requests are reviewed and how payment is recorded.',
         content="""Every company-paid purchase starts with a request in **Expenses**.

## Steps

1. Click **“New request”** and enter the amount, the category and why it is needed.
2. Requests are reviewed once a week. The decision is “Approved”, “Rejected” or “Needs info”.
3. Accounting pays the approved request and records the actual amount.

**Note:** the actual amount may differ from the requested one — that’s fine, it is stored separately.
"""),
    dict(title='A new hire’s first week', category='hr', required=False, author='saule',
         summary='What to do in the first five days: access, introductions, first tasks.',
         content="""## Day 1
- Get access to email, TaskHub and the CRM.
- Meet your mentor.

## Days 2–3
- Read the required guides in **Guides**.
- Take 2–3 small tasks in your team’s sprint.

## Days 4–5
- First one-on-one with your manager: what is clear and what is not.
"""),
    dict(title='Messenger reply standard', category='sales', required=False, author='erlan',
         summary='Draft under review by the Head of Sales.', status='review',
         content="""## Response time
During working hours — **within 15 minutes**.

## Reply structure
1. Greet the client by name.
2. Answer the question.
3. Offer the next step: a call, a quote or a meeting.
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
            sp = dict(id=new(), project_id=pr['id'], name=f'Sprint {n + 1}', date_from=d_from.isoformat(),
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
                   DNI}

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
                    t['column_id'] = (next((c['id'] for c in srednie if c['name'] == V_RABOTE), None)
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
    for title, sdvig, proekt in LICHNYE:
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
                 justification=rnd.choice(OBOSNOVANIYA),
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
                     paid_note='Paid from the company account' if oplata == summa else 'Found a cheaper supplier')
            out['expense_request_activities'].append(dict(id=new(), request_id=z['id'], actor_id=ids['nurlan'],
                                                          type='paid', old_value=None, new_value=str(oplata),
                                                          created_at=oplacheno.isoformat()))
        if status == 'needs_info':
            out['expense_request_comments'].append(dict(
                id=new(), request_id=z['id'], author_id=ids[kto], attachments=[],
                text='Added three options to the description, the second one is the cheapest.',
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
                                        note='Baseline from the learning platform export'))
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
                    deal_title=f'{rebyonok[0]}, grade {rnd.randint(1, 11)}' if len(imena) == 1 else f'{fam[2]} family',
                    counted=not propusk, origin_stage='C4:NEW' if propusk else 'WON',
                    skip_reason='the deal came from “Unsorted”, not from “Paid in full”' if propusk else None))
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
                    deal_title=f'{rebyonok[0]}, grade {rnd.randint(1, 11)}', counted=not propusk, origin_stage='C10:NEW',
                    skip_reason=rnd.choice(['a withdrawal for this deal was already recorded',
                                            'came from “Debtors archive” — the student is no longer enrolled there'])
                    if propusk else None))
                istoriya += 1
        den += dt.timedelta(days=1)

    return out
