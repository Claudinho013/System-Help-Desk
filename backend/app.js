const cors = require('cors')
const express = require('express')
const WebSocket = require('ws')
const http = require('http')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const webpush = require('web-push')
const { getSupabaseStatus, hasServiceRoleKey, isSupabaseConfigured } = require('./lib/supabaseClient')
const { pullStateFromSupabase, pushStateToSupabase } = require('./lib/supabaseSync')

const app = express()

const ROLES = {
  ADMIN: 'admin',
  ATTENDANT: 'attendant',
  CLIENT: 'client',
  MANAGER: 'manager',
}

const STAFF_ROLES = [ROLES.ADMIN, ROLES.ATTENDANT, ROLES.MANAGER]
const TICKET_STATUSES = [
  'open',
  'in_analysis',
  'in_service',
  'waiting_customer',
  'waiting_third_party',
  'resolved',
  'closed',
  'cancelled',
]
const ACTIVE_TICKET_STATUSES = ['in_analysis', 'in_service', 'waiting_customer', 'waiting_third_party']
const FINAL_TICKET_STATUSES = ['closed', 'cancelled']
const REOPENABLE_TICKET_STATUSES = ['resolved', 'closed', 'cancelled']
const TICKET_STATUS_LABELS = {
  open: 'Aberto',
  in_analysis: 'Em analise',
  in_service: 'Em atendimento',
  waiting_customer: 'Aguardando cliente',
  waiting_third_party: 'Aguardando terceiro',
  resolved: 'Resolvido',
  closed: 'Fechado',
  cancelled: 'Cancelado',
}
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical']
const TICKET_PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
}
const TICKET_ORIGINS = ['site', 'email', 'whatsapp', 'app']
const TICKET_PROBLEM_TYPES = [
  'access_issue',
  'billing_issue',
  'bug',
  'performance_issue',
  'integration_issue',
  'infrastructure_issue',
  'service_request',
  'question',
  'other',
]
const TICKET_PROBLEM_TYPE_LABELS = {
  access_issue: 'Acesso',
  billing_issue: 'Financeiro',
  bug: 'Erro funcional',
  performance_issue: 'Performance',
  integration_issue: 'Integracao',
  infrastructure_issue: 'Infraestrutura',
  service_request: 'Solicitacao de servico',
  question: 'Duvida',
  other: 'Outro',
}
const TICKET_PRIORITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}
const TICKET_STATUS_ORDER = Object.fromEntries(TICKET_STATUSES.map((status, index) => [status, index + 1]))
const SUPABASE_AUTO_PULL =
  process.env.SUPABASE_AUTO_PULL === 'true' ||
  (Boolean(process.env.VERCEL) && process.env.SUPABASE_AUTO_PULL !== 'false')
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'helpdesk-dev-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
let supabasePullAttempted = false

const COMMENT_TYPES = ['standard', 'internal', 'system']
const COMMENT_TYPE_LABELS = {
  standard: 'Comentario publico',
  internal: 'Comentario interno',
  system: 'Mensagem do sistema',
}

const EMAIL_CONFIG = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  provider: process.env.EMAIL_PROVIDER || 'console',
  from: process.env.EMAIL_FROM || 'noreply@helpdesk.local',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
}

const PUSH_CONFIG = {
  enabled: process.env.PUSH_ENABLED === 'true',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
}

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@helpdesk.local'
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-in-env'
const DEFAULT_STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'change-me-in-env'
const DEFAULT_CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || 'change-me-in-env'

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    'dashboard:view',
    'tickets:view:all',
    'tickets:create',
    'tickets:update:all',
    'tickets:delete:all',
    'comments:create',
    'users:view:all',
    'users:create:all',
    'users:edit:all',
    'users:status:all',
    'users:history:all',
    'users:avatar:all',
    'reports:view',
    'settings:view',
    'settings:edit',
    'knowledge:view',
    'knowledge:create',
    'knowledge:edit',
    'knowledge:delete',
  ],
  [ROLES.MANAGER]: [
    'dashboard:view',
    'tickets:view:all',
    'tickets:create',
    'tickets:update:all',
    'tickets:delete:all',
    'comments:create',
    'users:view:all',
    'users:create:limited',
    'users:edit:limited',
    'users:status:limited',
    'users:history:all',
    'users:avatar:all',
    'reports:view',
    'settings:view',
    'settings:edit',
    'knowledge:view',
    'knowledge:create',
    'knowledge:edit',
    'knowledge:delete',
  ],
  [ROLES.ATTENDANT]: [
    'dashboard:view',
    'tickets:view:all',
    'tickets:create',
    'tickets:update:all',
    'comments:create',
    'users:view:all',
    'users:history:all',
    'users:avatar:all',
    'settings:view',
    'knowledge:view',
    'knowledge:create',
  ],
  [ROLES.CLIENT]: [
    'dashboard:view',
    'tickets:view:own',
    'tickets:create',
    'tickets:update:own',
    'tickets:delete:own',
    'comments:create',
    'users:view:own',
    'users:edit:own',
    'users:history:own',
    'users:avatar:own',
    'knowledge:view',
  ],
}

app.use(cors())
app.use(express.json({ limit: '4mb' }))

const nowIso = () => new Date().toISOString()

const CATEGORY_SUBCATEGORIES = {
  1: ['Senha', 'Permissao', 'MFA'],
  2: ['Fatura', 'Reembolso', 'Pagamento'],
  3: ['Rede', 'Servidor', 'Equipamento'],
  4: ['Erro de sistema', 'Integracao', 'Performance'],
  5: ['Duvida', 'Reclamacao', 'Acompanhamento'],
}

const CATEGORY_DEFAULT_DEPARTMENTS = {
  1: 'Suporte N1',
  2: 'Financeiro',
  3: 'Infraestrutura',
  4: 'Desenvolvimento',
  5: 'Atendimento',
}

const DEFAULT_SLA_RULES = {
  low: { firstResponseMinutes: 240, resolutionMinutes: 4320 },
  medium: { firstResponseMinutes: 120, resolutionMinutes: 1440 },
  high: { firstResponseMinutes: 30, resolutionMinutes: 480 },
  critical: { firstResponseMinutes: 10, resolutionMinutes: 240 },
}

const DEFAULT_ESCALATION_RULES = {
  warningBeforeMinutes: 30,
  maxEscalationLevel: 2,
}

const DEFAULT_REMINDER_RULES = {
  inactivityMinutes: 120,
  repeatEveryMinutes: 180,
}

const defaultAvatar = (name) => {
  const encoded = encodeURIComponent(name || 'User')
  return `https://ui-avatars.com/api/?name=${encoded}&background=0f172a&color=f1f5f9`
}

const data = {
  users: [
    {
      id: 1,
      name: 'Administrador',
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      role: ROLES.ADMIN,
      phone: '(11) 99999-0001',
      department: 'TI',
      avatarUrl: defaultAvatar('Administrador'),
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    },
    {
      id: 2,
      name: 'Atendente',
      email: 'atendente@helpdesk.local',
      password: DEFAULT_STAFF_PASSWORD,
      role: ROLES.ATTENDANT,
      phone: '(11) 99999-0002',
      department: 'Suporte N1',
      avatarUrl: defaultAvatar('Atendente'),
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    },
    {
      id: 3,
      name: 'Gerente',
      email: 'gerente@helpdesk.local',
      password: DEFAULT_STAFF_PASSWORD,
      role: ROLES.MANAGER,
      phone: '(11) 99999-0003',
      department: 'Gestao de Operacoes',
      avatarUrl: defaultAvatar('Gerente'),
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    },
    {
      id: 4,
      name: 'Cliente Demo',
      email: 'cliente@helpdesk.local',
      password: DEFAULT_CLIENT_PASSWORD,
      role: ROLES.CLIENT,
      phone: '(11) 99999-0004',
      department: 'Financeiro',
      avatarUrl: defaultAvatar('Cliente Demo'),
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    },
  ],
  categories: [
    { id: 1, name: 'Acesso' },
    { id: 2, name: 'Financeiro' },
    { id: 3, name: 'Infraestrutura' },
    { id: 4, name: 'Sistema' },
    { id: 5, name: 'Suporte ao Cliente' },
  ],
  tickets: [
    {
      id: 1,
      ticketNumber: 'HD-20260318-00001',
      title: 'Primeiro ticket de exemplo',
      description: 'Estrutura inicial para comecar a codificacao.',
      status: 'open',
      priority: 'medium',
      categoryId: 4,
      subcategory: 'Erro de sistema',
      requesterId: 4,
      assignedTo: 2,
      departmentResponsible: 'Suporte N1',
      problemType: 'bug',
      tags: ['login', 'web'],
      origin: 'site',
      attachments: [
        {
          id: 'att-1',
          name: 'print-erro-login.png',
          url: 'https://example.com/print-erro-login.png',
          uploadedAt: nowIso(),
        },
      ],
      attendantResponse: '',
      clientReturn: '',
      firstResponseAt: null,
      slaFirstResponseDueAt: null,
      slaResolutionDueAt: null,
      slaBreachedAt: null,
      slaState: 'on_track',
      escalationLevel: 0,
      escalatedAt: null,
      lastInternalReminderAt: null,
      lastDelayAlertAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      closedAt: null,
    },
  ],
  comments: [
    {
      id: 1,
      ticketId: 1,
      authorId: 2,
      message: 'Bem-vindo ao projeto HelpDesk.',
      type: 'standard',
      visibility: 'public',
      emailedAt: null,
      createdAt: nowIso(),
    },
  ],
  ticketHistory: [
    {
      id: 1,
      ticketId: 1,
      actorId: 2,
      eventType: 'created',
      description: 'Chamado criado',
      changes: [],
      createdAt: nowIso(),
    },
  ],
  sessions: new Map(),
  settings: {
    id: 1,
    companyName: 'HelpDesk Corp',
    supportEmail: 'suporte@helpdesk.local',
    allowTicketReopen: true,
    autoAssignEnabled: false,
    autoAssignByDepartment: true,
    autoAssignByWorkload: true,
    autoReplyOnTicketOpen: true,
    autoStatusTransitionsEnabled: true,
    notifyOnNewTicket: true,
    notifyOnTicketUpdate: true,
    slaEnabled: true,
    autoEscalationEnabled: true,
    delayAlertsEnabled: true,
    attendantRemindersEnabled: true,
    emailNotificationsEnabled: false,
    emailReplyEnabled: false,
    pushNotificationsEnabled: false,
    slaRules: DEFAULT_SLA_RULES,
    escalationRules: DEFAULT_ESCALATION_RULES,
    reminderRules: DEFAULT_REMINDER_RULES,
    updatedAt: nowIso(),
  },
  knowledgeArticles: [
    {
      id: 1,
      title: 'Como abrir um chamado eficiente',
      category: 'Boas praticas',
      content:
        'Descreva o problema com contexto, passos para reproduzir e anexos. Isso reduz o tempo de atendimento.',
      updatedAt: nowIso(),
      authorId: 2,
    },
    {
      id: 2,
      title: 'Recuperacao de senha',
      category: 'Conta',
      content:
        'Use a tela de recuperacao de senha para receber instrucoes por email. Em ambiente demo, a resposta e simulada.',
      updatedAt: nowIso(),
      authorId: 1,
    },
  ],
  userActivities: [],
  notifications: [],
  internalReminders: [],
  pushSubscriptions: [],
  emailMessages: [],
  wsConnections: new Map(),
  counters: {
    users: 4,
    tickets: 1,
    comments: 1,
    ticketHistory: 1,
    knowledgeArticles: 2,
    userActivities: 0,
    notifications: 0,
    internalReminders: 0,
    pushSubscriptions: 0,
    emailMessages: 0,
  },
}

const nextId = (bucket) => {
  data.counters[bucket] += 1
  return data.counters[bucket]
}

const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || []

const buildUserPayload = (user, options = {}) => {
  const { includePermissions = false } = options

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    department: user.department || '',
    avatarUrl: user.avatarUrl || defaultAvatar(user.name),
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  }

  if (includePermissions) {
    payload.permissions = getPermissionsForRole(user.role)
  }

  return payload
}

const logUserActivity = (userId, actorId, action, details) => {
  const entry = {
    id: nextId('userActivities'),
    userId,
    actorId,
    action,
    details,
    createdAt: nowIso(),
  }

  data.userActivities.unshift(entry)
  return entry
}

