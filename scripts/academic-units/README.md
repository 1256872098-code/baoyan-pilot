# Academic Units Crawler

This framework incrementally collects official school academic unit directories.

Scope:

- 学院
- 学部
- 系
- 研究院
- 书院
- 研究中心
- Other official graduate admission or training units

Rules:

- Do not guess unit names.
- Do not use encyclopedia, training agency, social media, or unofficial aggregation pages.
- Keep `sourceUrl` for every candidate.
- Do not write `verified` data without an official source.
- Low-confidence, conflicting, or abnormal results go to `scripts/review/academic-units-review.json`.
- Existing `verified` records are preserved unless a later official source proves a merge or rename.

Commands:

```bash
npm run crawl:units -- --limit 10 --offset 0
npm run crawl:units:school -- peking-university
npm run validate:units
npm run report:units
```

Before crawling:

1. Add or enable sources in `scripts/source-registry/school-unit-sources.json`.
2. Start with one school or a small batch.
3. Review `scripts/review/academic-units-review.json` before promoting data to `verified`.
