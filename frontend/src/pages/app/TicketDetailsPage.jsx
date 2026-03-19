import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { TICKET_PRIORITY_OPTIONS } from '../../lib/ticketPriority'
import { getTicketProblemTypeLabel, TICKET_PROBLEM_TYPE_OPTIONS } from '../../lib/ticketProblemType'
import { TICKET_STATUS_OPTIONS } from '../../lib/ticketStatus'

export function TicketDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user, isStaff } = useAuth()

  const [ticket, setTicket] = useState(null)
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [comments, setComments] = useState([])
  const [timeline, setTimeline] = useState([])
  const [editForm, setEditForm] = useState(null)
  const [commentInput, setCommentInput] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const canUpdate = useMemo(() => {
    if (!ticket || !user) {
      return false
    }

    return isStaff || ticket.requesterId === user.id
  }, [isStaff, ticket, user])

  const canDelete = useMemo(() => {
    if (!ticket || !user) {
      return false
    }

    return isStaff || ticket.requesterId === user.id
  }, [isStaff, ticket, user])

  const canClose = Boolean(canUpdate && ticket && !['closed', 'cancelled'].includes(ticket.status))
  const canReopen = Boolean(canUpdate && ticket && ['closed', 'resolved', 'cancelled'].includes(ticket.status))

  const toAttachmentText = (attachments) => {
    if (!Array.isArray(attachments) || !attachments.length) {
      return ''
    }

    return attachments.map((attachment) => attachment.url).join('\n')
  }

  const toTagsText = (tags) => {
    if (!Array.isArray(tags) || !tags.length) {
      return ''
    }

    return tags.join(', ')
  }

  const parseAttachments = (raw) => {
    return String(raw || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((url, index) => ({
        id: `att-${index + 1}`,
        name: url.split('/').pop() || `Anexo ${index + 1}`,
        url,
      }))
  }

  const parseTags = (raw) => {
    return [...new Set(String(raw || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean))]
  }

  const hydrateForm = useCallback((rawTicket) => {
    if (!rawTicket) {
      return
    }

    setEditForm({
      title: rawTicket.title || '',
      description: rawTicket.description || '',
      status: rawTicket.status || 'open',
      priority: rawTicket.priority || 'medium',
      problemType: rawTicket.problemType || 'other',
      tagsText: toTagsText(rawTicket.tags),
      categoryId: rawTicket.categoryId || 4,
      subcategory: rawTicket.subcategory || 'Geral',
      assignedTo: rawTicket.assignedTo || '',
      departmentResponsible: rawTicket.departmentResponsible || 'Atendimento',
      origin: rawTicket.origin || 'site',
      attendantResponse: rawTicket.attendantResponse || '',
      clientReturn: rawTicket.clientReturn || '',
      attachmentsText: toAttachmentText(rawTicket.attachments),
    })
  }, [])

  const loadTicket = useCallback(async () => {
    const [ticketData, commentData, timelineData] = await Promise.all([
      apiRequest(`/tickets/${id}`, { token }),
      apiRequest(`/tickets/${id}/comments`, { token }),
      apiRequest(`/tickets/${id}/timeline`, { token }),
    ])

    setTicket(ticketData.ticket)
    setComments(commentData.comments)
    setTimeline(timelineData.timeline)
    hydrateForm(ticketData.ticket)
  }, [hydrateForm, id, token])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadTicket()

        const categoryPromise = apiRequest('/categories', { token })
        const userPromise = isStaff ? apiRequest('/users', { token }) : Promise.resolve({ users: [] })

        const [categoryData, usersData] = await Promise.all([categoryPromise, userPromise])

        setCategories(categoryData.categories || [])
        setUsers((usersData.users || []).filter((item) => ['admin', 'attendant', 'manager'].includes(item.role)))
      } catch (requestError) {
        setError(requestError.message)
      }
    }

    bootstrap()
  }, [isStaff, loadTicket, token])

  const patchTicket = async (payload, successMessage) => {
    if (!ticket) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = await apiRequest(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        token,
        body: payload,
      })

      setTicket(data.ticket)
      hydrateForm(data.ticket)
      const timelineData = await apiRequest(`/tickets/${ticket.id}/timeline`, { token })
      setTimeline(timelineData.timeline)

      if (successMessage) {
        setError('')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const closeTicket = async () => {
    if (!ticket) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = await apiRequest(`/tickets/${ticket.id}/close`, {
        method: 'POST',
        token,
        body: {
          attendantResponse: editForm?.attendantResponse || '',
          clientReturn: editForm?.clientReturn || '',
        },
      })

      setTicket(data.ticket)
      hydrateForm(data.ticket)
      const timelineData = await apiRequest(`/tickets/${ticket.id}/timeline`, { token })
      setTimeline(timelineData.timeline)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const reopenTicket = async () => {
    if (!ticket) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = await apiRequest(`/tickets/${ticket.id}/reopen`, {
        method: 'POST',
        token,
        body: {
          clientReturn: editForm?.clientReturn || '',
        },
      })

      setTicket(data.ticket)
      hydrateForm(data.ticket)
      const timelineData = await apiRequest(`/tickets/${ticket.id}/timeline`, { token })
      setTimeline(timelineData.timeline)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteTicket = async () => {
    if (!ticket) {
      return
    }

    const confirmed = window.confirm('Deseja realmente excluir este chamado?')

    if (!confirmed) {
      return
    }

    setSaving(true)
    setError('')

    try {
      await apiRequest(`/tickets/${ticket.id}`, {
        method: 'DELETE',
        token,
      })

      navigate('/tickets')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const saveTicketDetails = async () => {
    if (!editForm || !ticket) {
      return
    }

    await patchTicket({
      title: editForm.title,
      description: editForm.description,
      categoryId: Number(editForm.categoryId),
      subcategory: editForm.subcategory,
      priority: editForm.priority,
      problemType: editForm.problemType,
      tags: parseTags(editForm.tagsText),
      origin: editForm.origin,
      departmentResponsible: editForm.departmentResponsible,
      assignedTo: editForm.assignedTo ? Number(editForm.assignedTo) : null,
      status: editForm.status,
      attachments: parseAttachments(editForm.attachmentsText),
      attendantResponse: editForm.attendantResponse,
      clientReturn: editForm.clientReturn,
    })
  }

  const submitComment = async (event) => {
    event.preventDefault()

    if (!commentInput.trim()) {
      return
    }

    try {
      const data = await apiRequest(`/tickets/${id}/comments`, {
        method: 'POST',
        token,
        body: { message: commentInput.trim() },
      })

      setComments((current) => [...current, data.comment])
      setCommentInput('')
      const timelineData = await apiRequest(`/tickets/${id}/timeline`, { token })
      setTimeline(timelineData.timeline)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const selectedCategory =
    categories.find((category) => Number(category.id) === Number(editForm?.categoryId)) || categories[0] || null

  const formatDate = (value) => (value ? new Date(value).toLocaleString() : '-')

  if (!ticket && !error) {
    return <section className="panel-surface p-6 text-sm text-slate-300">Carregando ticket...</section>
  }

  if (error && !ticket) {
    return <section className="panel-surface border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</section>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="panel-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">{ticket.ticketNumber || `Ticket #${ticket.id}`}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{ticket.title}</h3>
        <p className="mt-2 text-sm text-slate-300">Timeline completa, historico de alteracoes e resposta entre equipe e cliente.</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-slate-100">
            Tipo: {getTicketProblemTypeLabel(ticket.problemType)}
          </span>
          {(ticket.tags || []).map((tag) => (
            <span key={`ticket-tag-${tag}`} className="rounded-full border border-teal-300/30 bg-teal-400/10 px-3 py-1 text-teal-100">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Data de abertura</p>
            <p className="mt-1 text-sm text-white">{formatDate(ticket.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ultima atualizacao</p>
            <p className="mt-1 text-sm text-white">{formatDate(ticket.updatedAt)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Data de fechamento</p>
            <p className="mt-1 text-sm text-white">{formatDate(ticket.closedAt)}</p>
          </div>
        </div>

        {editForm ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ticket-title">
                Titulo do chamado
              </label>
              <input
                id="ticket-title"
                className="input-field"
                value={editForm.title}
                onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                disabled={!canUpdate || saving}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ticket-description">
                Descricao detalhada
              </label>
              <textarea
                id="ticket-description"
                className="input-field min-h-36 resize-y"
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                disabled={!canUpdate || saving}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-status">
                Status
              </label>
              <select
                id="ticket-status"
                className="input-field"
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                disabled={!canUpdate || !isStaff || saving}
              >
                {TICKET_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-priority">
                Prioridade
              </label>
              <select
                id="ticket-priority"
                className="input-field"
                value={editForm.priority}
                onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value }))}
                disabled={!canUpdate || saving}
              >
                {TICKET_PRIORITY_OPTIONS.map((priorityOption) => (
                  <option key={priorityOption.value} value={priorityOption.value}>
                    {priorityOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-problem-type">
                Tipo de problema
              </label>
              <select
                id="ticket-problem-type"
                className="input-field"
                value={editForm.problemType}
                onChange={(event) => setEditForm((current) => ({ ...current, problemType: event.target.value }))}
                disabled={!canUpdate || saving}
              >
                {TICKET_PROBLEM_TYPE_OPTIONS.map((problemTypeOption) => (
                  <option key={problemTypeOption.value} value={problemTypeOption.value}>
                    {problemTypeOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-origin">
                Origem
              </label>
              <select
                id="ticket-origin"
                className="input-field"
                value={editForm.origin}
                onChange={(event) => setEditForm((current) => ({ ...current, origin: event.target.value }))}
                disabled={!canUpdate || saving}
              >
                <option value="site">Site</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="app">App</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-department-responsible">
                Departamento responsavel
              </label>
              <input
                id="ticket-department-responsible"
                className="input-field"
                value={editForm.departmentResponsible}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, departmentResponsible: event.target.value }))
                }
                disabled={!canUpdate || saving}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-category">
                Categoria
              </label>
              <select
                id="ticket-category"
                className="input-field"
                value={editForm.categoryId}
                onChange={(event) => {
                  const categoryId = Number(event.target.value)
                  const category = categories.find((item) => Number(item.id) === categoryId)
                  setEditForm((current) => ({
                    ...current,
                    categoryId,
                    subcategory: category?.subcategories?.[0] || 'Geral',
                  }))
                }}
                disabled={!canUpdate || saving}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-subcategory">
                Subcategoria
              </label>
              <select
                id="ticket-subcategory"
                className="input-field"
                value={editForm.subcategory}
                onChange={(event) => setEditForm((current) => ({ ...current, subcategory: event.target.value }))}
                disabled={!canUpdate || saving}
              >
                {(selectedCategory?.subcategories?.length ? selectedCategory.subcategories : ['Geral']).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {isStaff ? (
              <div>
                <label className="field-label" htmlFor="ticket-assigned">
                  Atendente responsavel
                </label>
                <select
                  id="ticket-assigned"
                  className="input-field"
                  value={editForm.assignedTo || ''}
                  onChange={(event) => setEditForm((current) => ({ ...current, assignedTo: event.target.value }))}
                  disabled={!canUpdate || saving}
                >
                  <option value="">Nao atribuido</option>
                  {users.map((staffUser) => (
                    <option key={staffUser.id} value={staffUser.id}>
                      {staffUser.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ticket-tags">
                Tags (separadas por virgula)
              </label>
              <input
                id="ticket-tags"
                className="input-field"
                value={editForm.tagsText}
                onChange={(event) => setEditForm((current) => ({ ...current, tagsText: event.target.value }))}
                disabled={!canUpdate || saving}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ticket-attachments">
                Anexos (uma URL por linha)
              </label>
              <textarea
                id="ticket-attachments"
                className="input-field min-h-24 resize-y"
                value={editForm.attachmentsText}
                onChange={(event) => setEditForm((current) => ({ ...current, attachmentsText: event.target.value }))}
                disabled={!canUpdate || saving}
              />
            </div>

            {isStaff ? (
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="ticket-attendant-response">
                  Resposta do atendente
                </label>
                <textarea
                  id="ticket-attendant-response"
                  className="input-field min-h-24 resize-y"
                  value={editForm.attendantResponse}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, attendantResponse: event.target.value }))
                  }
                  disabled={!canUpdate || saving}
                />
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ticket-client-return">
                Retorno do cliente
              </label>
              <textarea
                id="ticket-client-return"
                className="input-field min-h-24 resize-y"
                value={editForm.clientReturn}
                onChange={(event) => setEditForm((current) => ({ ...current, clientReturn: event.target.value }))}
                disabled={!canUpdate || saving}
              />
            </div>

            {canUpdate ? (
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <button className="btn-primary" type="button" onClick={saveTicketDetails} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
                {canClose ? (
                  <button className="btn-ghost" type="button" onClick={closeTicket} disabled={saving}>
                    Fechar chamado
                  </button>
                ) : null}
                {canReopen ? (
                  <button className="btn-ghost" type="button" onClick={reopenTicket} disabled={saving}>
                    Reabrir chamado
                  </button>
                ) : null}
                {canDelete ? (
                  <button className="btn-ghost" type="button" onClick={deleteTicket} disabled={saving}>
                    Excluir chamado
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="grid gap-6">
        <section className="panel-surface p-6">
          <h4 className="text-lg font-semibold text-white">Comentarios no chamado</h4>

          <form className="mt-4 grid gap-3" onSubmit={submitComment}>
            <textarea
              className="input-field min-h-28 resize-y"
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              placeholder="Adicione um comentario para o historico do ticket"
              required
            />
            <button className="btn-primary w-fit" type="submit">
              Enviar comentario
            </button>
          </form>

          <div className="mt-6 grid gap-3">
            {comments.length === 0 ? <p className="text-sm text-slate-300">Sem comentarios por enquanto.</p> : null}

            {comments.map((comment) => (
              <article key={comment.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white">{comment.message}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {comment.authorName || 'Equipe'} • {new Date(comment.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-surface p-6">
          <h4 className="text-lg font-semibold text-white">Timeline do ticket</h4>

          <div className="mt-4 grid gap-3">
            {timeline.length === 0 ? <p className="text-sm text-slate-300">Sem eventos na timeline.</p> : null}

            {timeline.map((event) => (
              <article key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-teal-300">{event.kind}</p>
                  <p className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-2 text-sm text-white">{event.description}</p>
                <p className="mt-2 text-xs text-slate-400">Responsavel: {event.authorName || 'Sistema'}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