const buildTicketNumber = (ticketId) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `HD-${stamp}-${String(ticketId).padStart(5, '0')}`
}

const parseCsvOrArray = (value) => {
  if (Array.isArray(value)) {
    return value
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const normalizeTicketAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return []
  }

  return attachments
    .map((attachment, index) => {
      if (typeof attachment === 'string') {
        const url = attachment.trim()

        if (!url) {
          return null
        }

        return {
          id: `att-${index + 1}`,
          name: url.split('/').pop() || `Anexo ${index + 1}`,
          url,
          uploadedAt: nowIso(),
        }
      }

      if (!attachment || typeof attachment !== 'object') {
        return null
      }

      const url = String(attachment.url || '').trim()

      if (!url) {
        return null
      }

      return {
        id: String(attachment.id || `att-${index + 1}`),
        name: String(attachment.name || url.split('/').pop() || `Anexo ${index + 1}`),
        url,
        uploadedAt: attachment.uploadedAt || nowIso(),
      }
    })
    .filter(Boolean)
    .slice(0, 20)
}

const normalizeTicketTags = (tags) => {
  const rawTags = parseCsvOrArray(tags)

  return [...new Set(rawTags.map((tag) => String(tag || '').toLowerCase().trim()).filter(Boolean))].slice(0, 20)
}

const sanitizeTicketOrigin = (origin) => {
  const normalized = String(origin || 'site').toLowerCase().trim()
  return TICKET_ORIGINS.includes(normalized) ? normalized : 'site'
}

const sanitizeTicketPriority = (priority) => {
  const normalized = String(priority || 'medium').toLowerCase().trim()
  return TICKET_PRIORITIES.includes(normalized) ? normalized : 'medium'
}

const getTicketPriorityLabel = (priority) => TICKET_PRIORITY_LABELS[sanitizeTicketPriority(priority)] || 'Media'

const sanitizeTicketProblemType = (problemType) => {
  const normalized = String(problemType || 'other')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
  return TICKET_PROBLEM_TYPES.includes(normalized) ? normalized : 'other'
}

const getTicketProblemTypeLabel = (problemType) =>
  TICKET_PROBLEM_TYPE_LABELS[sanitizeTicketProblemType(problemType)] || 'Outro'

const sanitizeTicketStatus = (status) => {
  let normalized = String(status || 'open').toLowerCase().trim()

  // Backward compatibility with old status values.
  if (normalized === 'in_progress') {
    normalized = 'in_service'
  }

  return TICKET_STATUSES.includes(normalized) ? normalized : 'open'
}

const getTicketStatusLabel = (status) => TICKET_STATUS_LABELS[sanitizeTicketStatus(status)] || 'Aberto'

const getCategorySubcategories = (categoryId) => CATEGORY_SUBCATEGORIES[Number(categoryId)] || []

const toPositiveMinutes = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const normalizeSlaRules = (rules) => {
  const source = rules && typeof rules === 'object' ? rules : {}

  return Object.fromEntries(
    TICKET_PRIORITIES.map((priority) => {
      const current = source[priority] || {}
      const defaults = DEFAULT_SLA_RULES[priority]

      return [
        priority,
        {
          firstResponseMinutes: toPositiveMinutes(current.firstResponseMinutes, defaults.firstResponseMinutes),
          resolutionMinutes: toPositiveMinutes(current.resolutionMinutes, defaults.resolutionMinutes),
        },
      ]
    }),
  )
}

const normalizeSettings = (rawSettings = {}) => {
  const normalized = {
    id: Number(rawSettings.id || 1),
    companyName: String(rawSettings.companyName || 'HelpDesk Corp'),
    supportEmail: String(rawSettings.supportEmail || 'suporte@helpdesk.local'),
    allowTicketReopen: Boolean(rawSettings.allowTicketReopen ?? true),
    autoAssignEnabled: Boolean(rawSettings.autoAssignEnabled),
    autoAssignByDepartment: Boolean(rawSettings.autoAssignByDepartment ?? true),
    autoAssignByWorkload: Boolean(rawSettings.autoAssignByWorkload ?? true),
    autoReplyOnTicketOpen: Boolean(rawSettings.autoReplyOnTicketOpen ?? true),
    autoStatusTransitionsEnabled: Boolean(rawSettings.autoStatusTransitionsEnabled ?? true),
    notifyOnNewTicket: Boolean(rawSettings.notifyOnNewTicket ?? true),
    notifyOnTicketUpdate: Boolean(rawSettings.notifyOnTicketUpdate ?? true),
    slaEnabled: Boolean(rawSettings.slaEnabled ?? true),
    autoEscalationEnabled: Boolean(rawSettings.autoEscalationEnabled ?? true),
    delayAlertsEnabled: Boolean(rawSettings.delayAlertsEnabled ?? true),
    attendantRemindersEnabled: Boolean(rawSettings.attendantRemindersEnabled ?? true),
    slaRules: normalizeSlaRules(rawSettings.slaRules),
    escalationRules: {
      warningBeforeMinutes: toPositiveMinutes(
        rawSettings.escalationRules?.warningBeforeMinutes,
        DEFAULT_ESCALATION_RULES.warningBeforeMinutes,
      ),
      maxEscalationLevel: toPositiveMinutes(
        rawSettings.escalationRules?.maxEscalationLevel,
        DEFAULT_ESCALATION_RULES.maxEscalationLevel,
      ),
    },
    reminderRules: {
      inactivityMinutes: toPositiveMinutes(rawSettings.reminderRules?.inactivityMinutes, DEFAULT_REMINDER_RULES.inactivityMinutes),
      repeatEveryMinutes: toPositiveMinutes(
        rawSettings.reminderRules?.repeatEveryMinutes,
        DEFAULT_REMINDER_RULES.repeatEveryMinutes,
      ),
    },
    updatedAt: rawSettings.updatedAt || nowIso(),
  }

  return normalized
}

const getSettings = () => {
  data.settings = normalizeSettings(data.settings)
  return data.settings
}

const getCategoryDepartment = (categoryId) => CATEGORY_DEFAULT_DEPARTMENTS[Number(categoryId)] || 'Atendimento'

const isActiveTicketForWorkload = (ticketStatus) => !['resolved', ...FINAL_TICKET_STATUSES].includes(ticketStatus)

const getActiveTicketLoad = (userId) =>
  data.tickets.filter((ticket) => Number(ticket.assignedTo) === Number(userId) && isActiveTicketForWorkload(ticket.status)).length

const getAssignableUsers = (department, useDepartmentFilter) => {
  const normalizedDepartment = String(department || '').toLowerCase().trim()
  const staff = data.users.filter((user) => STAFF_ROLES.includes(user.role) && user.isActive)

  if (!useDepartmentFilter || !normalizedDepartment) {
    return staff
  }

  const sectorStaff = staff.filter((user) => String(user.department || '').toLowerCase().trim() === normalizedDepartment)
  return sectorStaff.length > 0 ? sectorStaff : staff
}

const pickAutomaticAssignee = (ticket) => {
  const settings = getSettings()

  if (!settings.autoAssignEnabled) {
    return null
  }

  const candidates = getAssignableUsers(ticket.departmentResponsible, settings.autoAssignByDepartment)

  if (!candidates.length) {
    return null
  }

  if (!settings.autoAssignByWorkload) {
    return candidates[0].id
  }

  const sorted = [...candidates].sort((a, b) => {
    const loadDiff = getActiveTicketLoad(a.id) - getActiveTicketLoad(b.id)
    if (loadDiff !== 0) {
      return loadDiff
    }

    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0

    return aUpdated - bUpdated || a.id - b.id
  })

  return sorted[0]?.id || null
}

const addNotification = ({ userId, type, title, message, ticketId = null, metadata = {} }) => {
  const targetUserId = Number(userId)
  const target = data.users.find((user) => user.id === targetUserId)

  if (!target) {
    return null
  }

  const item = {
    id: nextId('notifications'),
    userId: targetUserId,
    type: String(type || 'info'),
    title: String(title || 'Atualizacao de chamado'),
    message: String(message || ''),
    ticketId: ticketId ? Number(ticketId) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    readAt: null,
    createdAt: nowIso(),
  }

  data.notifications.unshift(item)
  return item
}

const addInternalReminder = ({ attendantId, ticketId, message, createdBy = null }) => {
  const attendant = data.users.find((user) => user.id === Number(attendantId) && STAFF_ROLES.includes(user.role))

  if (!attendant) {
    return null
  }

  const reminder = {
    id: nextId('internalReminders'),
    attendantId: Number(attendantId),
    ticketId: Number(ticketId),
    message: String(message || 'Lembrete de acompanhamento de chamado'),
    createdBy: createdBy ? Number(createdBy) : null,
    status: 'pending',
    resolvedAt: null,
    createdAt: nowIso(),
  }

  data.internalReminders.unshift(reminder)

  addNotification({
    userId: attendant.id,
    type: 'internal_reminder',
    title: 'Lembrete interno',
    message: reminder.message,
    ticketId,
    metadata: { reminderId: reminder.id },
  })

  return reminder
}

const computeDueAt = (baseIso, minutesToAdd) => {
  const base = new Date(baseIso).getTime()
  if (!Number.isFinite(base)) {
    return null
  }

  return new Date(base + minutesToAdd * 60000).toISOString()
}

const applySlaTargets = (ticket) => {
  const settings = getSettings()

  if (!settings.slaEnabled) {
    ticket.slaFirstResponseDueAt = null
    ticket.slaResolutionDueAt = null
    ticket.slaState = 'on_track'
    return ticket
  }

  const priority = sanitizeTicketPriority(ticket.priority)
  const rule = settings.slaRules[priority] || DEFAULT_SLA_RULES[priority]
  const base = ticket.createdAt || nowIso()

  ticket.slaFirstResponseDueAt = ticket.slaFirstResponseDueAt || computeDueAt(base, rule.firstResponseMinutes)
  ticket.slaResolutionDueAt = ticket.slaResolutionDueAt || computeDueAt(base, rule.resolutionMinutes)
  ticket.slaState = ticket.slaState || 'on_track'

  return ticket
}

const markFirstResponseIfNeeded = (ticket, actorId, source) => {
  const actor = data.users.find((user) => user.id === Number(actorId))

  if (!actor || !STAFF_ROLES.includes(actor.role) || ticket.firstResponseAt) {
    return false
  }

  ticket.firstResponseAt = nowIso()

  addTicketHistory(ticket.id, actor.id, 'first_response', `Primeira resposta registrada automaticamente (${source})`, [
    { field: 'firstResponseAt', from: null, to: ticket.firstResponseAt },
  ])

  return true
}

const autoTransitionStatusAfterAssignment = (ticket, actorId) => {
  const settings = getSettings()

  if (!settings.autoStatusTransitionsEnabled) {
    return false
  }

  if (ticket.assignedTo && ticket.status === 'open') {
    const previousStatus = ticket.status
    ticket.status = 'in_analysis'
    ticket.updatedAt = nowIso()
    addTicketHistory(ticket.id, actorId || null, 'auto_status_change', 'Status alterado automaticamente para Em analise', [
      { field: 'status', from: previousStatus, to: ticket.status },
    ])
    return true
  }

  return false
}

const notifyTicketCreation = (ticket) => {
  const settings = getSettings()

  if (!settings.notifyOnNewTicket) {
    return
  }

  addNotification({
    userId: ticket.requesterId,
    type: 'ticket_created',
    title: 'Chamado recebido',
    message: `Recebemos o chamado ${ticket.ticketNumber}. Nossa equipe vai acompanhar o atendimento.`,
    ticketId: ticket.id,
  })

  if (ticket.assignedTo) {
    addNotification({
      userId: ticket.assignedTo,
      type: 'ticket_assigned',
      title: 'Novo chamado atribuido',
      message: `${ticket.ticketNumber} foi atribuido para sua fila de atendimento.`,
      ticketId: ticket.id,
    })
  }
}

