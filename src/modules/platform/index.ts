/**
 * Module Plateforme (P1) — API publique : catalogue global (villes, catégories, langues, ADM-06),
 * commissions (ADM-05) et annonces (ADM-10), réglés par le Super Admin.
 */
export { activeCities, commissionsReport, getPlatformSettings, updatePlatformSettings, type CommissionsReport } from "./infrastructure/settings";
export { listAnnouncements, sendAnnouncement } from "./infrastructure/announcements";
export { announcementInput, platformSettingsInput, type AnnouncementInput, type PlatformSettingsInput } from "./application/schemas";
export { commissionOn, DEFAULT_SETTINGS, type PlatformSettingsView } from "./domain/defaults";
