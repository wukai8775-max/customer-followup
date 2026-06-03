-- Customer follow-up manager shared-password database schema.
-- Run this file in the Supabase SQL Editor for a clean shared-password deployment.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  country text not null default '',
  source text not null default '',
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  product text not null default '',
  amount numeric(12,2) not null default 0,
  payment_status text not null default '未支付',
  payment_date timestamptz,
  order_status text not null default '待沟通',
  tracking_number text,
  logistics_company text,
  logistics_status text,
  logistics_updated_at timestamptz,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  communicated_at timestamptz not null default now(),
  content text not null,
  next_follow_up_at timestamptz,
  follower_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.settings_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Remove columns and objects from the older per-user Auth version if this SQL is run on a reused project.
alter table public.customers drop column if exists created_by;
alter table public.orders drop column if exists created_by;
alter table public.communications drop column if exists created_by;

drop table if exists public.user_profiles cascade;
drop schema if exists private cascade;
drop type if exists public.app_role cascade;

create index if not exists customers_deleted_at_idx on public.customers(deleted_at);
create index if not exists customers_tags_idx on public.customers using gin(tags);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(order_status);
create index if not exists orders_next_follow_up_idx on public.orders(next_follow_up_at);
create index if not exists orders_logistics_status_idx on public.orders(logistics_status);
create index if not exists communications_customer_id_idx on public.communications(customer_id);
create index if not exists settings_options_category_idx on public.settings_options(category);

with duplicated_options as (
  select id,
         row_number() over (partition by category, value order by created_at, id) as row_number
  from public.settings_options
  where deleted_at is null
)
update public.settings_options
set deleted_at = now()
where id in (
  select id
  from duplicated_options
  where row_number > 1
);

create unique index if not exists settings_options_category_value_active_idx
on public.settings_options(category, value)
where deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_communications_updated_at on public.communications;
create trigger set_communications_updated_at
before update on public.communications
for each row execute function public.set_updated_at();

drop trigger if exists set_settings_options_updated_at on public.settings_options;
create trigger set_settings_options_updated_at
before update on public.settings_options
for each row execute function public.set_updated_at();

drop policy if exists "active users can read customers" on public.customers;
drop policy if exists "active users can insert customers" on public.customers;
drop policy if exists "active users can update customers" on public.customers;
drop policy if exists "active users can read orders" on public.orders;
drop policy if exists "active users can insert orders" on public.orders;
drop policy if exists "active users can update orders" on public.orders;
drop policy if exists "active users can read communications" on public.communications;
drop policy if exists "active users can insert communications" on public.communications;
drop policy if exists "active users can update communications" on public.communications;
drop policy if exists "active users can read settings" on public.settings_options;
drop policy if exists "admins can insert settings" on public.settings_options;
drop policy if exists "admins can update settings" on public.settings_options;

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.communications enable row level security;
alter table public.settings_options enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.communications from anon, authenticated;
revoke all on public.settings_options from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.communications to service_role;
grant select, insert, update, delete on public.settings_options to service_role;

insert into public.settings_options (category, value, sort_order)
values
  ('countries', '美国', 1),
  ('countries', '加拿大', 2),
  ('countries', '英国', 3),
  ('countries', '德国', 4),
  ('countries', '法国', 5),
  ('countries', '澳大利亚', 6),
  ('sources', '独立站', 1),
  ('sources', 'WhatsApp', 2),
  ('sources', 'Facebook', 3),
  ('sources', 'Instagram', 4),
  ('sources', 'TikTok', 5),
  ('sources', '老客户介绍', 6),
  ('tags', '高意向', 1),
  ('tags', '待报价', 2),
  ('tags', '已成交', 3),
  ('tags', '复购', 4),
  ('tags', '重点客户', 5),
  ('logistics_companies', 'DHL', 1),
  ('logistics_companies', 'FedEx', 2),
  ('logistics_companies', 'UPS', 3),
  ('logistics_companies', 'USPS', 4),
  ('logistics_companies', '顺丰', 5),
  ('logistics_companies', '云途', 6)
on conflict do nothing;
