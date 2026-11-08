-- RF-PAG / D27: RKMed owns recurring charges; Wedea retains its fixed share.
create table private.wedea_shares (
  invoice_id text primary key check (invoice_id ~ '^in_[A-Za-z0-9]+$'),
  member_id uuid not null references private.members(id),
  customer_id text not null, subscription_id text not null,
  active_members bigint not null check (active_members >= 0),
  paid_amount bigint not null check (paid_amount >= 0),
  amount_cents integer not null check (amount_cents in (0,1587)),
  status text not null check (status in ('skipped','pending','sending','sent','review')),
  destination text, charge_id text, use_source boolean, transfer_id text unique,
  owner uuid, lease_until timestamptz, first_attempt_at timestamptz,
  created_at timestamptz not null default now(), completed_at timestamptz,
  check ((amount_cents=0 and status='skipped') or (amount_cents=1587 and status<>'skipped'))
);
alter table private.wedea_shares enable row level security;
revoke all on private.wedea_shares from public,anon,authenticated,service_role;

create function public.rk_sync_apply_wedea(p_sync jsonb,p_paid_invoice text,p_paid_subscription text,p_paid_amount bigint)
returns void language plpgsql security definer set search_path='' as $$
declare mid uuid := (p_sync->>'p_member')::uuid; total bigint; customer text;
begin
  perform private.service_only();
  -- Serializes concurrent paid-member reconciliation/threshold decisions.
  perform pg_advisory_xact_lock(1587,200);
  perform public.rk_sync_apply(mid,(p_sync->>'p_owner')::uuid,p_sync->>'p_subscription',p_sync->>'p_state',
    (p_sync->>'p_paid_through')::timestamptz,(p_sync->>'p_cancel')::boolean,p_sync->>'p_invoice',(p_sync->>'p_amount')::bigint);
  select customer_id into customer from private.subscriptions where member_id=mid;
  if customer is null or p_paid_subscription is null or p_paid_subscription !~ '^sub_[A-Za-z0-9]+$'
    or p_paid_amount is null or p_paid_amount<0 then raise exception 'Pagamento inválido'; end if;
  if exists(select 1 from private.wedea_shares where invoice_id=p_paid_invoice and
    (member_id<>mid or customer_id<>customer or subscription_id<>p_paid_subscription or paid_amount<>p_paid_amount)) then
    raise exception 'Fatura já vinculada a outro pagamento';
  end if;
  select count(*) into total from private.members m join private.subscriptions s on s.member_id=m.id
    where not m.blocked and s.state='active' and s.paid_through>now();
  insert into private.wedea_shares(invoice_id,member_id,customer_id,subscription_id,active_members,paid_amount,amount_cents,status)
    values(p_paid_invoice,mid,customer,p_paid_subscription,total,p_paid_amount,
      case when total>200 and p_paid_amount>0 then 1587 else 0 end,
      case when total>200 and p_paid_amount>0 then 'pending' else 'skipped' end)
    on conflict(invoice_id) do nothing;
  if found then perform private.log('billing.wedea.decision',mid); end if;
end $$;

create function public.rk_wedea_get(p_invoice text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return (select to_jsonb(s) from private.wedea_shares s where invoice_id=p_invoice);
end $$;

create function public.rk_wedea_claim(p_invoice text,p_owner uuid,p_destination text,p_charge text,p_use_source boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.wedea_shares;
begin
  perform private.service_only();
  if p_owner is null or p_destination is null or p_destination !~ '^acct_[A-Za-z0-9]+$'
    or p_charge is null or p_charge !~ '^ch_[A-Za-z0-9]+$' or p_use_source is null then raise exception 'Repasse inválido'; end if;
  select * into s from private.wedea_shares where invoice_id=p_invoice for update;
  if not found or s.status not in ('pending','sending') then return null; end if;
  if s.first_attempt_at<=now()-interval '23 hours' then
    update private.wedea_shares set status='review',owner=null,lease_until=null where invoice_id=p_invoice;
    perform private.log('billing.wedea.review',s.member_id);
    return null;
  end if;
  if s.lease_until>now() then return null; end if;
  if s.destination is not null and (s.destination<>p_destination or s.charge_id<>p_charge or s.use_source<>p_use_source) then
    raise exception 'Parâmetros do repasse não podem mudar';
  end if;
  update private.wedea_shares set status='sending',owner=p_owner,lease_until=now()+interval '2 minutes',
    destination=p_destination,charge_id=p_charge,use_source=p_use_source,first_attempt_at=coalesce(first_attempt_at,now())
    where invoice_id=p_invoice returning * into s;
  return to_jsonb(s);
end $$;

create function public.rk_wedea_complete(p_invoice text,p_owner uuid,p_transfer text)
returns void language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
  perform private.service_only();
  if p_transfer is null or p_transfer !~ '^tr_[A-Za-z0-9]+$' then raise exception 'Transferência inválida'; end if;
  update private.wedea_shares set status='sent',transfer_id=p_transfer,completed_at=now(),owner=null,lease_until=null
    where invoice_id=p_invoice and owner=p_owner and status='sending' returning member_id into mid;
  if not found then raise exception 'Repasse sem reserva válida'; end if;
  perform private.log('billing.wedea.sent',mid);
end $$;

create function public.rk_wedea_pending() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return (select coalesce(jsonb_agg(invoice_id),'[]'::jsonb) from
    (select invoice_id from private.wedea_shares where status in ('pending','sending') and (lease_until is null or lease_until<now())
      order by created_at limit 100) s);
end $$;

revoke all on function public.rk_sync_apply_wedea(jsonb,text,text,bigint),public.rk_wedea_get(text),
  public.rk_wedea_claim(text,uuid,text,text,boolean),public.rk_wedea_complete(text,uuid,text),public.rk_wedea_pending()
  from public,anon,authenticated;
grant execute on function public.rk_sync_apply_wedea(jsonb,text,text,bigint),public.rk_wedea_get(text),
  public.rk_wedea_claim(text,uuid,text,text,boolean),public.rk_wedea_complete(text,uuid,text),public.rk_wedea_pending()
  to service_role;
