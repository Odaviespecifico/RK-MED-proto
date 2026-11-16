-- Correct the verifier positions (13 and 14); preserve previously applied migrations.
create or replace function private.valid_partner_cnpj(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare c text:=upper(regexp_replace(coalesce(value,''),'[^A-Z0-9]','','g')); total integer; weight integer; remainder integer; digit integer;
begin
  if c !~ '^[A-Z0-9]{12}[0-9]{2}$' or c ~ '^([A-Z0-9])\1{13}$' then return false; end if;
  for check_index in 1..2 loop
    total:=0;
    for i in 1..(11+check_index) loop
      weight:=((11+check_index-i) % 8)+2;
      total:=total+(ascii(substr(c,i,1))-48)*weight;
    end loop;
    remainder:=total % 11; digit:=case when remainder<2 then 0 else 11-remainder end;
    if digit<>substr(c,12+check_index,1)::integer then return false; end if;
  end loop;
  return true;
end $$;

