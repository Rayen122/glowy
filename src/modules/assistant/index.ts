/** Module Assistante (IA P3) — API publique : compréhension des demandes et créneaux proposés */
export { chat, type ChatReply, type ChatSlot } from "./infrastructure/assistant";
export { chatInput } from "./application/schemas";
export { matchesTime, parseMessage, SERVICES, type DayPart, type FaqTopic, type Parsed, type ServiceIntent } from "./domain/nlu";
