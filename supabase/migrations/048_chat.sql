-- CHAT tra giocatori: canale generale + canale dell'alleanza. I messaggi più vecchi di 2 giorni si cancellano.
create table if not exists chat_messages (
  id bigserial primary key,
  channel text not null,
  org_id uuid not null references organizations(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_channel_time on chat_messages (channel, created_at desc);
alter table chat_messages enable row level security;
create policy "read chat" on chat_messages for select to authenticated
  using (channel = 'generale' or channel = 'alleanza:' || coalesce(my_alliance()::text, '-'));
grant select on chat_messages to authenticated;

create or replace function send_chat(p_channel text, p_body text) returns chat_messages
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); m chat_messages; b text := trim(p_body);
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if char_length(b) = 0 then raise exception 'EMPTY'; end if;
  if char_length(b) > 300 then b := left(b, 300); end if;
  if p_channel <> 'generale' and p_channel <> 'alleanza:' || coalesce(my_alliance()::text, '-') then raise exception 'NO_CHANNEL'; end if;
  if exists (select 1 from chat_messages where org_id = v_org and created_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST'; end if;
  insert into chat_messages (channel, org_id, body) values (p_channel, v_org, b) returning * into m;
  return m;
end $$;
grant execute on function send_chat(text, text) to authenticated;

create or replace view chat_feed with (security_invoker = true) as
select c.id, c.channel, c.body, c.created_at, c.org_id, o.name as org_name, o.type as org_type, o.logo_url
  from chat_messages c join organizations o on o.id = c.org_id;
grant select on chat_feed to authenticated;

create or replace function purge_chat() returns int language sql security definer set search_path = public as $$
  with d as (delete from chat_messages where created_at < now() - interval '2 days' returning 1) select count(*)::int from d $$;
select cron.schedule('purge-chat', '15 * * * *', $$select purge_chat()$$);
