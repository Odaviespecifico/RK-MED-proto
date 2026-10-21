-- RF-ADM/DG/NOT: publish a coarse invalidation signal, never private provider/member rows.
create function private.can_read_operations() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from private.roles r join auth.sessions s on s.user_id=r.user_id
    left join private.staff_activity a on a.session_id=s.id
    where r.user_id=auth.uid() and r.active and r.role in ('admin','support')
      and s.id=nullif(auth.jwt()->>'session_id','')::uuid
      and (s.not_after is null or s.not_after>now())
      and s.created_at+interval '8 hours'>now()
      and coalesce(a.last_seen,s.created_at)+interval '30 minutes'>now()
  );
$$;
revoke all on function private.can_read_operations() from public,anon;
grant execute on function private.can_read_operations() to authenticated;

create table public.rk_operational_signal (
  id integer primary key check(id=1),
  revision bigint not null default 0,
  changed_at timestamptz not null default now()
);
alter table public.rk_operational_signal enable row level security;
revoke all on public.rk_operational_signal from public,anon,authenticated;
grant select on public.rk_operational_signal to authenticated;
create policy operations_staff_read on public.rk_operational_signal for select to authenticated
  using ((select private.can_read_operations()));
insert into public.rk_operational_signal(id) values(1);
alter publication supabase_realtime add table public.rk_operational_signal;

create function private.signal_operations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Lease refreshes and unchanged statuses do not create notification storms.
  if TG_OP='UPDATE' and
    (to_jsonb(new)->'status',to_jsonb(new)->'kind',to_jsonb(new)->'attempts',to_jsonb(new)->'state')
    is not distinct from
    (to_jsonb(old)->'status',to_jsonb(old)->'kind',to_jsonb(old)->'attempts',to_jsonb(old)->'state') then
    return null;
  end if;
  update public.rk_operational_signal set revision=revision+1,changed_at=clock_timestamp() where id=1;
  return null;
end $$;
revoke all on function private.signal_operations() from public,anon,authenticated;
create trigger notify_operations_outbox after insert or update or delete on private.notification_outbox
  for each row execute function private.signal_operations();
create trigger notify_operations_webhooks after insert or update or delete on private.webhook_events
  for each row execute function private.signal_operations();
create trigger notify_operations_billing after insert or update or delete on private.subscriptions
  for each row execute function private.signal_operations();

create function public.rk_operational_summary() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  -- Deliberately read-only: background traffic must not extend staff inactivity.
  if not private.can_read_operations() then
    raise exception 'Acesso negado ou sessão expirada. Entre novamente.' using errcode='42501';
  end if;
  return jsonb_build_object(
    'checkedAt',now(),
    'paymentFailures',(select count(*) from private.subscriptions where state='past_due'),
    'deliveryFailures',(select count(*) from private.notification_outbox where status='failed'),
    'exhaustedDeliveries',(select count(*) from private.notification_outbox where status in ('pending','failed') and attempts>=5),
    'riskReviews',(select count(*) from private.notification_outbox where kind like 'risk.%'),
    'webhookFailures',(select count(*) from private.webhook_events where status='failed')
  );
end $$;
revoke all on function public.rk_operational_summary() from public,anon;
grant execute on function public.rk_operational_summary() to authenticated;
