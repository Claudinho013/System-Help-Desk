import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { TICKET_PRIORITY_OPTIONS } from '../../lib/ticketPriority'
import { TICKET_PROBLEM_TYPE_OPTIONS } from '../../lib/ticketProblemType'

export function NewTicketPage() {
  const navigate = useNavigate()
  const { token, isStaff, user } = useAuth()

  const [categories, setCategories] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    problemType: 'other',
    tagsText: '',
    categoryId: 4,
    subcategory: '',
    departmentResponsible: user?.department || 'Atendimento',
    origin: 'site',
    assignedTo: '',
    attachmentsText: '',
    attendantResponse: '',
    clientReturn: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const categoryData = await apiRequest('/categories')
        const resolvedCategories = categoryData.categories || []
        setCategories(resolvedCategories)

        if (resolvedCategories.length) {
          setForm((current) => {
            const selectedCategory =
              resolvedCategories.find((category) => Number(category.id) === Number(current.categoryId)) || resolvedCategories[0]
            const subcategory = current.subcategory || selectedCategory.subcategories?.[0] || 'Geral'

            return {
              ...current,
              categoryId: Number(selectedCategory.id),
              subcategory,
            }
          })
        }

        if (isStaff) {
          const usersData = await apiRequest('/users', { token })
          setStaffUsers(usersData.users.filter((item) => ['admin', 'attendant', 'manager'].includes(item.role)))
        }
      } catch {
        // The page still works with default category id even if category fetch fails.
      }
    }

    bootstrap()
  }, [isStaff, token])

  const selectedCategory =
    categories.find((category) => Number(category.id) === Number(form.categoryId)) ||
    categories[0] ||
    ({ id: 4, name: 'Sistema', subcategories: ['Geral'] })

  const parseAttachments = (rawText) => {
    return String(rawText || '')
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

  const parseTags = (rawText) => {
    return [...new Set(String(rawText || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean))]
  }

  const onCategoryChange = (value) => {
    const categoryId = Number(value)
    const category = categories.find((item) => Number(item.id) === categoryId)

    setForm((current) => ({
      ...current,
      categoryId,
      subcategory: category?.subcategories?.[0] || 'Geral',
    }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await apiRequest('/tickets', {
        method: 'POST',
        token,
        body: {
          title: form.title,
          description: form.description,
          priority: form.priority,
          problemType: form.problemType,
          tags: parseTags(form.tagsText),
          categoryId: Number(form.categoryId),
          subcategory: form.subcategory,
          departmentResponsible: form.departmentResponsible,
          origin: form.origin,
          assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
          attachments: parseAttachments(form.attachmentsText),
          attendantResponse: isStaff ? form.attendantResponse : '',
          clientReturn: form.clientReturn,
        },
      })

      navigate(`/tickets/${data.ticket.id}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel-surface p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Abertura</p>
      <h3 className="mt-2 text-2xl font-semibold text-white">Abrir novo chamado</h3>
      <p className="mt-2 text-sm text-slate-300">Forneca detalhes claros para agilizar o atendimento.</p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="ticket-title">
          Titulo
        </label>
        <input
          id="ticket-title"
          className="input-field"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          required
        />

        <label className="field-label" htmlFor="ticket-description">
          Descricao
        </label>
        <textarea
          id="ticket-description"
          className="input-field min-h-36 resize-y"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ticket-priority">
              Prioridade
            </label>
            <select
              id="ticket-priority"
              className="input-field"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
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
              value={form.problemType}
              onChange={(event) => setForm((current) => ({ ...current, problemType: event.target.value }))}
            >
              {TICKET_PROBLEM_TYPE_OPTIONS.map((problemTypeOption) => (
                <option key={problemTypeOption.value} value={problemTypeOption.value}>
                  {problemTypeOption.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="ticket-tags">
            Tags (separadas por virgula)
          </label>
          <input
            id="ticket-tags"
            className="input-field"
            placeholder="login, financeiro, urgente"
            value={form.tagsText}
            onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <div>
            <label className="field-label" htmlFor="ticket-category">
              Categoria
            </label>
            <select
              id="ticket-category"
              className="input-field"
              value={form.categoryId}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              {(categories.length ? categories : [{ id: 4, name: 'Sistema' }]).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ticket-subcategory">
              Subcategoria
            </label>
            <select
              id="ticket-subcategory"
              className="input-field"
              value={form.subcategory}
              onChange={(event) => setForm((current) => ({ ...current, subcategory: event.target.value }))}
            >
              {(selectedCategory.subcategories?.length ? selectedCategory.subcategories : ['Geral']).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="ticket-origin">
              Origem do chamado
            </label>
            <select
              id="ticket-origin"
              className="input-field"
              value={form.origin}
              onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
            >
              <option value="site">Site</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="app">App</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ticket-department">
              Departamento responsavel
            </label>
            <input
              id="ticket-department"
              className="input-field"
              value={form.departmentResponsible}
              onChange={(event) => setForm((current) => ({ ...current, departmentResponsible: event.target.value }))}
              required
            />
          </div>

          {isStaff ? (
            <div>
              <label className="field-label" htmlFor="ticket-assigned-to">
                Atendente responsavel
              </label>
              <select
                id="ticket-assigned-to"
                className="input-field"
                value={form.assignedTo}
                onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
              >
                <option value="">Nao atribuido</option>
                {staffUsers.map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div>
          <label className="field-label" htmlFor="ticket-attachments">
            Anexos (uma URL por linha)
          </label>
          <textarea
            id="ticket-attachments"
            className="input-field min-h-24 resize-y"
            placeholder="https://.../arquivo.pdf"
            value={form.attachmentsText}
            onChange={(event) => setForm((current) => ({ ...current, attachmentsText: event.target.value }))}
          />
        </div>

        {isStaff ? (
          <div>
            <label className="field-label" htmlFor="ticket-attendant-response">
              Resposta inicial do atendente
            </label>
            <textarea
              id="ticket-attendant-response"
              className="input-field min-h-24 resize-y"
              value={form.attendantResponse}
              onChange={(event) => setForm((current) => ({ ...current, attendantResponse: event.target.value }))}
            />
          </div>
        ) : null}

        <div>
          <label className="field-label" htmlFor="ticket-client-return">
            Retorno inicial do cliente
          </label>
          <textarea
            id="ticket-client-return"
            className="input-field min-h-24 resize-y"
            value={form.clientReturn}
            onChange={(event) => setForm((current) => ({ ...current, clientReturn: event.target.value }))}
          />
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button className="btn-primary mt-2 w-fit" type="submit" disabled={loading}>
          {loading ? 'Criando chamado...' : 'Criar chamado'}
        </button>
      </form>
    </section>
  )
}
