import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      const message = await forgotPassword(email)
      setFeedback(message)
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <p className="auth-kicker">Recuperacao</p>
        <h1 className="auth-title">Recupere sua senha</h1>
        <p className="auth-subtitle">Informe seu email para receber instrucoes de redefinicao de acesso.</p>

        <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="recovery-email">
            Email
          </label>
          <input
            id="recovery-email"
            type="email"
            className="input-field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <button className="btn-primary mt-2" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar instrucoes'}
          </button>
        </form>

        {feedback ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm text-teal-100">
            <MailCheck size={16} />
            {feedback}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-slate-300">
          <Link to="/login" className="font-semibold text-teal-300 hover:text-teal-200">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
