/**
 * Types for the Shadow Git extension
 */

export type ShadowGitType = 'main' | 'working';

export interface Snapshot {
  hash: string;
  content: string;
  timestamp: number;
  lines: string[];
}

export interface Change {
  id: number;
  type: 'addition' | 'modification' | 'deletion';
  startLine: number;
  endLine: number;
  content: string;
  approved: boolean | null;
}

export interface Checkpoint {
  id: string;
  message: string;
  timestamp: number;
  changes: Record<string, Change[]>;
  type: ShadowGitType;
}