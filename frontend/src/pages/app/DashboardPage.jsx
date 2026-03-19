import { AlertTriangle, CheckCircle2, Clock3, Layers3, Ticket, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { getTicketStatusLabel } from '../../lib/ticketStatus'

const cardConfig = [
  { key: 'ticketsOpen', label: 'Abertos', icon: Ticket, tone: 'from-cyan-400/30 to-cyan-500/10' },
  { key: 'ticketsInProgress', label: 'Em andamento', icon: Clock3, tone: 'from-amber-400/30 to-amber-500/10' },
  { key: 'ticketsResolved', label: 'Resolvidos', icon: CheckCircle2, tone: 'from-emerald-400/30 to-emerald-500/10' },
  { key: 'ticketsHighPriority', label: 'Alta e critica', icon: AlertTriangle, tone: 'from-rose-400/30 to-rose-500/10' },
  { key: 'users', label: 'Usuarios', icon: Users, tone: 'from-violet-400/30 to-violet-500/10' },
  { key: 'categories', label: 'Categorias', icon: Layers3, tone: 'from-sky-400/30 to-sky-500/10' },
]

export function DashboardPage() {
  const { token, user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [summaryData, ticketData] = await Promise.all([
          apiRequest('/dashboard/summary', { token }),
          apiRequest('/tickets', { token }),
        ])

        setSummary(summaryData.summary)
        setTickets(ticketData.tickets.slice(0, 5))
      } catch (requestError) {
        setError(requestError.message)
      }
    }

    loadData()
  }, [token])

  return (
    <div className="grid gap-6">
      <section className="panel-surface relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Bem-vindo</p>
          <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{user?.name}</h3>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
            Acompanhe indicadores principais do atendimento, priorize chamados criticos e mantenha o fluxo da equipe
            organizado.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/tickets/new">
              Abrir novo chamado
            </Link>
            <Link className="btn-ghost" to="/tickets">
              Ver todos os chamados
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <section className="panel-surface border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cardConfig.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.key} className="panel-surface overflow-hidden p-5">
              <div className={`rounded-2xl bg-gradient-to-br ${item.tone} p-4`}>
                <div className="inline-flex rounded-lg bg-white/10 p-2 text-white">
                  <Icon size={18} />
                </div>
                <p className="mt-4 text-sm text-slate-200">{item.label}</p>
                <p className="mt-1 text-3xl font-semibold text-white">{summary ? summary[item.key] : '--'}</p>
              </div>
            </article>
          )
        })}
      </section>

      <section className="panel-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Chamados recentes</h3>
          <Link className="text-sm font-semibold text-teal-300 hover:text-teal-200" to="/tickets">
            Ver lista completa
          </Link>
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-300">Nenhum chamado encontrado no momento.</p>
        ) : (
          <div className="grid gap-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-teal-300/40 hover:bg-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">#{ticket.id} {ticket.title}</p>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
                    {getTicketStatusLabel(ticket.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{ticket.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
