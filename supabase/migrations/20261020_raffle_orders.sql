-- Supabase migration: shared raffle orders and number reservations
create extension if not exists pgcrypto;

create table if not exists public.raffle_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled','expired','legacy_paid')),
  pix_txid text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz,
  notes text
);

create table if not exists public.raffle_order_numbers (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.raffle_orders(id) on delete cascade,
  number integer not null check (number > 0),
  created_at timestamptz not null default now(),
  unique (number)
);

create index if not exists raffle_orders_status_created_idx
  on public.raffle_orders(status, created_at desc);
create index if not exists raffle_order_numbers_order_id_idx
  on public.raffle_order_numbers(order_id);

alter table public.raffle_orders enable row level security;
alter table public.raffle_order_numbers enable row level security;
-- No anon/authenticated policies are intentionally created. Only server-side
-- API functions using SUPABASE_SERVICE_ROLE_KEY should read/write these tables.

-- Atomic reservation: unique(number) prevents two concurrent orders from
-- reserving the same number. Any conflict rolls back the whole function.
create or replace function public.reserve_raffle_order(
  p_order_code text,
  p_customer_name text,
  p_customer_phone text,
  p_amount numeric,
  p_numbers integer[],
  p_expires_at timestamptz default (now() + interval '20 minutes')
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_number integer;
begin
  if p_numbers is null or cardinality(p_numbers) = 0 then
    raise exception 'Escolha pelo menos um número.';
  end if;

  if cardinality(p_numbers) <> (select count(distinct x) from unnest(p_numbers) as t(x)) then
    raise exception 'Há números repetidos no pedido.';
  end if;

  insert into raffle_orders(order_code, customer_name, customer_phone, amount, status, expires_at)
  values (p_order_code, p_customer_name, p_customer_phone, p_amount, 'pending', p_expires_at)
  returning id into v_order_id;

  foreach v_number in array p_numbers loop
    insert into raffle_order_numbers(order_id, number) values (v_order_id, v_number);
  end loop;

  return jsonb_build_object('id', v_order_id, 'order_code', p_order_code, 'status', 'pending');
end;
$$;

revoke all on function public.reserve_raffle_order(text,text,text,numeric,integer[],timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_raffle_order(text,text,text,numeric,integer[],timestamptz) to service_role;

-- Legacy sold numbers can be imported after creating a placeholder order for
-- each number, or by an admin import script. Do not guess customer/order data.
