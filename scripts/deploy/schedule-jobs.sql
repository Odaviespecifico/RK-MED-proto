-- Homologation only. Store the same JOBS_SECRET as the Edge Function in Vault
-- under rkmed_jobs_secret before running. No bearer is embedded in cron metadata.
do $$
begin
  if (select value from private.settings where key='environment') is distinct from 'sandbox' then
    raise exception 'Agendamento reservado à homologação';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='rkmed_jobs_secret' and length(decrypted_secret)>=32) then
    raise exception 'Configure rkmed_jobs_secret no Vault primeiro';
  end if;
end $$;

select cron.schedule('rkmed-provider-jobs', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://chuyompxoctmpawhfmyb.supabase.co/functions/v1/provider-jobs',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='rkmed_jobs_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);
