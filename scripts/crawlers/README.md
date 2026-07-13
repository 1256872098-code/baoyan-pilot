# Crawlers

Future crawlers will collect public information from official graduate school websites, admissions office pages, department pages, and official recommendation notices.

Rules:

- Crawlers must not modify React page components directly.
- Crawlers should write raw or normalized output into `scripts/outputs/`.
- Parsed data should be converted into the unified `public/data/school-details/${school.id}.json` format.
- Do not generate unverified recommendation policies, timelines, requirements, departments, or source links.
- Only crawl publicly accessible pages.
- Do not bypass login, captcha, rate limits, or access restrictions.
- Do not collect student personal information.
- Check robots.txt and site usage rules before enabling a source.
- Use request intervals and retry limits; do not make high-frequency concurrent requests.
- Keep original official links in every normalized notice.
- Do not publish full raw HTML in `public/`.
