export function normalizeSchools(value) {
  return Array.isArray(value) ? value : [];
}

export async function fetchSchools({ signal } = {}) {
  const response = await fetch("/data/schools.json", {
    signal,
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return normalizeSchools(await response.json());
}

export async function fetchSchoolDetail(schoolId, { signal } = {}) {
  const response = await fetch(`/data/school-details/${schoolId}.json`, {
    signal,
    cache: "no-cache",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchCollegeDetail(schoolId, collegeId, { signal } = {}) {
  const response = await fetch(`/data/college-details/${schoolId}/${collegeId}.json`, {
    signal,
    cache: "no-cache",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
