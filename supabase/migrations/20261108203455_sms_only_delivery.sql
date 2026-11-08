-- User decision: phone OTP is delivered only by SMS.
-- Pending delivery intents are ephemeral and must not retain the previous channel.
delete from private.phone_delivery_intents where channel <> 'sms';
alter table private.phone_delivery_intents
  drop constraint phone_delivery_intents_channel_check;
alter table private.phone_delivery_intents
  add constraint phone_delivery_intents_channel_check check (channel = 'sms');

create or replace function public.rk_phone_prepare(p_phone text,p_channel text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_channel is distinct from 'sms' then
    raise exception 'Telefone ou canal inválido';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_phone,0));
  if exists(select 1 from private.phone_delivery_intents where phone_hash=extensions.digest(p_phone,'sha256') and created_at>now()-interval '60 seconds') then
    raise exception 'Aguarde 60 segundos antes de reenviar.';
  end if;
  insert into private.phone_delivery_intents(phone_hash,channel) values(extensions.digest(p_phone,'sha256'),'sms')
    on conflict(phone_hash) do update set channel=excluded.channel,created_at=now(),claimed=false;
end $$;
revoke all on function public.rk_phone_prepare(text,text) from public,anon,authenticated;
grant execute on function public.rk_phone_prepare(text,text) to service_role;