const notifyTicketUpdate = (ticket, actorId, changes) => {
  const settings = getSettings()

  if (!settings.notifyOnTicketUpdate) {
    return
  }

  const actor = data.users.find((user) => user.id === Number(actorId))
  const actorName = actor ? actor.name : 'Sistema'
  const recipients = [ticket.requesterId, ticket.assignedTo].filter(Boolean)
  const uniqueRecipients = [...new Set(recipients)].filter((userId) => Number(userId) !== Number(actorId))
  const changedFields = Array.isArray(changes) ? changes.map((change) => change.field).join(', ') : ''

  uniqueRecipients.forEach((userId) => {
    addNotification({
      userId,
      type: 'ticket_updated',
      title: 'Chamado atualizado',
      message: `${ticket.ticketNumber} foi atualizado por ${actorName}${changedFields ? ` (${changedFields})` : ''}.`,
      ticketId: ticket.id,
    })
  })
}

const runAutomations = ({ actorId = null, ticketId = null, reason = 'manual' } = {}) => {
  const settings = getSettings()
  const now = new Date()
  const targetIndexes = ticketId
    ? data.tickets
        .map((ticket, index) => ({ ticket, index }))
        .filter((entry) => entry.ticket.id === Number(ticketId))
        .map((entry) => entry.index)
    : data.tickets.map((_ticket, index) => index)

  for (const ticketIndex of targetIndexes) {
    const ticket = ensureTicketDefaults(data.tickets[ticketIndex])
    applySlaTargets(ticket)
    autoTransitionStatusAfterAssignment(ticket, actorId)

    const isFinal = [...FINAL_TICKET_STATUSES, 'resolved'].includes(ticket.status)
    const resolutionDue = ticket.slaResolutionDueAt ? new Date(ticket.slaResolutionDueAt) : null

    data.tickets[ticketIndex] = ensureTicketDefaults(ticket)
    const warningWindow = settings.escalationRules.warningBeforeMinutes * 60000

    if (!isFinal && settings.slaEnabled && resolutionDue && Number.isFinite(resolutionDue.getTime())) {
      const dueTime = resolutionDue.getTime()
      const nowTime = now.getTime()

      if (nowTime > dueTime) {
        if (!ticket.slaBreachedAt) {
          ticket.slaBreachedAt = nowIso()
          ticket.slaState = 'breached'
          ticket.updatedAt = nowIso()
          addTicketHistory(ticket.id, actorId, 'sla_breached', `SLA vencido automaticamente (${reason})`, [
            { field: 'slaBreachedAt', from: null, to: ticket.slaBreachedAt },
            { field: 'slaState', from: 'warning', to: 'breached' },
          ])

          if (settings.delayAlertsEnabled) {
            addNotification({
              userId: ticket.requesterId,
              type: 'sla_delayed',
              title: 'Atraso no SLA',
              message: `O chamado ${ticket.ticketNumber} ultrapassou o prazo previsto.`,
              ticketId: ticket.id,
            })

            if (ticket.assignedTo) {
              addNotification({
                userId: ticket.assignedTo,
                type: 'sla_delayed',
                title: 'Chamado em atraso',
                message: `${ticket.ticketNumber} esta atrasado e requer acao imediata.`,
                ticketId: ticket.id,
              })
            }
          }
        }

        if (settings.autoEscalationEnabled && ticket.escalationLevel < settings.escalationRules.maxEscalationLevel) {
          const managers = data.users.filter((user) => user.role === ROLES.MANAGER && user.isActive)
          const targetManagers = managers.length ? managers : getAssignableUsers(ticket.departmentResponsible, false)

          if (targetManagers.length) {
            const escalatedTo = [...targetManagers].sort((a, b) => getActiveTicketLoad(a.id) - getActiveTicketLoad(b.id))[0]
            const previousAssignee = ticket.assignedTo || null

            ticket.assignedTo = escalatedTo.id
            ticket.escalationLevel += 1
            ticket.escalatedAt = nowIso()
            ticket.updatedAt = nowIso()
            autoTransitionStatusAfterAssignment(ticket, actorId)

            addTicketHistory(ticket.id, actorId, 'escalated', 'Chamado escalonado automaticamente', [
              { field: 'assignedTo', from: previousAssignee, to: ticket.assignedTo },
              { field: 'escalationLevel', from: ticket.escalationLevel - 1, to: ticket.escalationLevel },
            ])

            addNotification({
              userId: escalatedTo.id,
              type: 'ticket_escalated',
              title: 'Chamado escalonado para voce',
              message: `${ticket.ticketNumber} foi escalonado automaticamente devido a atraso de SLA.`,
              ticketId: ticket.id,
            })
          }
        }
      } else if (dueTime - now.getTime() <= warningWindow) {
        ticket.slaState = 'warning'

        if (settings.delayAlertsEnabled && !ticket.lastDelayAlertAt) {
          ticket.lastDelayAlertAt = nowIso()
          addNotification({
            userId: ticket.requesterId,
            type: 'sla_warning',
            title: 'Prazo proximo do limite',
            message: `O chamado ${ticket.ticketNumber} esta perto do vencimento de SLA.`,
            ticketId: ticket.id,
          })

          if (ticket.assignedTo) {
            addNotification({
              userId: ticket.assignedTo,
              type: 'sla_warning',
              title: 'SLA proximo do vencimento',
              message: `${ticket.ticketNumber} esta no limite de prazo.`,
              ticketId: ticket.id,
            })
          }
        }
      } else if (ticket.slaState !== 'breached') {
        ticket.slaState = 'on_track'
      }
    }

    if (
      !isFinal &&
      settings.attendantRemindersEnabled &&
      ticket.assignedTo &&
      ACTIVE_TICKET_STATUSES.includes(ticket.status)
    ) {
      const inactivityMs = settings.reminderRules.inactivityMinutes * 60000
      const repeatMs = settings.reminderRules.repeatEveryMinutes * 60000
      const lastUpdate = ticket.updatedAt ? new Date(ticket.updatedAt).getTime() : 0
      const lastReminder = ticket.lastInternalReminderAt ? new Date(ticket.lastInternalReminderAt).getTime() : 0
      const shouldCreateReminder = now.getTime() - lastUpdate >= inactivityMs && (!lastReminder || now.getTime() - lastReminder >= repeatMs)

      if (shouldCreateReminder) {
        ticket.lastInternalReminderAt = nowIso()
        addInternalReminder({
          attendantId: ticket.assignedTo,
          ticketId: ticket.id,
          createdBy: actorId,
          message: `Lembrete: o chamado ${ticket.ticketNumber} esta sem atualizacao recente.`,
        })
      }
    }
  }
}

