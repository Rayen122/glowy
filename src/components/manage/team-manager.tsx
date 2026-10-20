"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarOff, Copy, KeyRound, Pencil, Plus, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { TeamMember } from "@/modules/dashboard";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, Field, FIELD, FormError, ICON_BUTTON, ImageUpload, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

const DOT: Record<number, string> = { 1: "bg-series-1", 2: "bg-series-2", 3: "bg-series-3", 4: "bg-series-4", 5: "bg-series-5" };
/** Dimanche 18 octobre 2026 : sert seulement à nommer les jours */
const SUNDAY = Date.UTC(2026, 9, 18);
const WEEK = [1, 2, 3, 4, 5, 6, 0];
type DayMode = "salon" | "custom" | "off";
type Opening = { weekday: number; opensAt: string; closesAt: string };

function useDayName() {
  const { df } = useI18n();
  return (weekday: number) => df(new Date(SUNDAY + weekday * 86_400_000).toISOString().slice(0, 10), { weekday: "long" });
}

/** SAL-05 / AUTH-07 : professionnels, horaires, congés, comptes */
export function TeamManager({ team, openingHours }: { team: TeamMember[]; openingHours: Opening[] }) {
  const { t, f, df } = useI18n();
  const m = t.manage.team;
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const [leaveFor, setLeaveFor] = useState<TeamMember | null>(null);
  const [accountFor, setAccountFor] = useState<TeamMember | null>(null);
  const { run } = useAction();

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => setEditing("new")} className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden /> {m.add}
        </button>
      </div>
      {team.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.empty}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {team.map((e) => (
            <li key={e.id} className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border", !e.active && "opacity-75")}>
              <div className="flex items-center gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-blush">
                  {e.avatarUrl ? (
                    <Image src={e.avatarUrl} alt="" fill sizes="48px" className="object-cover" unoptimized={e.avatarUrl.startsWith("/api/media/")} />
                  ) : (
                    <span className="flex size-full items-center justify-center text-lg font-semibold text-plum-700">{e.name[0]}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className={cn("size-2.5 shrink-0 rounded-full", DOT[e.color] ?? DOT[1])} aria-hidden />
                    <span className="truncate">{e.name}</span>
                    {!e.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{m.inactiveBadge}</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{e.title}</p>
                </div>
                <button type="button" onClick={() => setEditing(e)} aria-label={`${t.manage.common.edit} — ${e.name}`} className={ICON_BUTTON}>
                  <Pencil className="size-4" aria-hidden />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{e.upcomingBookings ? f(m.upcoming, { n: e.upcomingBookings }) : m.noUpcoming}</p>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.leaves}</p>
                {e.leaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{m.noLeaves}</p>
                ) : (
                  <ul className="space-y-1">
                    {e.leaves.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 py-1 ps-3 pe-1 text-sm">
                        <span className="min-w-0 truncate">
                          {l.label} · {df(l.from.date, { day: "numeric", month: "short" })}
                          {l.to.date !== l.from.date && ` → ${df(l.to.date, { day: "numeric", month: "short" })}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => run(() => api(`/api/dashboard/timeoff/${l.id}`, { method: "DELETE" }), t.manage.common.deleted)}
                          aria-label={f(m.removeLeave, { label: l.label })}
                          className={ICON_BUTTON}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.account}</p>
                {e.account ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate">{e.account.email}</span>
                    {e.account.status === "BLOCKED" && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-destructive">{m.blocked}</span>}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{m.noAccount}</p>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                <button type="button" onClick={() => setLeaveFor(e)} className={cn(SECONDARY_BUTTON, "h-10 px-4")}>
                  <CalendarOff className="size-4" aria-hidden /> {m.addLeave}
                </button>
                {e.account ? (
                  <button type="button" onClick={() => run(() => api(`/api/dashboard/team/${e.id}/account`, { method: "DELETE" }), m.revoked)} className={cn(SECONDARY_BUTTON, "h-10 px-4")}>
                    <UserX className="size-4" aria-hidden /> {m.revoke}
                  </button>
                ) : (
                  <button type="button" onClick={() => setAccountFor(e)} className={cn(SECONDARY_BUTTON, "h-10 px-4")}>
                    <KeyRound className="size-4" aria-hidden /> {m.createAccount}
                  </button>
                )}
                <ConfirmDelete
                  compact
                  label={e.name}
                  onConfirm={async () => {
                    const result = await run(() => api<{ deactivated: boolean }>(`/api/dashboard/team/${e.id}`, { method: "DELETE" }));
                    if (result) toast.success(result.deactivated ? m.deactivated : t.manage.common.deleted);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <EmployeeDialog key={editing === "new" ? "new" : (editing?.id ?? "closed")} member={editing} openingHours={openingHours} onClose={() => setEditing(null)} />
      <LeaveDialog key={leaveFor?.id ?? "no-leave"} member={leaveFor} onClose={() => setLeaveFor(null)} />
      <AccountDialog key={accountFor?.id ?? "no-account"} member={accountFor} onClose={() => setAccountFor(null)} />
    </div>
  );
}

function EmployeeDialog({ member, openingHours, onClose }: { member: TeamMember | "new" | null; openingHours: Opening[]; onClose: () => void }) {
  const { t, f } = useI18n();
  const m = t.manage.team;
  const dayName = useDayName();
  const existing = member && member !== "new" ? member : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [color, setColor] = useState(existing?.color ?? 1);
  const [commissionRate, setCommissionRate] = useState(String(existing?.commissionRate ?? 0));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatarUrl ?? null);
  const [active, setActive] = useState(existing?.active ?? true);
  const [days, setDays] = useState(() =>
    WEEK.map((weekday) => {
      const own = existing?.workingHours.find((w) => w.weekday === weekday);
      const salon = openingHours.find((o) => o.weekday === weekday);
      const mode: DayMode = own ? (own.off ? "off" : "custom") : "salon";
      return { weekday, mode, startsAt: own && !own.off ? own.startsAt : (salon?.opensAt ?? "09:00"), endsAt: own && !own.off ? own.endsAt : (salon?.closesAt ?? "19:00") };
    })
  );
  const { run, pending, error } = useAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = {
      name,
      title,
      color,
      commissionRate,
      avatarUrl,
      active,
      workingHours: days.filter((d) => d.mode !== "salon").map((d) => ({ weekday: d.weekday, startsAt: d.startsAt, endsAt: d.endsAt, off: d.mode === "off" })),
    };
    const done = await run(
      () => (existing ? api(`/api/dashboard/team/${existing.id}`, { method: "PATCH", body }) : api("/api/dashboard/team", { method: "POST", body })),
      existing ? t.manage.common.saved : t.manage.common.created
    );
    if (done) onClose();
  }

  const salonHours = (weekday: number) => {
    const o = openingHours.find((h) => h.weekday === weekday);
    return o ? `${o.opensAt} – ${o.closesAt}` : t.manage.settings.closed;
  };

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? m.editTitle : m.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
            <ImageUpload label={m.photo} value={avatarUrl} onChange={setAvatarUrl} purpose="avatar" aspect="aspect-square" />
            <div className="space-y-3">
              <Field label={m.name}>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={FIELD} />
              </Field>
              <Field label={m.jobTitle}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={m.jobPlaceholder} maxLength={60} required className={FIELD} />
              </Field>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{m.color}</legend>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((c) => (
                <label key={c} className={cn("flex size-11 cursor-pointer items-center justify-center rounded-full ring-1 ring-border", color === c && "ring-2 ring-ink")}>
                  <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" aria-label={f(m.colorN, { n: c })} />
                  <span className={cn("size-6 rounded-full", DOT[c])} aria-hidden />
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={m.commission} hint={m.commissionHint}>
            <input type="number" inputMode="decimal" min={0} max={80} step={0.5} value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className={cn(FIELD, "max-w-32")} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
            {m.activeField}
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{m.workingHours}</legend>
            <p className="text-xs text-muted-foreground">{m.workingHint}</p>
            <ul className="divide-y divide-border rounded-2xl ring-1 ring-border">
              {days.map((d, i) => (
                <li key={d.weekday} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="w-24 text-sm font-medium first-letter:uppercase">{dayName(d.weekday)}</span>
                  <select
                    value={d.mode}
                    onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, mode: e.target.value as DayMode } : x)))}
                    aria-label={dayName(d.weekday)}
                    className={cn(FIELD, "h-10 w-auto")}
                  >
                    <option value="salon">
                      {m.salonHours} ({salonHours(d.weekday)})
                    </option>
                    <option value="custom">{m.works}</option>
                    <option value="off">{m.off}</option>
                  </select>
                  {d.mode === "custom" && (
                    <span className="flex items-center gap-1.5" dir="ltr">
                      <input type="time" step={900} value={d.startsAt} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, startsAt: e.target.value } : x)))} aria-label={t.manage.settings.opensAt} className={cn(FIELD, "h-10 w-28")} />
                      –
                      <input type="time" step={900} value={d.endsAt} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, endsAt: e.target.value } : x)))} aria-label={t.manage.settings.closesAt} className={cn(FIELD, "h-10 w-28")} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
          <FormError message={error} />
          <button type="submit" disabled={pending || name.trim().length < 2 || title.trim().length < 2} className={cn(PRIMARY_BUTTON, "w-full")}>
            {pending ? t.manage.common.saving : t.manage.common.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const m = t.manage.team;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [label, setLabel] = useState("");
  const { run, pending, error } = useAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!member) return;
    const done = await run(() => api(`/api/dashboard/team/${member.id}/leaves`, { method: "POST", body: { from, to, label } }), m.leaveAdded);
    if (done) onClose();
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? f(m.leaveTitle, { name: member.name }) : m.addLeave}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.leaveFrom}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
            </Field>
            <Field label={m.leaveTo}>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={FIELD} />
            </Field>
          </div>
          <Field label={m.leaveLabel}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={m.leavePlaceholder} maxLength={60} className={FIELD} />
          </Field>
          <FormError message={error} />
          <button type="submit" disabled={pending || !label.trim()} className={cn(PRIMARY_BUTTON, "w-full")}>
            {pending ? t.manage.common.saving : m.addLeave}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const m = t.manage.team;
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const { run, pending, error } = useAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!member) return;
    const result = await run(() => api<{ email: string; temporaryPassword: string }>(`/api/dashboard/team/${member.id}/account`, { method: "POST", body: { email } }), m.accountCreated);
    if (result) setCreated(result);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(m.copied);
    } catch {
      toast.error(t.errors.generic);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? f(m.accountTitle, { name: member.name }) : m.createAccount}</DialogTitle>
          <DialogDescription>{created ? m.tempPasswordHint : m.accountHint}</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm">{created.email}</p>
            <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
              <span className="text-xs font-medium text-muted-foreground">{m.tempPassword}</span>
              <code className="flex-1 font-mono text-base font-semibold select-all" dir="ltr">
                {created.temporaryPassword}
              </code>
              <button type="button" onClick={() => copy(created.temporaryPassword)} aria-label={m.copy} className={ICON_BUTTON}>
                <Copy className="size-4" aria-hidden />
              </button>
            </div>
            <button type="button" onClick={onClose} className={cn(SECONDARY_BUTTON, "w-full")}>
              {t.manage.common.back}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field label={m.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required className={FIELD} />
            </Field>
            <FormError message={error} />
            <button type="submit" disabled={pending || !email.includes("@")} className={cn(PRIMARY_BUTTON, "w-full")}>
              {pending ? t.manage.common.saving : m.createAccount}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
