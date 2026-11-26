import type { ServiceOrder } from '../types';

/** Colunas do Pátio — cada OS aparece em exatamente uma delas. */
export type PatioStage = 'para_fazer' | 'em_servico' | 'concluido' | 'pago';

/**
 * Coluna única da OS no Pátio (evita o mesmo cartão em duas colunas).
 * - entregue → Pago / Quitado
 * - demais etapas → coluna do próprio status
 * - OS cancelada não aparece no pátio
 */
export function patioStageOf(order: ServiceOrder): PatioStage | null {
  if (order.status === 'cancelado') return null;
  if (order.status === 'entregue') return 'pago';
  if (order.status === 'concluido') return 'concluido';
  if (order.status === 'em_servico') return 'em_servico';
  return 'para_fazer';
}
