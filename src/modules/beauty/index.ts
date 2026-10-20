/** Module Analyse beauté (IA P5) — API publique */
export { beautyAnalysis, type BeautyResult } from "./infrastructure/beauty";
export { beautyInput } from "./application/schemas";
export { diagnose, FACE_ISSUES, HAIR_ISSUES, measure, SERVICE_TERMS, type BeautyMode, type Diagnosis, type IssueKey, type Metrics } from "./domain/analysis";
