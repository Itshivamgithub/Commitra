export type SyncRepoJobData = {
  repositoryId: string
  repoFullName: string
  userId: string
  triggeredBy: 'manual' | 'webhook' | 'scheduled'
}

export type GenerateHealthJobData = {
  repositoryId: string
  userId: string
}

export type GenerateInsightsJobData = {
  repositoryId: string
  userId: string
  insightTypes: ('summary' | 'activity' | 'recommendations')[]
}
