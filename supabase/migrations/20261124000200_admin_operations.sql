begin;
-- Admin-only projection of Auth emails; never grant clients access to auth.users.
create function public.admin_accounts()
returns table(id uuid, display_name text, email text, role text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.aoun_active('admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  return query select p.id,p.display_name,u.email::text,p.role,p.status from public.profiles p join auth.users u on u.id=p.id order by p.display_name,p.id;
end $$;
revoke all on function public.admin_accounts() from public,anon,authenticated;
grant execute on function public.admin_accounts() to authenticated;

-- Save all nine facility states and the place atomically. Null means unrecorded.
create function public.admin_save_place(target_id integer, place_data jsonb, facility_states jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare saved_id integer; item jsonb; position integer := 0;
begin
  if not public.aoun_active('admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  if jsonb_typeof(facility_states) is distinct from 'array' then raise exception 'Nine facility states required'; end if;
  if jsonb_array_length(facility_states) <> 9 then raise exception 'Nine facility states required'; end if;
  if coalesce(trim(place_data->>'name_ar'),'')='' or coalesce(trim(place_data->>'name_en'),'')='' then raise exception 'Names required'; end if;
  if target_id is null then
    insert into public.places(name_ar,name_en,category_id,address,latitude,longitude)
    values(trim(place_data->>'name_ar'),trim(place_data->>'name_en'),(place_data->>'category_id')::integer,
      place_data->>'address',(place_data->>'latitude')::double precision,(place_data->>'longitude')::double precision)
    returning id into saved_id;
  else
    update public.places set name_ar=trim(place_data->>'name_ar'),name_en=trim(place_data->>'name_en'),
      category_id=(place_data->>'category_id')::integer,address=place_data->>'address',
      latitude=(place_data->>'latitude')::double precision,longitude=(place_data->>'longitude')::double precision
    where id=target_id returning id into saved_id;
    if not found then raise exception 'Place not found'; end if;
  end if;
  delete from public.place_facilities where place_id=saved_id;
  for item in select value from jsonb_array_elements(facility_states) loop
    position := position+1;
    if item <> 'null'::jsonb then
      insert into public.place_facilities(place_id,facility_id,status)
      values(saved_id,position,(item#>>'{}')::public.facility_status);
    end if;
  end loop;
  return saved_id;
end $$;
revoke all on function public.admin_save_place(integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_place(integer,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
