# Railway inventory

CLI: `railway whoami` returned `Unauthorized`. No `railway link` and no `railway status`. Nothing was deleted.

Source: the already authenticated Railway session, 2026-09-26. `railway list` was not available.

| Mark | Project | ID | Services | lodgist.online |
|---|---|---|---|---|
| KEEP | `'` | `46e8a12a-4123-4de8-b904-46b3883fb9be` | `lodgist`, `Postgres` | Yes. `lodgist` serves `https://lodgist.online` and `https://lodgist-production.up.railway.app` |
| KEEP | shadowspark-tech | `d6568fa9-b472-452a-8381-594fb07a0c01` | `shadowspark-tech` | No. Custom domain `https://shadowspark-tech.com` |
| KEEP | shadowspark-website | `020e1780-56d2-4c9f-a6ed-7bd550f6d52a` | `shadowspark-website` | No. `https://shadowspark-website-production.up.railway.app` |
| DELETED | dependable-solace | `16785530-f92a-4ddc-93a7-04be01f7afb7` | none (was `lodgist-backend`) | No |
| DELETED | secure-clarity | `eaf0bcb3-c7f6-4de1-9e90-64892ef36b97` | none (was `lodgist-backend`) | No |
| DELETED | romantic-victory | `f643f976-554d-493b-9d4b-17b3f54301f7` | none (was `Postgres`) | No |

Approved 2026-09-26. Those three services were deleted. The empty projects remain. `romantic-victory` volume `postgres-volume` (`26779798-f32c-4743-8b90-37b04ef0ded3`) was detached and kept. `lodgist.online` is still on service `lodgist`.
