import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Search, ShieldCheck, UserPlus, Activity, Save } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'

const roleOptions = ['client', 'attendant', 'manager', 'admin']

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'))
    reader.readAsDataURL(file)
  })
}

function UserCard({ user, onEdit, onToggleStatus, onUploadAvatar, onLoadHistory, canEdit, canToggle, canUpload, canViewHistory }) {
  return (
    <article className="panel-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={`Avatar de ${user.name}`}
            className="h-12 w-12 rounded-xl border border-white/20 object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-slate-300">{user.email}</p>
            <p className="mt-1 text-xs text-slate-400">{user.department || 'Sem departamento'}</p>
          </div>
        </div>

        <div className="grid gap-2 text-right">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
            {user.role}
          </span>
          <span
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold',
              user.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200',
            ].join(' ')}
          >
            {user.isActive ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canEdit ? (
          <button className="btn-ghost" type="button" onClick={() => onEdit(user)}>
            <Save size={16} />
            Editar
          </button>
        ) : null}

        {canToggle ? (
          <button className="btn-ghost" type="button" onClick={() => onToggleStatus(user)}>
            <ShieldCheck size={16} />
            {user.isActive ? 'Desativar' : 'Ativar'}
          </button>
        ) : null}

        {canUpload ? (
          <label className="btn-ghost cursor-pointer">
            <Camera size={16} />
            Foto
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onUploadAvatar(user, file)
                  event.target.value = ''
                }
              }}
            />
          </label>
        ) : null}

        {canViewHistory ? (
          <button className="btn-ghost" type="button" onClick={() => onLoadHistory(user.id)}>
            <Activity size={16} />
            Historico
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function UsersManagementPage() {
  const { token, user, hasRole, refreshUser } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client',
    phone: '',
    department: '',
  })

  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'client',
    phone: '',
    department: '',
  })

  const [historyTargetId, setHistoryTargetId] = useState(null)
  const [historyEntries, setHistoryEntries] = useState([])

  const allowedRolesToCreate = useMemo(() => {
    if (hasRole(['admin'])) {
      return roleOptions
    }

    if (hasRole(['manager'])) {
      return roleOptions.filter((role) => role !== 'admin')
    }

    return ['client']
  }, [hasRole])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (search.trim()) {
        params.set('search', search.trim())
      }
      if (roleFilter !== 'all') {
        params.set('role', roleFilter)
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await apiRequest(`/users${query}`, { token })
      setUsers(data.users)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search, statusFilter, token])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers()
    }, 240)

    return () => clearTimeout(timeout)
  }, [loadUsers])

  const createUser = async (event) => {
    event.preventDefault()
    setFeedback('')

    try {
      const data = await apiRequest('/users', {
        method: 'POST',
        token,
        body: createForm,
      })

      setFeedback(`Usuario ${data.user.name} criado com sucesso.`)
      setCreateForm({ name: '', email: '', password: '', role: 'client', phone: '', department: '' })
      await loadUsers()
    } catch (requestError) {
      setFeedback(requestError.message)
    }
  }

  const openEdit = (targetUser) => {
    setEditingUser(targetUser)
    setEditForm({
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone || '',
      department: targetUser.department || '',
    })
  }

  const saveEdit = async (event) => {
    event.preventDefault()

    if (!editingUser) {
      return
    }

    setFeedback('')

    try {
      await apiRequest(`/users/${editingUser.id}`, {
        method: 'PATCH',
        token,
        body: editForm,
      })

      setFeedback('Usuario atualizado com sucesso.')
      setEditingUser(null)
      await loadUsers()
      if (editingUser.id === user?.id) {
        await refreshUser()
      }
    } catch (requestError) {
      setFeedback(requestError.message)
    }
  }

  const toggleStatus = async (targetUser) => {
    setFeedback('')

    try {
      await apiRequest(`/users/${targetUser.id}/status`, {
        method: 'PATCH',
        token,
        body: { isActive: !targetUser.isActive },
      })

      setFeedback(`Conta de ${targetUser.name} ${targetUser.isActive ? 'desativada' : 'ativada'} com sucesso.`)
      await loadUsers()
      if (targetUser.id === user?.id) {
        await refreshUser()
      }
    } catch (requestError) {
      setFeedback(requestError.message)
    }
  }

  const uploadAvatar = async (targetUser, file) => {
    setFeedback('')

    try {
      const avatarDataUrl = await toDataUrl(file)
      await apiRequest(`/users/${targetUser.id}/avatar`, {
        method: 'POST',
        token,
        body: { avatarDataUrl },
      })

      setFeedback(`Foto de perfil de ${targetUser.name} atualizada.`)
      await loadUsers()
      if (targetUser.id === user?.id) {
        await refreshUser()
      }
    } catch (requestError) {
      setFeedback(requestError.message)
    }
  }

  const loadHistory = async (userId) => {
    setFeedback('')

    try {
      const data = await apiRequest(`/users/${userId}/activity`, { token })
      setHistoryTargetId(userId)
      setHistoryEntries(data.activities)
    } catch (requestError) {
      setFeedback(requestError.message)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="panel-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Administracao</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Gestao de usuarios</h3>
        <p className="mt-2 text-sm text-slate-300">
          Cadastre clientes, atendentes e administradores, gerencie status de conta e acompanhe atividades.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <label className="relative lg:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email, telefone ou departamento"
            />
          </label>

          <select className="input-field" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Todos os perfis</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select className="input-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </section>

      {(hasRole(['admin']) || hasRole(['manager'])) ? (
        <section className="panel-surface p-6">
          <h4 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <UserPlus size={18} />
            Cadastro de usuario
          </h4>

          <form className="mt-4 grid gap-3 lg:grid-cols-2" onSubmit={createUser}>
            <input
              className="input-field"
              placeholder="Nome"
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <input
              className="input-field"
              type="email"
              placeholder="Email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <input
              className="input-field"
              type="password"
              placeholder="Senha inicial"
              value={createForm.password}
              onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
            <select
              className="input-field"
              value={createForm.role}
              onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value }))}
            >
              {allowedRolesToCreate.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder="Telefone"
              value={createForm.phone}
              onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Departamento"
              value={createForm.department}
              onChange={(event) => setCreateForm((current) => ({ ...current, department: event.target.value }))}
            />
            <button className="btn-primary w-fit" type="submit">
              Cadastrar
            </button>
          </form>
        </section>
      ) : null}

      {editingUser ? (
        <section className="panel-surface p-6">
          <h4 className="text-lg font-semibold text-white">Edicao de usuario: {editingUser.name}</h4>
          <form className="mt-4 grid gap-3 lg:grid-cols-2" onSubmit={saveEdit}>
            <input
              className="input-field"
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              className="input-field"
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
            />
            <select
              className="input-field"
              value={editForm.role}
              onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
            >
              {allowedRolesToCreate.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder="Telefone"
              value={editForm.phone}
              onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Departamento"
              value={editForm.department}
              onChange={(event) => setEditForm((current) => ({ ...current, department: event.target.value }))}
            />
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">
                Salvar
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditingUser(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {feedback ? <section className="panel-surface p-4 text-sm text-teal-200">{feedback}</section> : null}
      {error ? <section className="panel-surface border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</section> : null}

      <section className="grid gap-3">
        {loading ? <p className="text-sm text-slate-300">Carregando usuarios...</p> : null}

        {!loading && users.length === 0 ? (
          <article className="panel-surface p-6 text-sm text-slate-300">Nenhum usuario encontrado para os filtros aplicados.</article>
        ) : null}

        {users.map((item) => {
          const isSelf = item.id === user?.id
          const isAdmin = item.role === 'admin'
          const canEdit = hasRole(['admin']) || (hasRole(['manager']) && !isAdmin)
          const canToggle = canEdit && !isSelf
          const canUpload = isSelf || hasRole(['admin', 'manager', 'attendant'])
          const canViewHistory = isSelf || hasRole(['admin', 'manager', 'attendant'])

          return (
            <UserCard
              key={item.id}
              user={item}
              onEdit={openEdit}
              onToggleStatus={toggleStatus}
              onUploadAvatar={uploadAvatar}
              onLoadHistory={loadHistory}
              canEdit={canEdit}
              canToggle={canToggle}
              canUpload={canUpload}
              canViewHistory={canViewHistory}
            />
          )
        })}
      </section>

      {historyTargetId ? (
        <section className="panel-surface p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-lg font-semibold text-white">Historico de atividade do usuario #{historyTargetId}</h4>
            <button className="btn-ghost" type="button" onClick={() => setHistoryTargetId(null)}>
              Fechar
            </button>
          </div>

          {historyEntries.length === 0 ? <p className="text-sm text-slate-300">Sem atividades registradas.</p> : null}

          <div className="grid gap-3">
            {historyEntries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-white">{entry.action}</p>
                <p className="mt-1 text-xs text-slate-300">{entry.details}</p>
                <p className="mt-2 text-xs text-slate-500">{entry.actorName} • {new Date(entry.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
