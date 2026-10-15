import type { CandidateResult, Db, Results } from "./types";

/**
 * Aggregate vote counts. Public consumers only ever see these aggregates —
 * never which voter picked which candidate (PRD 7.4).
 */
export function computeResults(db: Db): Results {
  const totalVotes = db.votes.length;
  const counts = new Map<string, number>();
  for (const candidate of db.candidates) counts.set(candidate.id, 0);
  for (const vote of db.votes) {
    counts.set(vote.candidateId, (counts.get(vote.candidateId) ?? 0) + 1);
  }

  const results: CandidateResult[] = db.candidates
    .map((c) => {
      const votes = counts.get(c.id) ?? 0;
      return {
        candidateId: c.id,
        name: c.name,
        votes,
        percentage: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10,
      };
    })
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  const hasClearLeader =
    totalVotes > 0 && results.length > 0 &&
    (results.length === 1 || results[0]!.votes > results[1]!.votes);

  return {
    status: db.election.status,
    totalVotes,
    results,
    winner: hasClearLeader
      ? { candidateId: results[0]!.candidateId, name: results[0]!.name }
      : null,
  };
}
