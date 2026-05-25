export function buildSummaryPrompt(context: any): string {
  return `Analyze this repository and write a 2–3 paragraph summary covering:
1. What kind of project this appears to be based on activity patterns
2. Overall health and activity level  
3. Team dynamics (solo vs collaborative)

Repository data: ${JSON.stringify(context)}`;
}

export const SUMMARY_SYSTEM_MESSAGE = "You are a software engineering analyst. Analyze GitHub repository statistics and write a concise, professional summary. Be specific and data-driven. Do not use filler phrases like 'it seems' or 'appears to be'. Maximum 150 words.";
