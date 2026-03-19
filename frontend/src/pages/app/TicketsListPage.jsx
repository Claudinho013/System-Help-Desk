import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { getTicketPriorityLabel, TICKET_PRIORITY_OPTIONS } from '../../lib/ticketPriority'
import { getTicketProblemTypeLabel } from '../../lib/ticketProblemType'
import { getTicketStatusLabel, TICKET_STATUS_OPTIONS } from '../../lib/ticketStatus'

export function TicketsListPage() {
  const { token, isStaff } = useAuth()

  const [tickets, setTickets] = useState([])
  const [categories, setCategories] = useState([])
  const [filterOptions, setFilterOptions] = useState({
    departments: [],
    tags: [],
    problemTypes: [],
    requesters: [],
    attendants: [],
  })
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    department: 'all',
    problemType: 'all',
    requesterId: 'all',
    attendantId: 'all',
    tag: 'all',
    categoryId: 'all',
    subcategory: 'all',
    origin: 'all',
    mine: false,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })
  const [loading, setLoading] = useState(true)
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadBootstrapData = async () => {
      setLoadingFilters(true)

      try {
        const [filtersData, categoriesData] = await Promise.all([
          apiRequest('/tickets/filter-options', { token }),
          apiRequest('/categories', { token }),
        ])

        setFilterOptions(filtersData.filters || {})
        setCategories(categoriesData.categories || [])
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoadingFilters(false)
      }
    }

    loadBootstrapData()
  }, [token])

  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true)
      setError('')

      try {
        const queryParams = new URLSearchParams()

        if (filters.status !== 'all') {
          queryParams.set('status', filters.status)
        }

        if (filters.priority !== 'all') {
          queryParams.set('priority', filters.priority)
        }

        if (filters.department !== 'all') {
          queryParams.set('department', filters.department)
        }

        if (filters.problemType !== 'all') {
          queryParams.set('problemType', filters.problemType)
        }

        if (filters.requesterId !== 'all') {
          queryParams.set('requesterId', filters.requesterId)
        }

        if (filters.attendantId !== 'all') {
          queryParams.set('attendantId', filters.attendantId)
        }

        if (filters.tag !== 'all') {
          queryParams.set('tag', filters.tag)
        }

        if (filters.categoryId !== 'all') {
          queryParams.set('categoryId', filters.categoryId)
        }

        if (filters.subcategory !== 'all') {
          queryParams.set('subcategory', filters.subcategory)
        }

        if (filters.origin !== 'all') {
          queryParams.set('origin', filters.origin)
        }

        if (filters.mine) {
          queryParams.set('mine', 'true')
        }

        if (filters.search.trim()) {
          queryParams.set('search', filters.search.trim())
        }

        queryParams.set('sortBy', filters.sortBy)
        queryParams.set('sortOrder', filters.sortOrder)

        const data = await apiRequest(`/tickets?${queryParams.toString()}`, { token })
        setTickets(data.tickets)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadTickets()
  }, [filters, token])

  const selectedCategory = useMemo(() => {
    if (filters.categoryId === 'all') {
      return null
    }

    return categories.find((category) => Number(category.id) === Number(filters.categoryId)) || null
  }, [categories, filters.categoryId])

  const subcategoryOptions = useMemo(() => {
    return selectedCategory?.subcategories?.length ? selectedCategory.subcategories : []
  }, [selectedCategory])

  const onFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      priority: 'all',
      department: 'all',
      problemType: 'all',
      requesterId: 'all',
      attendantId: 'all',
      tag: 'all',
      categoryId: 'all',
      subcategory: 'all',
      origin: 'all',
      mine: false,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
  }

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'sortBy' || key === 'sortOrder') {
        return false
      }

      if (key === 'mine') {
        return value
      }

      if (typeof value === 'string') {
        return value.trim() !== '' && value !== 'all'
      }

      return false
    })
  }, [filters])

  return (
    <div className="grid gap-6">
      <section className="panel-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Operacao</p>
            <h3 className="text-xl font-semibold text-white">Listagem de chamados</h3>
          </div>
          <Link className="btn-primary" to="/tickets/new">
            Abrir chamado
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9"
              value={filters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              placeholder="Buscar por numero, titulo, descricao, tags ou nomes"
            />
          </label>

          <select className="input-field" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="all">Todos os status</option>
            {TICKET_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.priority} onChange={(event) => onFilterChange('priority', event.target.value)}>
            <option value="all">Todas as prioridades</option>
            {TICKET_PRIORITY_OPTIONS.map((priorityOption) => (
              <option key={priorityOption.value} value={priorityOption.value}>
                {priorityOption.label}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.problemType} onChange={(event) => onFilterChange('problemType', event.target.value)}>
            <option value="all">Todos os tipos</option>
            {(filterOptions.problemTypes || []).map((problemTypeOption) => (
              <option key={problemTypeOption.value} value={problemTypeOption.value}>
                {problemTypeOption.label}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.department} onChange={(event) => onFilterChange('department', event.target.value)}>
            <option value="all">Todos os setores</option>
            {(filterOptions.departments || []).map((departmentOption) => (
              <option key={departmentOption} value={departmentOption}>
                {departmentOption}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.requesterId} onChange={(event) => onFilterChange('requesterId', event.target.value)}>
            <option value="all">Todos os clientes</option>
            {(filterOptions.requesters || []).map((requester) => (
              <option key={requester.id} value={requester.id}>
                {requester.name}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={filters.attendantId}
            onChange={(event) => onFilterChange('attendantId', event.target.value)}
            disabled={!isStaff}
          >
            <option value="all">Todos os atendentes</option>
            <option value="unassigned">Nao atribuido</option>
            {(filterOptions.attendants || []).map((attendant) => (
              <option key={attendant.id} value={attendant.id}>
                {attendant.name}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.tag} onChange={(event) => onFilterChange('tag', event.target.value)}>
            <option value="all">Todas as tags</option>
            {(filterOptions.tags || []).map((tagOption) => (
              <option key={tagOption} value={tagOption}>
                #{tagOption}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={filters.categoryId}
            onChange={(event) => {
              onFilterChange('categoryId', event.target.value)
              onFilterChange('subcategory', 'all')
            }}
          >
            <option value="all">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={filters.subcategory}
            onChange={(event) => onFilterChange('subcategory', event.target.value)}
            disabled={!selectedCategory}
          >
            <option value="all">Todas as subcategorias</option>
            {subcategoryOptions.map((subcategoryOption) => (
              <option key={subcategoryOption} value={subcategoryOption}>
                {subcategoryOption}
              </option>
            ))}
          </select>

          <select className="input-field" value={filters.origin} onChange={(event) => onFilterChange('origin', event.target.value)}>
            <option value="all">Todas as origens</option>
            <option value="site">Site</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="app">App</option>
          </select>

          <select className="input-field" value={filters.sortBy} onChange={(event) => onFilterChange('sortBy', event.target.value)}>
            <option value="updatedAt">Ordenar por atualizacao</option>
            <option value="createdAt">Ordenar por abertura</option>
            <option value="closedAt">Ordenar por fechamento</option>
            <option value="priority">Ordenar por prioridade</option>
            <option value="status">Ordenar por status</option>
            <option value="ticketNumber">Ordenar por numero</option>
          </select>

          <select className="input-field" value={filters.sortOrder} onChange={(event) => onFilterChange('sortOrder', event.target.value)}>
            <option value="desc">Mais recentes / maiores</option>
            <option value="asc">Mais antigos / menores</option>
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={filters.mine}
              onChange={(event) => onFilterChange('mine', event.target.checked)}
            />
            Apenas meus chamados
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span>Ordenacao e filtros aplicados no servidor.</span>
          {hasActiveFilters ? (
            <button className="btn-ghost" type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="panel-surface border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</section>
      ) : null}

      <section className="grid gap-3">
        {loading || loadingFilters ? <p className="text-sm text-slate-300">Carregando chamados...</p> : null}

        {!loading && !loadingFilters && tickets.length === 0 ? (
          <article className="panel-surface p-6 text-sm text-slate-300">Nenhum chamado encontrado para os filtros selecionados.</article>
        ) : null}

        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            className="panel-surface p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-teal-300/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to={`/tickets/${ticket.id}`} className="text-lg font-semibold text-white hover:text-teal-200">
                  {ticket.ticketNumber || `#${ticket.id}`} {ticket.title}
                </Link>
                <p className="mt-2 text-sm text-slate-300">{ticket.description}</p>
              </div>
              <div className="grid gap-2 text-right text-xs uppercase tracking-wide">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-100">{getTicketStatusLabel(ticket.status)}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-100">{getTicketPriorityLabel(ticket.priority)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
              <span>Categoria: {ticket.categoryName}</span>
              <span>Subcategoria: {ticket.subcategory || 'Geral'}</span>
              <span>Tipo: {getTicketProblemTypeLabel(ticket.problemType)}</span>
              <span>Setor: {ticket.departmentResponsible || 'Atendimento'}</span>
              <span>Origem: {ticket.origin || 'site'}</span>
              <span>Solicitante: {ticket.requesterName}</span>
              {ticket.tags?.length ? <span>Tags: {ticket.tags.map((tag) => `#${tag}`).join(', ')}</span> : null}
              {isStaff ? <span>Responsavel: {ticket.assignedName || 'Nao atribuido'}</span> : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
