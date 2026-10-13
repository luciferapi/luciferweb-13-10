alter table public.owner_live_banners
  add column image_url text
  check (image_url is null or char_length(btrim(image_url)) between 1 and 2000);