const sendEmail = async ({ to, subject, html, text }) => {
  const settings = getSettings()

  if (!settings.emailNotificationsEnabled || !EMAIL_CONFIG.enabled) {
    return { ok: false, message: 'Email notifications disabled' }
  }

  try {
    const message = {
      id: nextId('emailMessages'),
      to,
      subject,
      html,
      text,
      status: 'pending',
      sentAt: null,
      error: null,
      createdAt: nowIso(),
    }

    data.emailMessages.push(message)

    if ((EMAIL_CONFIG.provider === 'smtp' || EMAIL_CONFIG.provider === 'nodemailer') && EMAIL_CONFIG.smtp.auth.user) {
      const transporter = nodemailer.createTransport(EMAIL_CONFIG.smtp)
      await transporter.sendMail({
        from: EMAIL_CONFIG.from,
        to,
        subject,
        html,
        text,
      })

      message.status = 'sent'
      message.sentAt = nowIso()
    }

    return { ok: true, message }
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

const sendPushNotification = async (subscription, { title, body, data: notifData = {} }) => {
  const settings = getSettings()

  if (!settings.pushNotificationsEnabled || !PUSH_CONFIG.enabled) {
    return { ok: false }
  }

  try {
    if (PUSH_CONFIG.vapidPrivateKey && PUSH_CONFIG.vapidPublicKey) {
      webpush.setVapidDetails('mailto:noreply@helpdesk.local', PUSH_CONFIG.vapidPublicKey, PUSH_CONFIG.vapidPrivateKey)
    }

    const payload = JSON.stringify({ title, body, data: notifData })
    await webpush.sendNotification(subscription, payload).catch((error) => {
      if (error.statusCode === 410) {
        return
      }

      throw error
    })

    return { ok: true }
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

const broadcastToWs = (message) => {
  const payload = JSON.stringify(message)

  for (const [userId, clients] of data.wsConnections.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    }
  }
}

const notifyWsSubscribers = (ticketId, event, data) => {
  const subscribers = new Set()
  const ticket = data.tickets.find((t) => t.id === Number(ticketId))

  if (!ticket) {
    return
  }

  subscribers.add(ticket.requesterId)
  if (ticket.assignedTo) {
    subscribers.add(ticket.assignedTo)
  }

  const managers = data.users.filter((u) => u.role === ROLES.MANAGER && u.isActive)
  managers.forEach((m) => subscribers.add(m.id))

  for (const userId of subscribers) {
    if (data.wsConnections.has(userId)) {
      const clients = data.wsConnections.get(userId)

      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ticket_update', ticketId, event, timestamp: nowIso() }))
        }
      }
    }
  }
}

const sendStatusChangeNotification = async (ticket, previousStatus, currentUser) => {
  const settings = getSettings()
  if (!settings.emailNotificationsEnabled) {
    return
  }

  const requester = data.users.find((u) => u.id === ticket.requesterId)
  if (!requester || !requester.email) {
    return
  }

  const assignee = ticket.assignedTo ? data.users.find((u) => u.id === ticket.assignedTo) : null
  const statusLabel = getTicketStatusLabel(ticket.status)
  const previousStatusLabel = getTicketStatusLabel(previousStatus)

  const emailSubject = `Seu chamado ${ticket.ticketNumber} foi atualizado`
  const emailHtml = `
    <p>Ola ${requester.name},</p>
    <p>O status do seu chamado <strong>${ticket.ticketNumber}</strong> foi atualizado:</p>
    <p>
      <strong>Status anterior:</strong> ${previousStatusLabel}<br/>
      <strong>Novo status:</strong> ${statusLabel}
    </p>
    ${assignee ? `<p><strong>Atendente responsavel:</strong> ${assignee.name}</p>` : ''}
    <p><strong>Titulo:</strong> ${ticket.title}</p>
    <p><a href="${process.env.BASE_URL || 'http://localhost:5173'}/tickets/${ticket.id}">Ver chamado</a></p>
  `
  const emailText = `O status do seu chamado ${ticket.ticketNumber} foi atualizado de ${previousStatusLabel} para ${statusLabel}.`

  const messageId = nextId('emailMessages')
  const emailMessage = {
    id: messageId,
    toAddress: requester.email,
    subject: emailSubject,
    htmlBody: emailHtml,
    textBody: emailText,
    ticketId: ticket.id,
    status: 'pending',
    sentAt: null,
    errorMessage: null,
    createdAt: nowIso(),
  }

  data.emailMessages.push(emailMessage)

  const result = await sendEmail({ to: requester.email, subject: emailSubject, html: emailHtml, text: emailText })
  if (result.ok) {
    emailMessage.status = 'sent'
    emailMessage.sentAt = nowIso()
  } else {
    emailMessage.status = 'failed'
    emailMessage.errorMessage = result.message || 'Erro ao enviar email'
  }
}

const ensureTicketDefaults = (ticket) => {
  const fallbackId = Number(ticket.id || 0)
  const categoryId = ticket.categoryId ? Number(ticket.categoryId) : null
  const fallbackSubcategories = getCategorySubcategories(categoryId)

  return {
    ...ticket,
    ticketNumber: ticket.ticketNumber || (fallbackId ? buildTicketNumber(fallbackId) : null),
    status: sanitizeTicketStatus(ticket.status),
    priority: sanitizeTicketPriority(ticket.priority),
    categoryId,
    subcategory: String(ticket.subcategory || fallbackSubcategories[0] || 'Geral').trim(),
    departmentResponsible: String(ticket.departmentResponsible || 'Atendimento').trim(),
    problemType: sanitizeTicketProblemType(ticket.problemType),
    tags: normalizeTicketTags(ticket.tags),
    origin: sanitizeTicketOrigin(ticket.origin),
    attachments: normalizeTicketAttachments(ticket.attachments),
    attendantResponse: String(ticket.attendantResponse || ''),
    clientReturn: String(ticket.clientReturn || ''),
    firstResponseAt: ticket.firstResponseAt || null,
    slaFirstResponseDueAt: ticket.slaFirstResponseDueAt || null,
    slaResolutionDueAt: ticket.slaResolutionDueAt || null,
    slaBreachedAt: ticket.slaBreachedAt || null,
    slaState: ['on_track', 'warning', 'breached'].includes(String(ticket.slaState || 'on_track'))
      ? String(ticket.slaState || 'on_track')
      : 'on_track',
    escalationLevel: Math.max(0, Number(ticket.escalationLevel || 0)),
    escalatedAt: ticket.escalatedAt || null,
    lastInternalReminderAt: ticket.lastInternalReminderAt || null,
    lastDelayAlertAt: ticket.lastDelayAlertAt || null,
    createdAt: ticket.createdAt || nowIso(),
    updatedAt: ticket.updatedAt || ticket.createdAt || nowIso(),
    closedAt: ticket.closedAt || null,
  }
}

const addTicketHistory = (ticketId, actorId, eventType, description, changes = []) => {
  const historyEntry = {
    id: nextId('ticketHistory'),
    ticketId: Number(ticketId),
    actorId: actorId ? Number(actorId) : null,
    eventType,
    description,
    changes,
    createdAt: nowIso(),
  }

  data.ticketHistory.unshift(historyEntry)
  return historyEntry
}

const extractBearerToken = (req) => {
  const header = req.headers.authorization || ''

  if (!header.startsWith('Bearer ')) {
    return null
  }

  return header.slice(7).trim()
}

const removeUserSessions = (userId) => {
  for (const [token, tokenUserId] of data.sessions.entries()) {
    if (tokenUserId === userId) {
      data.sessions.delete(token)
    }
  }
}

const createSession = (userId) => {
  return jwt.sign({ id: Number(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const getAuthUser = (req) => {
  const token = extractBearerToken(req)

  if (!token) {
    return null
  }

  let payload = null
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch (_error) {
    return null
  }

  const userId = Number(payload?.id)

  if (!userId) {
    return null
  }

  return data.users.find((user) => user.id === userId) || null
}

const requireAuth = (req, res, next) => {
  const user = getAuthUser(req)

  if (!user) {
    return res.status(401).json({ ok: false, message: 'Nao autenticado' })
  }

  if (!user.isActive) {
    removeUserSessions(user.id)
    return res.status(403).json({ ok: false, message: 'Conta desativada. Entre em contato com um administrador.' })
  }

  req.user = user
  next()
}

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para este recurso' })
  }

  next()
}

const canAccessTicket = (user, ticket) => {
  if (STAFF_ROLES.includes(user.role)) {
    return true
  }

  return ticket.requesterId === user.id
}

const canManageUser = (actor, targetUser) => {
  if (!actor || !targetUser) {
    return false
  }

  if (actor.role === ROLES.ADMIN) {
    return true
  }

  if (actor.role === ROLES.MANAGER) {
    return targetUser.role !== ROLES.ADMIN
  }

  return actor.id === targetUser.id
}

const enrichTicket = (ticket) => {
  const normalizedTicket = ensureTicketDefaults(ticket)
  const requester = data.users.find((user) => user.id === ticket.requesterId)
  const assigned = data.users.find((user) => user.id === normalizedTicket.assignedTo)
  const category = data.categories.find((item) => item.id === normalizedTicket.categoryId)
  const department = normalizedTicket.departmentResponsible || assigned?.department || 'Atendimento'

  return {
    ...normalizedTicket,
    statusLabel: getTicketStatusLabel(normalizedTicket.status),
    priorityLabel: getTicketPriorityLabel(normalizedTicket.priority),
    problemTypeLabel: getTicketProblemTypeLabel(normalizedTicket.problemType),
    requesterName: requester ? requester.name : 'Nao identificado',
    assignedName: assigned ? assigned.name : null,
    assignedDepartment: assigned ? assigned.department || '' : '',
    departmentResponsible: department,
    categoryName: category ? category.name : 'Sem categoria',
  }
}

const buildTicketScope = (user) => {
  if (STAFF_ROLES.includes(user.role)) {
    return data.tickets
  }

  return data.tickets.filter((ticket) => ticket.requesterId === user.id)
}

const isValidRole = (role) => Object.values(ROLES).includes(role)

const buildCurrentStateSnapshot = () => ({
  users: data.users,
  categories: data.categories,
  tickets: data.tickets.map(ensureTicketDefaults),
  comments: data.comments,
  ticketHistory: data.ticketHistory,
  settings: normalizeSettings(data.settings),
  knowledgeArticles: data.knowledgeArticles,
  userActivities: data.userActivities,
  notifications: data.notifications,
  internalReminders: data.internalReminders,
})

const applySnapshotToMemory = (snapshot) => {
  data.users = snapshot.users
  data.categories = snapshot.categories
  data.tickets = (snapshot.tickets || []).map(ensureTicketDefaults)
  data.comments = snapshot.comments
  data.ticketHistory = Array.isArray(snapshot.ticketHistory) ? snapshot.ticketHistory : []
  data.settings = normalizeSettings(snapshot.settings)
  data.knowledgeArticles = snapshot.knowledgeArticles
  data.userActivities = snapshot.userActivities
  data.notifications = Array.isArray(snapshot.notifications) ? snapshot.notifications : []
  data.internalReminders = Array.isArray(snapshot.internalReminders) ? snapshot.internalReminders : []
  data.sessions = new Map()
  data.counters = {
    users: snapshot.counters.users,
    tickets: snapshot.counters.tickets,
    comments: snapshot.counters.comments,
    ticketHistory:
      snapshot.counters.ticketHistory ||
      (Array.isArray(snapshot.ticketHistory)
        ? snapshot.ticketHistory.reduce((acc, item) => Math.max(acc, Number(item.id || 0)), 0)
        : 0),
    knowledgeArticles: snapshot.counters.knowledgeArticles,
    userActivities: snapshot.counters.userActivities,
    notifications:
      snapshot.counters.notifications ||
      data.notifications.reduce((acc, item) => Math.max(acc, Number(item.id || 0)), 0),
    internalReminders:
      snapshot.counters.internalReminders ||
      data.internalReminders.reduce((acc, item) => Math.max(acc, Number(item.id || 0)), 0),
  }
}

const maybeAutoPullFromSupabase = async () => {
  if (!SUPABASE_AUTO_PULL || supabasePullAttempted || !isSupabaseConfigured()) {
    return
  }

  supabasePullAttempted = true

  try {
    const snapshot = await pullStateFromSupabase()

    if (snapshot.users.length > 0) {
      applySnapshotToMemory(snapshot)
      console.log('[Supabase] Estado carregado no boot da API')
    }
  } catch (error) {
    console.warn('[Supabase] Falha no auto pull:', error.message)
  }
}

const syncUsersFromSupabaseForAuth = async () => {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return false
  }

  try {
    const snapshot = await pullStateFromSupabase()

    if (snapshot.users.length > 0) {
      applySnapshotToMemory(snapshot)
      return true
    }
  } catch (error) {
    console.warn('[Supabase] Falha ao sincronizar usuarios para login:', error.message)
  }

  return false
}

app.use(async (_req, _res, next) => {
  await maybeAutoPullFromSupabase()
  runAutomations({ reason: 'request_cycle' })
  next()
})

app.get('/api/health', async (_req, res) => {
  const supabase = await getSupabaseStatus()

  res.status(200).json({
    ok: true,
    message: 'API online',
    supabase,
  })
})

app.get('/api/roles', requireAuth, (_req, res) => {
  res.status(200).json({ ok: true, roles: Object.values(ROLES) })
})

app.get('/api/permissions/me', requireAuth, (req, res) => {
  res.status(200).json({
    ok: true,
    role: req.user.role,
    permissions: getPermissionsForRole(req.user.role),
  })
})

app.get('/api/permissions', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (_req, res) => {
  res.status(200).json({ ok: true, permissionsByRole: ROLE_PERMISSIONS })
})

app.get('/api/supabase/status', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), async (_req, res) => {
  const supabase = await getSupabaseStatus()
  res.status(200).json({ ok: true, supabase })
})

app.post('/api/supabase/push', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), async (req, res) => {
  try {
    const counts = await pushStateToSupabase(buildCurrentStateSnapshot())
    logUserActivity(req.user.id, req.user.id, 'supabase_push', 'Sincronizacao de memoria para Supabase')

    return res.status(200).json({
      ok: true,
      message: 'Dados enviados para o Supabase com sucesso',
      counts,
    })
  } catch (error) {
    const statusCode = error.message.includes('SUPABASE_SERVICE_ROLE_KEY') ? 400 : 500
    return res.status(statusCode).json({ ok: false, message: error.message })
  }
})

app.post('/api/supabase/pull', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), async (req, res) => {
  try {
    const snapshot = await pullStateFromSupabase()
    applySnapshotToMemory(snapshot)
    logUserActivity(req.user.id, req.user.id, 'supabase_pull', 'Sincronizacao de Supabase para memoria')

    return res.status(200).json({
      ok: true,
      message: 'Dados carregados do Supabase com sucesso',
      counts: {
        users: snapshot.users.length,
        categories: snapshot.categories.length,
        tickets: snapshot.tickets.length,
        comments: snapshot.comments.length,
        ticketHistory: (snapshot.ticketHistory || []).length,
        knowledgeArticles: snapshot.knowledgeArticles.length,
        userActivities: snapshot.userActivities.length,
      },
    })
  } catch (error) {
    const statusCode = error.message.includes('SUPABASE_SERVICE_ROLE_KEY') ? 400 : 500
    return res.status(statusCode).json({ ok: false, message: error.message })
  }
})

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {}

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'name, email e password sao obrigatorios' })
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const existing = data.users.find((user) => user.email.toLowerCase() === normalizedEmail)

  if (existing) {
    return res.status(409).json({ ok: false, message: 'Email ja cadastrado' })
  }

  const user = {
    id: nextId('users'),
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password),
    role: ROLES.CLIENT,
    phone: '',
    department: '',
    avatarUrl: defaultAvatar(String(name).trim()),
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
  }

  data.users.push(user)
  logUserActivity(user.id, user.id, 'user_registered', 'Conta criada via formulario publico')

  return res.status(201).json({ ok: true, user: buildUserPayload(user, { includePermissions: true }) })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'email e password sao obrigatorios' })
  }

  const normalizedEmail = String(email).toLowerCase().trim()

  let user = data.users.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === String(password),
  )

  if (!user) {
    const synced = await syncUsersFromSupabaseForAuth()

    if (synced) {
      user = data.users.find(
        (item) => item.email.toLowerCase() === normalizedEmail && item.password === String(password),
      )
    }
  }

  if (!user) {
    return res.status(401).json({ ok: false, message: 'Credenciais invalidas' })
  }

  if (!user.isActive) {
    return res.status(403).json({ ok: false, message: 'Conta desativada. Contate o administrador.' })
  }

  const token = createSession(user.id)
  user.lastLoginAt = nowIso()
  user.updatedAt = nowIso()
  logUserActivity(user.id, user.id, 'session_login', 'Login efetuado com sucesso')

  return res.status(200).json({ ok: true, token, user: buildUserPayload(user, { includePermissions: true }) })
})

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {}

  if (!email) {
    return res.status(400).json({ ok: false, message: 'email e obrigatorio' })
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const user = data.users.find((item) => item.email.toLowerCase() === normalizedEmail)

  if (user) {
    logUserActivity(user.id, user.id, 'password_recovery_requested', 'Solicitacao de recuperacao de senha')
  }

  return res.status(200).json({
    ok: true,
    message: 'Se o email estiver cadastrado, as instrucoes de recuperacao serao enviadas.',
  })
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = extractBearerToken(req)

  if (token) {
    data.sessions.delete(token)
  }

  logUserActivity(req.user.id, req.user.id, 'session_logout', 'Sessao encerrada')
  return res.status(200).json({ ok: true, message: 'Sessao encerrada' })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.status(200).json({ ok: true, user: buildUserPayload(req.user, { includePermissions: true }) })
})

