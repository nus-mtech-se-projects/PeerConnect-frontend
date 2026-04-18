import PromptBuilder from "./PromptBuilder";

export default class FlashcardPromptBuilder extends PromptBuilder {
  build(ctx) {
    return [
      `Generate 10 flashcards${ctx ? " based on this class:" : "."}`,
      ctx || "",
      "",
      "Return ONLY valid JSON (no markdown, no extra text):",
      '{"title":"...","cards":[{"question":"Short question or term?","answer":"Concise answer"}]}',
    ].filter(Boolean).join("\n");
  }
}
