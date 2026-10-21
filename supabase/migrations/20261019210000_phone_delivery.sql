-- Channel choice belongs to a short-lived server intent, never editable user metadata.
create table private.phone_delivery_intents (
  phone_hash bytea primary key, channel text not null check(channel in ('whatsapp','sms')),
  created_at timestamptz not null default now(), claimed boolean not null default false
);
alter table private.phone_delivery_intents enable row level security;
revoke all on private.phone_delivery_intents from public,anon,authenticated;
create function public.rk_phone_prepare(p_phone text,p_channel text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_channel not in ('whatsapp','sms') then raise exception 'Telefone ou canal inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_phone,0));
  if exists(select 1 from private.phone_delivery_intents where phone_hash=extensions.digest(p_phone,'sha256') and created_at>now()-interval '60 seconds') then raise exception 'Aguarde 60 segundos antes de reenviar.'; end if;
  insert into private.phone_delivery_intents(phone_hash,channel) values(extensions.digest(p_phone,'sha256'),p_channel)
    on conflict(phone_hash) do update set channel=excluded.channel,created_at=now(),claimed=false;
end $$;
create function public.rk_phone_claim(p_phone text) returns text language plpgsql security definer set search_path='' as $$
declare channel text;
begin
  perform private.service_only();
  update private.phone_delivery_intents set claimed=true where phone_hash=extensions.digest(p_phone,'sha256') and not claimed and created_at>now()-interval '5 minutes' returning phone_delivery_intents.channel into channel;
  if channel is null then raise exception 'Solicitação de entrega ausente ou expirada'; end if;
  return channel;
end $$;
revoke all on function public.rk_phone_prepare(text,text),public.rk_phone_claim(text) from public,anon,authenticated;
grant execute on function public.rk_phone_prepare(text,text),public.rk_phone_claim(text) to service_role;