app.patch('/api/users/me', requireAuth, (req, res) => {
  const { name, password, phone, department } = req.body || {}

  if (name) {
    req.user.name = String(name).trim()
  }

  if (password) {
    req.user.password = String(password)
  }

  if (phone !== undefined) {
    req.user.phone = String(phone || '')
  }

  if (department !== undefined) {
    req.user.department = String(department || '')
  }

  req.user.updatedAt = nowIso()
  logUserActivity(req.user.id, req.user.id, 'profile_updated', 'Dados do proprio perfil atualizados')

  return res.status(200).json({ ok: true, user: buildUserPayload(req.user, { includePermissions: true }) })
})

app.get('/api/users', requireAuth, (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) {
    return res.status(200).json({ ok: true, users: [buildUserPayload(req.user, { includePermissions: true })], total: 1 })
  }

  const { search = '', role = 'all', status = 'all' } = req.query || {}
  const normalizedSearch = String(search || '').trim().toLowerCase()

  let users = [...data.users]

  if (req.user.role === ROLES.MANAGER) {
    users = users.filter((user) => user.role !== ROLES.ADMIN)
  }

  if (role !== 'all') {
    users = users.filter((user) => user.role === String(role))
  }

  if (status === 'active') {
    users = users.filter((user) => user.isActive)
  }

  if (status === 'inactive') {
    users = users.filter((user) => !user.isActive)
  }

  if (normalizedSearch) {
    users = users.filter((user) =>
      `${user.name} ${user.email} ${user.phone || ''} ${user.department || ''}`.toLowerCase().includes(normalizedSearch),
    )
  }

  const payload = users
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
    .map((user) => buildUserPayload(user, { includePermissions: true }))

  return res.status(200).json({ ok: true, users: payload, total: payload.length })
})

app.post('/api/users', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const {
    name,
    email,
    password,
    role = ROLES.CLIENT,
    phone = '',
    department = '',
    isActive = true,
    avatarUrl,
  } = req.body || {}

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'name, email e password sao obrigatorios' })
  }

  if (!isValidRole(role)) {
    return res.status(400).json({ ok: false, message: 'Perfil de usuario invalido' })
  }

  if (req.user.role === ROLES.MANAGER && role === ROLES.ADMIN) {
    return res.status(403).json({ ok: false, message: 'Gerentes nao podem cadastrar administradores' })
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const existing = data.users.find((user) => user.email.toLowerCase() === normalizedEmail)

  if (existing) {
    return res.status(409).json({ ok: false, message: 'Email ja cadastrado' })
  }

  const user = {
    id: nextId('users'),
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password),
    role,
    phone: String(phone || ''),
    department: String(department || ''),
    avatarUrl: String(avatarUrl || defaultAvatar(String(name).trim())),
    isActive: Boolean(isActive),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
  }

  data.users.push(user)
  logUserActivity(user.id, req.user.id, 'user_created', `Conta criada por ${req.user.name}`)

  return res.status(201).json({ ok: true, user: buildUserPayload(user, { includePermissions: true }) })
})

app.get('/api/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const user = data.users.find((item) => item.id === id)

  if (!user) {
    return res.status(404).json({ ok: false, message: 'Usuario nao encontrado' })
  }

  if (!canManageUser(req.user, user) && req.user.id !== user.id) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar este usuario' })
  }

  return res.status(200).json({ ok: true, user: buildUserPayload(user, { includePermissions: true }) })
})

app.patch('/api/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const targetUser = data.users.find((item) => item.id === id)

  if (!targetUser) {
    return res.status(404).json({ ok: false, message: 'Usuario nao encontrado' })
  }

  const isSelf = req.user.id === targetUser.id
  const canManageTarget = canManageUser(req.user, targetUser)

  if (!isSelf && !canManageTarget) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para editar este usuario' })
  }

  const body = req.body || {}

  const selfAllowed = ['name', 'password', 'phone', 'department']
  const managerAllowed = ['name', 'email', 'role', 'phone', 'department']
  const adminAllowed = ['name', 'email', 'role', 'phone', 'department', 'isActive']

  const allowed = isSelf
    ? selfAllowed
    : req.user.role === ROLES.ADMIN
      ? adminAllowed
      : managerAllowed

  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
      continue
    }

    if (key === 'role') {
      if (!isValidRole(body.role)) {
        return res.status(400).json({ ok: false, message: 'Perfil de usuario invalido' })
      }

      if (req.user.role === ROLES.MANAGER && body.role === ROLES.ADMIN) {
        return res.status(403).json({ ok: false, message: 'Gerentes nao podem promover para administrador' })
      }
    }

    if (key === 'email') {
      const normalizedEmail = String(body.email || '').toLowerCase().trim()
      const existing = data.users.find((user) => user.email.toLowerCase() === normalizedEmail && user.id !== targetUser.id)

      if (existing) {
        return res.status(409).json({ ok: false, message: 'Email ja esta em uso por outro usuario' })
      }

      targetUser.email = normalizedEmail
      continue
    }

    if (key === 'isActive') {
      targetUser.isActive = Boolean(body.isActive)
      if (!targetUser.isActive) {
        removeUserSessions(targetUser.id)
      }
      continue
    }

    if (key === 'name' || key === 'password' || key === 'role' || key === 'phone' || key === 'department') {
      targetUser[key] = String(body[key] || '')
    }
  }

  targetUser.updatedAt = nowIso()
  logUserActivity(targetUser.id, req.user.id, 'user_updated', `Dados atualizados por ${req.user.name}`)

  return res.status(200).json({ ok: true, user: buildUserPayload(targetUser, { includePermissions: true }) })
})

app.patch('/api/users/:id/status', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const id = Number(req.params.id)
  const targetUser = data.users.find((item) => item.id === id)

  if (!targetUser) {
    return res.status(404).json({ ok: false, message: 'Usuario nao encontrado' })
  }

  if (req.user.role === ROLES.MANAGER && targetUser.role === ROLES.ADMIN) {
    return res.status(403).json({ ok: false, message: 'Gerentes nao podem alterar status de administradores' })
  }

  if (req.user.id === targetUser.id && req.body?.isActive === false) {
    return res.status(400).json({ ok: false, message: 'Voce nao pode desativar sua propria conta' })
  }

  if (typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ ok: false, message: 'isActive deve ser boolean' })
  }

  targetUser.isActive = req.body.isActive
  targetUser.updatedAt = nowIso()

  if (!targetUser.isActive) {
    removeUserSessions(targetUser.id)
  }

  logUserActivity(
    targetUser.id,
    req.user.id,
    req.body.isActive ? 'account_activated' : 'account_deactivated',
    req.body.isActive ? 'Conta ativada' : 'Conta desativada',
  )

  return res.status(200).json({ ok: true, user: buildUserPayload(targetUser, { includePermissions: true }) })
})

app.post('/api/users/:id/avatar', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const targetUser = data.users.find((item) => item.id === id)

  if (!targetUser) {
    return res.status(404).json({ ok: false, message: 'Usuario nao encontrado' })
  }

  const canUpload = req.user.id === targetUser.id || STAFF_ROLES.includes(req.user.role)

  if (!canUpload) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para alterar esta foto de perfil' })
  }

  const avatarDataUrl = String(req.body?.avatarDataUrl || req.body?.avatarUrl || '').trim()

  if (!avatarDataUrl) {
    return res.status(400).json({ ok: false, message: 'avatarDataUrl e obrigatorio' })
  }

  const acceptedProtocol = avatarDataUrl.startsWith('data:image/') || avatarDataUrl.startsWith('http')

  if (!acceptedProtocol) {
    return res.status(400).json({ ok: false, message: 'Formato de imagem invalido' })
  }

  if (avatarDataUrl.startsWith('data:image/') && avatarDataUrl.length > 1500000) {
    return res.status(413).json({ ok: false, message: 'Imagem muito grande. Envie arquivo menor que 1.5MB' })
  }

  targetUser.avatarUrl = avatarDataUrl
  targetUser.updatedAt = nowIso()
  logUserActivity(targetUser.id, req.user.id, 'avatar_updated', 'Foto de perfil atualizada')

  return res.status(200).json({ ok: true, user: buildUserPayload(targetUser, { includePermissions: true }) })
})

app.get('/api/users/:id/activity', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const targetUser = data.users.find((item) => item.id === id)

  if (!targetUser) {
    return res.status(404).json({ ok: false, message: 'Usuario nao encontrado' })
  }

  const canView = req.user.id === id || STAFF_ROLES.includes(req.user.role)

  if (!canView) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar o historico deste usuario' })
  }

  const limit = Number(req.query?.limit || 40)
  const activities = data.userActivities
    .filter((entry) => entry.userId === id)
    .slice(0, Math.max(1, Math.min(limit, 100)))
    .map((entry) => {
      const actor = data.users.find((user) => user.id === entry.actorId)

      return {
        ...entry,
        actorName: actor ? actor.name : 'Sistema',
      }
    })

  return res.status(200).json({ ok: true, userId: id, activities })
})

app.get('/api/users-activity-feed', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.ATTENDANT]), (_req, res) => {
  const limit = Number(_req.query?.limit || 80)
  const activities = data.userActivities.slice(0, Math.max(1, Math.min(limit, 200))).map((entry) => {
    const actor = data.users.find((user) => user.id === entry.actorId)
    const target = data.users.find((user) => user.id === entry.userId)

    return {
      ...entry,
      actorName: actor ? actor.name : 'Sistema',
      userName: target ? target.name : 'Usuario removido',
    }
  })

  return res.status(200).json({ ok: true, activities })
})

app.get('/api/categories', (_req, res) => {
  const categories = data.categories.map((category) => ({
    ...category,
    subcategories: getCategorySubcategories(category.id),
  }))

  res.status(200).json({ ok: true, categories })
})

