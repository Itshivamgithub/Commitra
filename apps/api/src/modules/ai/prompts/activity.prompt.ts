export function buildActivityPrompt(context: any): string {
  return `Analyze the development activity for this repository and provide:
1. Activity trend (growing / stable / declining)
2. Peak activity periods and patterns
3. Any notable observations about commit or PR patterns

Be specific with numbers from the data. Max 120 words.

Repository data: ${JSON.stringify(context)}`;
}

export const ACTIVITY_SYSTEM_MESSAGE = "You are a software engineering analyst specializing in development velocity and team productivity metrics.";
