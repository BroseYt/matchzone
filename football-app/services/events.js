import { footballFetch } from "./footballApi";

export async function getMatchEvents(
  matchId
) {
  try {
    const external = String(matchId || "").startsWith("ext-");
    const response = await footballFetch(
      external
        ? `/extended/matches/${matchId}`
        : `/enriched/matches/${matchId}`
    );

    const data =
      await response.json();

    return [
      ...(data.goals || []),
      ...(data.bookings || []),
      ...(data.substitutions || []),
      ...(data.varDecisions || []),
    ];
  } catch (error) {
    console.log(error);

    return [];
  }
}
