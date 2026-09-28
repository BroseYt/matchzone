import { footballFetch } from "./footballApi";

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export async function getExtendedMatches(dateFrom, dateTo) {
  try {
    const response = await footballFetch(
      `/extended/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );

    if (!response.ok) return [];

    const data = await response.json();
    const start = dateValue(`${dateFrom}T00:00:00Z`);
    const end = dateValue(`${dateTo}T23:59:59Z`);

    return (data.matches || [])
      .filter((match) => {
        const kickoff = dateValue(match.utcDate);
        return (
          kickoff != null &&
          (start == null || kickoff >= start) &&
          (end == null || kickoff <= end)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.utcDate).getTime() -
          new Date(b.utcDate).getTime()
      );
  } catch (error) {
    console.log("EXTENDED MATCHES ERROR:", error);
    return [];
  }
}

export async function getExtendedLiveMatches() {
  try {
    const response = await footballFetch("/extended/live");

    if (!response.ok) return [];

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.log("EXTENDED LIVE MATCHES ERROR:", error);
    return [];
  }
}
