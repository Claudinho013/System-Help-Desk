# API Routes

Local base URL: `http://localhost:3001`

Vercel base URL: `https://seu-dominio.vercel.app`

Authorization header: `Authorization: Bearer TOKEN`

## Publicas

### GET /api/health

Resposta: status da API.

### POST /api/auth/register

Body JSON:

```json
{ "name": "string", "email": "string", "password": "string" }
```

Resposta: usuario criado.

### POST /api/auth/login

Body JSON:

```json
{ "email": "string", "password": "string" }
```

Resposta: token + usuario.

### POST /api/auth/forgot-password

Body JSON:

```json
{ "email": "string" }
```

Resposta: mensagem padrao de recuperacao.

### GET /api/categories

Resposta: lista de categorias.

## Privadas

### POST /api/auth/logout

Resposta: sessao encerrada.

### GET /api/auth/me

Resposta: usuario autenticado.

### GET /api/roles

Resposta: perfis disponiveis.

### GET /api/permissions/me

Resposta: permissões do perfil autenticado.

### GET /api/permissions

Acesso: `admin`, `manager`.

Resposta: matriz de permissões por perfil.

### GET /api/supabase/status

Acesso: `admin`, `manager`.

Resposta: status de configuração e conectividade do Supabase.

### POST /api/supabase/push

Acesso: `admin`, `manager`.

Requisito: `SUPABASE_SERVICE_ROLE_KEY` configurada.

Resposta: envia o estado atual em memória para as tabelas no Supabase.

### POST /api/supabase/pull

Acesso: `admin`, `manager`.

Requisito: `SUPABASE_SERVICE_ROLE_KEY` configurada.

Resposta: carrega o estado atual do Supabase para memória da API.

### PATCH /api/users/me

Body JSON:

```json
{ "name": "string", "password": "string", "phone": "string", "department": "string" }
```

Resposta: usuario atualizado.

### GET /api/users

Query opcional: `search`, `role`, `status=active|inactive`.

Resposta: lista de usuarios com escopo por perfil.

### POST /api/users

Acesso: `admin`, `manager`.

Body JSON:

```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "client|attendant|manager|admin",
  "phone": "string",
  "department": "string"
}
```

Resposta: usuario criado.

### GET /api/users/:id

Resposta: usuario por ID.

### PATCH /api/users/:id

Acesso: dono da conta ou gestão (`admin`, `manager` com limitações).

Body JSON: campos de usuario permitidos por perfil.

Resposta: usuario atualizado.

### PATCH /api/users/:id/status

Acesso: `admin`, `manager`.

Body JSON:

```json
{ "isActive": true }
```

Resposta: usuário ativado ou desativado.

### POST /api/users/:id/avatar

Acesso: dono da conta ou equipe interna.

Body JSON:

```json
{ "avatarDataUrl": "data:image/png;base64,..." }
```

Resposta: foto de perfil atualizada.

### GET /api/users/:id/activity

Acesso: dono da conta ou equipe interna.

Query opcional: `limit`.

Resposta: histórico de atividade do usuário.

### GET /api/users-activity-feed

Acesso: `admin`, `manager`, `attendant`.

Resposta: feed consolidado de atividades de usuários.

### GET /api/tickets

Query opcional:

- `status` (aceita lista CSV)
- `priority` (aceita lista CSV)
- `origin` (aceita lista CSV)
- `categoryId` (aceita lista CSV)
- `subcategory` (aceita lista CSV)
- `department` ou `sector` (aceita lista CSV)
- `problemType` (aceita lista CSV)
- `requesterId` (aceita lista CSV)
- `attendantId` ou `assignedTo` (aceita lista CSV; aceita `unassigned`)
- `tag` ou `tags` (aceita lista CSV)
- `search` ou `keyword`
- `mine=true`
- `sortBy=updatedAt|createdAt|closedAt|priority|status|ticketNumber`
- `sortOrder=asc|desc`

Resposta: lista de tickets.

### GET /api/tickets/filter-options

Resposta: opcoes de filtro para frontend (`departments`, `tags`, `problemTypes`, `requesters`, `attendants`).

### POST /api/tickets

Body JSON:

```json
{
  "title": "string",
  "description": "string",
  "priority": "low|medium|high|critical",
  "problemType": "access_issue|billing_issue|bug|performance_issue|integration_issue|infrastructure_issue|service_request|question|other",
  "tags": ["login", "financeiro"],
  "categoryId": 4,
  "subcategory": "string",
  "departmentResponsible": "string",
  "origin": "site|email|whatsapp|app",
  "assignedTo": 2,
  "attachments": [{ "name": "arquivo.pdf", "url": "https://..." }],
  "attendantResponse": "string",
  "clientReturn": "string"
}
```

Resposta: ticket criado.

### GET /api/tickets/:id

Resposta: ticket por ID.

### PATCH /api/tickets/:id

Body JSON com campos opcionais:

```json
{
  "status": "open|in_analysis|in_service|waiting_customer|waiting_third_party|resolved|closed|cancelled",
  "priority": "low|medium|high|critical",
  "problemType": "access_issue|billing_issue|bug|performance_issue|integration_issue|infrastructure_issue|service_request|question|other",
  "tags": ["login", "financeiro"],
  "assignedTo": 1,
  "title": "string",
  "description": "string",
  "categoryId": 2,
  "subcategory": "string",
  "departmentResponsible": "string",
  "origin": "site|email|whatsapp|app",
  "attachments": [{ "name": "arquivo.pdf", "url": "https://..." }],
  "attendantResponse": "string",
  "clientReturn": "string"
}
```

Resposta: ticket atualizado.

### POST /api/tickets/:id/close

Fecha chamado, define data de fechamento e registra histórico.

### POST /api/tickets/:id/reopen

Reabre chamado (se permitido em configurações) e registra histórico.

### DELETE /api/tickets/:id

Resposta: confirmacao de remocao.

### GET /api/tickets/:id/history

Resposta: histórico completo de alterações do chamado.

### GET /api/tickets/:id/timeline

Resposta: timeline consolidada (histórico + comentários).

### GET /api/tickets/:id/comments

Resposta: comentarios do ticket.

### POST /api/tickets/:id/comments

Body JSON:

```json
{ "message": "string" }
```

Resposta: comentario criado.

### GET /api/dashboard/summary

Resposta: totais do dashboard.

### GET /api/settings

Acesso: equipe interna.

Resposta: configuracoes do sistema.

### PATCH /api/settings

Acesso: `admin`, `manager`.

Body JSON: campos de configuracao.

Resposta: configuracoes atualizadas.

### GET /api/reports/overview

Acesso: `admin`, `manager`.

Resposta: consolidado por status, prioridade, categoria, setor, cliente, atendente e tipo de problema.

### GET /api/knowledge-base

Resposta: lista de artigos e FAQ.

### POST /api/knowledge-base

Acesso: `admin`, `attendant`, `manager`.

Body JSON:

```json
{ "title": "string", "category": "string", "content": "string" }
```

Resposta: artigo criado.

### PATCH /api/knowledge-base/:id

Acesso: `admin`, `manager`.

Body JSON: campos opcionais de artigo.

Resposta: artigo atualizado.

### DELETE /api/knowledge-base/:id

Acesso: `admin`, `manager`.

Resposta: confirmacao de remocao.
