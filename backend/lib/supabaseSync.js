const { getSupabaseClient, hasServiceRoleKey, isSupabaseConfigured } = require('./supabaseClient')

const TABLES = {
  users: 'hd_users',
  categories: 'hd_categories',
  tickets: 'hd_tickets',
  comments: 'hd_comments',
  ticketHistory: 'hd_ticket_history',
  settings: 'hd_settings',
  knowledgeArticles: 'hd_knowledge_articles',
  userActivities: 'hd_user_activities',
  notifications: 'hd_notifications',
  internalReminders: 'hd_internal_reminders',
}

function maxId(items) {
  if (!items.length) {
    return 0
  }

  return items.reduce((acc, item) => Math.max(acc, Number(item.id || 0)), 0)
}

const userToDb = (user) => ({
  id: Number(user.id),
  name: user.name,
  email: user.email,
  password: user.password,
  role: user.role,
  phone: user.phone || null,
  department: user.department || null,
  avatar_url: user.avatarUrl || null,
  is_active: Boolean(user.isActive),
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  last_login_at: user.lastLoginAt || null,
})

const userFromDb = (row) => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  password: row.password,
  role: row.role,
  phone: row.phone || '',
  department: row.department || '',
  avatarUrl: row.avatar_url || '',
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
})

const categoryToDb = (category) => ({
  id: Number(category.id),
  name: category.name,
})

const categoryFromDb = (row) => ({
  id: Number(row.id),
  name: row.name,
})

const ticketToDb = (ticket) => ({
  id: Number(ticket.id),
  ticket_number: ticket.ticketNumber || null,
  title: ticket.title,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  category_id: ticket.categoryId ? Number(ticket.categoryId) : null,
  subcategory: ticket.subcategory || null,
  problem_type: ticket.problemType || 'other',
  tags_json: Array.isArray(ticket.tags) ? ticket.tags : [],
  requester_id: ticket.requesterId ? Number(ticket.requesterId) : null,
  assigned_to: ticket.assignedTo ? Number(ticket.assignedTo) : null,
  department_responsible: ticket.departmentResponsible || null,
  origin: ticket.origin || 'site',
  attachments_json: Array.isArray(ticket.attachments) ? ticket.attachments : [],
  attendant_response: ticket.attendantResponse || null,
  client_return: ticket.clientReturn || null,
  first_response_at: ticket.firstResponseAt || null,
  sla_first_response_due_at: ticket.slaFirstResponseDueAt || null,
  sla_resolution_due_at: ticket.slaResolutionDueAt || null,
  sla_breached_at: ticket.slaBreachedAt || null,
  sla_state: ticket.slaState || 'on_track',
  escalation_level: Number(ticket.escalationLevel || 0),
  escalated_at: ticket.escalatedAt || null,
  last_internal_reminder_at: ticket.lastInternalReminderAt || null,
  last_delay_alert_at: ticket.lastDelayAlertAt || null,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt,
  closed_at: ticket.closedAt || null,
})

const ticketFromDb = (row) => ({
  id: Number(row.id),
  ticketNumber: row.ticket_number || null,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  categoryId: row.category_id ? Number(row.category_id) : null,
  subcategory: row.subcategory || 'Geral',
  problemType: row.problem_type || 'other',
  tags: Array.isArray(row.tags_json) ? row.tags_json : [],
  requesterId: row.requester_id ? Number(row.requester_id) : null,
  assignedTo: row.assigned_to ? Number(row.assigned_to) : null,
  departmentResponsible: row.department_responsible || 'Atendimento',
  origin: row.origin || 'site',
  attachments: Array.isArray(row.attachments_json) ? row.attachments_json : [],
  attendantResponse: row.attendant_response || '',
  clientReturn: row.client_return || '',
  firstResponseAt: row.first_response_at,
  slaFirstResponseDueAt: row.sla_first_response_due_at,
  slaResolutionDueAt: row.sla_resolution_due_at,
  slaBreachedAt: row.sla_breached_at,
  slaState: row.sla_state || 'on_track',
  escalationLevel: Number(row.escalation_level || 0),
  escalatedAt: row.escalated_at,
  lastInternalReminderAt: row.last_internal_reminder_at,
  lastDelayAlertAt: row.last_delay_alert_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
})

const ticketHistoryToDb = (entry) => ({
  id: Number(entry.id),
  ticket_id: Number(entry.ticketId),
  actor_id: entry.actorId ? Number(entry.actorId) : null,
  event_type: entry.eventType,
  description: entry.description || null,
  changes_json: Array.isArray(entry.changes) ? entry.changes : [],
  created_at: entry.createdAt,
})

