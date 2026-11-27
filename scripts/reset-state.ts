/**
 * Zera os dados operacionais do sistema no Supabase, mantendo usuários,
 * configurações da empresa, portal, permissões, catálogo de motos e identidade.
 *
 * Uso (com as variáveis do Supabase no ambiente):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run reset:state
 *
 * O formato gravado é o mesmo do app: a coluna `value` guarda a string JSON
 * do valor como o localStorage espera (dupla codificação).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TABLE = 'pk_kv';
const NS = 'state';

async function put(name: string, data: unknown): Promise<void> {
  const value = JSON.stringify(JSON.stringify(data));
  const { error } = await supabase.from(TABLE).upsert(
    { namespace: NS, key: `key:${name}`, value, updated_at: new Date().toISOString() },
    { onConflict: 'namespace,key' }
  );
  if (error) throw new Error(`${name}: ${error.message}`);
}

async function main(): Promise<void> {
  const admin = {
    id: 'usr_1',
    name: 'Administrador',
    phone: '',
    email: 'ricardo@pkdetail.com.br',
    role: 'admin',
    active: true,
    hireDate: '',
    specialties: [] as string[],
    commissionType: 'none',
    commissionValue: 0,
  };

  // Dados operacionais zerados.
  const emptyArrays: Array<[string, unknown[]]> = [
    ['pk_detail_clients_v1', []],
    ['pk_detail_motorcycles_v1', []],
    ['pk_detail_services_v1', []],
    ['pk_detail_products_v1', []],
    ['pk_detail_stock_movs_v1', []],
    ['pk_detail_orders_v1', []],
    ['pk_detail_appointments_v1', []],
    ['pk_detail_expenses_v1', []],
    ['pk_detail_cash_history_v1', []],
    ['pk_detail_commissions_v1', []],
    ['pk_detail_coupons_v1', []],
    ['pk_detail_audit_logs_v1', []],
    ['pk_detail_whatsapp_logs_v1', []],
    ['pk_detail_quotes_v1', []],
    ['pk_detail_notifications_v1', []],
  ];

  for (const [name, value] of emptyArrays) {
    await put(name, value);
  }

  await put('pk_detail_users_v1', [admin]);
  await put('pk_detail_cash_register_v1', {
    id: '',
    openedAt: '',
    status: 'fechado',
    operatorId: '',
    operatorName: '',
    initialBalance: 0,
    totalIn: 0,
    totalOut: 0,
    expectedBalance: 0,
    movements: [],
    notes: '',
  });
  await put('pk_detail_goals_v1', { enabled: false, goals: {} });

  // Atualiza a lista de chaves conhecidas (sem duplicar).
  const { data: keysRow, error: keysError } = await supabase
    .from(TABLE)
    .select('value')
    .eq('namespace', NS)
    .eq('key', '__keys')
    .maybeSingle();
  if (keysError) throw new Error(keysError.message);
  const current: string[] = keysRow?.value ? (JSON.parse(keysRow.value) as string[]) : [];
  const allNames = new Set<string>(current);
  for (const [name] of emptyArrays) allNames.add(name);
  allNames.add('pk_detail_users_v1');
  allNames.add('pk_detail_cash_register_v1');
  allNames.add('pk_detail_goals_v1');

  const allKeys = [...allNames];
  await supabase.from(TABLE).upsert(
    { namespace: NS, key: '__keys', value: JSON.stringify(allKeys), updated_at: new Date().toISOString() },
    { onConflict: 'namespace,key' }
  );

  // Incrementa a revisão para os clientes sincronizarem.
  const { data: revRow } = await supabase
    .from(TABLE)
    .select('value')
    .eq('namespace', NS)
    .eq('key', '__revision')
    .maybeSingle();
  const nextRev = (revRow?.value ? Number(JSON.parse(revRow.value)) || 0 : 0) + 1;
  await supabase.from(TABLE).upsert(
    { namespace: NS, key: '__revision', value: JSON.stringify(nextRev), updated_at: new Date().toISOString() },
    { onConflict: 'namespace,key' }
  );
  await supabase.from(TABLE).upsert(
    {
      namespace: NS,
      key: '__updatedAt',
      value: JSON.stringify(new Date().toISOString()),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'namespace,key' }
  );

  console.log(`Estado zerado no Supabase. Revisão: ${nextRev}. ${allKeys.length} chaves.`);
}

void main().catch(error => {
  console.error('Falha ao zerar o estado:', (error as Error)?.message || error);
  process.exit(1);
});
