-- Visão de faturamento para administração, suporte e diretoria (somente leitura, sem CPF completo ou contatos).

create function public.rk_admin_billing(p_months integer default 6) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r private.roles;
  v_months integer := least(greatest(coalesce(p_months, 6), 1), 12);
  v_month_start date := (date_trunc('month', now() at time zone 'America/Recife')::date - ((v_months - 1) || ' months')::interval)::date;
  v_range_start timestamptz := (v_month_start::timestamp at time zone 'America/Recife');
  v_active_paying bigint;
  v_gross bigint;
  v_wedea bigint;
  v_paid_count bigint;
  v_past_due_cents bigint;
begin
  r := private.actor();
  if r.role not in ('admin', 'support', 'viewer') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select count(*) into v_active_paying
  from private.members m
  where private.eligible(m.id);

  select
    coalesce(sum(w.paid_amount), 0),
    coalesce(sum(w.amount_cents), 0),
    count(*)
  into v_gross, v_wedea, v_paid_count
  from private.wedea_shares w
  where w.created_at >= v_range_start;

  select coalesce(sum(s.amount_due), 0) into v_past_due_cents
  from private.subscriptions s
  where s.state = 'past_due';

  return jsonb_build_object(
    'months', v_months,
    'generatedAt', now(),
    'priceCents', 6990,
    'wedeaShareUnitCents', 1587,
    'wedeaThreshold', 200,
    'activePayingMembers', v_active_paying,
    'estimatedMrrCents', (v_active_paying * 6990)::text,
    'grossRevenueCents', v_gross::text,
    'wedeaShareCents', v_wedea::text,
    'netRkmedCents', (v_gross - v_wedea)::text,
    'pastDueAmountCents', v_past_due_cents::text,
    'paidInvoicesCount', v_paid_count,
    'avgInvoiceCents', (case when v_paid_count > 0 then round(v_gross::numeric / v_paid_count)::bigint else 0 end)::text,
    'statusBreakdown', jsonb_build_object(
      'active', (select count(*) from private.subscriptions s join private.members m on m.id = s.member_id where s.state = 'active' and not s.cancel_at_period_end and not m.blocked),
      'canceling', (select count(*) from private.subscriptions s join private.members m on m.id = s.member_id where s.state = 'active' and s.cancel_at_period_end and not m.blocked),
      'pastDue', (select count(*) from private.subscriptions where state = 'past_due'),
      'canceled', (select count(*) from private.subscriptions where state = 'canceled'),
      'incomplete', (select count(*) from private.subscriptions where state = 'incomplete'),
      'blocked', (select count(*) from private.members where blocked)
    ),
    'wedea', jsonb_build_object(
      'sentCount', (select count(*) from private.wedea_shares where created_at >= v_range_start and status = 'sent'),
      'pendingCount', (select count(*) from private.wedea_shares where created_at >= v_range_start and status in ('pending', 'sending')),
      'reviewCount', (select count(*) from private.wedea_shares where created_at >= v_range_start and status = 'review'),
      'skippedCount', (select count(*) from private.wedea_shares where created_at >= v_range_start and status = 'skipped'),
      'sentCents', (select coalesce(sum(amount_cents), 0)::text from private.wedea_shares where created_at >= v_range_start and status = 'sent'),
      'pendingCents', (select coalesce(sum(amount_cents), 0)::text from private.wedea_shares where created_at >= v_range_start and status in ('pending', 'sending')),
      'reviewCents', (select coalesce(sum(amount_cents), 0)::text from private.wedea_shares where created_at >= v_range_start and status = 'review')
    ),
    'monthlySeries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(ms.month_date, 'YYYY-MM'),
        'invoices', coalesce(agg.invoices, 0),
        'grossCents', coalesce(agg.gross_cents, 0)::text,
        'wedeaCents', coalesce(agg.wedea_cents, 0)::text,
        'netCents', (coalesce(agg.gross_cents, 0) - coalesce(agg.wedea_cents, 0))::text
      ) order by ms.month_date asc), '[]'::jsonb)
      from (
        select generate_series(
          v_month_start,
          date_trunc('month', now() at time zone 'America/Recife')::date,
          interval '1 month'
        )::date as month_date
      ) ms
      left join (
        select
          date_trunc('month', w.created_at at time zone 'America/Recife')::date as month_date,
          count(*) as invoices,
          sum(w.paid_amount) as gross_cents,
          sum(w.amount_cents) as wedea_cents
        from private.wedea_shares w
        where w.created_at >= v_range_start
        group by 1
      ) agg on agg.month_date = ms.month_date
    ),
    'recentInvoices', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'invoiceId', w.invoice_id,
        'memberName', m.name,
        'paidAmountCents', w.paid_amount::text,
        'wedeaAmountCents', w.amount_cents::text,
        'wedeaStatus', w.status,
        'createdAt', w.created_at
      ) order by w.created_at desc), '[]'::jsonb)
      from (
        select * from private.wedea_shares
        order by created_at desc
        limit 8
      ) w
      join private.members m on m.id = w.member_id
    )
  );
end $$;

revoke all on function public.rk_admin_billing(integer) from public, anon;
grant execute on function public.rk_admin_billing(integer) to authenticated;
