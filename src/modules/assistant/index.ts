/** Module Assistante (IA P3) — API publique : compréhension des demandes et créneaux proposés */
export { chat, type ChatResponse, type ChatTurn } from "./infrastructure/ai-chat";
export { type ChatReply, type ChatSlot } from "./infrastructure/assistant";
export { chatInput } from "./application/schemas";
export { detectLang, matchesTime, parseMessage, pickService, SERVICES, type ChatLang, type DayPart, type FaqTopic, type Parsed, type ServiceIntent } from "./domain/nlu";
