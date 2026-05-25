export function buildRecommendationsPrompt(context: any): string {
  return `Based on this repository's data, provide exactly 3–5 specific, actionable recommendations to improve development practices.

Format each as:
- [Category]: Recommendation text

Categories to use: Velocity, Code Review, Issue Management, Consistency, Collaboration, Documentation

Base recommendations ONLY on the data provided. Do not suggest things that are already being done well.

Repository data: ${JSON.stringify(context)}`;
}

export const RECOMMENDATIONS_SYSTEM_MESSAGE = "You are a senior engineering manager reviewing a team's development practices. Give direct, actionable advice.";
