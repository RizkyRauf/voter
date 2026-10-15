export type ElectionStatus = "DRAFT" | "OPEN" | "CLOSED";

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Election {
  id: string;
  title: string;
  status: ElectionStatus;
  showResultsToVoters: boolean;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  createdAt: string;
}

export interface Voter {
  id: string;
  name: string;
  /** normalized (lowercase, collapsed whitespace) — used for duplicate detection */
  nameKey: string;
  hasVoted: boolean;
  createdAt: string;
  votedAt: string | null;
}

export interface Vote {
  id: string;
  voterId: string;
  candidateId: string;
  createdAt: string;
}

/** Snapshot of the tables that results computation reads. */
export interface ResultsInput {
  election: Election;
  candidates: Candidate[];
  votes: Vote[];
}

export interface CandidateResult {
  candidateId: string;
  name: string;
  votes: number;
  percentage: number;
}

export interface Results {
  status: ElectionStatus;
  totalVotes: number;
  results: CandidateResult[];
  winner: { candidateId: string; name: string } | null;
}
