-- Exportação configurável de dados (parceiros, associados e financeiro) para admin/suporte.
-- Mantém bloqueio à diretoria (viewer), CPF sempre mascarado, limite de 5.000 linhas, rate limit e auditoria.

create function public.rk_export_data(p_dataset text, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor private.roles;
  v_start timestamptz;
  v_end timestamptz;
  rows jsonb;
  row_count bigint;
begin
  actor := private.actor();
  if actor.role not in ('admin', 'support') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_dataset not in ('partners', 'members', 'financial') then
    raise exception 'Tipo de dado inválido para exportação.' using errcode = 'P0001';
  end if;

  perform private.report_period(p_from, p_to);
  v_start := (p_from::timestamp at time zone 'America/Recife');
  v_end := ((p_to + 1)::timestamp at time zone 'America/Recife');

  perform pg_advisory_xact_lock(hashtextextended('report.export:' || actor.user_id::text, 0));
  if (select count(*) from private.audit
      where actor_id = actor.user_id and action = 'report.export'
        and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Aguarde um minuto antes de exportar novamente' using errcode = 'P0001';
  end if;

  if p_dataset = 'partners' then
    with period_purchases as (
      select
        p.partner_id,
        count(*) as purchases_count,
        coalesce(sum(p.gross_cents), 0) as gross_cents,
        coalesce(sum(p.discount_cents), 0) as discount_cents
      from private.purchases p
      where p.created_at >= v_start and p.created_at < v_end
        and not exists (select 1 from private.reversals r where r.purchase_id = p.id)
      group by p.partner_id
    ),
    selected as (
      select
        s.id,
        s.name,
        s.segment,
        s.cnpj,
        s.address,
        s.city,
        s.state,
        s.phone,
        s.email,
        s.discount_bps,
        s.active,
        s.created_at,
        coalesce(pp.purchases_count, 0) as purchases_count,
        coalesce(pp.gross_cents, 0) as gross_cents,
        coalesce(pp.discount_cents, 0) as discount_cents
      from private.partners s
      left join period_purchases pp on pp.partner_id = s.id
      where not s.is_test
      order by s.name asc, s.id asc
      limit 5001
    )
    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'segment', segment,
      'cnpj', cnpj,
      'address', address,
      'city', city,
      'state', state,
      'phone', phone,
      'email', email,
      'discountPercent', (discount_bps / 100.0),
      'active', active,
      'purchasesCount', purchases_count,
      'grossCents', gross_cents::text,
      'discountCents', discount_cents::text,
      'createdAt', created_at
    ) order by name asc, id asc), '[]'::jsonb)
    into row_count, rows
    from selected;

  elsif p_dataset = 'members' then
    with member_purchases as (
      select
        p.member_id,
        count(*) as purchases_count,
        coalesce(sum(p.discount_cents), 0) as savings_cents
      from private.purchases p
      where not exists (select 1 from private.reversals r where r.purchase_id = p.id)
      group by p.member_id
    ),
    selected as (
      select
        m.id,
        m.name,
        '***.***.***-' || right(i.cpf, 2) as masked_cpf,
        m.birth_date,
        m.blocked,
        m.created_at,
        private.eligible(m.id) as eligible,
        coalesce(s.state, 'incomplete') as billing_state,
        s.paid_through,
        coalesce(s.cancel_at_period_end, false) as cancel_at_period_end,
        coalesce(mp.purchases_count, 0) as purchases_count,
        coalesce(mp.savings_cents, 0) as savings_cents
      from private.members m
      join private.member_identity i on i.member_id = m.id
      left join private.subscriptions s on s.member_id = m.id
      left join member_purchases mp on mp.member_id = m.id
      where m.created_at >= v_start and m.created_at < v_end
      order by m.created_at desc, m.id asc
      limit 5001
    )
    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'cpf', masked_cpf,
      'birthDate', birth_date,
      'billingState', billing_state,
      'eligible', eligible,
      'blocked', blocked,
      'paidThrough', paid_through,
      'cancelAtPeriodEnd', cancel_at_period_end,
      'purchasesCount', purchases_count,
      'savingsCents', savings_cents::text,
      'joinedAt', created_at
    ) order by created_at desc, id asc), '[]'::jsonb)
    into row_count, rows
    from selected;

  else
    with selected as (
      select
        w.invoice_id,
        m.name as member_name,
        '***.***.***-' || right(i.cpf, 2) as masked_cpf,
        w.paid_amount,
        w.amount_cents,
        (w.paid_amount - w.amount_cents) as net_rkmed_cents,
        w.status,
        w.active_members,
        w.created_at,
        w.completed_at
      from private.wedea_shares w
      join private.members m on m.id = w.member_id
      join private.member_identity i on i.member_id = m.id
      where w.created_at >= v_start and w.created_at < v_end
      order by w.created_at desc, w.invoice_id asc
      limit 5001
    )
    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'invoiceId', invoice_id,
      'memberName', member_name,
      'cpf', masked_cpf,
      'paidAmountCents', paid_amount::text,
      'operationalFeeCents', amount_cents::text,
      'netRkmedCents', net_rkmed_cents::text,
      'feeStatus', status,
      'activeMembersAtPayment', active_members,
      'createdAt', created_at,
      'completedAt', completed_at
    ) order by created_at desc, invoice_id asc), '[]'::jsonb)
    into row_count, rows
    from selected;
  end if;

  if row_count > 5000 then
    raise exception 'Mais de 5.000 registros. Reduza o período selecionado.' using errcode = 'P0001';
  end if;

  perform private.log(
    'report.export',
    null,
    'dataset=' || p_dataset || '; period=' || p_from::text || '/' || p_to::text || '; rows=' || row_count::text
  );

  return jsonb_build_object(
    'dataset', p_dataset,
    'generatedAt', now(),
    'from', p_from,
    'to', p_to,
    'rows', rows
  );
end $$;

revoke all on function public.rk_export_data(text, date, date) from public, anon;
grant execute on function public.rk_export_data(text, date, date) to authenticated;
