-- New accounts use the name from the sign-in provider (Google: full_name, others: name)
-- when the sign-up form gave none, before falling back to a random name.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 40), ''),
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 40), ''),
    nullif(left(btrim(new.raw_user_meta_data ->> 'name'), 40), ''),
    public.random_display_name()))
  on conflict (user_id) do nothing;
  return new;
end $$;
