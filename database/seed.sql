-- Sample brand kit for the fictional brand "FreshJuice" (written by the team for testing).
-- Safe to run more than once.

insert into public.brand_rules (id, title, body, category, severity) values
  ('G-1', 'Friendly voice',        'Write in a friendly, simple and positive voice. Avoid fear-based or aggressive wording.', 'tone', 'low'),
  ('G-2', 'Channel tone',          'Emails: no emojis. Instagram: at most two emojis. Website: neutral and factual.', 'tone', 'low'),
  ('G-3', 'Product name',          'Always write the product name as "FreshJuice" (one word, capital F and J).', 'terminology', 'medium'),
  ('G-4', 'No health claims',      'Never claim that the product cures, treats or prevents a disease.', 'claims', 'high'),
  ('G-5', 'Approved facts only',   'Prices, discounts, ingredients and delivery terms may only be stated as they appear in the approved facts.', 'claims', 'high'),
  ('G-6', 'Offer end date',        'Every time-limited offer must state its end date.', 'claims', 'medium'),
  ('G-7', 'Superlatives need evidence', 'Words such as "best", "#1" or "world''s best" need written evidence. Without evidence, do not use them.', 'claims', 'high'),
  ('G-8', 'Accessible images',     'Every image needs alt-text, and text on images needs enough contrast.', 'accessibility', 'medium'),
  ('G-9', 'Approved visuals',      'Use only the approved logo and the brand colours.', 'visual', 'medium')
on conflict (id) do nothing;

insert into public.facts (id, fact_key, label, value, numeric_value, unit, source, owner, valid_from, valid_until) values
  ('F-1', 'brand_name',      'Brand name',                   'FreshJuice',                           null, 'text',    'Brand guidelines v1',     'Brand admin',       '2026-10-01', null),
  ('F-2', 'ingredients',     'Ingredients claim',            '100% natural fruit juice, no added sugar', null, 'text', 'Ingredient sheet 2026',   'Quality team',      '2026-10-01', null),
  ('F-3', 'pack_size',       'Pack size',                    '6 bottles of 200 ml',                  6,    'bottles', 'Product catalogue',       'Product team',      '2026-10-01', null),
  ('F-4', 'price_6_pack',    'Price of the 6-bottle pack',   'Rs 1,199',                             1199, 'INR',     'Price list Oct 2026',     'Pricing team',      '2026-10-01', '2026-12-31'),
  ('F-5', 'launch_discount', 'Festive launch discount',      '15%',                                  15,   'percent', 'Campaign brief: Festive launch', 'Marketing manager', '2026-10-15', '2026-11-15'),
  ('F-6', 'free_delivery',   'Free delivery threshold',      'Free delivery on orders above Rs 799', 799,  'INR',     'Delivery policy',         'Operations',        '2026-10-01', null),
  ('F-7', 'shelf_life',      'Shelf life',                   '5 days when refrigerated',             5,    'days',    'Quality sheet',           'Quality team',      '2026-10-01', null),
  ('F-8', 'availability',    'Availability',                 'Available in 12 cities',               12,   'cities',  'Market availability sheet', 'Operations',      '2026-10-01', '2026-11-30')
on conflict (id) do nothing;

insert into public.terminology (banned_term, preferred_term, note)
select * from (values
  ('cheap',        'affordable',   'Avoid wording that suggests low quality'),
  ('miracle',      'natural',      'Sounds like an unsupported claim'),
  ('Fresh Juice',  'FreshJuice',   'Brand name is one word'),
  ('detox',        null,           'Health claim, not allowed (rule G-4)')
) as v(banned_term, preferred_term, note)
where not exists (select 1 from public.terminology);
