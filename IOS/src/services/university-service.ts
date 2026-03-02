const ENDPOINTS = [
  "https://universities.hipolabs.com/search",
  "http://universities.hipolabs.com/search",
];

interface HipolabsUniversity {
  name?: unknown;
}

export async function searchUniversities(query: string): Promise<string[]> {
  const name = query.trim();
  if (name.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    name,
    country: "United States",
  });

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as HipolabsUniversity[];
      const names = data
        .map((school) => (typeof school.name === "string" ? school.name : null))
        .filter((value): value is string => Boolean(value));

      return Array.from(new Set(names)).slice(0, 10);
    } catch {
      // Try next endpoint.
    }
  }

  throw new Error("University lookup service is unavailable right now.");
}
