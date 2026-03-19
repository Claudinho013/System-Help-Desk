import { useEffect, useMemo, useState } from 'react'
import { PlusCircle, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'

export function KnowledgeBasePage() {
  const { token, isStaff } = useAuth()
  const [articles, setArticles] = useState([])
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState('')
  const [newArticle, setNewArticle] = useState({ title: '', category: '', content: '' })

  useEffect(() => {
    const loadArticles = async () => {
      try {
        const data = await apiRequest('/knowledge-base', { token })
        setArticles(data.articles)
      } catch (error) {
        setFeedback(error.message)
      }
    }

    loadArticles()
  }, [token])

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return articles
    }

    const normalized = query.toLowerCase()
    return articles.filter((article) =>
      `${article.title} ${article.category} ${article.content}`.toLowerCase().includes(normalized),
    )
  }, [articles, query])

  const createArticle = async (event) => {
    event.preventDefault()

    try {
      const data = await apiRequest('/knowledge-base', {
        method: 'POST',
        token,
        body: newArticle,
      })

      setArticles((current) => [data.article, ...current])
      setNewArticle({ title: '', category: '', content: '' })
      setFeedback('Artigo criado com sucesso.')
    } catch (error) {
      setFeedback(error.message)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="panel-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Conhecimento</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Base de conhecimento / FAQ</h3>
        <p className="mt-2 text-sm text-slate-300">Centralize respostas recorrentes para acelerar atendimento e autoatendimento.</p>

        <label className="relative mt-5 block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por palavra-chave"
          />
        </label>
      </section>

      {isStaff ? (
        <section className="panel-surface p-6">
          <h4 className="text-lg font-semibold text-white">Novo artigo</h4>
          <form className="mt-4 grid gap-3" onSubmit={createArticle}>
            <input
              className="input-field"
              placeholder="Titulo"
              value={newArticle.title}
              onChange={(event) => setNewArticle((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <input
              className="input-field"
              placeholder="Categoria"
              value={newArticle.category}
              onChange={(event) => setNewArticle((current) => ({ ...current, category: event.target.value }))}
            />
            <textarea
              className="input-field min-h-28"
              placeholder="Conteudo"
              value={newArticle.content}
              onChange={(event) => setNewArticle((current) => ({ ...current, content: event.target.value }))}
              required
            />
            <button className="btn-primary w-fit" type="submit">
              <PlusCircle size={16} />
              Publicar artigo
            </button>
          </form>
        </section>
      ) : null}

      {feedback ? <section className="panel-surface p-4 text-sm text-teal-200">{feedback}</section> : null}

      <section className="grid gap-3">
        {filtered.map((article) => (
          <article key={article.id} className="panel-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-white">{article.title}</h4>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">{article.category}</span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{article.content}</p>
            <p className="mt-3 text-xs text-slate-500">Atualizado em {new Date(article.updatedAt).toLocaleString()}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
