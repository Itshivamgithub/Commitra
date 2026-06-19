import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { analyticsService } from '../analytics/analytics.service';
import logger from '../../lib/logger';

// ---------------------------------------------------------------------------
// PDFKit-based report generator — replaces Puppeteer/Chromium.
// Chromium needs 150-300 MB of RAM; PDFKit uses ~5 MB.
// This is critical for staying within the 512 MB Render instance limit.
// ---------------------------------------------------------------------------

const BRAND_COLOR = '#6366f1';   // indigo-500
const MUTED_COLOR = '#6b7280';   // gray-500
const TEXT_COLOR  = '#111827';   // gray-900
const LINE_COLOR  = '#e5e7eb';   // gray-200

function hr(doc: PDFKit.PDFDocument, y?: number) {
  const yPos = y ?? doc.y;
  doc.moveTo(doc.page.margins.left, yPos)
     .lineTo(doc.page.width - doc.page.margins.right, yPos)
     .strokeColor(LINE_COLOR)
     .lineWidth(0.5)
     .stroke();
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  hr(doc);
  doc.moveDown(0.4)
     .fillColor(BRAND_COLOR)
     .fontSize(13)
     .font('Helvetica-Bold')
     .text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.3);
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string | number | null | undefined) {
  doc.fillColor(MUTED_COLOR).fontSize(9).font('Helvetica').text(label, { continued: true })
     .fillColor(TEXT_COLOR).font('Helvetica-Bold').text(`: ${value ?? '—'}`);
}

