-- Stage 2 additions. Run once in the Supabase SQL Editor (safe to run again).
--  * terminology.rule_id: which brand rule a banned word comes from (so every finding can cite it)
--  * content_items.last_reviewed_at: lets the Impact view show content that is out of date
--    because an approved fact changed after the last review

alter table public.terminology add column if not exists rule_id text references public.brand_rules(id);
alter table public.content_items add column if not exists last_reviewed_at timestamptz;

update public.terminology set rule_id = 'G-1' where banned_term = 'cheap' and rule_id is null;
update public.terminology set rule_id = 'G-5' where banned_term = 'miracle' and rule_id is null;
update public.terminology set rule_id = 'G-3' where banned_term = 'Fresh Juice' and rule_id is null;
update public.terminology set rule_id = 'G-4' where banned_term = 'detox' and rule_id is null;
