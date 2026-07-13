# School Detail Data

This directory stores per-school detail JSON files.

File naming:

```text
${school.id}.json
```

School-level detail files should maintain the official academic unit directory. Per-college recommendation notices, requirements, materials, assessment, timeline, and sources should be written to:

```text
public/data/college-details/${schoolId}/${collegeId}.json
```

Expected school detail structure:

```json
{
  "schoolId": "string",
  "name": "string",
  "status": "building",
  "lastUpdated": null,
  "academicUnits": [
    {
      "id": "unit-stable-id",
      "name": "经济管理学院",
      "unitType": "学院",
      "aliases": [],
      "officialWebsite": "",
      "sourceUrl": "https://www.example.edu.cn/...",
      "graduateAdmissionsRelevant": null,
      "dataStatus": "building",
      "confidence": 0.6,
      "lastCheckedAt": "2026-07-13T00:00:00.000Z"
    }
  ],
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

Supported `unitType` values:

- `学院`
- `学部`
- `系`
- `研究院`
- `书院`
- `研究中心`
- `其他`

Supported `dataStatus` values:

- `verified`: manually verified from an official source.
- `pending-review`: crawler candidate needs manual review; the frontend does not show it by default.
- `building`: known placeholder or unverified directory item.
- `inactive`: historical or inactive item; the frontend does not show it by default.

Compatibility note:

Older files may still contain `colleges`. The frontend converts those entries to `academicUnits` at runtime. New data should use `academicUnits`.

Crawler rule:

Do not fill this directory with guessed unit names. New entries must come from official school pages, graduate admission pages, department pages, or manually reviewed official sources.
