import PromptBuilder from "./PromptBuilder";

export default class StudyPlanPromptBuilder extends PromptBuilder {
  build(ctx, hours) {
    return [
      `Create a 7-day study plan${ctx ? " for this class" : ""} with ${hours} hour${hours !== 1 ? "s" : ""} of study per day.`,
      ctx || "",
      "",
      "Return ONLY valid JSON (no markdown, no extra text):",
      `{"title":"...","dailyHours":${hours},"schedule":[{"day":"Monday","sessions":[{"topic":"...","activity":"...","duration":"45 min"}]}]}`,
      "Include all 7 days Monday through Sunday.",
    ].filter(Boolean).join("\n");
  }
}
