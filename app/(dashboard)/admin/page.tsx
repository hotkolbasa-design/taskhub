import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminUserActions from '@/components/admin-user-actions'
import AdminNameEdit from '@/components/admin-name-edit'

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Активен',   color: 'var(--green)',  bg: 'rgba(45,212,160,0.12)' },
  pending:  { label: 'Ожидает',   color: 'var(--yellow)', bg: 'rgba(247,192,79,0.12)' },
  inactive: { label: 'Неактивен', color: 'var(--text2)',  bg: 'rgba(136,146,164,0.12)' },
}

const roleLabel: Record<string, { label: string; color: string; bg: string }> = {
  admin:    { label: 'Admin',    color: 'var(--accent)', bg: 'rgba(79,142,247,0.12)' },
  employee: { label: 'Employee', color: 'var(--text2)',  bg: 'rgba(136,146,164,0.12)' },
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, login, role, status, created_at')
    .order('created_at', { ascending: false })

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers()
  const emailMap = Object.fromEntries(authUsers.map((u) => [u.id, u.email]))

  const pending = profiles?.filter((p) => p.status === 'pending') ?? []
  const rest = profiles?.filter((p) => p.status !== 'pending') ?? []

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-semibold mb-8" style={{ color: 'var(--text)' }}>
        Пользователи
      </h1>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text2)' }}>
            Ожидают подтверждения — {pending.length}
          </h2>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {pending.map((profile, i) => (
              <Row
                key={profile.id}
                profile={profile}
                email={emailMap[profile.id]}
                currentUserId={user.id}
                isLast={i === pending.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text2)' }}>
          Все пользователи — {profiles?.length ?? 0}
        </h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          {rest.length === 0 && (
            <p className="px-5 py-4 text-sm" style={{ color: 'var(--text2)' }}>Пусто</p>
          )}
          {rest.map((profile, i) => (
            <Row
              key={profile.id}
              profile={profile}
              email={emailMap[profile.id]}
              currentUserId={user.id}
              isLast={i === rest.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Row({
  profile,
  email,
  currentUserId,
  isLast,
}: {
  profile: { id: string; full_name: string; login: string; role: string; status: string }
  email: string | undefined
  currentUserId: string
  isLast: boolean
}) {
  const s = statusLabel[profile.status] ?? statusLabel.inactive
  const r = roleLabel[profile.role] ?? roleLabel.employee

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {(profile.full_name?.[0] ?? profile.login?.[0] ?? '?').toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <AdminNameEdit userId={profile.id} name={profile.full_name || profile.login} />
        <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>
          {email} · @{profile.login}
        </p>
      </div>

      <Badge label={r.label} color={r.color} bg={r.bg} />
      <Badge label={s.label} color={s.color} bg={s.bg} />

      <AdminUserActions
        userId={profile.id}
        status={profile.status}
        role={profile.role}
        isSelf={profile.id === currentUserId}
      />
    </div>
  )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-md shrink-0"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}