app.get('/api/tickets', requireAuth, (req, res) => {
  const {
    status,
    priority,
    mine,
    origin,
    categoryId,
    subcategory,
    department,
    sector,
    problemType,
    requesterId,
    assignedTo,
    attendantId,
    search,
    keyword,
    tag,
    tags,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = req.query || {}

  let tickets = [...buildTicketScope(req.user)].map(ensureTicketDefaults)

  if (mine === 'true') {
    tickets = tickets.filter((ticket) => ticket.requesterId === req.user.id)
  }

  if (status) {
    const normalizedStatuses = parseCsvOrArray(status).map(sanitizeTicketStatus)
    tickets = tickets.filter((ticket) => normalizedStatuses.includes(ticket.status))
  }

  if (priority) {
    const normalizedPriorities = parseCsvOrArray(priority).map(sanitizeTicketPriority)
    tickets = tickets.filter((ticket) => normalizedPriorities.includes(ticket.priority))
  }

  if (origin) {
    const normalizedOrigins = parseCsvOrArray(origin).map(sanitizeTicketOrigin)
    tickets = tickets.filter((ticket) => normalizedOrigins.includes(ticket.origin))
  }

  if (categoryId) {
    const categoryIds = parseCsvOrArray(categoryId).map(Number).filter(Boolean)
    tickets = tickets.filter((ticket) => categoryIds.includes(ticket.categoryId))
  }

  if (subcategory) {
    const normalizedSubcategories = parseCsvOrArray(subcategory).map((item) => item.toLowerCase())
    tickets = tickets.filter((ticket) => normalizedSubcategories.includes(String(ticket.subcategory || '').toLowerCase()))
  }

  const departmentFilterValue = department || sector

  if (departmentFilterValue) {
    const normalizedDepartments = parseCsvOrArray(departmentFilterValue).map((item) => item.toLowerCase())
    tickets = tickets.filter((ticket) =>
      normalizedDepartments.includes(String(ticket.departmentResponsible || '').toLowerCase()),
    )
  }

  if (problemType) {
    const normalizedProblemTypes = parseCsvOrArray(problemType).map(sanitizeTicketProblemType)
    tickets = tickets.filter((ticket) => normalizedProblemTypes.includes(ticket.problemType))
  }

  if (requesterId) {
    const requesterIds = parseCsvOrArray(requesterId).map(Number).filter(Boolean)
    tickets = tickets.filter((ticket) => requesterIds.includes(ticket.requesterId))
  }

  const assigneeFilterValue = assignedTo || attendantId

  if (assigneeFilterValue) {
    const assigneeValues = parseCsvOrArray(assigneeFilterValue)
    const assigneeIds = assigneeValues.map(Number).filter(Boolean)
    const includeUnassigned = assigneeValues.some((value) => value.toLowerCase() === 'unassigned')

    tickets = tickets.filter((ticket) => {
      if (includeUnassigned && !ticket.assignedTo) {
        return true
      }

      return assigneeIds.includes(ticket.assignedTo)
    })
  }

  const tagsFilterValue = tag || tags

  if (tagsFilterValue) {
    const normalizedTags = parseCsvOrArray(tagsFilterValue).map((item) => item.toLowerCase())
    tickets = tickets.filter((ticket) => ticket.tags.some((tagItem) => normalizedTags.includes(tagItem)))
  }

  const searchValue = String(search || keyword || '').toLowerCase().trim()

  if (searchValue) {
    tickets = tickets.filter((ticket) => {
      const requester = data.users.find((user) => user.id === ticket.requesterId)
      const assignee = data.users.find((user) => user.id === ticket.assignedTo)

      const content = [
        ticket.ticketNumber,
        ticket.title,
        ticket.description,
        ticket.subcategory,
        ticket.departmentResponsible,
        ticket.problemType,
        ticket.problemTypeLabel,
        requester?.name,
        assignee?.name,
        ticket.tags.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return content.includes(searchValue)
    })
  }

  const direction = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1

  const ordered = [...tickets].sort((a, b) => {
    if (sortBy === 'priority') {
      return (TICKET_PRIORITY_ORDER[a.priority] - TICKET_PRIORITY_ORDER[b.priority]) * direction
    }

    if (sortBy === 'status') {
      return (TICKET_STATUS_ORDER[a.status] - TICKET_STATUS_ORDER[b.status]) * direction
    }

    if (sortBy === 'ticketNumber') {
      return String(a.ticketNumber || '').localeCompare(String(b.ticketNumber || '')) * direction
    }

    const dateField = ['createdAt', 'updatedAt', 'closedAt'].includes(String(sortBy)) ? String(sortBy) : 'updatedAt'
    const firstDate = a[dateField] ? new Date(a[dateField]).getTime() : 0
    const secondDate = b[dateField] ? new Date(b[dateField]).getTime() : 0

    return (firstDate - secondDate) * direction
  })

  res.status(200).json({ ok: true, tickets: ordered.map(enrichTicket) })
})

app.get('/api/tickets/filter-options', requireAuth, (req, res) => {
  const scopedTickets = buildTicketScope(req.user).map(ensureTicketDefaults)
  const scopedRequesterIds = [...new Set(scopedTickets.map((ticket) => ticket.requesterId).filter(Boolean))]
  const scopedAssigneeIds = [...new Set(scopedTickets.map((ticket) => ticket.assignedTo).filter(Boolean))]

  const departments = [
    ...new Set(
      scopedTickets
        .map((ticket) => String(ticket.departmentResponsible || '').trim())
        .filter(Boolean)
        .concat(data.users.map((user) => String(user.department || '').trim()).filter(Boolean)),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const tags = [...new Set(scopedTickets.flatMap((ticket) => ticket.tags || []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )

  const requesters = scopedRequesterIds
    .map((id) => data.users.find((user) => user.id === id))
    .filter(Boolean)
    .map((requester) => ({ id: requester.id, name: requester.name }))

  const attendants = scopedAssigneeIds
    .map((id) => data.users.find((user) => user.id === id && STAFF_ROLES.includes(user.role)))
    .filter(Boolean)
    .map((attendant) => ({ id: attendant.id, name: attendant.name }))

  return res.status(200).json({
    ok: true,
    filters: {
      departments,
      tags,
      problemTypes: TICKET_PROBLEM_TYPES.map((problemType) => ({
        value: problemType,
        label: getTicketProblemTypeLabel(problemType),
      })),
      requesters,
      attendants,
    },
  })
})

app.post('/api/tickets', requireAuth, (req, res) => {
  const {
    title,
    description,
    priority = 'medium',
    categoryId = 4,
    subcategory,
    departmentResponsible,
    problemType,
    tags,
    origin = 'site',
    assignedTo,
    attachments,
    attendantResponse,
    clientReturn,
  } = req.body || {}

  if (!title || !description) {
    return res.status(400).json({ ok: false, message: 'title e description sao obrigatorios' })
  }

  const normalizedCategoryId = Number(categoryId)
  const categoryExists = data.categories.some((category) => category.id === normalizedCategoryId)

  if (!categoryExists) {
    return res.status(400).json({ ok: false, message: 'Categoria invalida' })
  }

  const id = nextId('tickets')
  const createdAt = nowIso()
  const settings = getSettings()
  const assigneeId = assignedTo ? Number(assignedTo) : null
  const assigneeUser = assigneeId ? data.users.find((user) => user.id === assigneeId) : null
  const canAssign = STAFF_ROLES.includes(req.user.role) && assigneeUser && STAFF_ROLES.includes(assigneeUser.role)
  const targetDepartment = String(departmentResponsible || getCategoryDepartment(normalizedCategoryId) || 'Atendimento').trim()

  const ticket = ensureTicketDefaults({
    id,
    ticketNumber: buildTicketNumber(id),
    title: String(title).trim(),
    description: String(description).trim(),
    status: 'open',
    priority,
    categoryId: normalizedCategoryId,
    subcategory: String(subcategory || getCategorySubcategories(normalizedCategoryId)[0] || 'Geral').trim(),
    requesterId: req.user.id,
    assignedTo: canAssign ? assigneeId : null,
    departmentResponsible: targetDepartment,
    problemType,
    tags,
    origin,
    attachments,
    attendantResponse: STAFF_ROLES.includes(req.user.role) ? String(attendantResponse || '').trim() : '',
    clientReturn: String(clientReturn || ''),
    createdAt,
    updatedAt: createdAt,
    closedAt: null,
  })

  if (!ticket.assignedTo) {
    ticket.assignedTo = pickAutomaticAssignee(ticket)
  }

  if (!ticket.attendantResponse && settings.autoReplyOnTicketOpen) {
    ticket.attendantResponse = `Recebemos seu chamado ${ticket.ticketNumber}. Nossa equipe iniciou a triagem e retornara em breve.`
    markFirstResponseIfNeeded(ticket, ticket.assignedTo, 'resposta_automatica')
  }

  applySlaTargets(ticket)
  autoTransitionStatusAfterAssignment(ticket, ticket.assignedTo || req.user.id)

  data.tickets.push(ticket)
  addTicketHistory(ticket.id, req.user.id, 'created', `Chamado ${ticket.ticketNumber} criado`)
  if (ticket.assignedTo) {
    addTicketHistory(ticket.id, ticket.assignedTo, 'assigned', 'Atribuicao automatica por setor/carga de trabalho', [
      { field: 'assignedTo', from: null, to: ticket.assignedTo },
      { field: 'departmentResponsible', from: null, to: ticket.departmentResponsible },
    ])
  }
  logUserActivity(req.user.id, req.user.id, 'ticket_created', `Chamado ${ticket.ticketNumber} criado`)
  notifyTicketCreation(ticket)
  runAutomations({ actorId: req.user.id, ticketId: ticket.id, reason: 'ticket_created' })

  return res.status(201).json({ ok: true, ticket: enrichTicket(ticket) })
})

app.get('/api/tickets/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === id)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar este ticket' })
  }

  return res.status(200).json({ ok: true, ticket: enrichTicket(ticket) })
})

app.patch('/api/tickets/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const index = data.tickets.findIndex((item) => item.id === id)

  if (index === -1) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  const ticket = data.tickets[index]

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para editar este ticket' })
  }

  const isStaff = STAFF_ROLES.includes(req.user.role)
  const allowed = isStaff
    ? [
        'status',
        'priority',
        'assignedTo',
        'title',
        'description',
        'categoryId',
        'subcategory',
        'departmentResponsible',
        'problemType',
        'tags',
        'origin',
        'attachments',
        'attendantResponse',
        'clientReturn',
      ]
    : ['title', 'description', 'categoryId', 'subcategory', 'problemType', 'tags', 'origin', 'attachments', 'clientReturn']

  const updatedTicket = { ...ticket }
  const changes = []

  const pushChange = (field, from, to) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field, from, to })
    }
  }

  for (const key of allowed) {
    if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, key)) {
      continue
    }

    const previousValue = updatedTicket[key]
    let nextValue = req.body[key]

    if (key === 'title' || key === 'description') {
      nextValue = String(nextValue || '').trim()

      if (!nextValue) {
        return res.status(400).json({ ok: false, message: `${key} nao pode ser vazio` })
      }
    }

    if (key === 'categoryId') {
      nextValue = Number(nextValue)
      const categoryExists = data.categories.some((category) => category.id === nextValue)

      if (!categoryExists) {
        return res.status(400).json({ ok: false, message: 'Categoria invalida' })
      }
    }

    if (key === 'status') {
      const normalizedStatus = String(nextValue || '').toLowerCase().trim()

      if (!TICKET_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ ok: false, message: 'Status invalido' })
      }

      nextValue = normalizedStatus
    }

    if (key === 'priority') {
      const normalizedPriority = String(nextValue || '').toLowerCase().trim()

      if (!TICKET_PRIORITIES.includes(normalizedPriority)) {
        return res.status(400).json({ ok: false, message: 'Prioridade invalida' })
      }

      nextValue = normalizedPriority
    }

    if (key === 'origin') {
      nextValue = sanitizeTicketOrigin(nextValue)
    }

    if (key === 'problemType') {
      nextValue = sanitizeTicketProblemType(nextValue)
    }

    if (key === 'tags') {
      nextValue = normalizeTicketTags(nextValue)
    }

    if (key === 'assignedTo') {
      if (!isStaff) {
        continue
      }

      if (nextValue === null || nextValue === '') {
        nextValue = null
      } else {
        const assignedId = Number(nextValue)
        const assignedUser = data.users.find((user) => user.id === assignedId)

        if (!assignedUser || !STAFF_ROLES.includes(assignedUser.role)) {
          return res.status(400).json({ ok: false, message: 'Responsavel invalido' })
        }

        nextValue = assignedId
      }
    }

    if (key === 'attachments') {
      nextValue = normalizeTicketAttachments(nextValue)
    }

    if (key === 'subcategory' || key === 'departmentResponsible' || key === 'attendantResponse' || key === 'clientReturn') {
      nextValue = String(nextValue || '').trim()
    }

    if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      updatedTicket[key] = nextValue
      pushChange(key, previousValue, nextValue)
    }
  }

  if (changes.length === 0) {
    return res.status(200).json({ ok: true, ticket: enrichTicket(ticket) })
  }

  const previousStatus = ticket.status
  const nextStatus = updatedTicket.status
  const previousPriority = ticket.priority

  if (previousStatus !== nextStatus && FINAL_TICKET_STATUSES.includes(nextStatus)) {
    updatedTicket.closedAt = nowIso()
    pushChange('closedAt', ticket.closedAt || null, updatedTicket.closedAt)
  }

  if (FINAL_TICKET_STATUSES.includes(previousStatus) && !FINAL_TICKET_STATUSES.includes(nextStatus)) {
    pushChange('closedAt', ticket.closedAt || null, null)
    updatedTicket.closedAt = null
  }

  if (previousPriority !== updatedTicket.priority) {
    updatedTicket.slaFirstResponseDueAt = null
    updatedTicket.slaResolutionDueAt = null
    updatedTicket.slaBreachedAt = null
    updatedTicket.slaState = 'on_track'
    pushChange('slaRecalculated', previousPriority, updatedTicket.priority)
  }

  if (updatedTicket.categoryId !== ticket.categoryId && !req.body?.departmentResponsible) {
    const previousDepartment = updatedTicket.departmentResponsible
    updatedTicket.departmentResponsible = getCategoryDepartment(updatedTicket.categoryId)
    pushChange('departmentResponsible', previousDepartment, updatedTicket.departmentResponsible)
  }

  if (updatedTicket.assignedTo !== ticket.assignedTo && !updatedTicket.assignedTo) {
    const automaticAssignee = pickAutomaticAssignee(updatedTicket)
    if (automaticAssignee) {
      updatedTicket.assignedTo = automaticAssignee
      pushChange('assignedTo', null, automaticAssignee)
    }
  }

  if (updatedTicket.attendantResponse && updatedTicket.attendantResponse !== ticket.attendantResponse) {
    markFirstResponseIfNeeded(updatedTicket, req.user.id, 'resposta_atendente')
  }

  applySlaTargets(updatedTicket)
  autoTransitionStatusAfterAssignment(updatedTicket, req.user.id)

  updatedTicket.updatedAt = nowIso()
  data.tickets[index] = ensureTicketDefaults(updatedTicket)

  addTicketHistory(
    updatedTicket.id,
    req.user.id,
    'updated',
    `Chamado ${updatedTicket.ticketNumber} atualizado`,
    changes,
  )
  logUserActivity(req.user.id, req.user.id, 'ticket_updated', `Chamado ${updatedTicket.ticketNumber} atualizado`)
  notifyTicketUpdate(data.tickets[index], req.user.id, changes)
  runAutomations({ actorId: req.user.id, ticketId: updatedTicket.id, reason: 'ticket_updated' })

  // Send email notification if status changed
  if (previousStatus && previousStatus !== nextStatus) {
    sendStatusChangeNotification(data.tickets[index], previousStatus, req.user)
  }

  return res.status(200).json({ ok: true, ticket: enrichTicket(data.tickets[index]) })
})

