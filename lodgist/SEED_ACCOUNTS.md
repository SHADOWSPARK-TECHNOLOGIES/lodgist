# Lodgist Seed Test Accounts

## Credentials

| Role     | Email                  | Password      |
|----------|------------------------|---------------|
| Admin    | admin@lodgist.com      | password123   |
| Landlord | landlord@lodgist.com   | password123   |
| Tenant   | tenant@lodgist.com     | password123   |

## Users

| Name           | Role     | Email                  |
|----------------|----------|------------------------|
| Chidi Okafor   | ADMIN    | admin@lodgist.com      |
| Fatima Bello   | LANDLORD | landlord@lodgist.com   |
| Emeka Nwosu    | TENANT   | tenant@lodgist.com     |

## Seed Data Summary

| Table            | Count | Details                                      |
|------------------|-------|----------------------------------------------|
| Roles            | 3     | ADMIN, LANDLORD, TENANT                      |
| Users            | 3     | 1 per role                                   |
| Properties       | 6     | Lagos (3), FCT (1), Rivers (1), Imo (1)      |
| Listings         | 6     | ₦1.2M–₦25M, various property types           |
| ListingImages    | 18    | 3 images per listing                         |
| Reviews          | 12    | 2 reviews per listing, 3–5 stars             |
| Bookings         | 2     | 1 pending (Lekki), 1 confirmed (Wuse 2)      |
| TruthIndexScores | 6     | Scores 71–95 with breakdown JSON             |

## Properties

| # | Address                                      | City             | State  | Price (₦)    | Truth Index |
|---|----------------------------------------------|------------------|--------|--------------|-------------|
| 1 | 12 Admiralty Way, Lekki Phase 1              | Lekki            | Lagos  | 4,500,000    | 92          |
| 2 | 45 Aminu Kano Crescent, Wuse 2               | Wuse             | FCT    | 8,500,000    | 88          |
| 3 | Plot 7, Bishop Oluwole Street, Victoria Island| Victoria Island  | Lagos  | 25,000,000   | 76          |
| 4 | 8 Woji Road, GRA Phase 2                     | Port Harcourt    | Rivers | 3,200,000    | 85          |
| 5 | 22 Bourdillon Road, Ikoyi                    | Ikoyi            | Lagos  | 18,000,000   | 95          |
| 6 | 30 Ikenegbu Layout, Owerri Municipal         | Owerri           | Imo    | 1,200,000    | 71          |

## Database

- **Host**: localhost:5432
- **Database**: lodgist_db
- **User**: lodgist_user
- **Password**: lodgist_pass
- **Studio**: http://localhost:5555
