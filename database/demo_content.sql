-- A ready-made demo campaign ("FreshJuice Festive Launch") with three drafts that contain deliberate
-- mistakes, so a visitor can press "Run review" and see the checks working.
-- Run after demo_users.sql and stage2.sql. Safe to run again: it does nothing if the campaign exists.

do $$
declare
  creator uuid;
  camp uuid := 'c0000000-0000-4000-8000-000000000001';
begin
  select id into creator from public.profiles where role = 'creator' order by created_at limit 1;
  if creator is null then
    raise exception 'Run demo_users.sql first (no creator profile found)';
  end if;
  if exists (select 1 from public.campaigns where id = camp) then
    return;
  end if;

  insert into public.campaigns (id, name, created_by) values (camp, 'FreshJuice Festive Launch', creator);

  insert into public.content_items (id, campaign_id, title, channel, body, created_by) values
    ('c0000000-0000-4000-8000-000000000011', camp, 'Instagram launch post', 'instagram',
     'Festive launch! Our Fresh Juice is the world''s best juice ' || chr(127865) || chr(127865) || chr(127865) ||
     '. Grab the 6-pack for only Rs 999 and get 20% off. Cures tiredness. FREE DELIVERY on orders above Rs 500!!!',
     creator),
    ('c0000000-0000-4000-8000-000000000012', camp, 'Launch email', 'email',
     E'Subject: FreshJuice festive offer\nDear customer, enjoy the FreshJuice 6-pack at Rs 1,199 with 15% off until 15 Nov 2026 ' ||
     chr(128522) || '. Our juice is 100% natural fruit juice with no added sugar and lasts 10 days in the fridge. ' ||
     'Free delivery on orders above Rs 799.',
     creator),
    ('c0000000-0000-4000-8000-000000000013', camp, 'Website banner', 'website',
     'FreshJuice is available in 20 cities. Each pack has 6 bottles of 200 ml. Our cheap and delicious juice is sugar-free.',
     creator);

  insert into public.content_versions (item_id, version, body, note, created_by)
  select id, 1, body, 'First draft', created_by from public.content_items where campaign_id = camp;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  select created_by, 'created', 'content_item', id::text, jsonb_build_object('title', title)
  from public.content_items where campaign_id = camp;
end $$;
