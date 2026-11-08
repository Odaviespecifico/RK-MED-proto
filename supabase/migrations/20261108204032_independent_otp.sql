-- RF-CAD / D29: RKMED owns challenges; delivery providers never validate codes.
create table private.otp_challenges (
  id uuid primary key, contact_hash text not null check(length(contact_hash)=64),
  channel text not null check(channel in ('email','sms')),
  purpose text not null check(purpose in ('login','signup','attach')),
  user_id uuid references auth.users(id), actor_id uuid references auth.users(id),
  code_hash text not null check(length(code_hash)=64),
  status text not null default 'sending' check(status in ('sending','sent','failed','used','superseded')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  provider_id text, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '5 minutes',
  check ((purpose='attach')=(actor_id is not null)),
  check (purpose<>'attach' or (channel='sms' and actor_id=user_id)),
  check (purpose<>'signup' or channel='email')
);
create index otp_contact_time on private.otp_challenges(contact_hash,created_at desc);
alter table private.otp_challenges enable row level security;
revoke all on private.otp_challenges from public,anon,authenticated,service_role;

create function public.rk_otp_identity(p_contact text,p_channel text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users; r text;
begin
 perform private.service_only();
 select * into u from auth.users where case when p_channel='email' then lower(email)=lower(p_contact) when p_channel='sms' then phone=ltrim(p_contact,'+') else false end;
 if not found then return null; end if;
 select role into r from private.roles where user_id=u.id;
 -- Staff use their independent password flow; OTP cannot downgrade staff authentication.
 if r in ('admin','support','partner','viewer') then return null; end if;
 return jsonb_build_object('id',u.id,'email',u.email,'emailVerified',u.email_confirmed_at is not null,'phoneVerified',u.phone_confirmed_at is not null);
end $$;

create function public.rk_otp_begin(p_id uuid,p_contact_hash text,p_channel text,p_purpose text,p_user uuid,p_actor uuid,p_code_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform private.service_only();
 perform pg_advisory_xact_lock(hashtextextended(p_contact_hash,29));
 if exists(select 1 from private.otp_challenges where contact_hash=p_contact_hash and created_at>now()-interval '60 seconds')
 or (select count(*) from private.otp_challenges where contact_hash=p_contact_hash and created_at>now()-interval '1 hour')>=5
 or (select coalesce(sum(attempts),0) from private.otp_challenges where contact_hash=p_contact_hash and created_at>now()-interval '1 hour')>=10 then return false; end if;
 update private.otp_challenges set status='superseded' where contact_hash=p_contact_hash and status in ('sending','sent');
 insert into private.otp_challenges(id,contact_hash,channel,purpose,user_id,actor_id,code_hash) values(p_id,p_contact_hash,p_channel,p_purpose,p_user,p_actor,p_code_hash);
 return true;
end $$;

create function public.rk_otp_sent(p_id uuid,p_provider text,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.service_only();
 update private.otp_challenges set status=case when p_success then 'sent' else 'failed' end,provider_id=left(p_provider,100)
 where id=p_id and status='sending';
end $$;

create function public.rk_otp_consume(p_id uuid,p_contact_hash text,p_channel text,p_purpose text,p_actor uuid,p_code_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.otp_challenges;
begin
 perform private.service_only();
 perform pg_advisory_xact_lock(hashtextextended(p_contact_hash,29));
 select * into c from private.otp_challenges where id=p_id for update;
 if not found or c.contact_hash<>p_contact_hash or c.channel<>p_channel or c.purpose<>p_purpose
 or c.actor_id is distinct from p_actor or c.status<>'sent' or c.expires_at<=now() or c.attempts>=5 then return null; end if;
 if (select coalesce(sum(attempts),0) from private.otp_challenges where contact_hash=p_contact_hash and created_at>now()-interval '1 hour')>=10 then return null; end if;
 -- Return failure instead of raising, so wrong-attempt counters commit.
 update private.otp_challenges set attempts=attempts+1 where id=p_id;
 if c.code_hash<>p_code_hash then return null; end if;
 update private.otp_challenges set status='used' where id=p_id;
 return jsonb_build_object('userId',c.user_id);
end $$;

revoke all on function public.rk_otp_identity(text,text),public.rk_otp_begin(uuid,text,text,text,uuid,uuid,text),public.rk_otp_sent(uuid,text,boolean),public.rk_otp_consume(uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.rk_otp_identity(text,text),public.rk_otp_begin(uuid,text,text,text,uuid,uuid,text),public.rk_otp_sent(uuid,text,boolean),public.rk_otp_consume(uuid,text,text,text,uuid,text) to service_role;
