import PromptBuilder from "./PromptBuilder";

export default class QuizPromptBuilder extends PromptBuilder {
  build(ctx, difficulty = "quiz") {
    const isExam = difficulty === "exam";
    const count = isExam ? 20 : 5;
    const style = isExam ? "difficult, application-based, exam-style" : "introductory";

    return [
      `Generate exactly ${count} ${style} multiple choice questions${ctx ? " based on this class:" : "."}`,
      ctx || "",
      "",
      `IMPORTANT: You MUST produce exactly ${count} questions — no more, no less. Do not stop early.`,
      "Return ONLY valid JSON (no markdown, no extra text):",
      '{"title":"...","questions":[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"One sentence max."}]}',
      "Each question needs exactly 4 options. The answer field must be only the letter A, B, C, or D. Keep explanations to one sentence.",
    ].filter(Boolean).join("\n");
  }
}
