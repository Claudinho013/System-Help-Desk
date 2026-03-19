# Supabase Setup

## 1) Criar estrutura do banco

No Supabase SQL Editor, execute o arquivo:

- supabase/migrations/20260318_001_helpdesk_initial.sql
- supabase/migrations/20260318_002_ticket_workflow_upgrade.sql
- supabase/migrations/20260318_003_ticket_status_expansion.sql
- supabase/migrations/20260318_004_ticket_priority_expansion.sql
- supabase/migrations/20260318_005_ticket_classification.sql

## 2) Configurar variaveis de ambiente do backend

Copie backend/.env.example para backend/.env e preencha:

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL (opcional, para scripts diretos em Postgres)
- SUPABASE_AUTO_PULL (opcional, true para carregar dados automaticamente no primeiro request)
- JWT_SECRET (obrigatorio em producao para assinatura dos tokens)
- JWT_EXPIRES_IN (opcional, padrao 7d)

Exemplo:

```env
PORT=3001
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=SEU_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
SUPABASE_DB_URL=postgresql://postgres:[SENHA]@db.SEUPROJETO.supabase.co:5432/postgres
SUPABASE_AUTO_PULL=false
JWT_SECRET=uma-chave-forte-e-unica
JWT_EXPIRES_IN=7d
```

Observacao:

- Com apenas `SUPABASE_PUBLISHABLE_KEY`, o endpoint de status funciona.
- Para `push/pull`, e obrigatoria a `SUPABASE_SERVICE_ROLE_KEY`.

## 3) Como sincronizar dados

Com backend rodando e usuario admin logado:

1. Enviar dados atuais da API para o Supabase:

- POST /api/supabase/push

1. Carregar dados do Supabase para a API:

- POST /api/supabase/pull

1. Validar conectividade:

- GET /api/supabase/status
- GET /api/health

## 4) Vercel

Adicione no projeto da Vercel as variaveis:

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL (opcional)
- SUPABASE_AUTO_PULL (opcional)
- JWT_SECRET (obrigatorio)
- JWT_EXPIRES_IN (opcional)

Recomendado na Vercel:

- SUPABASE_AUTO_PULL=true

## 5) Seguranca

- Nunca exponha SUPABASE_SERVICE_ROLE_KEY no frontend.
- Use apenas no backend (server-side).
