import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form.email, form.password)
      const destination = location.state?.from?.pathname || '/dashboard'
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div>
          <p className="auth-kicker">HelpDesk Pro</p>
          <h1 className="auth-title">Acesse sua central de atendimento</h1>
          <p className="auth-subtitle">
            Interface moderna para clientes e equipe interna acompanharem chamados em tempo real.
          </p>
        </div>

        <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="input-field"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="voce@empresa.com"
            required
          />

          <label className="field-label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            className="input-field"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Sua senha"
            required
          />

          {error ? (
            <p className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              <AlertCircle size={16} />
              {error}
            </p>
          ) : null}

          <button className="btn-primary mt-2" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar no sistema'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-8 grid gap-3 text-sm text-slate-300">
          <Link className="link-button" to="/forgot-password">
            Esqueci minha senha
          </Link>
          <p>
            Ainda nao tem conta?{' '}
            <Link to="/register" className="font-semibold text-teal-300 hover:text-teal-200">
              Criar cadastro
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
