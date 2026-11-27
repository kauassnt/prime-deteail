-- Rode este SQL uma vez no SQL Editor do seu projeto Supabase.
create table if not exists pk_kv (
  namespace text not null,
  key       text not null,
  value     text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (namespace, key)
);

create index if not exists pk_kv_expires_idx on pk_kv (expires_at);
