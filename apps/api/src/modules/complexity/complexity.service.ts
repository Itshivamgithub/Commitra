import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import logger from '../../lib/logger';
import { createGithubClient } from '../../lib/github';
import path from 'path';

export class ComplexityService {
  private readonly LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.go': 'Go', '.rs': 'Rust',
    '.java': 'Java', '.cs': 'C#', '.cpp': 'C++',
    '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
    '.kt': 'Kotlin', '.md': 'Markdown',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.css': 'CSS', '.scss': 'SCSS', '.html': 'HTML'
  };

  async analyzeRepository(repoFullName: string, githubToken: string, repositoryId: string, defaultBranch: string = 'main') {
    logger.info({ repoFullName, repositoryId }, 'Starting complexity analysis');

    try {
      const github = createGithubClient(githubToken);
      
      // Step 1 - Fetch file tree
      const response = await github.get(`/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`);
      const tree = response.data.tree;
      const blobs = tree.filter((item: any) => item.type === 'blob');

      // Step 2 - Analyze files
      const totalFiles = blobs.length;
      let totalSize = 0;
      const fileTypeCount: Record<string, number> = {};
      const languageCounts: Record<string, number> = {};
      const largeFiles: any[] = [];

      blobs.forEach((item: any) => {
        totalSize += item.size || 0;
        const ext = path.extname(item.path).toLowerCase() || 'no extension';
        fileTypeCount[ext] = (fileTypeCount[ext] || 0) + 1;

        const lang = this.LANGUAGE_MAP[ext] || 'Other';
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;

        largeFiles.push({ path: item.path, size: item.size || 0, lines: Math.round((item.size || 0) / 40) });
      });

      const sortedLargeFiles = largeFiles.sort((a, b) => b.size - a.size).slice(0, 10);
      
      const languageBreakdown: Record<string, number> = {};
      Object.entries(languageCounts).forEach(([lang, count]) => {
        languageBreakdown[lang] = Math.round((count / totalFiles) * 100);
      });

      const avgFileSizeBytes = totalFiles > 0 ? totalSize / totalFiles : 0;
      const totalLines = Math.round(totalSize / 40);

      // Step 3 - Complexity score
      let score = 0;
      
      // fileSizeScore
      if (avgFileSizeBytes >= 15000) score += 30;
      else if (avgFileSizeBytes >= 5000) score += 15;

      // largeFilePenalty
      const ultraLargeFiles = sortedLargeFiles.filter(f => f.size > 100 * 1024).length;
      score += Math.min(ultraLargeFiles * 5, 30);

      // fileCountScore
      if (totalFiles >= 1000) score += 30;
      else if (totalFiles >= 500) score += 20;
      else if (totalFiles >= 100) score += 10;

      // languageDiversityScore
      const langCount = Object.keys(languageCounts).length;
      if (langCount >= 5) score += 10;
      else if (langCount >= 3) score += 5;

      const complexityScore = Math.max(0, Math.min(100, score));

      // Step 4 - Upsert in DB
      const report = await prisma.complexityReport.upsert({
        where: { repositoryId },
        update: {
          totalFiles,
          totalLines,
          largeFiles: sortedLargeFiles,
          languageBreakdown,
          fileTypeCount,
          avgFileSizeBytes,
          complexityScore,
          generatedAt: new Date(),
        },
        create: {
          repositoryId,
          totalFiles,
          totalLines,
          largeFiles: sortedLargeFiles,
          languageBreakdown,
          fileTypeCount,
          avgFileSizeBytes,
          complexityScore,
        },
      });

      // Invalidate cache
      await redis.del(`complexity:${repositoryId}`);

      logger.info({ repositoryId, complexityScore }, 'Complexity analysis completed');
      return report;
    } catch (error: any) {
      logger.error({ repoFullName, error: error.message }, 'Complexity analysis failed');
      throw error;
    }
  }

  async getComplexityReport(repositoryId: string) {
    const key = `complexity:${repositoryId}`;
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const report = await prisma.complexityReport.findUnique({
      where: { repositoryId },
    });

    if (!report) return null;

    const data = {
      totalFiles: report.totalFiles,
      totalLines: report.totalLines,
      complexityScore: report.complexityScore,
      complexityLabel: this.getComplexityLabel(report.complexityScore),
      largeFiles: report.largeFiles,
      languageBreakdown: Object.entries(report.languageBreakdown as any).map(([language, percentage]) => ({ language, percentage: percentage as number })),
      fileTypeCount: Object.entries(report.fileTypeCount as any).map(([extension, count]) => ({ extension, count: count as number })),
      avgFileSizeBytes: report.avgFileSizeBytes,
      generatedAt: report.generatedAt.toISOString(),
    };

    await redis.setex(key, 6 * 3600, JSON.stringify(data));
    return data;
  }

  private getComplexityLabel(score: number): string {
    if (score < 25) return 'Simple';
    if (score < 50) return 'Moderate';
    if (score < 75) return 'Complex';
    return 'Very Complex';
  }
}

export const complexityService = new ComplexityService();
export default complexityService;
