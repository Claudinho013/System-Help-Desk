import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="panel-surface max-w-xl p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-300">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Pagina nao encontrada</h1>
        <p className="mt-3 text-sm text-slate-300">A rota acessada nao existe neste sistema.</p>
        <Link to="/dashboard" className="btn-primary mx-auto mt-6 w-fit">
          Voltar para o painel
        </Link>
      </div>
    </div>
  )
}
