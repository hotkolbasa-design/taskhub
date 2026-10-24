import { isDemo } from '@/lib/demo/mode'
import LoginForm from './login-form'

export default function LoginPage() {
  return <LoginForm demo={isDemo()} />
}
