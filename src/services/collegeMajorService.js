export async function fetchCollegeMajors(schoolId, collegeId, { signal } = {}) {
  if (!schoolId || !collegeId) return null;
  const response = await fetch(`/data/college-majors/${schoolId}/${collegeId}.json`, {
    signal,
    cache: "no-cache",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function getActiveMajors(majorData) {
  const majors = Array.isArray(majorData?.majors) ? majorData.majors : [];
  return majors.filter((major) => major.status !== "inactive");
}
