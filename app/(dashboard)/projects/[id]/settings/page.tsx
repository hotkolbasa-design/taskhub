import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GeneralForm from '@/components/projects/settings/general-form'
import MembersSection from '@/components/projects/settings/members-section'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: project } = await admin
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!project) redirect('/projects')

  // Проверяем что текущий юзер — owner или admin
  const { data: myMembership } = await admin
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', session.user.id)
    .maybeSingle()

  const { data: myProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  const canEdit = myMembership?.role === 'owner' || myMembership?.role === 'manager' || myProfile?.role === 'admin'
  if (!canEdit) redirect(`/projects`)

  // Участники проекта с профилями
  const { data: members } = await admin
    .from('project_members')
    .select('user_id, role, profiles(full_name, login, avatar_url)')
    .eq('project_id', id)

  // Все активные пользователи (для добавления)
  const { data: allProfiles } = await admin
    .from('profiles')
    .select('id, full_name, login')
    .eq('status', 'active')
    .order('full_name')

  const membersNormalized = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    profile: m.profiles,
  }))

  return (
    <div className="p-8 max-w-2xl">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--text2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Проекты
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{project.name}</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="text-sm" style={{ color: 'var(--text2)' }}>Настройки</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${id}/backlog`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 4h6M3 6.5h4M3 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Бэклог
          </Link>
          <Link
            href={`/projects/${id}/sprint`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Спринт
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <GeneralForm
          projectId={id}
          initialName={project.name}
          initialDescription={project.description}
          initialColor={project.color}
          initialAssigneeMode={project.default_assignee_mode ?? 'manual'}
          initialAssigneeId={project.default_assignee_id ?? null}
          members={membersNormalized.map((m: any) => ({
            id: m.user_id,
            full_name: m.profile?.full_name ?? null,
            login: m.profile?.login ?? '',
          }))}
        />

        <MembersSection
          projectId={id}
          members={membersNormalized}
          availableProfiles={allProfiles ?? []}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  )
}
