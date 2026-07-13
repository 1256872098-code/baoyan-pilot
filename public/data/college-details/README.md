# College Detail Data

This directory is reserved for per-college recommendation detail JSON files.

File naming:

```text
public/data/college-details/${schoolId}/${collegeId}.json
```

Expected structure:

```json
{
  "schoolId": "string",
  "collegeId": "string",
  "collegeName": "string",
  "officialWebsite": "",
  "majors": [],
  "notices": [],
  "requirements": [],
  "materials": [],
  "assessment": [],
  "timeline": [],
  "sources": [],
  "lastUpdated": null
}
```

Future crawler output should follow:

```text
school -> college -> major -> notices and materials
```

Crawlers and parsers must write normalized college detail JSON files here. They must not modify React page components directly.