export class ReportsService {
  async generatePDFReport(repoId: string, userId: string): Promise<Buffer> {
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: {
        healthScore: true,
        aiInsights: {
          orderBy: { generatedAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!repo) throw new Error('Repository not found or access denied');

    const [overview, commits, contributors, prs, issues, cicd] = await Promise.all([
      analyticsService.getOverview(repoId),
      analyticsService.getCommits(repoId, '30d'),
      analyticsService.getContributors(repoId),
      analyticsService.getPullRequests(repoId, '30d'),
      analyticsService.getIssues(repoId, '30d'),
      analyticsService.getCicd(repoId, '30d'),
    ]);

    logger.info({ repoId }, 'Generating PDF report with PDFKit');

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: `Commitra Report — ${repo.fullName}`,
          Author: 'Commitra',
          Subject: 'Repository Health Report',
          Creator: 'Commitra (commitra.app)',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ────────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 120)
         .fill(BRAND_COLOR);

      doc.fillColor('#ffffff')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('Commitra', doc.page.margins.left, 30, { align: 'left' });

      doc.fillColor('rgba(255,255,255,0.75)')
         .fontSize(10)
         .font('Helvetica')
         .text('Repository Health Report', doc.page.margins.left, 58);

      doc.fillColor('#ffffff')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(repo.fullName, doc.page.margins.left, 80);

      doc.y = 136;

      // ── Overview ──────────────────────────────────────────────────────────
      sectionHeading(doc, 'Repository Overview');
      doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica');
      kv(doc, 'Full Name',      repo.fullName);
      kv(doc, 'Default Branch', repo.defaultBranch ?? 'main');
      kv(doc, 'Last Analyzed',  repo.lastAnalyzedAt
        ? new Date(repo.lastAnalyzedAt).toLocaleDateString()
        : 'Never');
      kv(doc, 'Generated',      new Date().toLocaleDateString());

      // ── Health Score ──────────────────────────────────────────────────────
      if (repo.healthScore) {
        const h = repo.healthScore as any;
        sectionHeading(doc, 'Health Score');
        kv(doc, 'Overall',     `${h.overall ?? '—'} / 100`);
        kv(doc, 'Velocity',    h.velocity   ?? '—');
        kv(doc, 'Quality',     h.quality    ?? '—');
        kv(doc, 'Engagement',  h.engagement ?? '—');
        kv(doc, 'Reliability', h.reliability ?? '—');
      }

      // ── Activity (30 days) ────────────────────────────────────────────────
      sectionHeading(doc, 'Activity — Last 30 Days');
      const ov = overview as any;
      kv(doc, 'Total Commits',        ov?.totalCommits        ?? '—');
      kv(doc, 'Open Pull Requests',   ov?.openPRs             ?? '—');
      kv(doc, 'Open Issues',          ov?.openIssues          ?? '—');
      kv(doc, 'Active Contributors',  ov?.activeContributors  ?? '—');

      // ── Top Contributors ──────────────────────────────────────────────────
      const topContributors = (contributors as any)?.contributors?.slice(0, 5) ?? [];
      if (topContributors.length) {
        sectionHeading(doc, 'Top Contributors');
        topContributors.forEach((c: any, i: number) => {
          kv(doc, `${i + 1}. ${c.login ?? c.authorLogin ?? 'Unknown'}`, `${c.commits ?? c.commitCount ?? 0} commits`);
        });
      }

      // ── Pull Requests ─────────────────────────────────────────────────────
      const prStats = prs as any;
      sectionHeading(doc, 'Pull Requests — Last 30 Days');
      kv(doc, 'Opened',    prStats?.opened   ?? '—');
      kv(doc, 'Merged',    prStats?.merged   ?? '—');
      kv(doc, 'Closed',    prStats?.closed   ?? '—');
      kv(doc, 'Avg Merge Time', prStats?.avgMergeTime
        ? `${Math.round(prStats.avgMergeTime / 3600)} hrs`
        : '—');

      // ── Issues ────────────────────────────────────────────────────────────
      const issueStats = issues as any;
      sectionHeading(doc, 'Issues — Last 30 Days');
      kv(doc, 'Opened', issueStats?.opened ?? '—');
      kv(doc, 'Closed', issueStats?.closed ?? '—');
      kv(doc, 'Avg Close Time', issueStats?.avgCloseTime
        ? `${Math.round(issueStats.avgCloseTime / 3600)} hrs`
        : '—');

      // ── CI/CD ─────────────────────────────────────────────────────────────
      const ciStats = cicd as any;
      sectionHeading(doc, 'CI/CD — Last 30 Days');
      kv(doc, 'Total Runs',    ciStats?.totalRuns    ?? '—');
      kv(doc, 'Success Rate',  ciStats?.successRate != null
        ? `${Math.round(ciStats.successRate * 100)}%`
        : '—');
      kv(doc, 'Avg Duration',  ciStats?.avgDuration != null
        ? `${Math.round(ciStats.avgDuration / 60)} min`
        : '—');

      // ── AI Insights ───────────────────────────────────────────────────────
      if (repo.aiInsights?.length) {
        sectionHeading(doc, 'AI Insights');
        repo.aiInsights.forEach((insight: any) => {
          doc.moveDown(0.3)
             .fillColor(TEXT_COLOR)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(insight.title ?? insight.type ?? 'Insight');

          doc.fillColor(MUTED_COLOR)
             .fontSize(9)
             .font('Helvetica')
             .text(insight.content ?? insight.summary ?? '', { indent: 10, width: 440 });
        });
      }

      // ── Footer on every page ──────────────────────────────────────────────
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(pages.start + i);
        const footerY = doc.page.height - doc.page.margins.bottom + 10;
        doc.fillColor(MUTED_COLOR)
           .fontSize(8)
           .font('Helvetica')
           .text(
             `Generated by Commitra · commitra.app · ${new Date().toLocaleDateString()}`,
             doc.page.margins.left,
             footerY,
             { align: 'left', width: 300 }
           )
           .text(`Page ${i + 1} of ${pages.count}`, doc.page.margins.left, footerY, {
             align: 'right',
             width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
           });
      }

      doc.end();
    });
  }
}

export const reportsService = new ReportsService();
export default reportsService;
