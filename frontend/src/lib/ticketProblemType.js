export const TICKET_PROBLEM_TYPE_OPTIONS = [
  { value: 'access_issue', label: 'Acesso' },
  { value: 'billing_issue', label: 'Financeiro' },
  { value: 'bug', label: 'Erro funcional' },
  { value: 'performance_issue', label: 'Performance' },
  { value: 'integration_issue', label: 'Integracao' },
  { value: 'infrastructure_issue', label: 'Infraestrutura' },
  { value: 'service_request', label: 'Solicitacao de servico' },
  { value: 'question', label: 'Duvida' },
  { value: 'other', label: 'Outro' },
]

export const TICKET_PROBLEM_TYPE_LABELS = Object.fromEntries(
  TICKET_PROBLEM_TYPE_OPTIONS.map((problemTypeOption) => [problemTypeOption.value, problemTypeOption.label]),
)

export function getTicketProblemTypeLabel(problemType) {
  if (!problemType) {
    return 'Outro'
  }

  return TICKET_PROBLEM_TYPE_LABELS[problemType] || problemType
}
