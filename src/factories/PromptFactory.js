import QuizPromptBuilder from "../prompts/QuizPromptBuilder";
import FlashcardPromptBuilder from "../prompts/FlashcardPromptBuilder";
import StudyPlanPromptBuilder from "../prompts/StudyPlanPromptBuilder";
import TopicsPromptBuilder from "../prompts/TopicsPromptBuilder";
import ChatPromptBuilder from "../prompts/ChatPromptBuilder";

export default class PromptFactory {
  static create(type) {
    switch (type) {
      case "quiz":
      case "exam":
        return new QuizPromptBuilder();
      case "flashcard":
        return new FlashcardPromptBuilder();
      case "studyplan":
        return new StudyPlanPromptBuilder();
      case "topics":
        return new TopicsPromptBuilder();
      case "chat":
      default:
        return new ChatPromptBuilder();
    }
  }
}
