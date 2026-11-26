/**
 * Diálogos do sistema (confirmar / avisar) com visual próprio do PK Detail.
 * Substitui window.confirm / window.alert / window.prompt nativos feios.
 */

export type DialogTone = 'default' | 'danger';

export interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

interface DialogEntry {
  id: number;
  kind: 'confirm' | 'alert';
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  resolve: (value: boolean) => void;
}

let current: DialogEntry | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach(listener => listener());
};

export function subscribeDialog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDialogSnapshot(): DialogEntry | null {
  return current;
}

export function resolveDialog(value: boolean) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(value);
}

/** Pergunta Sim/Não com o visual do sistema. Resolve true quando confirma. */
export function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    current = {
      id: nextId++,
      kind: 'confirm',
      message,
      title: options.title || 'Confirmar ação',
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      tone: options.tone || 'default',
      resolve,
    };
    emit();
  });
}

/** Aviso simples com um único botão. */
export function alertDialog(message: string, options: DialogOptions = {}): Promise<void> {
  return new Promise<void>(resolve => {
    current = {
      id: nextId++,
      kind: 'alert',
      message,
      title: options.title || 'Aviso',
      confirmLabel: options.confirmLabel || 'Entendi',
      cancelLabel: options.cancelLabel || 'Cancelar',
      tone: options.tone || 'default',
      resolve: () => resolve(),
    };
    emit();
  });
}