const ticketHistoryFromDb = (row) => ({
  id: Number(row.id),
  ticketId: Number(row.ticket_id),
  actorId: row.actor_id ? Number(row.actor_id) : null,
  eventType: row.event_type,
  description: row.description || '',
  changes: Array.isArray(row.changes_json) ? row.changes_json : [],
  createdAt: row.created_at,
})

const commentToDb = (comment) => ({
  id: Number(comment.id),
  ticket_id: Number(comment.ticketId),
  author_id: comment.authorId ? Number(comment.authorId) : null,
  message: comment.message,
  created_at: comment.createdAt,
})

const commentFromDb = (row) => ({
  id: Number(row.id),
  ticketId: Number(row.ticket_id),
  authorId: row.author_id ? Number(row.author_id) : null,
  message: row.message,
  createdAt: row.created_at,
})

const settingsToDb = (settings) => ({
  id: Number(settings.id || 1),
  company_name: settings.companyName,
  support_email: settings.supportEmail,
  allow_ticket_reopen: Boolean(settings.allowTicketReopen),
  auto_assign_enabled: Boolean(settings.autoAssignEnabled),
  auto_assign_by_department: Boolean(settings.autoAssignByDepartment),
  auto_assign_by_workload: Boolean(settings.autoAssignByWorkload),
  auto_reply_on_ticket_open: Boolean(settings.autoReplyOnTicketOpen),
  auto_status_transitions_enabled: Boolean(settings.autoStatusTransitionsEnabled),
  notify_on_new_ticket: Boolean(settings.notifyOnNewTicket),
  notify_on_ticket_update: Boolean(settings.notifyOnTicketUpdate),
  sla_enabled: Boolean(settings.slaEnabled),
  auto_escalation_enabled: Boolean(settings.autoEscalationEnabled),
  delay_alerts_enabled: Boolean(settings.delayAlertsEnabled),
  attendant_reminders_enabled: Boolean(settings.attendantRemindersEnabled),
  sla_rules_json: settings.slaRules || {},
  escalation_rules_json: settings.escalationRules || {},
  reminder_rules_json: settings.reminderRules || {},
  updated_at: settings.updatedAt,
})

const settingsFromDb = (row) => ({
  id: Number(row.id),
  companyName: row.company_name,
  supportEmail: row.support_email,
  allowTicketReopen: Boolean(row.allow_ticket_reopen),
  autoAssignEnabled: Boolean(row.auto_assign_enabled),
  autoAssignByDepartment: Boolean(row.auto_assign_by_department ?? true),
  autoAssignByWorkload: Boolean(row.auto_assign_by_workload ?? true),
  autoReplyOnTicketOpen: Boolean(row.auto_reply_on_ticket_open ?? true),
  autoStatusTransitionsEnabled: Boolean(row.auto_status_transitions_enabled ?? true),
  notifyOnNewTicket: Boolean(row.notify_on_new_ticket),
  notifyOnTicketUpdate: Boolean(row.notify_on_ticket_update),
  slaEnabled: Boolean(row.sla_enabled ?? true),
  autoEscalationEnabled: Boolean(row.auto_escalation_enabled ?? true),
  delayAlertsEnabled: Boolean(row.delay_alerts_enabled ?? true),
  attendantRemindersEnabled: Boolean(row.attendant_reminders_enabled ?? true),
  slaRules: row.sla_rules_json && typeof row.sla_rules_json === 'object' ? row.sla_rules_json : {},
  escalationRules: row.escalation_rules_json && typeof row.escalation_rules_json === 'object' ? row.escalation_rules_json : {},
  reminderRules: row.reminder_rules_json && typeof row.reminder_rules_json === 'object' ? row.reminder_rules_json : {},
  updatedAt: row.updated_at,
})

const articleToDb = (article) => ({
  id: Number(article.id),
  title: article.title,
  category: article.category || null,
  content: article.content,
  updated_at: article.updatedAt,
  author_id: article.authorId ? Number(article.authorId) : null,
})

const articleFromDb = (row) => ({
  id: Number(row.id),
  title: row.title,
  category: row.category || 'Geral',
  content: row.content,
  updatedAt: row.updated_at,
  authorId: row.author_id ? Number(row.author_id) : null,
})

const activityToDb = (entry) => ({
  id: Number(entry.id),
  user_id: entry.userId ? Number(entry.userId) : null,
  actor_id: entry.actorId ? Number(entry.actorId) : null,
  action: entry.action,
  details: entry.details || null,
  created_at: entry.createdAt,
})

