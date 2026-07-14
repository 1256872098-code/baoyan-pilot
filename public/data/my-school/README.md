# BaoyanPilot My School Data

This directory is reserved for verified school-specific recommendation data.

Future data files should use a structure similar to:

```json
{
  "schoolId": "school-id",
  "schoolName": "学校名称",
  "years": [
    {
      "year": 2026,
      "totalStudents": null,
      "recommendedStudents": null,
      "recommendationRate": null,
      "sourceUrl": "",
      "dataStatus": "pending-review"
    }
  ],
  "colleges": [],
  "policies": [],
  "lastUpdatedAt": null
}
```

Do not add estimated recommendation rates, quota numbers, or unofficial policy data here.
