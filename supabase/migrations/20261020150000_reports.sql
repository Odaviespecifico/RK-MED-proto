-- RF-ADM/DG: complete server aggregates and explicitly authorized, bounded exports.
create index purchases_report_date on private.purchases(created_at, id);

create function private.report_period(p_from date, p_to date) returns void
language plpgsql set search_path='' as $$
begin
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
    or p_to < p_from or p_to - p_from > 365 then
    raise exception 'Escolha um período válido de até 366 dias' using errcode='P0001';
  end if;
end $$;
revoke all on function private.report_period(date,date) from public,anon,authenticated;

create function public.rk_report(p_from date,p_to date,p_partner uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor private.roles; totals jsonb;
begin
  actor:=private.actor();
  if actor.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.report_period(p_from,p_to);
  select jsonb_build_object(
    'recordedCount',count(*),'validCount',count(*) filter(where r.id is null),
    'reversedCount',count(*) filter(where r.id is not null),
    'grossCents',coalesce(sum(p.gross_cents) filter(where r.id is null),0)::text,
    'discountCents',coalesce(sum(p.discount_cents) filter(where r.id is null),0)::text,
    'finalCents',coalesce(sum(p.final_cents) filter(where r.id is null),0)::text
  ) into totals from private.purchases p left join private.reversals r on r.purchase_id=p.id
    where p.created_at >= (p_from::timestamp at time zone 'America/Recife')
      and p.created_at < ((p_to+1)::timestamp at time zone 'America/Recife')
      and (p_partner is null or p.partner_id=p_partner);
  return jsonb_build_object('from',p_from,'to',p_to,'partnerId',p_partner,
    'generatedAt',now(),'totals',totals);
end $$;
revoke all on function public.rk_report(date,date,uuid) from public,anon;
grant execute on function public.rk_report(date,date,uuid) to authenticated;

create function public.rk_export_purchases(p_from date,p_to date,p_partner uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor private.roles; rows jsonb; row_count bigint;
begin
  actor:=private.actor();
  if actor.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.report_period(p_from,p_to);
  -- Serialize rate checks per actor. Export never bypasses the verified staff session.
  perform pg_advisory_xact_lock(hashtextextended('report.export:'||actor.user_id::text,0));
  if (select count(*) from private.audit where actor_id=actor.user_id and action='report.export'
      and created_at>now()-interval '1 minute')>=5 then
    raise exception 'Aguarde um minuto antes de exportar novamente' using errcode='P0001';
  end if;
  -- One statement gives count and rows the same snapshot. Never silently truncate a CSV.
  with selected as (
    select p.*,m.name as member_name,'***.***.***-'||right(i.cpf,2) as masked_cpf,
      s.name as partner_name,r.created_at as reversed_at
    from private.purchases p join private.members m on m.id=p.member_id
    join private.member_identity i on i.member_id=m.id
    join private.partners s on s.id=p.partner_id
    left join private.reversals r on r.purchase_id=p.id
    where p.created_at >= (p_from::timestamp at time zone 'America/Recife')
      and p.created_at < ((p_to+1)::timestamp at time zone 'America/Recife')
      and (p_partner is null or p.partner_id=p_partner)
    order by p.created_at,p.id limit 5001
  )
  select count(*),coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'memberName',member_name,'cpf',masked_cpf,'partnerName',partner_name,
    'employee',employee_name,'grossCents',gross_cents::text,'discountCents',discount_cents::text,
    'finalCents',final_cents::text,'createdAt',created_at,'reversedAt',reversed_at
  ) order by created_at,id),'[]'::jsonb) into row_count,rows from selected;
  if row_count>5000 then raise exception 'Mais de 5.000 registros. Reduza o período ou filtre um parceiro.' using errcode='P0001'; end if;
  perform private.log('report.export',p_partner,
    'period='||p_from::text||'/'||p_to::text||'; rows='||row_count::text);
  return jsonb_build_object('generatedAt',now(),'from',p_from,'to',p_to,'partnerId',p_partner,'rows',rows);
end $$;
revoke all on function public.rk_export_purchases(date,date,uuid) from public,anon;
grant execute on function public.rk_export_purchases(date,date,uuid) to authenticated;
