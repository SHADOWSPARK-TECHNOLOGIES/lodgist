-- Sample Owerri listings so the public /listings page is not empty during beta.
-- Every row is marked as a sample: not verified, not for rent, owned by a demo
-- account that cannot log in (no password). Safe to re-run: it does nothing if
-- the demo account already owns listings.
-- Remove with: DELETE FROM "User" WHERE email = 'demo-listings@lodgist.online';
-- (properties cascade; listings must be deleted first, see bottom of file)

DO $$
DECLARE
  demo_id INT;
  prop_id INT;
  r RECORD;
BEGIN
  INSERT INTO "User" (name, email, "passwordHash", role, "truthIndex", "isVerified", "updatedAt")
  VALUES ('Lodgist sample listings', 'demo-listings@lodgist.online', NULL, 'LANDLORD', 0, false, NOW())
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO demo_id FROM "User" WHERE email = 'demo-listings@lodgist.online';

  IF EXISTS (SELECT 1 FROM "Listing" WHERE "ownerId" = demo_id) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('Sample: 2-bedroom flat, Ikenegbu', 'Ikenegbu Layout', 'Owerri Municipal', 'Apartment', 2, 2, 1200000::float8, 150000::float8, false),
      ('Sample: self-contain near FUTO, Eziobodo', 'Eziobodo', 'Owerri West', 'Apartment', 1, 1, 350000::float8, 0::float8, false),
      ('Sample: 3-bedroom bungalow, World Bank', 'World Bank Housing Estate', 'Owerri North', 'House', 3, 3, 1800000::float8, 200000::float8, false),
      ('Sample: mini flat, New Owerri', 'New Owerri', 'Owerri Municipal', 'Apartment', 1, 1, 650000::float8, 100000::float8, true)
    ) AS t(title, address, lga, ptype, beds, baths, rent, service, furnished)
  LOOP
    INSERT INTO "Property" ("ownerId", address, city, state, lga, "propertyType", bedrooms, bathrooms, "updatedAt")
    VALUES (demo_id, r.address, 'Owerri', 'Imo', r.lga, r.ptype, r.beds, r.baths, NOW())
    RETURNING id INTO prop_id;

    INSERT INTO "Listing" ("propertyId", "ownerId", title, description, price, currency, category, status,
                           "riskState", "truthIndex", "totalMoveInCost", furnished, "serviceCharge", "updatedAt")
    VALUES (
      prop_id, demo_id, r.title,
      'This is a sample listing so you can see how Lodgist works during beta. It is not a real offer and has not been checked. Message us on WhatsApp if you want help finding a real place in this area.',
      r.rent, 'NGN', 'RESIDENTIAL', 'PENDING', 'UNVERIFIED', NULL,
      jsonb_build_object('base_rent', r.rent, 'agency_fee', r.rent * 0.1, 'legal_fee', r.rent * 0.1,
                         'caution_fee', r.rent * 0.1, 'currency', 'NGN', 'total', r.rent * 1.3, 'sample', true),
      r.furnished, NULLIF(r.service, 0), NOW()
    );
  END LOOP;
END $$;

-- Full removal (run manually):
-- DELETE FROM "Listing" WHERE "ownerId" = (SELECT id FROM "User" WHERE email = 'demo-listings@lodgist.online');
-- DELETE FROM "User" WHERE email = 'demo-listings@lodgist.online';
