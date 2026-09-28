import { footballFetch } from "./footballApi";

export async function getTeamSquad(
  teamId
) {
  try {
    if (String(teamId || "").startsWith("ext-")) {
      const response = await footballFetch(
        `/extended/teams/${teamId}/squad`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.squad || [];
    }

    const response =
      await footballFetch(
        `https://api.football-data.org/v4/teams/${teamId}`,
      );

    const data =
      await response.json();

    return (
      data.squad || []
    );
  } catch (error) {
    console.log(error);

    return [];
  }
}
