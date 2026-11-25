alter table public.reports add column admin_response text;
grant update(admin_response) on public.reports to authenticated;

create function public.check_report_response() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status in ('resolved','rejected') and new.admin_response is distinct from old.admin_response then
    raise exception 'Closed report response cannot be changed';
  end if;
  if new.status in ('resolved','rejected') and new.status <> old.status then
    new.admin_response := nullif(btrim(new.admin_response), '');
    if new.admin_response is null then raise exception 'Report response required'; end if;
  elsif old.status not in ('resolved','rejected') and new.status not in ('resolved','rejected') and new.admin_response is not null then
    raise exception 'Only closed reports may have a response';
  end if;
  return new;
end $$;
create trigger report_response before update of status, admin_response on public.reports
for each row execute function public.check_report_response();
