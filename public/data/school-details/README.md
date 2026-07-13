# School Detail Data

This directory is reserved for per-school detail JSON files.

File naming:

```text
${school.id}.json
```

Expected structure:

```json
{
  "schoolId": "string",
  "name": "string",
  "status": "building",
  "lastUpdated": null,
  "colleges": [
    {
      "id": "economics-management",
      "name": "经济管理学院",
      "officialWebsite": "",
      "majorNames": [],
      "dataStatus": "building"
    }
  ],
  "overview": {
    "officialWebsite": "",
    "graduateWebsite": "",
    "introduction": "",
    "advantages": []
  },
  "recommendation": {
    "generalPolicy": null,
    "summerCamps": [],
    "preRecommendation": [],
    "finalRecommendation": []
  },
  "requirements": {},
  "materials": [],
  "assessment": [],
  "timeline": [],
  "departments": [],
  "experiencePosts": [],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "sourceType": "school",
      "publishedAt": null,
      "crawledAt": "string",
      "lastCheckedAt": "string"
    }
  ]
}
```

Do not fill this directory with unverified school detail content. Future data should come from official graduate school, admissions office, department, or official notice sources.

School-level detail files should mainly maintain the college directory. Per-college recommendation notices, requirements, materials, assessment, timeline, and sources should be written to `public/data/college-details/${schoolId}/${collegeId}.json`.

Supported `sourceType` values:

- `school`
- `graduate-school`
- `department`
- `official-notice`
