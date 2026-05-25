export function buildReportHTML(data: any): string {
  const { repo, overview, commits, contributors, prs, issues, cicd, healthScore, aiInsights } = data;

  const sparklineSVG = buildSparkline(commits.timeline);
  const healthBarsHTML = buildHealthBars(healthScore);

  let aiSummaryHTML = '';
  const summaryInsight = aiInsights?.find((i: any) => i.type === 'summary');
  if (summaryInsight) {
    aiSummaryHTML = `
      <div class="ai-block">
        <h3>AI Summary</h3>
        <p>${summaryInsight.content}</p>
      </div>
    `;
  }

  let recommendationsHTML = '';
  const recInsight = aiInsights?.find((i: any) => i.type === 'recommendations');
  if (recInsight) {
    recommendationsHTML = `
      <div class="ai-block section">
        <h3>AI Recommendations</h3>
        <pre style="font-family: inherit; white-space: pre-wrap;">${recInsight.content}</pre>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Commitra Report - ${repo.name}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .header { margin-bottom: 32px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 800; color: #111827; }
        .header p { margin: 4px 0; color: #6b7280; font-size: 14px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #f3f4f6; color: #374151; margin-right: 8px; }
        .section { margin-bottom: 32px; page-break-inside: avoid; }
        .section h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .stat-card p { margin: 0; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-card h3 { margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #111827; }
        table { w-width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
        th { font-weight: 600; color: #6b7280; }
        .health-score { text-align: center; margin: 24px 0; }
        .health-score h3 { font-size: 48px; font-weight: 800; margin: 0; color: #111827; }
        .ai-block { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 24px; }
        .ai-block h3 { margin: 0 0 8px; font-size: 16px; color: #166534; }
        .ai-block p { margin: 0; color: #14532d; font-size: 14px; }
        .sparkline { margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="font-size: 12px; font-weight: 700; color: #4f46e5; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em;">Commitra Analytics Report</div>
        <h1>${repo.name}</h1>
        <p>${repo.fullName}</p>
        <div style="margin-top: 12px;">
          ${repo.language ? `<span class="badge">${repo.language}</span>` : ''}
          <span class="badge">★ ${repo.stars}</span>
          <span class="badge">⑂ ${repo.forks}</span>
        </div>
        <p style="margin-top: 16px; font-size: 12px;">Report period: Last 30 days &middot; Generated ${new Date().toLocaleString()}</p>
      </div>

      <div class="section">
        <h2>Executive Summary</h2>
        <div class="grid-3">
          <div class="stat-card">
            <p>Total Commits</p>
            <h3>${overview.totalCommits}</h3>
          </div>
          <div class="stat-card">
            <p>Merged PRs</p>
            <h3>${overview.mergedPRs}</h3>
          </div>
          <div class="stat-card">
            <p>Closed Issues</p>
            <h3>${overview.closedIssues}</h3>
          </div>
        </div>
        
        ${healthScore ? `
          <div class="health-score">
            <p style="font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Overall Health Score</p>
            <h3>${Math.round(healthScore.overallScore)} <span style="font-size: 24px; color: #4f46e5;">(${healthScore.grade})</span></h3>
          </div>
        ` : ''}

        ${aiSummaryHTML}
      </div>

      <div class="section">
        <h2>Commit Activity</h2>
        <p style="font-size: 14px; color: #4a4a4a;">Total commits in period: <strong>${commits.totalInRange}</strong>. Peak day: <strong>${commits.peakDay.date} (${commits.peakDay.count} commits)</strong>.</p>
        <div class="sparkline">
          ${sparklineSVG}
        </div>
        <h3 style="font-size: 16px; margin-top: 24px;">Top Contributors</h3>
        <table>
          <tr><th>Contributor</th><th>Commits</th><th>Additions</th><th>Deletions</th></tr>
          ${contributors.map((c: any) => `
            <tr>
              <td><strong>${c.login}</strong></td>
              <td>${c.totalCommits}</td>
              <td style="color: #16a34a;">+${c.totalAdditions}</td>
              <td style="color: #dc2626;">-${c.totalDeletions}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="section">
        <h2>Pull Requests & Issues</h2>
        <div class="grid-3">
          <div class="stat-card">
            <p>Merge Rate</p>
            <h3>${Math.round(prs.mergeRate)}%</h3>
          </div>
          <div class="stat-card">
            <p>Avg Merge Time</p>
            <h3>${prs.avgMergeTimeHours.toFixed(1)}h</h3>
          </div>
          <div class="stat-card">
            <p>Issue Resolution Rate</p>
            <h3>${Math.round(issues.resolutionRate)}%</h3>
          </div>
        </div>
      </div>

      ${healthScore ? `
      <div class="section">
        <h2>Health Breakdown</h2>
        ${healthBarsHTML}
        
        <h3 style="font-size: 16px; margin-top: 24px;">Key Insights</h3>
        <ul style="font-size: 14px; color: #4a4a4a; padding-left: 20px;">
          ${healthScore.insights.map((i: string) => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${cicd && cicd.summary.totalRuns > 0 ? `
      <div class="section">
        <h2>CI/CD Analytics</h2>
        <div class="grid-3">
          <div class="stat-card">
            <p>Total Runs</p>
            <h3>${cicd.summary.totalRuns}</h3>
          </div>
          <div class="stat-card">
            <p>Success Rate</p>
            <h3>${Math.round(cicd.summary.successRate)}%</h3>
          </div>
          <div class="stat-card">
            <p>Deploy Freq (per day)</p>
            <h3>${cicd.summary.deploymentFrequency.toFixed(2)}</h3>
          </div>
        </div>
      </div>
      ` : ''}

      ${recommendationsHTML}

    </body>
    </html>
  `;
}

function buildSparkline(timeline: any[]) {
  if (!timeline || timeline.length === 0) return '';
  const width = 500;
  const height = 80;
  const max = Math.max(...timeline.map((t: any) => t.count), 1);
  
  const points = timeline.map((t: any, i: number) => {
    const x = (i / (timeline.length - 1)) * width;
    const y = height - ((t.count / max) * height);
    return `${x},${y}`;
  });

  const pathD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
  const lineD = `M ${points.join(' L ')}`;

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <path d="${pathD}" fill="#eef2ff" />
      <path d="${lineD}" fill="none" stroke="#4f46e5" stroke-width="2" />
    </svg>
  `;
}

function buildHealthBars(healthScore: any) {
  if (!healthScore) return '';
  
  const categories = [
    { label: 'Commit Consistency', score: healthScore.commitConsistency },
    { label: 'PR Health', score: healthScore.prHealthScore },
    { label: 'Issue Health', score: healthScore.issueHealthScore },
    { label: 'Code Activity', score: healthScore.codeActivityScore },
    { label: 'Community', score: healthScore.communityScore },
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${categories.map(c => {
        const color = c.score >= 70 ? '#22c55e' : c.score >= 50 ? '#f59e0b' : '#ef4444';
        const width = Math.max(c.score, 2); // min 2% so it's visible
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; font-weight: 600;">
              <span>${c.label}</span>
              <span>${Math.round(c.score)}/100</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background: ${color}; width: ${width}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
