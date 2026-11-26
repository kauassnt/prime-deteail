import type { CompanySettings } from '../types';

export const FALLBACK_COMPANY_NAME = 'PK DETAIL';

type CompanyNameSource = Pick<CompanySettings, 'name' | 'fantasyName'> | null | undefined;

/**
 * Nome exibido da empresa em todo o sistema (menus, documentos, PDFs, portal e mensagens).
 * `fantasyName` é o nome comercial; `name` é apenas a razão social (fallback).
 */
export function companyDisplayName(settings: CompanyNameSource): string {
  const fantasyName = settings?.fantasyName?.trim();
  if (fantasyName) return fantasyName;
  const legalName = settings?.name?.trim();
  if (legalName) return legalName;
  return FALLBACK_COMPANY_NAME;
}