app.post('/api/tickets/:id/close', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === id)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para fechar este ticket' })
  }

  if (FINAL_TICKET_STATUSES.includes(ticket.status)) {
    return res.status(400).json({ ok: false, message: 'Ticket ja esta finalizado' })
  }

  const now = nowIso()
  const previousStatus = ticket.status

  ticket.status = 'closed'
  ticket.closedAt = now
  ticket.updatedAt = now

  if (STAFF_ROLES.includes(req.user.role) && req.body?.attendantResponse !== undefined) {
    ticket.attendantResponse = String(req.body.attendantResponse || '').trim()
    markFirstResponseIfNeeded(ticket, req.user.id, 'fechamento')
  }

  if (req.user.role === ROLES.CLIENT && req.body?.clientReturn !== undefined) {
    ticket.clientReturn = String(req.body.clientReturn || '').trim()
  }

  addTicketHistory(ticket.id, req.user.id, 'closed', `Chamado ${ticket.ticketNumber} fechado`, [
    { field: 'status', from: previousStatus, to: 'closed' },
    { field: 'closedAt', from: null, to: now },
  ])
  logUserActivity(req.user.id, req.user.id, 'ticket_closed', `Chamado ${ticket.ticketNumber} fechado`)
  notifyTicketUpdate(ticket, req.user.id, [{ field: 'status', from: previousStatus, to: 'closed' }])

  // Send email notification when ticket is closed
  sendStatusChangeNotification(ticket, previousStatus, req.user)

  return res.status(200).json({ ok: true, ticket: enrichTicket(ticket) })
})

app.post('/api/tickets/:id/reopen', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === id)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para reabrir este ticket' })
  }

  if (!getSettings().allowTicketReopen) {
    return res.status(403).json({ ok: false, message: 'Reabertura de chamados esta desativada nas configuracoes' })
  }

  if (!REOPENABLE_TICKET_STATUSES.includes(ticket.status)) {
    return res.status(400).json({ ok: false, message: 'Somente chamados resolvidos, fechados ou cancelados podem ser reabertos' })
  }

  const previousStatus = ticket.status
  ticket.status = 'open'
  ticket.closedAt = null
  ticket.updatedAt = nowIso()

  if (req.body?.clientReturn !== undefined) {
    ticket.clientReturn = String(req.body.clientReturn || '').trim()
  }

  addTicketHistory(ticket.id, req.user.id, 'reopened', `Chamado ${ticket.ticketNumber} reaberto`, [
    { field: 'status', from: previousStatus, to: 'open' },
  ])
  logUserActivity(req.user.id, req.user.id, 'ticket_reopened', `Chamado ${ticket.ticketNumber} reaberto`)
  notifyTicketUpdate(ticket, req.user.id, [{ field: 'status', from: previousStatus, to: 'open' }])
  runAutomations({ actorId: req.user.id, ticketId: ticket.id, reason: 'ticket_reopened' })

  return res.status(200).json({ ok: true, ticket: enrichTicket(ticket) })
})

app.delete('/api/tickets/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const index = data.tickets.findIndex((item) => item.id === id)

  if (index === -1) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  const ticket = data.tickets[index]
  const isOwner = ticket.requesterId === req.user.id
  const canDelete = STAFF_ROLES.includes(req.user.role) || isOwner

  if (!canDelete) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para remover este ticket' })
  }

  data.tickets.splice(index, 1)
  data.comments = data.comments.filter((item) => item.ticketId !== id)
  data.ticketHistory = data.ticketHistory.filter((item) => item.ticketId !== id)
  logUserActivity(req.user.id, req.user.id, 'ticket_deleted', `Chamado ${ticket.ticketNumber} removido`)

  return res.status(200).json({ ok: true, message: 'Ticket removido' })
})

app.get('/api/tickets/:id/history', requireAuth, (req, res) => {
  const ticketId = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === ticketId)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar historico' })
  }

  const history = data.ticketHistory
    .filter((item) => item.ticketId === ticketId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => {
      const actor = data.users.find((user) => user.id === item.actorId)
      return {
        ...item,
        actorName: actor ? actor.name : 'Sistema',
      }
    })

  return res.status(200).json({ ok: true, history })
})

app.get('/api/tickets/:id/timeline', requireAuth, (req, res) => {
  const ticketId = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === ticketId)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar timeline' })
  }

  const historyEvents = data.ticketHistory
    .filter((item) => item.ticketId === ticketId)
    .map((item) => {
      const actor = data.users.find((user) => user.id === item.actorId)
      return {
        id: `history-${item.id}`,
        kind: 'history',
        eventType: item.eventType,
        description: item.description,
        changes: item.changes || [],
        authorName: actor ? actor.name : 'Sistema',
        createdAt: item.createdAt,
      }
    })

  const commentEvents = data.comments
    .filter((item) => item.ticketId === ticketId)
    .map((item) => {
      const author = data.users.find((user) => user.id === item.authorId)
      return {
        id: `comment-${item.id}`,
        kind: 'comment',
        eventType: 'comment',
        description: item.message,
        changes: [],
        authorName: author ? author.name : 'Usuario removido',
        createdAt: item.createdAt,
      }
    })

  const timeline = [...historyEvents, ...commentEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  return res.status(200).json({ ok: true, timeline })
})

app.get('/api/tickets/:id/comments', requireAuth, (req, res) => {
  const ticketId = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === ticketId)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar comentarios' })
  }

  const isStaff = STAFF_ROLES.includes(req.user.role)
  const comments = data.comments
    .filter((item) => {
      if (item.ticketId !== ticketId) return false
      if (item.visibility === 'internal' && !isStaff) return false
      return true
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => {
      const author = data.users.find((user) => user.id === item.authorId)
      return {
        ...item,
        authorName: author ? author.name : 'Usuario removido',
      }
    })

  return res.status(200).json({ ok: true, comments })
})

app.post('/api/tickets/:id/comments', requireAuth, (req, res) => {
  const ticketId = Number(req.params.id)
  const ticket = data.tickets.find((item) => item.id === ticketId)

  if (!ticket) {
    return res.status(404).json({ ok: false, message: 'Ticket nao encontrado' })
  }

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para comentar neste ticket' })
  }

  const { message, type = 'standard', visibility = 'public', sendEmail = false } = req.body || {}

  if (!message) {
    return res.status(400).json({ ok: false, message: 'message e obrigatorio' })
  }

  const isStaff = STAFF_ROLES.includes(req.user.role)
  const effectiveType = COMMENT_TYPES.includes(String(type)) ? String(type) : 'standard'
  const effectiveVisibility = visibility === 'internal' && isStaff ? 'internal' : 'public'

  const comment = {
    id: nextId('comments'),
    ticketId,
    authorId: req.user.id,
    message: String(message),
    type: effectiveType,
    visibility: effectiveVisibility,
    emailedAt: null,
    createdAt: nowIso(),
  }

  data.comments.push(comment)

  const requester = data.users.find((u) => u.id === ticket.requesterId)

  if (sendEmail && effectiveVisibility === 'public' && effectiveType === 'standard' && requester) {
    const emailSubject = `Re: ${ticket.title} - ${ticket.ticketNumber}`
    const emailHtml = `
      <p>Ola ${requester.name},</p>
      <p>Novo comentario no seu chamado <strong>${ticket.ticketNumber}</strong>:</p>
      <blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin: 16px 0;">
        <p>${String(message).replace(/\n/g, '<br>')}</p>
        <p><em>Por: ${req.user.name}</em></p>
      </blockquote>
      <p><a href="${process.env.BASE_URL || 'http://localhost:5173'}/tickets/${ticket.id}">Ver chamado</a></p>
    `
    const emailText = `Novo comentario:\n\n${message}\n\nPor: ${req.user.name}`

    sendEmail({ to: requester.email, subject: emailSubject, html: emailHtml, text: emailText }).then((emailResult) => {
      if (emailResult.ok) {
        comment.emailedAt = nowIso()
      }
    })
  }

  const beforeStatus = ticket.status
  const settings = getSettings()

  if (settings.autoStatusTransitionsEnabled && !FINAL_TICKET_STATUSES.includes(ticket.status) && ticket.status !== 'resolved') {
    if (STAFF_ROLES.includes(req.user.role)) {
      ticket.status = 'waiting_customer'
      markFirstResponseIfNeeded(ticket, req.user.id, 'comentario_atendente')
    } else {
      ticket.status = ticket.assignedTo ? 'in_analysis' : 'open'
    }
  }

  ticket.updatedAt = nowIso()

  if (beforeStatus !== ticket.status) {
    addTicketHistory(ticket.id, req.user.id, 'auto_status_change', 'Status atualizado automaticamente com base no comentario', [
      { field: 'status', from: beforeStatus, to: ticket.status },
    ])
  }

  addTicketHistory(ticketId, req.user.id, 'comment', `Comentario adicionado por ${req.user.name}`)
  logUserActivity(req.user.id, req.user.id, 'ticket_comment_added', `Comentario no chamado ${ticket.ticketNumber}`)
  notifyTicketUpdate(ticket, req.user.id, [{ field: 'comment', from: null, to: 'novo_comentario' }])
  notifyWsSubscribers(ticket.id, 'new_comment', { authorId: req.user.id, type: effectiveType, visibility: effectiveVisibility })
  runAutomations({ actorId: req.user.id, ticketId: ticket.id, reason: 'ticket_commented' })

  return res.status(201).json({
    ok: true,
    comment: {
      ...comment,
      authorName: req.user.name,
    },
  })
})

app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  const scopedTickets = buildTicketScope(req.user)

  const summary = {
    ticketsOpen: scopedTickets.filter((item) => item.status === 'open').length,
    ticketsInProgress: scopedTickets.filter((item) => ACTIVE_TICKET_STATUSES.includes(item.status)).length,
    ticketsResolved: scopedTickets.filter((item) => ['resolved', ...FINAL_TICKET_STATUSES].includes(item.status)).length,
    ticketsHighPriority: scopedTickets.filter((item) => ['high', 'critical'].includes(item.priority)).length,
    ticketsSlaBreached: scopedTickets.filter((item) => item.slaState === 'breached').length,
    ticketsEscalated: scopedTickets.filter((item) => Number(item.escalationLevel || 0) > 0).length,
    pendingReminders: data.internalReminders.filter((item) => item.status === 'pending').length,
    users: data.users.length,
    categories: data.categories.length,
  }

  res.status(200).json({ ok: true, summary })
})

app.get('/api/settings', requireAuth, (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: 'Somente equipe interna pode visualizar configuracoes' })
  }

  return res.status(200).json({ ok: true, settings: getSettings() })
})

app.patch('/api/settings', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const allowed = [
    'companyName',
    'supportEmail',
    'allowTicketReopen',
    'autoAssignEnabled',
    'autoAssignByDepartment',
    'autoAssignByWorkload',
    'autoReplyOnTicketOpen',
    'autoStatusTransitionsEnabled',
    'notifyOnNewTicket',
    'notifyOnTicketUpdate',
    'slaEnabled',
    'autoEscalationEnabled',
    'delayAlertsEnabled',
    'attendantRemindersEnabled',
    'emailNotificationsEnabled',
    'emailReplyEnabled',
    'pushNotificationsEnabled',
    'slaRules',
    'escalationRules',
    'reminderRules',
  ]

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      data.settings[key] = req.body[key]
    }
  }

  data.settings = normalizeSettings({
    ...data.settings,
    updatedAt: nowIso(),
  })
  runAutomations({ actorId: req.user.id, reason: 'settings_updated' })

  return res.status(200).json({ ok: true, settings: data.settings })
})

