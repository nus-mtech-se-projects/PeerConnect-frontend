import PromptBuilder from "./PromptBuilder";

export default class TopicsPromptBuilder extends PromptBuilder {
  build(ctx) {
    return [
      `Suggest 10 specific topics to study${ctx ? " based on this class/group:" : "."}`,
      ctx || "",
      "",
      "Return ONLY valid JSON (no markdown, no extra text):",
      '{"title":"...","topics":[{"name":"Topic Name","description":"Why this matters","priority":"high","subtopics":["sub 1","sub 2"]}]}',
      'Priority must be exactly "high", "medium", or "low".',
    ].filter(Boolean).join("\n");
  }
}
