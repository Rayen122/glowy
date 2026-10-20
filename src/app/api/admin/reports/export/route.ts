import { z } from "zod";
import { csvResponse } from "@/core/domain/csv";
import { route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { platformReportCsv, REPORT_KINDS } from "@/modules/admin";

const query = z.object({
  type: z.enum(REPORT_KINDS).default("salon"),
  days: z.coerce.number().pipe(z.union([z.literal(30), z.literal(90), z.literal(365)])).default(30),
});

/** GET /api/admin/reports/export?type=city|service|salon&days=30 — rapport en CSV pour Excel (ADM-08) */
export const GET = route(async (request) => {
  await requireUser("ADMIN");
  const { type, days } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  return csvResponse(await platformReportCsv(type, days), `glowy-rapport-${type}-${days}j.csv`);
});
