# Crawlers

Future crawlers will collect public information from official graduate school websites, admissions office pages, department pages, and official recommendation notices.

Rules:

- Crawlers must not modify React page components directly.
- Crawlers should write raw or normalized output into `scripts/outputs/`.
- Parsed data should be converted into the unified `public/data/school-details/${school.id}.json` format.
- Do not generate unverified recommendation policies, timelines, requirements, departments, or source links.
