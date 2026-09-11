# TaskHub

A team task-management and analytics app built for a real company that had outgrown spreadsheets:
projects, an epic-based backlog, sprints, a kanban board, weekly snapshots, and per-person
efficiency analytics — plus a CRM module that reads live marketing data from Google Sheets.

Built and shipped solo in three months (177 commits). Running in production on Vercel.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL, Auth, Realtime,
Row Level Security) · Tailwind CSS 4 · dnd-kit · Google Sheets API

---

## Why it exists

The team ran planning in spreadsheets and chat. Nobody could answer two questions that matter every
week: what did we actually commit to, and who is overloaded. Off-the-shelf trackers either hid that
behind paid analytics tiers or didn't model the workflow the team already had.

So the app is built around those two questions. Everything else is in service of them.

## What it does

**Backlog with epics.** Tasks nest under epics, drag and drop works across containers — root list,
any epic, or the sprint panel — and a task can be promoted to an epic or pulled out of one without
losing its place.

**Sprints and weekly commitment.** The sprint panel sits next to the backlog. When the week starts,
the sprint is *frozen*: a snapshot records exactly which tasks were committed, so the end-of-week
review compares against the promise rather than against a moving target.

**Kanban board.** Sprint tasks move through configurable columns. The freeze badge stays visible so
everyone knows what was in scope when the week began.

**Efficiency analytics.** Per-person completion rate and time-estimate accuracy, computed from the
frozen task set rather than from whatever ended up in the sprint later.

**Roles and admin.** Registration goes through a pending state; an admin activates users, assigns
roles and departments. Access to the CRM module is granted by department and position.

**CRM module.** Marketing funnel data lives in Google Sheets, maintained by the marketing team. The
app reads it through the Sheets API and computes funnel metrics, spend and period-over-period
snapshots — so the sales side gets a dashboard without anyone changing how they work.

**Notifications, comments, trash.** Real-time comments on tasks, a notification feed, and a
recoverable trash instead of hard deletes.

## Engineering notes

A few decisions that took more than one attempt:

**Multi-container drag and drop without layout thrash.** Using a DOM element as the drop indicator
caused an infinite loop through layout detection — the indicator changed the layout that produced
the indicator. The position marker is a `box-shadow` on the neighbouring card instead, and drag
preview state lives in refs with an equality check, never in React state during `dragOver`.

**Optimistic updates with rollback.** Every mutation updates the UI immediately, writes to the
server in the background, and rolls back on failure. The pattern is centralized so new features get
it by default rather than by remembering.

**Filtering that doesn't lose data.** The assignee filter narrows what's *displayed*, while
mutations always run against the full task list — otherwise tasks hidden by a filter silently
disappear from state on the next write.

**Row Level Security as the real boundary.** Access rules live in Postgres policies, not in the
client. The service-role key is used only in server-side admin paths.

**No native `<select>` or `<input type="date">`.** Both are replaced with custom components —
consistent across browsers, and dropdowns inside scroll containers render through a portal with
fixed positioning so they don't clip.

## Running locally

```bash
npm install
cp .env.example .env.local   # Supabase URL and keys
npm run dev
```

Requires a Supabase project; migrations live in `supabase/`.

## Status

In production and in daily use. Active work: deeper efficiency analytics and admin tooling.
