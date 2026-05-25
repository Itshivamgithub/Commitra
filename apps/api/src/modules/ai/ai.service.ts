import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import logger from '../../lib/logger';
import { env } from '../../config/env';
import { buildSummaryPrompt, SUMMARY_SYSTEM_MESSAGE } from './prompts/summary.prompt';
import { buildActivityPrompt, ACTIVITY_SYSTEM_MESSAGE } from './prompts/activity.prompt';
import { buildRecommendationsPrompt, RECOMMENDATIONS_SYSTEM_MESSAGE } from './prompts/recommendations.prompt';
import { format, subDays } from 'date-fns';
import { cacheService } from '../../lib/cache.service';

export class AIService {
  private client: OpenAI | null = null;
  private readonly MODEL: string;
  private readonly DAILY_TOKEN_LIMIT = 100000;

  constructor() {
    if (env.OPENAI_API_KEY && !env.OPENAI_API_KEY.includes('placeholder')) {
      this.MODEL = env.OPENAI_MODEL;
      this.client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
      logger.info({ model: this.MODEL }, 'AI Service initialized with OpenAI');
    } else if (env.GROQ_API_KEY) {
      this.MODEL = env.GROQ_MODEL;
      this.client = new OpenAI({
        apiKey: env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      logger.info({ model: this.MODEL }, 'AI Service initialized with GROQ');
    } else {
      this.MODEL = 'none';
      logger.warn('Neither OPENAI_API_KEY nor GROQ_API_KEY provided. AI Insights will be unavailable.');
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw new Error('AI service is currently unavailable: AI provider API key is missing.');
    }
    return this.client;
  }

  private async checkTokenBudget() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const key = `ai:tokens:${today}`;
    
    const currentUsage = await redis.get(key);
    const usage = parseInt(currentUsage || '0');

    if (usage > this.DAILY_TOKEN_LIMIT) {
      throw new Error('Daily AI token budget exceeded. Please try again tomorrow.');
    }

    if (usage > 80000) {
      logger.warn({ usage, limit: this.DAILY_TOKEN_LIMIT }, 'AI token usage approaching limit');
    }
  }

  private async incrementTokenUsage(tokens: number) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const key = `ai:tokens:${today}`;
    await redis.incrby(key, tokens);
    await redis.expire(key, 25 * 3600); // 25 hours
  }

  async generateInsights(repositoryId: string, userId: string, types: ('summary' | 'activity' | 'recommendations')[]) {
    const client = this.getClient();
    await this.checkTokenBudget();

    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        healthScore: true,
      },
    });

    if (!repo) throw new Error('Repository not found');

    const ninetyDaysAgo = subDays(new Date(), 90);
    const [commits, prs, issues] = await Promise.all([
      prisma.commit.findMany({
        where: { repositoryId, committedAt: { gte: ninetyDaysAgo } },
        select: { authorLogin: true, committedAt: true },
      }),
      prisma.pullRequest.findMany({
        where: { repositoryId, createdAt: { gte: ninetyDaysAgo } },
      }),
      prisma.issue.findMany({
        where: { repositoryId, createdAt: { gte: ninetyDaysAgo } },
      }),
    ]);

    // Build compact context
    const context = {
      repo: {
        name: repo.name,
        language: repo.language,
        stars: repo.stars,
        description: repo.description,
      },
      last90Days: {
        commits: {
          total: commits.length,
          topAuthors: Array.from(new Set(commits.map(c => c.authorLogin))).slice(0, 5),
          byWeek: this.getWeeklyCommitCounts(commits),
        },
        prs: {
          total: prs.length,
          merged: prs.filter(p => p.state === 'merged').length,
          avgMergeHours: this.calculateAvgMergeTime(prs),
        },
        issues: {
          total: issues.length,
          open: issues.filter(i => i.state === 'open').length,
          closed: issues.filter(i => i.state === 'closed').length,
          topLabels: this.getTopLabels(issues),
        },
      },
      health: repo.healthScore ? {
        score: repo.healthScore.overallScore,
        grade: repo.healthScore.grade,
        insights: repo.healthScore.insights,
      } : null,
    };

    const results = [];

    for (const type of types) {
      let systemMessage = '';
      let userPrompt = '';

      if (type === 'summary') {
        systemMessage = SUMMARY_SYSTEM_MESSAGE;
        userPrompt = buildSummaryPrompt(context);
      } else if (type === 'activity') {
        systemMessage = ACTIVITY_SYSTEM_MESSAGE;
        userPrompt = buildActivityPrompt(context);
      } else if (type === 'recommendations') {
        systemMessage = RECOMMENDATIONS_SYSTEM_MESSAGE;
        userPrompt = buildRecommendationsPrompt(context);
      }

      const response = await client.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0].message.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      await this.incrementTokenUsage(tokensUsed);

      const provider = env.OPENAI_API_KEY && !env.OPENAI_API_KEY.includes('placeholder') ? 'openai' : 'groq';

      const insight = await prisma.aIInsight.upsert({
        where: {
          repositoryId_type: { repositoryId, type },
        },
        update: {
          content,
          tokensUsed,
          modelUsed: `${provider}:${this.MODEL}`,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
          repositoryId,
          type,
          content,
          tokensUsed,
          modelUsed: `${provider}:${this.MODEL}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      results.push(insight);
    }

    // Invalidate AI cache for this repo
    await cacheService.invalidatePattern(`ai:insights:${repositoryId}*`);

    return results;
  }

  private getWeeklyCommitCounts(commits: any[]) {
    const weeks: number[] = new Array(13).fill(0);
    const now = new Date();
    commits.forEach(c => {
      const diff = this.differenceInHours(now, new Date(c.committedAt)) / (24 * 7);
      const weekIdx = Math.floor(diff);
      if (weekIdx >= 0 && weekIdx < 13) {
        weeks[weekIdx]++;
      }
    });
    return weeks.reverse();
  }

  private calculateAvgMergeTime(prs: any[]) {
    const merged = prs.filter(p => p.state === 'merged' && p.mergedAt);
    if (merged.length === 0) return 0;
    const total = merged.reduce((sum, p) => sum + this.differenceInHours(new Date(p.mergedAt!), new Date(p.createdAt)), 0);
    return total / merged.length;
  }

  private getTopLabels(issues: any[]) {
    const labelsMap: Record<string, number> = {};
    issues.forEach(i => {
      if (Array.isArray(i.labels)) {
        i.labels.forEach((l: string) => {
          labelsMap[l] = (labelsMap[l] || 0) + 1;
        });
      }
    });
    return Object.entries(labelsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([l]) => l);
  }

  private differenceInHours(date1: Date, date2: Date) {
    return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60);
  }

  async getInsights(repositoryId: string) {
    const key = `ai:insights:${repositoryId}`;
    const tag = `repo:${repositoryId}`;

    return cacheService.getOrSet(key, async () => {
      const insights = await prisma.aIInsight.findMany({
        where: { repositoryId },
      });

      const result: any = {};
      const now = new Date();

      insights.forEach((i: any) => {
        result[i.type] = {
          content: i.content,
          generatedAt: new Date(i.generatedAt).toISOString(),
          expired: new Date(i.expiresAt).getTime() < now.getTime(),
        };
      });

      const finalResult = {
        insights: result,
        hasInsights: insights.length > 0,
      };

      await cacheService.tagKey(tag, key);
      return finalResult;
    }, 3600);
  }
}

export const aiService = new AIService();
export default aiService;
