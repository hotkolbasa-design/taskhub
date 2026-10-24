// Промпт копируется сотрудником в свой ИИ: ключ — точный текст AI_PROMPT из components/articles/article-ui.tsx
const AI_PROMPT_RU = `Напиши инструкцию для сотрудников компании.

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

const AI_PROMPT_EN = `Write a guide for company employees.

Topic: [DESCRIBE WHAT THE GUIDE IS ABOUT]

Text requirements:
- Write in English, in plain language, addressing the reader as "you", no jargon or bureaucratic wording
- Start with one paragraph: why this matters and when it applies
- Then numbered steps — what to click and what happens
- Put important warnings in bold
- End with a "FAQ" section with 3–5 questions and short answers
- Don't invent buttons or sections that don't exist: if you don't know something, write [TO CLARIFY]

Response format — Markdown:
## for section headings, ### for subheadings,
1. 2. 3. for steps, - for lists, **bold** for important points,
| tables | when a comparison is needed |

Output only the guide text, with no preamble like "Sure, here's the guide".`

export const shell: Record<string, string> = {
  // вход, регистрация, восстановление пароля
  'Ссылка недействительна или устарела. Запросите новую.': 'This link is invalid or has expired. Request a new one.',
  'Срок действия ссылки истёк. Запросите новую.': 'This link has expired. Request a new one.',
  'Письмо отправлено': 'Check your email',
  'Если аккаунт с адресом ': 'If an account with ',
  ' существует, на него ушло письмо со ссылкой для смены пароля. Ссылка действует час.':
    ' exists, we’ve sent it a password reset link. The link is valid for one hour.',
  'Письма нет — проверьте папку «Спам» или': 'No email? Check your spam folder or',
  'отправьте ещё раз': 'send it again',
  'Вернуться ко входу': 'Back to sign in',
  'Восстановление пароля': 'Reset password',
  'Укажите email — пришлём ссылку для смены пароля': 'Enter your email and we’ll send you a password reset link',
  'Отправка…': 'Sending…',
  'Отправить ссылку': 'Send link',
  'Вспомнили пароль?': 'Remembered your password?',
  'Войти': 'Sign in',
  'Ваш аккаунт деактивирован. Обратитесь к администратору.': 'Your account has been deactivated. Contact an administrator.',
  'Ваш аккаунт ожидает подтверждения администратора.': 'Your account is awaiting administrator approval.',
  'Не удалось войти в демо. Попробуйте ещё раз через минуту.': 'Couldn’t sign in to the demo. Try again in a minute.',
  'Вход': 'Sign in',
  'Входим…': 'Signing in…',
  'Войти в демо без пароля': 'Enter the demo — no password needed',
  'Демо-версия: вымышленная компания и тестовые данные. Данные обновляются раз в неделю.':
    'Demo version: a fictional company with sample data. Data is refreshed weekly.',
  'Пароль': 'Password',
  'Забыли пароль?': 'Forgot password?',
  'Вход…': 'Signing in…',
  'Нет аккаунта?': 'No account?',
  'Зарегистрироваться': 'Sign up',
  'Регистрация завершена': 'You’re signed up',
  'Ваш аккаунт ожидает подтверждения администратора': 'Your account is awaiting administrator approval',
  'Регистрация': 'Sign up',
  'Имя': 'Name',
  'Регистрация…': 'Signing up…',
  'Уже есть аккаунт?': 'Already have an account?',
  'Пароль должен быть не короче {n} символов': 'Password must be at least {n} characters',
  'Пароли не совпадают': 'Passwords don’t match',
  'Ссылка не действует': 'Link no longer valid',
  'Ссылка для смены пароля устарела или уже была использована. Запросите новую — она придёт на почту.':
    'This password reset link has expired or was already used. Request a new one and we’ll email it to you.',
  'Запросить новую ссылку': 'Request a new link',
  'Пароль изменён': 'Password changed',
  'Новый пароль сохранён. Им же входите в следующий раз.': 'Your new password is saved. Use it next time you sign in.',
  'Перейти в TaskHub': 'Go to TaskHub',
  'Новый пароль': 'New password',
  'Придумайте пароль от {n} символов': 'Choose a password of at least {n} characters',
  'Повторите пароль': 'Confirm password',
  'Сохранение…': 'Saving…',
  'Сохранить пароль': 'Save password',

  // главная
  'Добро пожаловать в Task Hub': 'Welcome to Task Hub',

  // админка: ошибки server actions
  'Только суперадмин может выдавать право утверждать расходы': 'Only the superadmin can grant expense approval rights',
  'Только суперадмин может выдавать доступ к расходам': 'Only the superadmin can grant access to expenses',
  'Свой пароль меняйте через восстановление по почте': 'To change your own password, use email password reset',
  'Только суперадмин может приглашать администраторов': 'Only the superadmin can invite admins',

  // инструкции: ошибки server actions
  'Не авторизован': 'Not signed in',
  'Нужен заголовок': 'Title is required',
  'Инструкция не найдена': 'Guide not found',
  'Опубликованную инструкцию правит только админ': 'Only an admin can edit a published guide',
  'Это не ваша инструкция': 'This isn’t your guide',
  'Публикует только админ': 'Only an admin can publish',
  'Снимает с публикации только админ': 'Only an admin can unpublish',
  'Удалить может автор в черновике или админ': 'Only the author (while it’s a draft) or an admin can delete this',
  'Нет доступа': 'Access denied',

  // проекты
  'Все проекты — {n}': 'All projects — {n}',
  'Новый проект': 'New project',
  'Проектов пока нет': 'No projects yet',
  'Создай первый проект чтобы начать работу': 'Create your first project to get started',
  'Создать проект': 'Create project',

  // админка: приглашение и профиль пользователя
  'Укажите email': 'Enter an email',
  'Ошибка при отправке приглашения': 'Failed to send the invite',
  'Пригласить пользователя': 'Invite user',
  'Полное имя': 'Full name',
  'Иванов Иван': 'John Smith',
  'Должность': 'Position',
  'Менеджер проектов': 'Project manager',
  'Отдел': 'Department',
  'Маркетинг': 'Marketing',
  'Роль': 'Role',
  'Отправить приглашение': 'Send invite',
  'вы': 'you',
  'Не указан': 'Not set',
  'Не указана': 'Not set',
  'Поиск или новый отдел…': 'Search or add a department…',
  'Добавить «{q}»': 'Add “{q}”',
  'Ничего не найдено': 'Nothing found',
  'Не удалось изменить право': 'Couldn’t change the permission',
  'Не удалось сбросить пароль': 'Couldn’t reset the password',
  'Скопируйте пароль вручную': 'Copy the password manually',
  'Профиль пользователя': 'User profile',
  'Это вы': 'This is you',
  'Суперадмин': 'Superadmin',
  'Дата рождения': 'Date of birth',
  'Очистить': 'Clear',
  'Заявки на расходы': 'Expense requests',
  'Может одобрять расходы': 'Can approve expenses',
  'Бухгалтерия: видит все и отмечает оплату': 'Accounting: sees all requests and marks them paid',
  'Скопировано': 'Copied',
  'Копировать': 'Copy',
  'Передайте пароль лично — второй раз он не покажется. Войдя, человек сменит его на свой через «Забыли пароль?».':
    'Share this password in person — it won’t be shown again. After signing in, they can set their own via “Forgot password?”.',
  'Старый пароль перестанет работать. Сбросить?': 'The old password will stop working. Reset it?',
  'Да, сбросить': 'Yes, reset',
  'Сброс…': 'Resetting…',
  'Сбросить пароль': 'Reset password',
  'Сохранить изменения': 'Save changes',
  'Добавить пользователя': 'Add user',
  'Ожидают подтверждения — {n}': 'Awaiting approval — {n}',
  'Все пользователи — {n}': 'All users — {n}',
  'Пусто': 'Empty',

  // инструкции: категории, статусы, редактор, просмотр
  'Работа в TaskHub': 'Using TaskHub',
  'Процессы компании': 'Company processes',
  'Кадры': 'HR',
  'Продажи и маркетинг': 'Sales & marketing',
  'Черновик': 'Draft',
  'Опубликована': 'Published',
  'Обязательная': 'Required',
  'Не удалось скопировать — выделите текст промпта вручную': 'Couldn’t copy — select the prompt text manually',
  'Напишите заголовок': 'Add a title',
  'Инструкция пустая': 'The guide is empty',
  'Не удалось сохранить': 'Couldn’t save',
  'Редактирование инструкции': 'Edit guide',
  'Новая инструкция': 'New guide',
  'Пишете через ИИ?': 'Writing with AI?',
  'Скопируйте промпт, вставьте в Claude или другой ИИ, опишите процесс своими словами — и вставьте готовый текст в поле ниже.':
    'Copy the prompt, paste it into Claude or another AI, describe the process in your own words — then paste the result into the field below.',
  'Скопировать промпт': 'Copy prompt',
  'Заголовок': 'Title',
  'Как поставить задачу в проекте': 'How to create a task in a project',
  'Раздел': 'Section',
  'О чём инструкция — одной строкой': 'What the guide is about — in one line',
  'Кому ставить, как выбрать исполнителя и срок': 'Who to assign, how to pick an assignee and a due date',
  'Текст': 'Text',
  'Предпросмотр': 'Preview',
  '## Заголовок раздела\n\nАбзац текста.\n\n1. Первый шаг\n2. Второй шаг\n\n**Важно:** предупреждение.':
    '## Section heading\n\nA paragraph of text.\n\n1. First step\n2. Second step\n\n**Important:** a warning.',
  'Пока пусто — напишите текст на вкладке «Текст»': 'Nothing here yet — write the text on the “Text” tab',
  'Обязательна к прочтению — у людей будет висеть напоминание, пока не откроют':
    'Required reading — people will see a reminder until they open it',
  'Кому показывать (ничего не выбрано — всем)': 'Who can see it (nothing selected — everyone)',
  'Существенная правка — попросить всех перечитать заново': 'Major update — ask everyone to read it again',
  'Не получилось': 'Something went wrong',
  'Не удалось получить список': 'Couldn’t load the list',
  'Все инструкции': 'All guides',
  'версия {n}': 'version {n}',
  'Неизвестно': 'Unknown',
  ' · опубликовано {d}': ' · published {d}',
  'Файлы': 'Files',
  '✓ Вы ознакомились с этой инструкцией': '✓ You’ve read this guide',
  'Прочитали? Отметьте — это видно руководителю.': 'Done reading? Mark it — your manager can see this.',
  'Ознакомился': 'I’ve read it',
  'Редактировать': 'Edit',
  'Отправить на проверку': 'Submit for review',
  'Опубликовать': 'Publish',
  'Снять с публикации': 'Unpublish',
  'Кто прочитал': 'Who has read it',
  'Ознакомились: {read} из {total}': 'Read: {read} of {total}',
  'Скрыть': 'Hide',
  'Ещё не прочитали': 'Not read yet',
  'Прочитали': 'Read',
  'Как всё устроено в компании и в TaskHub': 'How things work at the company and in TaskHub',
  'Написать инструкцию': 'Write a guide',
  'Нужно прочитать: ': 'Required reading: ',
  'Открыть': 'Open',
  'Здесь пока нет инструкций': 'No guides here yet',
  'Написать первую': 'Write the first one',
  '✓ прочитано': '✓ read',
  'прочитали: {n}': 'read: {n}',

  // ошибка страницы
  'Не удалось загрузить страницу': 'Couldn’t load the page',
  'Произошла непредвиденная ошибка': 'An unexpected error occurred',
  'Попробовать снова': 'Try again',

  // мой профиль
  'Мой профиль': 'My profile',

  // проекты: создание, карточка, настройки
  'Название *': 'Name *',
  'Например: Разработка сайта': 'E.g. Website development',
  'Кратко о проекте...': 'A short project summary...',
  'Цвет': 'Color',
  'Создать': 'Create',
  'Настройки проекта': 'Project settings',
  'Удалить проект': 'Delete project',
  'История': 'History',
  'Вручную': 'Manual',
  'При создании задачи исполнитель не назначается': 'No assignee is set when a task is created',
  'Исполнитель = тот кто создаёт задачу': 'Assignee = whoever creates the task',
  'Конкретный человек': 'Specific person',
  'Всегда назначать одного и того же': 'Always assign the same person',
  'Выбрать пользователя...': 'Select a user...',
  'Выберите исполнителя по умолчанию': 'Select a default assignee',
  'Основное': 'General',
  'Название': 'Name',
  'Цвет проекта': 'Project color',
  'Исполнитель по умолчанию': 'Default assignee',
  'Кто будет назначен исполнителем при создании задачи': 'Who gets assigned when a task is created',
  'Сохранено ✓': 'Saved ✓',
  'Выбрать пользователей...': 'Select users...',
  'Поиск...': 'Search...',
  'Не найдено': 'Not found',
  'Выбрать всех': 'Select all',
  'Снять всё': 'Clear all',
  'Участники — {n}': 'Members — {n}',
  'Неизвестный': 'Unknown',
  '(вы)': '(you)',
  'Удалить участника': 'Remove member',
  'Добавить участников': 'Add members',
  'Все пользователи системы уже добавлены в проект': 'All users have already been added to the project',
  'Добавить ({n})': 'Add ({n})',

  // боковое меню и уведомления
  'только что': 'just now',
  '{n} мин': '{n}m',
  '{n} ч': '{n}h',
  '{n} дн': '{n}d',
  'Назначили на задачу': 'Assigned to you',
  'Изменён исполнитель': 'Assignee changed',
  'Изменён постановщик': 'Reporter changed',
  'Изменён статус': 'Status changed',
  'Новый комментарий': 'New comment',
  'Дедлайн завтра': 'Due tomorrow',
  'Дедлайн просрочен': 'Overdue',
  'Новая заявка на расход': 'New expense request',
  'Решение по заявке': 'Decision on your request',
  'Комментарий к заявке': 'Comment on a request',
  'Заявка оплачена': 'Request paid',
  'Инструкция обновилась': 'Guide updated',
  'Пользователь': 'User',
  'Ожидают подтверждения: {n}': 'Awaiting approval: {n}',
  'Выход…': 'Signing out…',
  'Отмечаю…': 'Marking…',
  'Прочитать все': 'Mark all as read',
  'Нет уведомлений': 'No notifications',

  // промпт для ИИ в редакторе инструкций
  [AI_PROMPT_RU]: AI_PROMPT_EN,
}

export const shellPlurals: Record<string, [string, string]> = {
}
