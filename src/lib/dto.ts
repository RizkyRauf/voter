export type ElectionStatus = "DRAFT" | "OPEN" | "CLOSED";

export interface CandidateDto {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
}

export interface PublicElectionDto {
  title: string;
  status: ElectionStatus;
  showResultsToVoters: boolean;
  startedAt: string | null;
  closedAt: string | null;
  candidates: CandidateDto[];
}

export interface ElectionAdminDto {
  title: string;
  status: ElectionStatus;
  showResultsToVoters: boolean;
  startedAt: string | null;
  closedAt: string | null;
}

export interface CandidateResultDto {
  candidateId: string;
  name: string;
  votes: number;
  percentage: number;
}

export interface ResultsDto {
  status: ElectionStatus;
  totalVotes: number;
  results: CandidateResultDto[];
  winner: { candidateId: string; name: string } | null;
}

export interface VoterDto {
  id: string;
  code: string;
  hasVoted: boolean;
  createdAt: string;
}

export interface VotersDto {
  total: number;
  votedCount: number;
  voters: VoterDto[];
}

export interface VoterMeDto {
  authenticated: boolean;
  hasVoted?: boolean;
}
