const TEAM_RULES = {
  "T5 Advisors": [
    "Branson",
    "Cody",
    "Matt Davis",
    "Eric Kelley",
    "Chance",
  ],
  Strad: [
    "Brad",
    "Steelman",
  ],
  AGTeam: [
    "Austin",
    "Gunnar",
  ],
  "MC$": [
    "Cale",
    "Matthew Simmons",
  ],
  "QSR Team": [
    "Drew",
    "Justin Dillon",
    "Jacob Mace",
  ],
};

function getListingLeaderName(agentName) {
  const normalizedAgent = String(agentName || "").toLowerCase();

  for (const [teamName, members] of Object.entries(TEAM_RULES)) {
    const isTeamMember = members.some((member) =>
      normalizedAgent.includes(member.toLowerCase())
    );

    if (isTeamMember) {
      return teamName;
    }
  }

  return agentName || "Unassigned";
}

module.exports = {
  TEAM_RULES,
  getListingLeaderName,
};