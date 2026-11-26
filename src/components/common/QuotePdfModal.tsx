import React from 'react';
import { companyDisplayName } from '../../utils/company';

import { ArrowLeft, Download, Share2, MessageCircle } from 'lucide-react';
import { PrintableDocumentHeader } from './PrintableDocumentHeader';
import { useApp } from '../../context/AppContext';
import { formatDateBR } from '../../utils/dateUtils';
import { buildWhatsappLink } from '../../utils/whatsappUtils';
import { documentOnAccent, resolveDocumentColor } from '../../utils/documentTheme';
import { alertDialog } from '../../services/dialogService';

export interface QuotePdfData {
  id: string;
  createdAt: string;
  validUntil: string;
  clientName: string;
  motorcycleLabel: string;
  plate: string;
  services: { serviceId: string; name: string; price: number }[];
  subtotal: number;
  discountPercent: number;
  total: number;
  notes?: string;
}

interface QuotePdfModalProps {
  quote: QuotePdfData | null;
  clientPhone?: string;
  onClose: () => void;
}

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatLongDateBR = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const QuotePdfModal: React.FC<QuotePdfModalProps> = ({ quote, clientPhone, onClose }) => {
  const { settings, services: serviceCatalog } = useApp();

  if (!quote) return null;

  const showServiceDescriptions = settings.showServiceDescriptions === true;
  const serviceDescriptionById = new Map(
    serviceCatalog.filter(s => s.description).map(s => [s.id, s.description] as const)
  );
  const companyName = companyDisplayName(settings);
  const documentColor = resolveDocumentColor(settings.documentColor);
  const onAccent = documentOnAccent(settings.documentColor);

  const buildMessage = () =>
    [
      `*Orçamento ${quote.id} — ${companyName}*`,
      '',
      `Cliente: ${quote.clientName}`,
      `Veículo: ${quote.motorcycleLabel}`,
      `Placa: ${quote.plate}`,
      '',
      '*Serviços:*',
      ...quote.services.map(s => `• ${s.name}: ${brl(s.price)}`),
      '',
      `Subtotal: ${brl(quote.subtotal)}`,
      quote.discountPercent > 0 ? `Desconto: ${quote.discountPercent}%` : '',
      `*Total: ${brl(quote.total)}*`,
      '',
      `Válido até ${formatLongDateBR(quote.validUntil)}.`,
    ]
      .filter(Boolean)
      .join('\n');

  const handleShare = async () => {
    const text = buildMessage();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Orçamento ${quote.id}`, text });
        return;
      } catch {
        // usuário cancelou o compartilhamento
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      await alertDialog('Resumo do orçamento copiado. Cole no app que preferir.', {
        title: 'Orçamento copiado'
      });
    } catch {
      await alertDialog('Não foi possível compartilhar automaticamente neste navegador.', {
        title: 'Não foi possível compartilhar'
      });
    }
  };

  return (
    <div className="print-root-reset fixed inset-x-0 top-0 z-50 w-full h-[var(--vvh,100dvh)] bg-[#F1F5F9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="no-print sticky top-0 z-30 bg-[#171717] text-white px-3 sm:px-5 py-2.5 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] px-2.5 rounded-lg hover:bg-white/10 text-xs font-bold flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
        <span className="text-sm font-bold truncate">PDF do Orçamento</span>
      </header>

      {/* A4 sheet */}
      <div className="print-root-reset flex-1 overflow-y-auto pk-scroll-compact bg-slate-200/80 py-4 px-2.5 sm:px-6 print:p-0 print:bg-white">
        <div className="print-container print-root-reset w-full max-w-[210mm] mx-auto bg-white text-slate-900 rounded-xl shadow-xl border border-slate-300/80 print:shadow-none print:border-none print:rounded-none print:max-w-none overflow-hidden">
          <div className="p-6 sm:p-8 print:p-0 print:pt-2 space-y-4 text-left">
            {/* Cabeçalho oficial unificado (logo, cor e contatos ao vivo de Minha Empresa) */}
            <PrintableDocumentHeader
              documentTypeLabel="Orçamento de Serviços"
              documentCode={quote.id}
              issuedAt={quote.createdAt}
              badges={[{ label: `Válido até ${formatDateBR(quote.validUntil)}` }]}
            />

            {/* Client table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden print-avoid-break">
              <div
                className="grid grid-cols-2 text-[9.5px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: documentColor, color: onAccent }}
              >
                <span className="px-2.5 py-1.5 border-r border-white/20">Cliente</span>
                <span className="px-2.5 py-1.5">Informações</span>
              </div>
              {[
                { label: 'Cliente', value: quote.clientName },
                { label: 'Veículo', value: quote.motorcycleLabel },
                { label: 'Placa', value: quote.plate },
                { label: 'Validade', value: formatDateBR(quote.validUntil) },
              ].map(row => (
                <div
                  key={row.label}
                  className="grid grid-cols-2 text-[10px] border-t border-slate-200 first:border-t-0"
                >
                  <span className="px-2.5 py-1.5 font-bold text-slate-800 bg-slate-50 border-r border-slate-200">
                    {row.label}
                  </span>
                  <span className="px-2.5 py-1.5 text-slate-700">{row.value || '-'}</span>
                </div>
              ))}
            </div>

            {/* Services table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden print-avoid-break">
              <div
                className="grid grid-cols-12 text-[9.5px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: documentColor, color: onAccent }}
              >
                <span className="col-span-7 px-2.5 py-1.5 border-r border-white/20">Serviço</span>
                <span className="col-span-2 px-2.5 py-1.5 text-right border-r border-white/20">Original</span>
                <span className="col-span-3 px-2.5 py-1.5 text-right">Final</span>
              </div>

              {quote.services.map(line => (
                <div key={line.serviceId} className="grid grid-cols-12 text-[10px] border-t border-slate-200">
                  <span className="col-span-7 px-2.5 py-1.5 text-slate-800 border-r border-slate-200">
                    <span className="block">{line.name}</span>
                    {showServiceDescriptions && serviceDescriptionById.get(line.serviceId) && (
                      <span className="block text-[8.5px] leading-snug text-slate-500 mt-0.5">
                        {serviceDescriptionById.get(line.serviceId)}
                      </span>
                    )}
                  </span>
                  <span className="col-span-2 px-2.5 py-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                    {brl(line.price)}
                  </span>
                  <span className="col-span-3 px-2.5 py-1.5 text-right font-mono text-slate-700">{brl(line.price)}</span>
                </div>
              ))}

              <div className="grid grid-cols-12 text-[10px] font-bold border-t border-slate-200 bg-slate-50">
                <span className="col-span-9 px-2.5 py-1.5 text-slate-700 border-r border-slate-200">Subtotal</span>
                <span className="col-span-3 px-2.5 py-1.5 text-right font-mono text-slate-800">{brl(quote.subtotal)}</span>
              </div>

              {quote.discountPercent > 0 && (
                <div className="grid grid-cols-12 text-[10px] font-bold border-t border-slate-200 bg-slate-50">
                  <span className="col-span-9 px-2.5 py-1.5 text-slate-700 border-r border-slate-200">
                    Desconto ({quote.discountPercent}%)
                  </span>
                  <span className="col-span-3 px-2.5 py-1.5 text-right font-mono text-slate-800">
                    - {brl(quote.subtotal - quote.total)}
                  </span>
                </div>
              )}

              <div
                className="grid grid-cols-12 text-[10.5px] font-black border-t-4 bg-slate-200/70"
                style={{ borderTopColor: documentColor }}
              >
                <span className="col-span-9 px-2.5 py-2 text-slate-900 border-r border-slate-300">Valor Total</span>
                <span className="col-span-3 px-2.5 py-2 text-right font-mono text-slate-900">{brl(quote.total)}</span>
              </div>
            </div>

            {quote.notes && (
              <div className="border border-slate-300 rounded-lg px-2.5 py-2 print-avoid-break">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Observações</p>
                <p className="text-[10px] text-slate-700 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            <p className="text-[9.5px] text-slate-600">
              Este orçamento é válido somente até o dia {formatLongDateBR(quote.validUntil)}.
            </p>

            <footer className="pt-2 border-t border-slate-300 text-[8.5px] text-slate-500 text-center">
              Documento emitido por {companyName}
            </footer>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="no-print shrink-0 bg-white border-t border-slate-200 px-3 py-2.5 space-y-2 safe-area-bottom">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 min-h-[44px] rounded-xl bg-[#171717] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Baixar PDF</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex-1 min-h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.open(buildWhatsappLink(clientPhone, buildMessage()), '_blank', 'noopener,noreferrer')}
          className="w-full min-h-[44px] rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Enviar no WhatsApp</span>
        </button>
      </div>
    </div>
  );
};
