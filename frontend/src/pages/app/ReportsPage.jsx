import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'

const barTones = ['bg-teal-400', 'bg-cyan-400', 'bg-indigo-400', 'bg-amber-400', 'bg-rose-400']

function MetricsSection({ title, items, valueKey, labelKey }) {
  return (
    <section className="panel-surface p-5">
      <h4 className="text-lg font-semibold text-white">{title}</h4>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <article key={`${title}-${item[labelKey]}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <p>{item[labelKey]}</p>
              <p>{item[valueKey]} ({item.percentage}%)</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full ${barTones[index % barTones.length]}`}
                style={{ width: `${Math.max(item.percentage, 4)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ReportsPage() {
  const { token } = useAuth()
  const [report, setReport] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadReport = async () => {
      try {
        const data = await apiRequest('/reports/overview', { token })
        setReport(data)
      } catch (requestError) {
        if (requestError.status === 403) {
          setForbidden(true)
        } else {
          setError(requestError.message)
        }
      }
    }

    loadReport()
  }, [token])

  if (forbidden) {
    return (
      <section className="panel-surface p-6 text-sm text-slate-200">
        Apenas administradores e gerentes podem visualizar os relatorios.
      </section>
    )
  }

  if (error) {
    return <section className="panel-surface p-6 text-sm text-rose-200">{error}</section>
  }

  if (!report) {
    return <section className="panel-surface p-6 text-sm text-slate-300">Carregando relatorios...</section>
  }

  return (
    <div className="grid gap-6">
      <section className="panel-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Analitico</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Relatorios operacionais</h3>
        <p className="mt-2 text-sm text-slate-300">Visao consolidada de status, prioridades, setores, clientes e atendentes.</p>
        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          Total de chamados: {report.totalTickets}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricsSection title="Por status" items={report.byStatus} valueKey="count" labelKey="statusLabel" />
        <MetricsSection title="Por prioridade" items={report.byPriority} valueKey="count" labelKey="priorityLabel" />
        <MetricsSection title="Por categoria" items={report.byCategory} valueKey="count" labelKey="category" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MetricsSection title="Por setor" items={report.byDepartment || []} valueKey="count" labelKey="department" />
        <MetricsSection title="Por tipo de problema" items={report.byProblemType || []} valueKey="count" labelKey="problemTypeLabel" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MetricsSection title="Por cliente" items={report.byRequester || []} valueKey="count" labelKey="requesterName" />
        <MetricsSection title="Por atendente" items={report.byAttendant || []} valueKey="count" labelKey="attendantName" />
      </div>
    </div>
  )
}