const activityFromDb = (row) => ({
  id: Number(row.id),
  userId: row.user_id ? Number(row.user_id) : null,
  actorId: row.actor_id ? Number(row.actor_id) : null,
  action: row.action,
  details: row.details || '',
  createdAt: row.created_at,
})

const notificationToDb = (entry) => ({
  id: Number(entry.id),
  user_id: Number(entry.userId),
  type: entry.type,
  title: entry.title,
  message: entry.message,
  ticket_id: entry.ticketId ? Number(entry.ticketId) : null,
  metadata_json: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
  read_at: entry.readAt || null,
  created_at: entry.createdAt,
})

const notificationFromDb = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  type: row.type,
  title: row.title,
  message: row.message,
  ticketId: row.ticket_id ? Number(row.ticket_id) : null,
  metadata: row.metadata_json && typeof row.metadata_json === 'object' ? row.metadata_json : {},
  readAt: row.read_at,
  createdAt: row.created_at,
})

const internalReminderToDb = (entry) => ({
  id: Number(entry.id),
  attendant_id: Number(entry.attendantId),
  ticket_id: Number(entry.ticketId),
  message: entry.message,
  created_by: entry.createdBy ? Number(entry.createdBy) : null,
  status: entry.status || 'pending',
  resolved_at: entry.resolvedAt || null,
  created_at: entry.createdAt,
})

const internalReminderFromDb = (row) => ({
  id: Number(row.id),
  attendantId: Number(row.attendant_id),
  ticketId: Number(row.ticket_id),
  message: row.message,
  createdBy: row.created_by ? Number(row.created_by) : null,
  status: row.status || 'pending',
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
})

async function clearTables(client) {
  await client.from(TABLES.notifications).delete().gt('id', 0)
  await client.from(TABLES.internalReminders).delete().gt('id', 0)
  await client.from(TABLES.userActivities).delete().gt('id', 0)
  await client.from(TABLES.comments).delete().gt('id', 0)
  await client.from(TABLES.ticketHistory).delete().gt('id', 0)
  await client.from(TABLES.tickets).delete().gt('id', 0)
  await client.from(TABLES.knowledgeArticles).delete().gt('id', 0)
  await client.from(TABLES.users).delete().gt('id', 0)
  await client.from(TABLES.categories).delete().gt('id', 0)
  await client.from(TABLES.settings).delete().gt('id', 0)
}

async function insertRows(client, table, rows) {
  if (!rows.length) {
    return
  }

  const { error } = await client.from(table).insert(rows)

  if (error) {
    const schemaOutdated = /Could not find .* in the schema cache|relation .* does not exist/i.test(error.message)
    const statusConstraintOutdated = /hd_tickets_status_check|violates check constraint/i.test(error.message)
    const priorityConstraintOutdated = /hd_tickets_priority_check|violates check constraint/i.test(error.message)
    const problemTypeConstraintOutdated = /hd_tickets_problem_type_check|problem_type/i.test(error.message)

    if (schemaOutdated && [TABLES.tickets, TABLES.ticketHistory, TABLES.notifications, TABLES.internalReminders].includes(table)) {
      throw new Error(
        'Schema do Supabase desatualizado para tickets. Execute as migracoes 20260318_001_helpdesk_initial.sql, 20260318_002_ticket_workflow_upgrade.sql, 20260318_003_ticket_status_expansion.sql, 20260318_004_ticket_priority_expansion.sql, 20260318_005_ticket_classification.sql e 20260318_006_ticket_automation.sql',
      )
    }

    if (table === TABLES.tickets && statusConstraintOutdated) {
      throw new Error(
        'Constraint de status desatualizada em hd_tickets. Execute a migracao 20260318_003_ticket_status_expansion.sql no Supabase SQL Editor',
      )
    }

    if (table === TABLES.tickets && priorityConstraintOutdated) {
      throw new Error(
        'Constraint de prioridade desatualizada em hd_tickets. Execute a migracao 20260318_004_ticket_priority_expansion.sql no Supabase SQL Editor',
      )
    }

    if (table === TABLES.tickets && problemTypeConstraintOutdated) {
      throw new Error(
        'Schema de classificacao desatualizado em hd_tickets. Execute a migracao 20260318_005_ticket_classification.sql no Supabase SQL Editor',
      )
    }

    throw new Error(`Falha ao inserir em ${table}: ${error.message}`)
  }
}

