-- Retired. This file used to insert fictional Owerri homes (Ikenegbu, Eziobodo,
-- World Bank, New Owerri) with invented rents. Do not run it.
-- Use: node prisma/seed-owerri-home.js

DO $$
BEGIN
  RAISE EXCEPTION 'Refusing demo-owerri-listings.sql. It invents Owerri homes. Use node prisma/seed-owerri-home.js';
END $$;
