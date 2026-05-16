# Lodgist Seed Test Accounts — v5.0

## New in v5.0

- **Expanded from 6 → 12 listings** across 12 Nigerian cities/states
- **5 users** (admin, 2 landlords, 2 tenants) with `.ng` email domains
- **3 bookings** (pending, confirmed, cancelled) across different tenants
- **24 reviews** (2 per listing, one from each tenant)
- **12 Truth Index scores** with detailed breakdown JSON
- **24–36 listing images** (2–3 per listing) from Unsplash

## Credentials

| Role     | Email                  | Password        |
|----------|------------------------|-----------------|
| Admin    | admin@lodgist.ng       | Admin2026!      |
| Landlord | emeka@lodgist.ng       | Landlord2026!   |
| Landlord | fatima@lodgist.ng      | Landlord2026!   |
| Tenant   | chioma@lodgist.ng      | Tenant2026!     |
| Tenant   | amina@lodgist.ng       | Tenant2026!     |

## Users

| Name           | Role         | Email                  |
|----------------|--------------|------------------------|
| Lodgist Admin  | STUDIO_ADMIN | admin@lodgist.ng       |
| Emeka Okafor   | LANDLORD | emeka@lodgist.ng       |
| Fatima Bello   | LANDLORD | fatima@lodgist.ng      |
| Chioma Eze     | TENANT   | chioma@lodgist.ng      |
| Amina Yusuf    | TENANT   | amina@lodgist.ng       |

## Seed Data Summary

| Table            | Count | Details                                              |
|------------------|-------|------------------------------------------------------|
| Roles            | 3     | STUDIO_ADMIN, LANDLORD, TENANT                       |
| Users            | 5     | 1 admin, 2 landlords, 2 tenants                      |
| Properties       | 12    | Across Lagos, FCT, Rivers, Imo, Enugu, Edo           |
| Listings         | 12    | ₦350K–₦1.8M monthly, all available                   |
| ListingImages    | 24–36 | 2–3 images per listing                               |
| Reviews          | 24    | 2 per listing (Chioma + Amina), 4–5 stars            |
| Bookings         | 3     | 1 pending (Lekki), 1 confirmed (Wuse), 1 cancelled (VI) |
| TruthIndexScores | 12    | Scores 80–95 with breakdown JSON                     |

## Properties & Listings

| # | Address                                                | City             | State   | Owner         | Monthly Price (₦) | Truth Index |
|---|--------------------------------------------------------|------------------|---------|---------------|-------------------|-------------|
| 1 | 15B Admiralty Way, Lekki Phase 1                       | Lekki            | Lagos   | Emeka Okafor  | 1,200,000         | 92          |
| 2 | 24 Durban Street, Wuse 2                               | Wuse             | FCT     | Emeka Okafor  | 900,000           | 88          |
| 3 | 8A Adeola Odeku, Victoria Island                       | Victoria Island  | Lagos   | Emeka Okafor  | 1,500,000         | 90          |
| 4 | 12 Forces Avenue, GRA Phase 2                          | Port Harcourt    | Rivers  | Fatima Bello  | 600,000           | 85          |
| 5 | 33B Bourdillon Road, Ikoyi                             | Ikoyi            | Lagos   | Emeka Okafor  | 1,800,000         | 95          |
| 6 | 5 Wetheral Road, Owerri Municipal                      | Owerri           | Imo     | Fatima Bello  | 350,000           | 82          |
| 7 | 77 Adeniran Ogunsanya Street, Surulere                 | Surulere         | Lagos   | Emeka Okafor  | 500,000           | 80          |
| 8 | 2 Aguiyi Ironsi Street, Maitama                        | Maitama          | FCT     | Fatima Bello  | 1,000,000         | 93          |
| 9 | 18 Ogui Road, Independence Layout                      | Enugu            | Enugu   | Fatima Bello  | 400,000           | 84          |
| 10| 45 Allen Avenue, Ikeja                                 | Ikeja            | Lagos   | Emeka Okafor  | 550,000           | 87          |
| 11| 9 Kano Street, Area 11, Garki                          | Garki            | FCT     | Fatima Bello  | 700,000           | 81          |
| 12| 30 Ihama Road, GRA                                     | Benin City       | Edo     | Fatima Bello  | 450,000           | 86          |

## Database

- **Host**: localhost:5432
- **Database**: lodgist_db
- **User**: lodgist_user
- **Password**: lodgist_pass
- **Studio**: http://localhost:5555
