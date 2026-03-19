import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'

export function SettingsPage() {
  const { token } = useAuth()
  const [settings, setSettings] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiRequest('/settings', { token })
        setSettings(data.settings)
      } catch (error) {
        if (error.status === 403) {
          setForbidden(true)
        } else {
          setFeedback(error.message)
        }
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [token])

  const onSave = async (event) => {
    event.preventDefault()

    if (!settings) {
      return
    }

    try {
      const data = await apiRequest('/settings', {
        method: 'PATCH',
        token,
        body: settings,
      })

      setSettings(data.settings)
      setFeedback('Configuracoes atualizadas com sucesso.')
    } catch (error) {
      setFeedback(error.message)
    }
  }

  const updateNumberField = (path, value) => {
    const parsed = Number(value)
    const safeNumber = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1

    setSettings((current) => {
      const [group, key] = path
      return {
        ...current,
        [group]: {
          ...(current[group] || {}),
          [key]: safeNumber,
        },
      }
    })
  }

  if (loading) {
    return <section className="panel-surface p-6 text-sm text-slate-300">Carregando configuracoes...</section>
  }

  if (forbidden) {
    return (
      <section className="panel-surface p-6 text-sm text-slate-200">
        Seu perfil nao possui permissao para editar configuracoes da plataforma.
      </section>
    )
  }

  if (!settings) {
    return <section className="panel-surface p-6 text-sm text-rose-200">{feedback || 'Falha ao carregar configuracoes.'}</section>
  }

  return (
    <section className="panel-surface p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Administracao</p>
      <h3 className="mt-2 text-2xl font-semibold text-white">Configuracoes</h3>

      <form className="mt-6 grid gap-4" onSubmit={onSave}>
        <label className="field-label" htmlFor="settings-company-name">
          Nome da empresa
        </label>
        <input
          id="settings-company-name"
          className="input-field"
          value={settings.companyName}
          onChange={(event) => setSettings((current) => ({ ...current, companyName: event.target.value }))}
        />

        <label className="field-label" htmlFor="settings-support-email">
          Email de suporte
        </label>
        <input
          id="settings-support-email"
          className="input-field"
          type="email"
          value={settings.supportEmail}
          onChange={(event) => setSettings((current) => ({ ...current, supportEmail: event.target.value }))}
        />

        <div className="grid gap-3 text-sm text-slate-200">
          {[
            ['allowTicketReopen', 'Permitir reabertura de chamados'],
            ['autoAssignEnabled', 'Ativar atribuicao automatica'],
            ['autoAssignByDepartment', 'Distribuicao por setor'],
            ['autoAssignByWorkload', 'Distribuicao por carga de trabalho'],
            ['autoReplyOnTicketOpen', 'Resposta automatica ao abrir chamado'],
            ['autoStatusTransitionsEnabled', 'Mudanca automatica de status'],
            ['notifyOnNewTicket', 'Notificar novos chamados'],
            ['notifyOnTicketUpdate', 'Notificar atualizacoes de chamados'],
            ['slaEnabled', 'Ativar regras de SLA'],
            ['autoEscalationEnabled', 'Ativar escalonamento automatico'],
            ['delayAlertsEnabled', 'Enviar alertas de atraso'],
            ['attendantRemindersEnabled', 'Lembretes internos para atendentes'],
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>

        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">SLA resposta (minutos)</p>
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <label key={`sla-response-${priority}`} className="grid gap-1">
                <span className="text-xs uppercase text-slate-300">{priority}</span>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={settings.slaRules?.[priority]?.firstResponseMinutes || 1}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      slaRules: {
                        ...(current.slaRules || {}),
                        [priority]: {
                          ...(current.slaRules?.[priority] || {}),
                          firstResponseMinutes: Math.max(1, Number(event.target.value || 1)),
                        },
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="grid gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">SLA resolucao (minutos)</p>
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <label key={`sla-resolution-${priority}`} className="grid gap-1">
                <span className="text-xs uppercase text-slate-300">{priority}</span>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={settings.slaRules?.[priority]?.resolutionMinutes || 1}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      slaRules: {
                        ...(current.slaRules || {}),
                        [priority]: {
                          ...(current.slaRules?.[priority] || {}),
                          resolutionMinutes: Math.max(1, Number(event.target.value || 1)),
                        },
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Aviso antes do SLA (min)</span>
            <input
              className="input-field"
              type="number"
              min={1}
              value={settings.escalationRules?.warningBeforeMinutes || 1}
              onChange={(event) => updateNumberField(['escalationRules', 'warningBeforeMinutes'], event.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Nivel maximo de escalonamento</span>
            <input
              className="input-field"
              type="number"
              min={1}
              value={settings.escalationRules?.maxEscalationLevel || 1}
              onChange={(event) => updateNumberField(['escalationRules', 'maxEscalationLevel'], event.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Inatividade para lembrete (min)</span>
            <input
              className="input-field"
              type="number"
              min={1}
              value={settings.reminderRules?.inactivityMinutes || 1}
              onChange={(event) => updateNumberField(['reminderRules', 'inactivityMinutes'], event.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Repeticao de lembretes (min)</span>
            <input
              className="input-field"
              type="number"
              min={1}
              value={settings.reminderRules?.repeatEveryMinutes || 1}
              onChange={(event) => updateNumberField(['reminderRules', 'repeatEveryMinutes'], event.target.value)}
            />
          </label>
        </div>

        <button className="btn-primary mt-2 w-fit" type="submit">
          Salvar configuracoes
        </button>
      </form>

      {feedback ? <p className="mt-4 text-sm text-teal-200">{feedback}</p> : null}
    </section>
  )
}
