import PromptBuilder from "./PromptBuilder";

export default class ChatPromptBuilder extends PromptBuilder {
  build(message) {
    return message || "";
  }
}
