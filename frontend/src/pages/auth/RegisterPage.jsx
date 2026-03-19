import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })
    setLoading(true)

    try {
      await register(form)
      setFeedback({ type: 'success', message: 'Cadastro realizado com sucesso. Agora faca login.' })
      setTimeout(() => navigate('/login'), 1200)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <p className="auth-kicker">Cadastro</p>
        <h1 className="auth-title">Crie sua conta de cliente</h1>
        <p className="auth-subtitle">Acompanhe chamados, historico e comunicacao com a equipe em um unico painel.</p>

        <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="register-name">
            Nome completo
          </label>
          <input
            id="register-name"
            className="input-field"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />

          <label className="field-label" htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            className="input-field"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />

          <label className="field-label" htmlFor="register-password">
            Senha
          </label>
          <input
            id="register-password"
            type="password"
            className="input-field"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
          />

          <button className="btn-primary mt-2" type="submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        {feedback.message ? (
          <p
            className={[
              'mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              feedback.type === 'success'
                ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border border-rose-500/40 bg-rose-500/10 text-rose-200',
            ].join(' ')}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : null}
            {feedback.message}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-slate-300">
          Ja possui conta?{' '}
          <Link to="/login" className="font-semibold text-teal-300 hover:text-teal-200">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
