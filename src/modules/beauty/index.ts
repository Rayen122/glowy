/** Module Analyse beauté (IA P5) — API publique */
export { beautyAnalysis, type BeautyResult } from "./infrastructure/beauty";
export { beautyInput, tryOnProInput, type TryOnProInput } from "./application/schemas";
export { proHairColor, proRenderEnabled } from "./infrastructure/pro-render";
export { closestAspectRatio, fluxSize, proColorPrompt, REFERENCE_MAX } from "./domain/pro-render";
export { diagnose, FACE_ISSUES, HAIR_ISSUES, measure, SERVICE_TERMS, type BeautyMode, type Diagnosis, type IssueKey, type Metrics } from "./domain/analysis";
