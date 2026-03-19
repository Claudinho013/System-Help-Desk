export const TICKET_STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_analysis', label: 'Em analise' },
  { value: 'in_service', label: 'Em atendimento' },
  { value: 'waiting_customer', label: 'Aguardando cliente' },
  { value: 'waiting_third_party', label: 'Aguardando terceiro' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
  { value: 'cancelled', label: 'Cancelado' },
]

export const TICKET_STATUS_LABELS = Object.fromEntries(
  TICKET_STATUS_OPTIONS.map((statusOption) => [statusOption.value, statusOption.label]),
)

export function getTicketStatusLabel(status) {
  if (!status) {
    return 'Aberto'
  }

  return TICKET_STATUS_LABELS[status] || status
}