app.post('/api/automation/run', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const ticketId = req.body?.ticketId ? Number(req.body.ticketId) : null
  runAutomations({ actorId: req.user.id, ticketId, reason: 'manual_run' })

  return res.status(200).json({
    ok: true,
    message: ticketId ? `Automacoes executadas para o chamado #${ticketId}` : 'Automacoes executadas para todos os chamados',
  })
})

// Email endpoints
app.post('/api/email/test', requireAuth, requireRole([ROLES.ADMIN]), async (req, res) => {
  const { to } = req.body || {}

  if (!to) {
    return res.status(400).json({ ok: false, message: 'E-mail para teste e obrigatorio' })
  }

  const result = await sendEmail({
    to: String(to),
    subject: 'Teste de Configuracao de Email - HelpDesk',
    html: `
      <p>Ola,</p>
      <p>Este e um teste da configuracao de email do sistema HelpDesk.</p>
      <p>Se voce recebeu este email, as configuracoes de SMTP estao funcionando corretamente.</p>
      <p>Data: ${nowIso()}</p>
    `,
    text: 'Este e um teste da configuracao de email do sistema HelpDesk.',
  })

  return res.status(result.ok ? 200 : 500).json(result)
})

app.get('/api/email/messages', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 50), 200))
  const status = String(req.query?.status || 'any').toLowerCase().trim()

  let messages = [...data.emailMessages]

  if (status === 'pending' || status === 'sent' || status === 'failed') {
    messages = messages.filter((m) => m.status === status)
  }

  const sorted = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return res.status(200).json({
    ok: true,
    messages: sorted.slice(0, limit),
    total: messages.length,
    pending: messages.filter((m) => m.status === 'pending').length,
  })
})

app.get('/api/email/messages/:id', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const id = Number(req.params.id)
  const message = data.emailMessages.find((m) => m.id === id)

  if (!message) {
    return res.status(404).json({ ok: false, message: 'Mensagem de email nao encontrada' })
  }

  return res.status(200).json({ ok: true, message })
})

app.post('/api/email/messages/:id/retry', requireAuth, requireRole([ROLES.ADMIN]), async (req, res) => {
  const id = Number(req.params.id)
  const message = data.emailMessages.find((m) => m.id === id)

  if (!message) {
    return res.status(404).json({ ok: false, message: 'Mensagem de email nao encontrada' })
  }

  const result = await sendEmail({
    to: message.toAddress,
    subject: message.subject,
    html: message.htmlBody,
    text: message.textBody,
  })

  if (result.ok) {
    message.status = 'sent'
    message.sentAt = nowIso()
    message.errorMessage = null
  } else {
    message.status = 'failed'
    message.errorMessage = result.message || 'Erro ao enviar email'
  }

  return res.status(result.ok ? 200 : 500).json({ ok: result.ok, message, result })
})

app.get('/api/notifications', requireAuth, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 50), 200))
  const unreadOnly = String(req.query?.unreadOnly || 'false') === 'true'

  let list = data.notifications.filter((item) => item.userId === req.user.id)

  if (unreadOnly) {
    list = list.filter((item) => !item.readAt)
  }

  const items = list.slice(0, limit)

  return res.status(200).json({
    ok: true,
    notifications: items,
    unread: data.notifications.filter((item) => item.userId === req.user.id && !item.readAt).length,
  })
})

app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const notification = data.notifications.find((item) => item.id === id && item.userId === req.user.id)

  if (!notification) {
    return res.status(404).json({ ok: false, message: 'Notificacao nao encontrada' })
  }

  notification.readAt = notification.readAt || nowIso()
  return res.status(200).json({ ok: true, notification })
})

app.get('/api/reminders/internal', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.ATTENDANT]), (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 80), 200))
  const status = String(req.query?.status || 'pending').toLowerCase().trim()

  let reminders = [...data.internalReminders]

  if (req.user.role === ROLES.ATTENDANT) {
    reminders = reminders.filter((item) => item.attendantId === req.user.id)
  }

  if (status === 'pending' || status === 'done') {
    reminders = reminders.filter((item) => (status === 'pending' ? item.status === 'pending' : item.status === 'done'))
  }

  return res.status(200).json({ ok: true, reminders: reminders.slice(0, limit) })
})

app.patch('/api/reminders/internal/:id', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.ATTENDANT]), (req, res) => {
  const id = Number(req.params.id)
  const reminder = data.internalReminders.find((item) => item.id === id)

  if (!reminder) {
    return res.status(404).json({ ok: false, message: 'Lembrete nao encontrado' })
  }

  const canEdit = req.user.role !== ROLES.ATTENDANT || reminder.attendantId === req.user.id

  if (!canEdit) {
    return res.status(403).json({ ok: false, message: 'Sem permissao para atualizar este lembrete' })
  }

  reminder.status = req.body?.status === 'pending' ? 'pending' : 'done'
  reminder.resolvedAt = reminder.status === 'done' ? nowIso() : null

  return res.status(200).json({ ok: true, reminder })
})

// Push notification endpoints
app.get('/api/push-notifications/public-key', (_req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) {
    return res.status(503).json({ ok: false, message: 'Push notifications nao estao configuradas' })
  }
  return res.status(200).json({ ok: true, publicKey })
})

app.post('/api/push-notifications/subscribe', requireAuth, (req, res) => {
  const { subscription } = req.body || {}

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, message: 'subscription com endpoint e obrigatoria' })
  }

  const sub = {
    id: nextId('pushSubscriptions'),
    userId: req.user.id,
    endpoint: String(subscription.endpoint),
    p256dh: String(subscription.keys?.p256dh || ''),
    auth: String(subscription.keys?.auth || ''),
    userAgent: String(req.get('user-agent') || ''),
    subscribedAt: nowIso(),
    lastUsedAt: null,
  }

  const existing = data.pushSubscriptions.find((s) => s.userId === req.user.id && s.endpoint === sub.endpoint)
  if (existing) {
    existing.lastUsedAt = nowIso()
    return res.status(200).json({ ok: true, subscription: existing, message: 'Subscricao ja existe' })
  }

  data.pushSubscriptions.push(sub)

  return res.status(201).json({ ok: true, subscription: sub })
})

app.get('/api/push-notifications/subscriptions', requireAuth, (req, res) => {
  const subscriptions = data.pushSubscriptions.filter((s) => s.userId === req.user.id)
  return res.status(200).json({ ok: true, subscriptions })
})

app.delete('/api/push-notifications/subscriptions/:endpoint', requireAuth, (req, res) => {
  const endpoint = String(req.params.endpoint || '')
  const index = data.pushSubscriptions.findIndex((s) => s.userId === req.user.id && s.endpoint === endpoint)

  if (index === -1) {
    return res.status(404).json({ ok: false, message: 'Subscricao nao encontrada' })
  }

  const removed = data.pushSubscriptions.splice(index, 1)
  return res.status(200).json({ ok: true, subscription: removed[0] })
})

app.post('/api/push-notifications/test', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), async (req, res) => {
  const subscriptions = data.pushSubscriptions.filter((s) => s.userId === req.user.id)
  if (subscriptions.length === 0) {
    return res.status(400).json({ ok: false, message: 'Nenhuma subscricao de push encontrada' })
  }

  const results = []
  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, {
      title: 'Teste de Notificacao Push',
      body: 'Este e um teste da funcao de notificacoes push do helpdesk',
      data: { type: 'test', timestamp: nowIso() },
    })
    results.push({ endpoint: sub.endpoint, ...result })
  }

  return res.status(200).json({ ok: true, results })
})

app.get('/api/reports/overview', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (_req, res) => {
  const total = data.tickets.length || 1

  const byStatus = TICKET_STATUSES.map((status) => {
    const count = data.tickets.filter((ticket) => ticket.status === status).length
    return {
      status,
      statusLabel: getTicketStatusLabel(status),
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }
  })

  const byPriority = TICKET_PRIORITIES.map((priority) => {
    const count = data.tickets.filter((ticket) => ticket.priority === priority).length
    return {
      priority,
      priorityLabel: getTicketPriorityLabel(priority),
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }
  })

  const byCategory = data.categories.map((category) => {
    const count = data.tickets.filter((ticket) => ticket.categoryId === category.id).length
    return { category: category.name, count, percentage: Number(((count / total) * 100).toFixed(1)) }
  })

  const byDepartment = [...new Set(data.tickets.map((ticket) => ticket.departmentResponsible).filter(Boolean))].map(
    (department) => {
      const count = data.tickets.filter((ticket) => ticket.departmentResponsible === department).length
      return { department, count, percentage: Number(((count / total) * 100).toFixed(1)) }
    },
  )

  const byRequester = [...new Set(data.tickets.map((ticket) => ticket.requesterId).filter(Boolean))].map((requesterId) => {
    const requester = data.users.find((user) => user.id === requesterId)
    const count = data.tickets.filter((ticket) => ticket.requesterId === requesterId).length
    return {
      requesterId,
      requester: requester ? requester.name : `Usuario #${requesterId}`,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }
  })

  const byAttendant = [...new Set(data.tickets.map((ticket) => ticket.assignedTo).filter(Boolean))].map((attendantId) => {
    const attendant = data.users.find((user) => user.id === attendantId)
    const count = data.tickets.filter((ticket) => ticket.assignedTo === attendantId).length
    return {
      attendantId,
      attendant: attendant ? attendant.name : `Usuario #${attendantId}`,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }
  })

  const byProblemType = TICKET_PROBLEM_TYPES.map((problemType) => {
    const count = data.tickets.filter((ticket) => sanitizeTicketProblemType(ticket.problemType) === problemType).length
    return {
      problemType,
      problemTypeLabel: getTicketProblemTypeLabel(problemType),
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }
  })

  return res.status(200).json({
    ok: true,
    generatedAt: nowIso(),
    byStatus,
    byPriority,
    byCategory,
    byDepartment,
    byRequester,
    byAttendant,
    byProblemType,
    totalTickets: data.tickets.length,
  })
})

app.get('/api/knowledge-base', requireAuth, (_req, res) => {
  res.status(200).json({ ok: true, articles: data.knowledgeArticles })
})

app.post('/api/knowledge-base', requireAuth, requireRole([ROLES.ADMIN, ROLES.ATTENDANT, ROLES.MANAGER]), (req, res) => {
  const { title, category, content } = req.body || {}

  if (!title || !content) {
    return res.status(400).json({ ok: false, message: 'title e content sao obrigatorios' })
  }

  const article = {
    id: nextId('knowledgeArticles'),
    title: String(title),
    category: String(category || 'Geral'),
    content: String(content),
    updatedAt: nowIso(),
    authorId: req.user.id,
  }

  data.knowledgeArticles.unshift(article)

  return res.status(201).json({ ok: true, article })
})

app.patch('/api/knowledge-base/:id', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const id = Number(req.params.id)
  const article = data.knowledgeArticles.find((item) => item.id === id)

  if (!article) {
    return res.status(404).json({ ok: false, message: 'Artigo nao encontrado' })
  }

  const allowed = ['title', 'category', 'content']

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      article[key] = req.body[key]
    }
  }

  article.updatedAt = nowIso()

  return res.status(200).json({ ok: true, article })
})

app.delete('/api/knowledge-base/:id', requireAuth, requireRole([ROLES.ADMIN, ROLES.MANAGER]), (req, res) => {
  const id = Number(req.params.id)
  const index = data.knowledgeArticles.findIndex((item) => item.id === id)

  if (index === -1) {
    return res.status(404).json({ ok: false, message: 'Artigo nao encontrado' })
  }

  data.knowledgeArticles.splice(index, 1)

  return res.status(200).json({ ok: true, message: 'Artigo removido' })
})

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, message: 'Rota nao encontrada' })
})

app.locals.wsConnections = data.wsConnections
app.locals.sendEmail = sendEmail
app.locals.sendPushNotification = sendPushNotification

module.exports = app
