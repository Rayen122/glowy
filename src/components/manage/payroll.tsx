"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, FileText, LogIn, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { EmployeeMonth, PayrollRates, PayslipView, SalonTodayRow } from "@/modules/payroll";
import { api, Field, FIELD, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

type Today = { date: string; status: "ABSENT" | "EXCUSED" | null; present: boolean; segments: { in: string; out: string | null }[]; workedMinutes: number };

/** Montant en dinars au millime (fiche de paie) */
function useDt() {
  const { t, nf } = useI18n();
  return (n: number) => `${nf(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${t.common.currency}`;
}

const monthLabel = (period: string, locale: (iso: string, o: Intl.DateTimeFormatOptions) => string) => locale(`${period}-15`, { month: "long", year: "numeric" });

/** Choix du mois (12 derniers mois) : change le paramètre ?mois= de l'adresse */
export function MonthPicker({ period, months }: { period: string; months: string[] }) {
  const { t, df } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t.manage.payroll.month}</span>
      <select
        value={period}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("mois", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className={cn(FIELD, "h-10 w-auto capitalize")}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m, df)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Carte de pointage du professionnel connecté : arrivée / départ, temps travaillé aujourd'hui */
export function ClockCard({ today, plannedMinutes }: { today: Today; plannedMinutes: number }) {
  const { t, f, dur } = useI18n();
  const p = t.manage.payroll;
  const { run, pending } = useAction();
  const last = today.segments.at(-1);
  const status = today.status === "ABSENT" ? p.absentMarked : today.status === "EXCUSED" ? p.excusedMarked : today.present ? f(p.presentSince, { time: last!.in }) : last?.out ? f(p.left, { time: last.out }) : p.notYet;
  async function act(action: "in" | "out") {
    const result = await run(() => api<Today>("/api/payroll/clock", { method: "POST", body: { action } }));
    const segment = result?.segments.at(-1);
    if (segment) toast.success(action === "in" ? f(p.clockedIn, { time: segment.in }) : f(p.clockedOut, { time: segment.out ?? "" }));
  }
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="clock-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="clock-title" className="font-semibold">
            {p.todayTitle}
          </h2>
          <p className={cn("mt-1 text-sm", today.present ? "font-medium text-success" : "text-muted-foreground")}>{status}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plannedMinutes > 0 ? f(p.plannedToday, { dur: dur(plannedMinutes) }) : p.rest} · {f(p.workedToday, { dur: dur(today.workedMinutes) })}
          </p>
        </div>
        {!today.status && (
          <button type="button" disabled={pending} onClick={() => void act(today.present ? "out" : "in")} className={cn(PRIMARY_BUTTON, "h-12 px-6", today.present && "bg-ink")}>
            {today.present ? <LogOut className="size-4" aria-hidden /> : <LogIn className="size-4" aria-hidden />} {today.present ? p.clockOut : p.clockIn}
          </button>
        )}
      </div>
      {today.segments.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
          {today.segments.map((s) => (
            <li key={s.in} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 tabular-nums" dir="ltr">
              <Clock className="size-3.5" aria-hidden /> {s.in} → {s.out ?? "…"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const KIND_STYLE = { worked: "text-success", leave: "text-plum-700", absent: "text-destructive", rest: "text-muted-foreground", upcoming: "text-muted-foreground" } as const;

/** Dossier du mois : chaque jour (prévu, pointé, heures sup, statut) et les totaux */
export function MonthTable({ month }: { month: EmployeeMonth }) {
  const { t, f, df, dur } = useI18n();
  const p = t.manage.payroll;
  const s = month.summary;
  const tiles = [
    [p.summary.workedDays, String(s.workedDays)],
    [p.summary.absentDays, String(s.absentDays)],
    [p.summary.leaveDays, String(s.leaveDays)],
    [p.summary.hours, dur(s.workedMinutes)],
    [p.summary.overtime, dur(s.overtimeMinutes)],
  ];
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="month-title">
      <h2 id="month-title" className="font-semibold first-letter:uppercase">
        {f(p.monthTitle, { month: monthLabel(month.period, df) })}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th className="py-2 text-start font-medium">{p.day}</th>
              <th className="py-2 text-start font-medium">{p.in} → {p.out}</th>
              <th className="py-2 text-end font-medium">{p.worked}</th>
              <th className="py-2 text-end font-medium">{p.planned}</th>
              <th className="py-2 text-end font-medium">{p.overtime}</th>
              <th className="py-2 text-end font-medium">{p.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {month.days.map((d) => (
              <tr key={d.date} className={cn(d.kind === "rest" && "text-muted-foreground")}>
                <td className="py-2 capitalize">{df(d.date, { weekday: "short", day: "numeric" })}</td>
                <td className="py-2 tabular-nums" dir="ltr">
                  {d.segments.length ? d.segments.map((x) => `${x.in}–${x.out ?? "…"}`).join(", ") : "—"}
                </td>
                <td className="py-2 text-end tabular-nums">{d.workedMinutes ? dur(d.workedMinutes) : "—"}</td>
                <td className="py-2 text-end tabular-nums">{d.plannedMinutes ? dur(d.plannedMinutes) : "—"}</td>
                <td className={cn("py-2 text-end tabular-nums", d.overtimeMinutes > 0 && "font-semibold text-plum-700")}>{d.overtimeMinutes ? `+${dur(d.overtimeMinutes)}` : "—"}</td>
                <td className={cn("py-2 text-end text-xs font-medium", KIND_STYLE[d.kind])}>{p.kinds[d.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Équipe du jour (gérant) : pointage de chacun, correction, accès au dossier */
export function TeamToday({ rows }: { rows: SalonTodayRow[] }) {
  const { t, f, dur } = useI18n();
  const p = t.manage.payroll;
  const [editing, setEditing] = useState<SalonTodayRow | null>(null);
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="team-today-title">
      <h2 id="team-today-title" className="font-semibold">
        {p.teamToday}
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {rows.map((r) => {
          const last = r.segments.at(-1);
          const status = r.status === "ABSENT" ? p.absentMarked : r.status === "EXCUSED" ? p.excusedMarked : r.present ? f(p.presentSince, { time: last!.in }) : last?.out ? f(p.left, { time: last.out }) : r.plannedMinutes ? p.notYet : p.rest;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block font-medium">{r.name}</span>
                <span className={cn("text-xs", r.present ? "text-success" : r.status === "ABSENT" ? "text-destructive" : "text-muted-foreground")}>
                  {status}
                  {r.workedMinutes > 0 && ` · ${dur(r.workedMinutes)}`}
                  {!r.hasAccount && ` · ${p.noAccount}`}
                </span>
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setEditing(r)} className={cn(SECONDARY_BUTTON, "h-9 px-3 text-sm")}>
                  <Pencil className="size-3.5" aria-hidden /> {p.correct}
                </button>
                <Link href={`?employe=${r.id}`} className={cn(SECONDARY_BUTTON, "h-9 px-3 text-sm")}>
                  <FileText className="size-3.5" aria-hidden /> {p.dossier}
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
      {editing && <CorrectDialog row={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function CorrectDialog({ row, onClose }: { row: SalonTodayRow; onClose: () => void }) {
  const { t, f } = useI18n();
  const p = t.manage.payroll;
  const { run, pending, error } = useAction();
  const [date, setDate] = useState(row.date);
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "EXCUSED">(row.status ?? "PRESENT");
  const [segments, setSegments] = useState(row.segments.length ? row.segments.map((s) => ({ in: s.in, out: s.out ?? "" })) : [{ in: "09:00", out: "" }]);
  const [note, setNote] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = { employeeId: row.id, date, status, note, segments: status === "PRESENT" ? segments.map((s) => ({ in: s.in, out: s.out || null })) : [] };
    if (await run(() => api("/api/payroll/attendance", { method: "PUT", body }), p.corrected)) onClose();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{f(p.correctTitle, { name: row.name })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={p.date}>
            <input type="date" value={date} max={row.date} onChange={(e) => setDate(e.target.value)} className={FIELD} required />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{p.status}</legend>
            {(["PRESENT", "ABSENT", "EXCUSED"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} className="accent-[#6b2a5c]" />
                {s === "PRESENT" ? p.statusPresent : s === "ABSENT" ? p.statusAbsent : p.statusExcused}
              </label>
            ))}
          </fieldset>
          {status === "PRESENT" && (
            <div className="space-y-2">
              {segments.map((s, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Field label={p.in} className="flex-1">
                    <input type="time" value={s.in} onChange={(e) => setSegments(segments.map((x, j) => (j === i ? { ...x, in: e.target.value } : x)))} className={FIELD} required />
                  </Field>
                  <Field label={p.out} className="flex-1">
                    <input type="time" value={s.out} onChange={(e) => setSegments(segments.map((x, j) => (j === i ? { ...x, out: e.target.value } : x)))} className={FIELD} />
                  </Field>
                  {segments.length > 1 && (
                    <button type="button" onClick={() => setSegments(segments.filter((_, j) => j !== i))} aria-label={p.removeSegment} className={cn(SECONDARY_BUTTON, "size-11 px-0")}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              {segments.length < 4 && (
                <button type="button" onClick={() => setSegments([...segments, { in: "14:00", out: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700">
                  <Plus className="size-4" aria-hidden /> {p.addSegment}
                </button>
              )}
            </div>
          )}
          <Field label={p.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={FIELD} />
          </Field>
          <FormError message={error} />
          <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, "w-full")}>
            {t.manage.common.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Fiches de paie du mois (gérant) : calcul des brouillons, ajustement, validation */
export function PayslipsManager({ period, slips }: { period: string; slips: PayslipView[] }) {
  const { t, f } = useI18n();
  const p = t.manage.payroll;
  const dt = useDt();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<PayslipView | null>(null);
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="payslips-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="payslips-title" className="font-semibold">
          {p.payslipsTitle}
        </h2>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const result = await run(() => api<{ count: number }>("/api/payroll/payslips", { method: "POST", body: { period } }));
            if (result) toast.success(f(p.generated, { n: result.count }));
          }}
          className={cn(SECONDARY_BUTTON, "h-10 px-4 text-sm")}
        >
          {p.generate}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{p.autoNote}</p>
      {slips.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{p.emptyPayslips}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-start font-medium">{p.employee}</th>
                <th className="py-2 text-start font-medium">{p.status}</th>
                <th className="py-2 text-end font-medium">{p.gross}</th>
                <th className="py-2 text-end font-medium">{p.net}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slips.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 font-medium">{s.employeeName}</td>
                  <td className="py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.status === "VALIDATED" ? "bg-success/10 text-success" : "bg-warning/15 text-plum-800")}>
                      {s.status === "VALIDATED" ? p.validated : p.draft}
                    </span>
                  </td>
                  <td className="py-2.5 text-end tabular-nums">{dt(s.lines.gross)}</td>
                  <td className="py-2.5 text-end font-semibold tabular-nums">{dt(s.lines.net)}</td>
                  <td className="py-2.5 text-end">
                    <span className="flex justify-end gap-2">
                      {s.status === "DRAFT" && (
                        <button type="button" onClick={() => setEditing(s)} className={cn(SECONDARY_BUTTON, "h-9 px-3 text-sm")}>
                          {p.edit}
                        </button>
                      )}
                      <Link href={`/dashboard/paie/${s.id}`} className={cn(SECONDARY_BUTTON, "h-9 px-3 text-sm")}>
                        {p.view}
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <PayslipDialog slip={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function PayslipDialog({ slip, onClose }: { slip: PayslipView; onClose: () => void }) {
  const { t, f, df } = useI18n();
  const p = t.manage.payroll;
  const dt = useDt();
  const { run, pending, error } = useAction();
  const [bonus, setBonus] = useState(String(slip.bonus));
  const [advance, setAdvance] = useState(String(slip.advance));
  const [note, setNote] = useState(slip.note ?? "");
  async function save(action: "save" | "recompute" | "validate") {
    const done = await run(
      () => api(`/api/payroll/payslips/${slip.id}`, { method: "PATCH", body: { bonus, advance, note, action } }),
      action === "validate" ? p.validatedToast : t.manage.common.saved
    );
    if (done && action !== "recompute") onClose();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="first-letter:uppercase">{f(p.editTitle, { name: slip.employeeName, month: monthLabel(slip.period, df) })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="flex justify-between rounded-2xl bg-muted/60 p-3 text-sm">
            <span>{p.net}</span> <span className="font-semibold tabular-nums">{dt(slip.lines.net)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={p.bonus}>
              <input type="number" min={0} step={1} value={bonus} onChange={(e) => setBonus(e.target.value)} className={FIELD} />
            </Field>
            <Field label={p.advance}>
              <input type="number" min={0} step={1} value={advance} onChange={(e) => setAdvance(e.target.value)} className={FIELD} />
            </Field>
          </div>
          <Field label={p.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={FIELD} />
          </Field>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void save("recompute")} className={cn(SECONDARY_BUTTON, "flex-1")}>
              {p.recompute}
            </button>
            <button type="button" disabled={pending} onClick={() => void save("save")} className={cn(SECONDARY_BUTTON, "flex-1")}>
              {t.manage.common.save}
            </button>
          </div>
          <button type="button" disabled={pending} onClick={() => void save("validate")} className={cn(PRIMARY_BUTTON, "w-full")}>
            <Check className="size-4" aria-hidden /> {p.validate}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Taux des retenues indicatives du salon (gérant) */
export function PayrollSettingsForm({ rates }: { rates: PayrollRates }) {
  const { t } = useI18n();
  const p = t.manage.payroll;
  const { run, pending, error } = useAction();
  const [cnssRate, setCnss] = useState(String(rates.cnssRate));
  const [cssRate, setCss] = useState(String(rates.cssRate));
  const [irpp, setIrpp] = useState(rates.irpp);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await run(() => api("/api/payroll/settings", { method: "PUT", body: { cnssRate, cssRate, irpp } }), p.settingsSaved);
  }
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="payroll-settings-title">
      <h2 id="payroll-settings-title" className="font-semibold">
        {p.settingsTitle}
      </h2>
      <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label={p.cnss}>
            <input type="number" min={0} max={30} step={0.01} value={cnssRate} onChange={(e) => setCnss(e.target.value)} className={FIELD} />
          </Field>
          <Field label={p.css}>
            <input type="number" min={0} max={5} step={0.1} value={cssRate} onChange={(e) => setCss(e.target.value)} className={FIELD} />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
          {p.irpp}
          <Switch checked={irpp} onCheckedChange={setIrpp} />
        </label>
        <p className="text-xs text-muted-foreground">{p.doc.indicative}</p>
        <FormError message={error} />
        <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, "w-full sm:w-auto")}>
          {t.manage.common.save}
        </button>
      </form>
    </section>
  );
}

/** Fiches de paie validées du professionnel connecté */
export function MyPayslips({ slips }: { slips: PayslipView[] }) {
  const { t, df } = useI18n();
  const p = t.manage.payroll;
  const dt = useDt();
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6" aria-labelledby="my-payslips-title">
      <h2 id="my-payslips-title" className="font-semibold">
        {p.myPayslips}
      </h2>
      {slips.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{p.noPayslips}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {slips.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/paie/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-plum-700">
                <span className="flex items-center gap-2 font-medium capitalize">
                  <FileText className="size-4 shrink-0 text-plum-700" aria-hidden /> {monthLabel(s.period, df)}
                </span>
                <span className="text-sm font-semibold tabular-nums">{dt(s.lines.net)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
