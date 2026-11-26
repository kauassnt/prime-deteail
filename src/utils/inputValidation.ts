import React from 'react';
import { Motorcycle } from '../types';

export interface FieldValidationResult {
  valid: boolean;
  error?: string;
}

export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  firstError?: string;
}

export function isTouchCoarseDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse =
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        window.matchMedia('(pointer: coarse)').matches);
    return coarse || window.innerWidth < 768;
  } catch {
    return false;
  }
}

/**
 * Foca um elemento sem disparar salto brusco de rolagem nem zoom automático no mobile.
 * Por padrão (`skipOnTouch = true`), evita foco programático automático em telas touch
 * para não abrir o teclado virtual inesperadamente ao abrir modais ou seletores.
 */
export function focusElementSafely(
  element: HTMLElement | null | undefined,
  options?: { skipOnTouch?: boolean; scrollIntoViewIfDesktop?: boolean }
): void {
  if (!element) return;
  const skipOnTouch = options?.skipOnTouch ?? true;
  if (skipOnTouch && isTouchCoarseDevice()) return;

  try {
    element.focus({ preventScroll: true });
    if (options?.scrollIntoViewIfDesktop && !isTouchCoarseDevice()) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch {
    try {
      element.focus();
    } catch {
      // Ignore focus errors on detached elements
    }
  }
}

/**
 * Bloqueia caracteres científicos/inválidos ("e", "E", "+", "-") em campos numéricos positivos.
 */
export function preventInvalidNumericKeys(
  e: React.KeyboardEvent<HTMLInputElement>,
  allowDecimal = false
): void {
  const blocked = allowDecimal ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.', ','];
  if (blocked.includes(e.key)) {
    e.preventDefault();
  }
}

export function sanitizePlateInput(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-');

  // Remove hífen inicial se houver
  const noLeadingHyphen = cleaned.replace(/^-+/, '');
  // Garante no máximo 1 hífen e até 8 caracteres (ex: BRA-2E19 ou ABC1D23)
  const parts = noLeadingHyphen.split('-');
  const rejoined = parts.length > 2 ? `${parts[0]}-${parts.slice(1).join('')}` : noLeadingHyphen;
  return rejoined.slice(0, 8);
}

export function normalizePlateCompact(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatPlateBR(raw: string): string {
  const compact = normalizePlateCompact(raw).slice(0, 7);
  if (compact.length === 7 && /^[A-Z]{3}\d{4}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  }
  return compact;
}

export function validatePlateBR(plate: string, required = true): FieldValidationResult {
  const trimmed = plate.trim();
  const compact = normalizePlateCompact(trimmed);

  if (!compact) {
    return required
      ? { valid: false, error: 'Informe a placa da motocicleta.' }
      : { valid: true };
  }

  if (compact.length !== 7) {
    return {
      valid: false,
      error: 'A placa deve conter 7 caracteres (ex: ABC-1234 ou ABC1D23).',
    };
  }

  const isOldPattern = /^[A-Z]{3}\d{4}$/.test(compact);
  const isMercosulPattern = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(compact);

  if (!isOldPattern && !isMercosulPattern) {
    return {
      valid: false,
      error: 'Formato de placa inválido. Use padrão brasileiro (ABC-1234) ou Mercosul (ABC1D23).',
    };
  }

  return { valid: true };
}

export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function validatePhoneBR(
  phone: string,
  label = 'Telefone',
  required = true
): FieldValidationResult {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return required
      ? { valid: false, error: `Informe o ${label.toLowerCase()} com DDD.` }
      : { valid: true };
  }

  // Aceita DDI 55 opcional (12 ou 13 dígitos) ou DDD + número (10 ou 11 dígitos)
  const localDigits =
    (digits.length === 12 || digits.length === 13) && digits.startsWith('55')
      ? digits.slice(2)
      : digits;

  if (localDigits.length < 10 || localDigits.length > 11) {
    return {
      valid: false,
      error: `${label} deve ter DDD + 8 ou 9 dígitos (ex: (75) 98807-7173).`,
    };
  }

  const ddd = Number(localDigits.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return {
      valid: false,
      error: `DDD inválido em ${label.toLowerCase()}.`,
    };
  }

  if (/^(\d)\1+$/.test(localDigits)) {
    return {
      valid: false,
      error: `${label} inválido (sequência repetida).`,
    };
  }

  return { valid: true };
}

export function validateEmail(email: string, required = false): FieldValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return required ? { valid: false, error: 'Informe um e-mail válido.' } : { valid: true };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Formato de e-mail inválido (ex: nome@dominio.com).' };
  }
  return { valid: true };
}

