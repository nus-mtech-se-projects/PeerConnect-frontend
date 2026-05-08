import PromptFactory from "../../factories/PromptFactory";
import ChatPromptBuilder from "../ChatPromptBuilder";
import FlashcardPromptBuilder from "../FlashcardPromptBuilder";
import PromptBuilder from "../PromptBuilder";
import QuizPromptBuilder from "../QuizPromptBuilder";
import StudyPlanPromptBuilder from "../StudyPlanPromptBuilder";
import TopicsPromptBuilder from "../TopicsPromptBuilder";

describe("prompt builders", () => {
  it("base PromptBuilder requires subclasses to implement build", () => {
    expect(() => new PromptBuilder().build()).toThrow("build() must be implemented");
  });

  it("ChatPromptBuilder returns the message or an empty string", () => {
    const builder = new ChatPromptBuilder();

    expect(builder.build("hello")).toBe("hello");
    expect(builder.build()).toBe("");
  });

  it("QuizPromptBuilder switches between quiz and exam instructions", () => {
    const builder = new QuizPromptBuilder();

    expect(builder.build("CS2040 sorting")).toContain("exactly 5 introductory");
    expect(builder.build("CS2040 sorting", "exam")).toContain("exactly 20 difficult");
  });

  it("FlashcardPromptBuilder includes context and JSON-only instruction", () => {
    const prompt = new FlashcardPromptBuilder().build("biology");

    expect(prompt).toContain("Generate 10 flashcards");
    expect(prompt).toContain("biology");
    expect(prompt).toContain("Return ONLY valid JSON");
  });

  it("StudyPlanPromptBuilder handles singular and plural hours", () => {
    const builder = new StudyPlanPromptBuilder();

    expect(builder.build("math", 1)).toContain("1 hour of study per day");
    expect(builder.build("", 3)).toContain("3 hours of study per day");
  });

  it("TopicsPromptBuilder asks for priority-tagged topics", () => {
    const prompt = new TopicsPromptBuilder().build("software engineering");

    expect(prompt).toContain("Suggest 10 specific topics");
    expect(prompt).toContain('"high", "medium", or "low"');
  });

  it.each([
    ["quiz", QuizPromptBuilder],
    ["exam", QuizPromptBuilder],
    ["flashcard", FlashcardPromptBuilder],
    ["studyplan", StudyPlanPromptBuilder],
    ["topics", TopicsPromptBuilder],
    ["chat", ChatPromptBuilder],
    ["unknown", ChatPromptBuilder],
  ])("PromptFactory creates %s builders", (type, ExpectedClass) => {
    expect(PromptFactory.create(type)).toBeInstanceOf(ExpectedClass);
  });
});
