import { useEffect, useState } from 'react'
import { Camera, Activity } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Falha ao ler imagem selecionada'))
    reader.readAsDataURL(file)
  })
}

export function ProfilePage() {
  const { user, token, updateProfile, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(user?.phone || '')
  const [department, setDepartment] = useState(user?.department || '')
  const [activities, setActivities] = useState([])
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(user?.name || '')
    setPhone(user?.phone || '')
    setDepartment(user?.department || '')
  }, [user])

  useEffect(() => {
    const loadActivity = async () => {
      if (!user?.id || !token) {
        return
      }

      try {
        const data = await apiRequest(`/users/${user.id}/activity?limit=12`, { token })
        setActivities(data.activities)
      } catch {
        setActivities([])
      }
    }

    loadActivity()
  }, [token, user?.id])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setFeedback('')

    try {
      await updateProfile({
        name,
        phone,
        department,
        ...(password ? { password } : {}),
      })

      setPassword('')
      setFeedback('Perfil atualizado com sucesso.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setLoading(false)
    }
  }

  const onAvatarChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file || !token || !user?.id) {
      return
    }

    setFeedback('')

    try {
      const avatarDataUrl = await toDataUrl(file)
      await apiRequest(`/users/${user.id}/avatar`, {
        method: 'POST',
        token,
        body: { avatarDataUrl },
      })

      await refreshUser()
      setFeedback('Foto de perfil atualizada com sucesso.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section className="panel-surface p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Conta</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Perfil do usuario</h3>
        <p className="mt-2 text-sm text-slate-300">Gerencie dados pessoais, foto de perfil e credenciais de acesso.</p>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <img
            src={user?.avatarUrl}
            alt="Avatar do perfil"
            className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
          />
          <div className="flex-1 text-sm text-slate-300">
            <p>
              <span className="text-slate-400">Email:</span> {user?.email}
            </p>
            <p>
              <span className="text-slate-400">Perfil:</span> {user?.role}
            </p>
            <p>
              <span className="text-slate-400">Status:</span> {user?.isActive ? 'Ativo' : 'Inativo'}
            </p>
          </div>
          <label className="btn-ghost cursor-pointer">
            <Camera size={16} />
            Alterar foto
            <input type="file" className="hidden" accept="image/*" onChange={onAvatarChange} />
          </label>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="profile-name">
            Nome
          </label>
          <input id="profile-name" className="input-field" value={name} onChange={(event) => setName(event.target.value)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="profile-phone">
                Telefone
              </label>
              <input
                id="profile-phone"
                className="input-field"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="profile-department">
                Departamento
              </label>
              <input
                id="profile-department"
                className="input-field"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </div>
          </div>

          <label className="field-label" htmlFor="profile-password">
            Nova senha (opcional)
          </label>
          <input
            id="profile-password"
            type="password"
            className="input-field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Preencha apenas se quiser alterar"
          />

          <button className="btn-primary mt-2 w-fit" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </form>

        {feedback ? <p className="mt-4 text-sm text-teal-200">{feedback}</p> : null}
      </section>

      <section className="panel-surface p-6">
        <h4 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
          <Activity size={18} />
          Historico de atividade
        </h4>
        <p className="mt-2 text-sm text-slate-300">Ultimas acoes registradas para sua conta.</p>

        <div className="mt-5 grid gap-3">
          {activities.length === 0 ? <p className="text-sm text-slate-300">Sem atividades recentes.</p> : null}

          {activities.map((entry) => (
            <article key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">{entry.action}</p>
              <p className="mt-1 text-xs text-slate-300">{entry.details}</p>
              <p className="mt-2 text-xs text-slate-500">{entry.actorName} • {new Date(entry.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
