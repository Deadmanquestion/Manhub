create index if not exists booking_photos_uploaded_by_idx
  on public.booking_photos(uploaded_by);
create index if not exists lift_bookings_car_id_idx
  on public.lift_bookings(car_id);
create index if not exists lift_bookings_lift_id_idx
  on public.lift_bookings(lift_id);
create index if not exists service_bookings_car_id_idx
  on public.service_bookings(car_id);
create index if not exists service_bookings_service_catalog_id_idx
  on public.service_bookings(service_catalog_id);
