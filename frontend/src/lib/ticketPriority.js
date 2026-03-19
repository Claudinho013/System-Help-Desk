export const TICKET_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' },
]

export const TICKET_PRIORITY_LABELS = Object.fromEntries(
  TICKET_PRIORITY_OPTIONS.map((priorityOption) => [priorityOption.value, priorityOption.label]),
)

export function getTicketPriorityLabel(priority) {
  if (!priority) {
    return 'Media'
  }

  return TICKET_PRIORITY_LABELS[priority] || priority
}
