import { prisma } from '../../lib/prisma';
import { cacheService } from '../../lib/cache.service';
import logger from '../../lib/logger';
import { subDays, startOfDay, format } from 'date-fns';

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export class WorkspacesService {
  async requireRole(userId: string, workspaceSlug: string, minRole: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { userId, workspace: { slug: workspaceSlug } },
      include: { workspace: true }
    });

    if (!member) {
      throw new Error('Unauthorized: You are not a member of this workspace');
    }

    const currentRoleLevel = ROLE_HIERARCHY[member.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minRole] || 0;

    if (currentRoleLevel < requiredRoleLevel) {
      throw new Error(`Forbidden: Requires ${minRole} role or higher`);
    }

    return member;
  }

  async createWorkspace(userId: string, data: { name: string; slug: string; githubOrgLogin?: string }) {
    // Validate slug uniqueness
    const existing = await prisma.workspace.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new Error('Workspace with this slug already exists');
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        githubOrgLogin: data.githubOrgLogin,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner',
          }
        }
      }
    });

    return workspace;
  }

  async getUserWorkspaces(userId: string) {
    const members = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true, repositories: true }
            }
          }
        }
      }
    });

    return members.map(m => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
      repoCount: m.workspace._count.repositories,
    }));
  }

  async getWorkspaceBySlug(userId: string, slug: string) {
    const member = await this.requireRole(userId, slug, 'viewer');

    const workspace = await prisma.workspace.findUnique({
      where: { slug },
      include: {
        members: {
          include: { user: true }
        },
        repositories: {
          include: { repository: true }
        }
      }
    });

    if (!workspace) throw new Error('Workspace not found');

    return {
      workspace,
      members: workspace.members.map(m => ({
        ...m,
        user: {
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl
        }
      })),
      repositories: workspace.repositories.map(r => r.repository),
      userRole: member.role
    };
  }

  async updateWorkspace(userId: string, slug: string, data: { name?: string; avatarUrl?: string }) {
    const member = await this.requireRole(userId, slug, 'admin');

    return prisma.workspace.update({
      where: { id: member.workspaceId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      }
    });
  }

  async deleteWorkspace(userId: string, slug: string) {
    const member = await this.requireRole(userId, slug, 'owner');

    await prisma.workspace.delete({
      where: { id: member.workspaceId }
    });

    return true;
  }

  // --- MEMBER MANAGEMENT ---

  async getMembers(userId: string, slug: string) {
    await this.requireRole(userId, slug, 'member');
    const workspace = await prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new Error('Workspace not found');

    return prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true }
    });
  }

  async updateMemberRole(userId: string, slug: string, targetUserId: string, newRole: string) {
    const member = await this.requireRole(userId, slug, 'admin');

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: member.workspaceId, userId: targetUserId } }
    });

    if (!targetMember) throw new Error('Target user is not a member');
    if (targetMember.role === 'owner') throw new Error('Cannot change the role of the workspace owner');
    if (newRole === 'owner') throw new Error('Cannot promote member to owner. Ownership transfer not supported.');

    return prisma.workspaceMember.update({
      where: { id: targetMember.id },
      data: { role: newRole }
    });
  }

  async removeMember(userId: string, slug: string, targetUserId: string) {
    const workspace = await prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new Error('Workspace not found');

    if (userId === targetUserId) {
      // Self-removal allowed
      const targetMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: targetUserId } }
      });
      if (!targetMember) throw new Error('You are not a member');
      if (targetMember.role === 'owner') throw new Error('Owner cannot leave workspace. Delete it instead.');
    } else {
      // Removing someone else requires admin
      await this.requireRole(userId, slug, 'admin');
      const targetMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: targetUserId } }
      });
      if (!targetMember) throw new Error('Target user is not a member');
      if (targetMember.role === 'owner') throw new Error('Cannot remove the workspace owner');
    }

    return prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: targetUserId } }
    });
  }

  // --- REPO MANAGEMENT ---

  async addRepository(userId: string, slug: string, repositoryId: string) {
    const member = await this.requireRole(userId, slug, 'member');

    // Verify user owns the repo
    const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.userId !== userId) {
      throw new Error('You do not own this repository or it does not exist');
    }

    return prisma.workspaceRepository.create({
      data: {
        workspaceId: member.workspaceId,
        repositoryId,
        addedBy: userId
      }
    });
  }

  async removeRepository(userId: string, slug: string, repositoryId: string) {
    const member = await this.requireRole(userId, slug, 'admin');

    return prisma.workspaceRepository.delete({
      where: {
        workspaceId_repositoryId: {
          workspaceId: member.workspaceId,
          repositoryId
        }
      }
    });
  }

  // --- ANALYTICS AGGREGATION ---

  async getWorkspaceAnalytics(userId: string, slug: string) {
    const member = await this.requireRole(userId, slug, 'viewer');
    const workspaceId = member.workspaceId;

    const key = `workspace:${slug}:analytics`;

    return cacheService.getOrSet(key, async () => {
      const workspaceRepos = await prisma.workspaceRepository.findMany({
        where: { workspaceId },
        include: { repository: { include: { healthScore: true } } }
      });

      const repoIds = workspaceRepos.map(wr => wr.repositoryId);
      const repos = workspaceRepos.map(wr => wr.repository);

      if (repoIds.length === 0) {
        return {
          totalRepos: 0, totalCommits: 0, totalPRs: 0, mergedPRs: 0,
          totalIssues: 0, activeContributors: 0, avgHealthScore: 0,
          topContributors: [], repoHealthRanking: [], commitTimeline: []
        };
      }

      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));

      const [commits, prs, issues, snapshots] = await Promise.all([
        prisma.commit.findMany({
          where: { repositoryId: { in: repoIds }, committedAt: { gte: thirtyDaysAgo } }
        }),
        prisma.pullRequest.findMany({
          where: { repositoryId: { in: repoIds }, createdAt: { gte: thirtyDaysAgo } }
        }),
        prisma.issue.findMany({
          where: { repositoryId: { in: repoIds }, createdAt: { gte: thirtyDaysAgo } }
        }),
        prisma.analyticsSnapshot.findMany({
          where: { repositoryId: { in: repoIds }, snapshotDate: { gte: thirtyDaysAgo } },
          orderBy: { snapshotDate: 'asc' }
        })
      ]);

      const totalCommits = commits.length;
      const totalPRs = prs.length;
      const mergedPRs = prs.filter(p => p.state === 'merged').length;
      const totalIssues = issues.length;
      
      const contributorsMap: Record<string, { commits: number, repos: Set<string> }> = {};
      commits.forEach(c => {
        const login = c.authorLogin || 'unknown';
        if (!contributorsMap[login]) {
          contributorsMap[login] = { commits: 0, repos: new Set() };
        }
        contributorsMap[login].commits++;
        contributorsMap[login].repos.add(c.repositoryId);
      });

      const activeContributors = Object.keys(contributorsMap).length;
      const topContributors = Object.entries(contributorsMap)
        .sort((a, b) => b[1].commits - a[1].commits)
        .slice(0, 10)
        .map(([login, data]) => ({
          login,
          commits: data.commits,
          repos: Array.from(data.repos)
        }));

      const reposWithHealth = repos.filter(r => r.healthScore);
      const avgHealthScore = reposWithHealth.length > 0
        ? reposWithHealth.reduce((sum, r) => sum + r.healthScore!.overallScore, 0) / reposWithHealth.length
        : 0;

      const repoHealthRanking = reposWithHealth
        .map(r => ({
          repoId: r.id,
          repoName: r.fullName,
          score: r.healthScore!.overallScore,
          grade: r.healthScore!.grade,
          lastAnalyzedAt: r.lastAnalyzedAt
        }))
        .sort((a, b) => b.score - a.score);

      // Commit timeline aggregation
      const timelineMap: Record<string, { totalCommits: number, byRepo: Record<string, number> }> = {};
      snapshots.forEach(s => {
        const dateStr = format(s.snapshotDate, 'yyyy-MM-dd');
        if (!timelineMap[dateStr]) {
          timelineMap[dateStr] = { totalCommits: 0, byRepo: {} };
        }
        timelineMap[dateStr].totalCommits += s.commitCount;
        timelineMap[dateStr].byRepo[s.repositoryId] = (timelineMap[dateStr].byRepo[s.repositoryId] || 0) + s.commitCount;
      });

      const commitTimeline = Object.entries(timelineMap).map(([date, data]) => ({
        date,
        totalCommits: data.totalCommits,
        byRepo: Object.entries(data.byRepo).map(([repoId, count]) => ({ repoId, count }))
      })).sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalRepos: repoIds.length,
        totalCommits,
        totalPRs,
        mergedPRs,
        totalIssues,
        activeContributors,
        avgHealthScore,
        topContributors,
        repoHealthRanking,
        commitTimeline
      };
    }, 3600);
  }
}

export const workspacesService = new WorkspacesService();
export default workspacesService;
