export type ElectionStatus = "DRAFT" | "OPEN" | "CLOSED";

export interface CandidateDto {
  id: string;
  name: string;
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
  /** True bila daftar dipotong ke 5 peringkat teratas (tampilan publik). */
  truncated: boolean;
}

export interface VoterDto {
  id: string;
  name: string;
  hasVoted: boolean;
  /** Nama peserta yang dipilih pemilih ini; null bila belum memilih. */
  choice: string | null;
  votedAt: string | null;
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