async function pushStateToSupabase(snapshot) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase nao configurado no backend')
  }

  if (!hasServiceRoleKey()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY e obrigatoria para push de dados')
  }

  const client = getSupabaseClient()

  await clearTables(client)

  await insertRows(client, TABLES.users, snapshot.users.map(userToDb))
  await insertRows(client, TABLES.categories, snapshot.categories.map(categoryToDb))
  await insertRows(client, TABLES.tickets, snapshot.tickets.map(ticketToDb))
  await insertRows(client, TABLES.comments, snapshot.comments.map(commentToDb))
  await insertRows(client, TABLES.ticketHistory, (snapshot.ticketHistory || []).map(ticketHistoryToDb))
  await insertRows(client, TABLES.settings, [settingsToDb(snapshot.settings)])
  await insertRows(client, TABLES.knowledgeArticles, snapshot.knowledgeArticles.map(articleToDb))
  await insertRows(client, TABLES.userActivities, snapshot.userActivities.map(activityToDb))
  await insertRows(client, TABLES.notifications, (snapshot.notifications || []).map(notificationToDb))
  await insertRows(client, TABLES.internalReminders, (snapshot.internalReminders || []).map(internalReminderToDb))

  return {
    users: snapshot.users.length,
    categories: snapshot.categories.length,
    tickets: snapshot.tickets.length,
    comments: snapshot.comments.length,
    ticketHistory: (snapshot.ticketHistory || []).length,
    knowledgeArticles: snapshot.knowledgeArticles.length,
    userActivities: snapshot.userActivities.length,
    notifications: (snapshot.notifications || []).length,
    internalReminders: (snapshot.internalReminders || []).length,
  }
}

async function selectAll(client, table) {
  const { data, error } = await client.from(table).select('*')

  if (error) {
    const schemaOutdated = /Could not find .* in the schema cache|relation .* does not exist/i.test(error.message)

    if (schemaOutdated && [TABLES.tickets, TABLES.ticketHistory, TABLES.notifications, TABLES.internalReminders].includes(table)) {
      throw new Error(
        'Schema do Supabase desatualizado para tickets. Execute as migracoes 20260318_001_helpdesk_initial.sql, 20260318_002_ticket_workflow_upgrade.sql, 20260318_003_ticket_status_expansion.sql, 20260318_004_ticket_priority_expansion.sql, 20260318_005_ticket_classification.sql e 20260318_006_ticket_automation.sql',
      )
    }

    throw new Error(`Falha ao buscar ${table}: ${error.message}`)
  }

  return data || []
}

async function pullStateFromSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase nao configurado no backend')
  }

  if (!hasServiceRoleKey()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY e obrigatoria para pull de dados')
  }

  const client = getSupabaseClient()

  const [
    usersRaw,
    categoriesRaw,
    ticketsRaw,
    commentsRaw,
    ticketHistoryRaw,
    settingsRaw,
    knowledgeArticlesRaw,
    userActivitiesRaw,
    notificationsRaw,
    internalRemindersRaw,
  ] = await Promise.all([
    selectAll(client, TABLES.users),
    selectAll(client, TABLES.categories),
    selectAll(client, TABLES.tickets),
    selectAll(client, TABLES.comments),
    selectAll(client, TABLES.ticketHistory),
    selectAll(client, TABLES.settings),
    selectAll(client, TABLES.knowledgeArticles),
    selectAll(client, TABLES.userActivities),
    selectAll(client, TABLES.notifications),
    selectAll(client, TABLES.internalReminders),
  ])

  const users = usersRaw.map(userFromDb)
  const categories = categoriesRaw.map(categoryFromDb)
  const tickets = ticketsRaw.map(ticketFromDb)
  const comments = commentsRaw.map(commentFromDb)
  const ticketHistory = ticketHistoryRaw.map(ticketHistoryFromDb)
  const knowledgeArticles = knowledgeArticlesRaw.map(articleFromDb)
  const userActivities = userActivitiesRaw.map(activityFromDb)
  const notifications = notificationsRaw.map(notificationFromDb)
  const internalReminders = internalRemindersRaw.map(internalReminderFromDb)

  const settings = settingsRaw[0]
    ? settingsFromDb(settingsRaw[0])
    : {
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
        slaRules: {},
        escalationRules: {},
        reminderRules: {},
        updatedAt: new Date().toISOString(),
      }

  return {
    users,
    categories,
    tickets,
    comments,
    ticketHistory,
    settings,
    knowledgeArticles,
    userActivities,
    notifications,
    internalReminders,
    counters: {
      users: maxId(users),
      tickets: maxId(tickets),
      comments: maxId(comments),
      ticketHistory: maxId(ticketHistory),
      knowledgeArticles: maxId(knowledgeArticles),
      userActivities: maxId(userActivities),
      notifications: maxId(notifications),
      internalReminders: maxId(internalReminders),
    },
  }
}

module.exports = {
  pullStateFromSupabase,
  pushStateToSupabase,
}
