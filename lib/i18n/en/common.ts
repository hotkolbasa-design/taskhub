// Общие слова интерфейса: статусы, приоритеты, роли, разделы меню, даты.
// Это глоссарий — разделы (shell, tasks, crm, …) не переводят эти строки по-своему.
export const common: Record<string, string> = {
  // разделы меню
  'Дашборд': 'Dashboard',
  'Мои задачи': 'My tasks',
  'Проекты': 'Projects',
  'Аналитика': 'Analytics',
  'Инструкции': 'Guides',
  'Расходы': 'Expenses',
  'Корзина': 'Trash',
  'CRM': 'CRM',
  'Пользователи': 'Users',
  'Уведомления': 'Notifications',
  'Подсказчик': 'Call assistant',
  'Предложения': 'Suggestions',
  'Выйти': 'Sign out',
  'Профиль': 'Profile',

  // задачи
  'Задача': 'Task',
  'Эпик': 'Epic',
  'Бэклог': 'Backlog',
  'Спринт': 'Sprint',
  'Исполнитель': 'Assignee',
  'Постановщик': 'Reporter',
  'Создатель задачи': 'Reporter',
  'Дедлайн': 'Due date',
  'Приоритет': 'Priority',
  'Статус': 'Status',
  'Оценка времени': 'Estimate',
  'Описание': 'Description',
  'Комментарии': 'Comments',

  // статусы задачи (workflow_status)
  'Новая': 'New',
  'В работе': 'In progress',
  'На проверке': 'In review',
  'Выполнена': 'Done',
  'Отменена': 'Cancelled',

  // приоритеты; «Нет» у приоритета — tc('priority', 'Нет'), в других местах это «No»
  'Высокий': 'High',
  'Средний': 'Medium',
  'priority|Нет': 'None',

  // колонки спринта по умолчанию (создаются кодом и хранятся в базе)
  'К выполнению': 'To do',
  'Готово': 'Done',
  'Новые': 'New',

  // роли и статусы людей
  'Админ': 'Admin',
  'Сотрудник': 'Employee',
  'Активен': 'Active',
  'Неактивен': 'Inactive',
  'Ожидает': 'Pending',
  'Владелец': 'Owner',
  'Руководитель': 'Manager',
  'Участник': 'Member',
  'Наблюдатель': 'Viewer',

  // кнопки
  'Сохранить': 'Save',
  'Отмена': 'Cancel',
  'Удалить': 'Delete',
  'Закрыть': 'Close',
  'Добавить': 'Add',
  'Изменить': 'Edit',
  'Готово!': 'Done!',
  'Загрузка…': 'Loading…',
  'Загрузка...': 'Loading…',
  'Все': 'All',
  'Прочее': 'Other',

  // месяцы — именительный падеж (заголовки) и родительный (даты «19 октября»)
  'Январь': 'January', 'Февраль': 'February', 'Март': 'March', 'Апрель': 'April', 'Май': 'May', 'Июнь': 'June',
  'Июль': 'July', 'Август': 'August', 'Сентябрь': 'September', 'Октябрь': 'October', 'Ноябрь': 'November',
  'Декабрь': 'December',
  'января': 'January', 'февраля': 'February', 'марта': 'March', 'апреля': 'April', 'мая': 'May', 'июня': 'June',
  'июля': 'July', 'августа': 'August', 'сентября': 'September', 'октября': 'October', 'ноября': 'November',
  'декабря': 'December',
  'янв': 'Jan', 'фев': 'Feb', 'мар': 'Mar', 'апр': 'Apr', 'июн': 'Jun', 'июл': 'Jul', 'авг': 'Aug',
  'сен': 'Sep', 'окт': 'Oct', 'ноя': 'Nov', 'дек': 'Dec',

  // дни недели
  'Понедельник': 'Monday', 'Вторник': 'Tuesday', 'Среда': 'Wednesday', 'Четверг': 'Thursday',
  'Пятница': 'Friday', 'Суббота': 'Saturday', 'Воскресенье': 'Sunday',
  'Пн': 'Mon', 'Вт': 'Tue', 'Ср': 'Wed', 'Чт': 'Thu', 'Пт': 'Fri', 'Сб': 'Sat', 'Вс': 'Sun',
  'пн': 'Mon', 'вт': 'Tue', 'ср': 'Wed', 'чт': 'Thu', 'пт': 'Fri', 'сб': 'Sat', 'вс': 'Sun',
  'Сегодня': 'Today', 'Вчера': 'Yesterday', 'Завтра': 'Tomorrow',
}

export const commonPlurals: Record<string, [string, string]> = {
  'задача': ['task', 'tasks'],
  'эпик': ['epic', 'epics'],
  'день': ['day', 'days'],
  'неделя': ['week', 'weeks'],
  'месяц': ['month', 'months'],
  'час': ['hour', 'hours'],
  'минута': ['minute', 'minutes'],
  'человек': ['person', 'people'],
  'участник': ['member', 'members'],
}
