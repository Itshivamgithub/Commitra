export interface User {
  id: string;
  githubId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date | string;
  createdAt: Date | string;
}

export interface Repository {
  id: string;
  githubId: string;
  userId: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
  githubUrl: string;
  lastPushedAt: Date | string | null;
  githubCreatedAt: Date | string | null;
  lastAnalyzedAt: Date | string | null;
  syncedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: any };

export * from './jobs';
export * from './socket';
