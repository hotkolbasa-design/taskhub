const AVATAR_COLORS = ['#7C5CF6', '#A78BFA', '#2DD4A0', '#F7C04F', '#F75C6E', '#60C0E8']

export function getAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
