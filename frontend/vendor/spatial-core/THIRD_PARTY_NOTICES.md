# Third-party notices

God's Eye View source pin: https://github.com/bilawalsidhu/gods-eye-view commit `6be25595b16491ce01ffd8d81e66921f321ee200`. MIT covers that repository's source code only. No datasets, imagery, models, event packs, or provider payloads were copied.

| Destination | Upstream path | Upstream SHA | Modifications |
|---|---|---|---|
| `packages/spatial-core/src/readCappedResponseText.cjs` | `server/providers/common/http.js` (`readCappedResponseText`) | `6be25595b16491ce01ffd8d81e66921f321ee200` | ESM converted to CommonJS. Dropped the re-exports of `src/sources/httpBody.js`. The content-length read also accepts a plain header object so tests can pass a fetch mock. Copyright and MIT notice stay in the file. |

Everything else in this package is Lodgist code. The proxy rules, budget fallback, freshness contract, and Overpass way/area builder follow GEV's behavior and were reimplemented because the upstream modules are tied to GEV's server, globals, or provider setup.
