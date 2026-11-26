/**
 * Sinais usados para abrir formulários de criação em módulos carregados sob demanda.
 * A flag no sessionStorage cobre o primeiro mount; o evento cobre o módulo já montado.
 */

const dispatchSoon = (eventName: string) => {
  window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 60);
};

export const requestNewAppointment = () => {
  try {
    sessionStorage.setItem('pk_open_new_appointment', '1');
  } catch {
    // sem sessionStorage: o evento ainda resolve
  }
  dispatchSoon('pk:new-appointment');
};

export const requestNewQuote = () => {
  try {
    sessionStorage.setItem('pk_open_new_quote', '1');
  } catch {
    // sem sessionStorage: o evento ainda resolve
  }
  dispatchSoon('pk:new-quote');
};
