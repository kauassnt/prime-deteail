export type PatioFocusTab = 'para_fazer' | 'em_servico' | 'concluido' | 'pago';

let pendingFocus: PatioFocusTab | null = null;

/** Marca a coluna que o Pátio deve destacar ao abrir (null limpa o pedido). */
export function requestPatioFocus(tab: PatioFocusTab | null) {
  pendingFocus = tab;
}

/**
 * Lê o pedido de foco sem consumir: a montagem do Pátio pode rodar duas vezes
 * (React StrictMode) e precisa do mesmo valor nas duas.
 */
export function peekPatioFocus(): PatioFocusTab | null {
  return pendingFocus;
}

/** Limpa o pedido depois que o destaque foi aplicado. */
export function clearPatioFocus() {
  pendingFocus = null;
}