export function validatePersonName(name: string, label = 'Nome'): FieldValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: `Informe o ${label.toLowerCase()}.` };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: `${label} deve ter pelo menos 2 caracteres.` };
  }
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: `${label} não pode conter apenas números.` };
  }
  return { valid: true };
}

export function parseSafeNumber(
  raw: string | number,
  options?: { min?: number; max?: number; integer?: boolean; fallback?: number }
): number {
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  const fallback = options?.fallback ?? 0;
  if (!Number.isFinite(num)) return fallback;
  let value = options?.integer ? Math.trunc(num) : num;
  if (options?.min !== undefined && value < options.min) value = options.min;
  if (options?.max !== undefined && value > options.max) value = options.max;
  return value;
}

export interface MotorcycleDraftValidationInput {
  brand: string;
  model: string;
  version?: string;
  year?: number;
  manufactureYear?: number;
  modelYear?: number;
  cc?: number;
  plate: string;
  mileage?: number;
}

export function validateMotorcycleDraft(
  draft: MotorcycleDraftValidationInput,
  options?: {
    plateRequired?: boolean;
    existingMotorcycles?: Motorcycle[];
    editingMotoId?: string;
  }
): FormValidationResult {
  const errors: Record<string, string> = {};
  const plateRequired = options?.plateRequired ?? true;
  const maxYear = new Date().getFullYear() + 1;

  if (!draft.brand || draft.brand.trim().length < 2) {
    errors.brand = 'Selecione ou digite a marca da motocicleta (mín. 2 caracteres).';
  }

  if (!draft.model || draft.model.trim().length < 1) {
    errors.model = 'Selecione ou informe o modelo da motocicleta.';
  }

  const plateCheck = validatePlateBR(draft.plate || '', plateRequired);
  if (!plateCheck.valid && plateCheck.error) {
    errors.plate = plateCheck.error;
  } else if (options?.existingMotorcycles && normalizePlateCompact(draft.plate || '')) {
    const compact = normalizePlateCompact(draft.plate || '');
    const duplicate = options.existingMotorcycles.find(
      m => m.id !== options.editingMotoId && normalizePlateCompact(m.plate) === compact
    );
    if (duplicate) {
      errors.plate = `A placa ${duplicate.plate} já está cadastrada (${duplicate.brand} ${duplicate.model} · ${duplicate.clientName}).`;
    }
  }

  const ccVal = Number(draft.cc ?? 0);
  if (!Number.isFinite(ccVal) || ccVal < 49 || ccVal > 3000) {
    errors.cc = 'Informe uma cilindrada válida entre 49 cc e 3000 cc.';
  }

  const mfgYear = Number(draft.manufactureYear || draft.year || new Date().getFullYear());
  const modYear = Number(draft.modelYear || draft.year || new Date().getFullYear());

  if (!Number.isFinite(mfgYear) || mfgYear < 1950 || mfgYear > maxYear) {
    errors.manufactureYear = `Ano de fabricação deve estar entre 1950 e ${maxYear}.`;
  }
  if (!Number.isFinite(modYear) || modYear < 1950 || modYear > maxYear) {
    errors.modelYear = `Ano/modelo deve estar entre 1950 e ${maxYear}.`;
  } else if (Number.isFinite(mfgYear) && modYear < mfgYear - 1) {
    errors.modelYear = 'Ano/modelo não pode ser anterior ao ano de fabricação.';
  }

  if (draft.mileage !== undefined) {
    const km = Number(draft.mileage);
    if (!Number.isFinite(km) || km < 0 || km > 999999) {
      errors.mileage = 'Quilometragem deve estar entre 0 e 999.999 km.';
    }
  }

  const keys = Object.keys(errors);
  return {
    valid: keys.length === 0,
    errors,
    firstError: keys.length > 0 ? errors[keys[0]] : undefined,
  };
}
