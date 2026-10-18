"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const FIELD = "h-11 w-full rounded-xl border border-border bg-card px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? (e.details?.[0]?.message ?? e.message) : fallback);

/** Bloquer un créneau (pause, congé) dans l'agenda — SAL-04 */
export function BlockSlotButton({ employees, date }: { employees: { id: string; name: string }[]; date: string }) {
  const { t } = useI18n();
  const a = t.dashboard.agenda;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [day, setDay] = useState(date);
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("13:00");
  const [label, setLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api("/api/dashboard/timeoff", { method: "POST", body: { employeeId, date: day, from, to, label } });
      toast.success(a.blocked);
      setOpen(false);
      setLabel("");
      router.push(`?date=${day}`);
      router.refresh();
    } catch (e) {
      setError(errorText(e, t.errors.generic));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={!employees.length}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
      >
        <CalendarPlus className="size-4" aria-hidden /> {a.block}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{a.blockTitle}</DialogTitle>
          <DialogDescription>{a.blockHint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <label className="block text-sm font-medium">
            {a.employee}
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={cn(FIELD, "mt-1.5")}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {a.date}
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className={cn(FIELD, "mt-1.5")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              {a.from}
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} required step={300} className={cn(FIELD, "mt-1.5")} />
            </label>
            <label className="block text-sm font-medium">
              {a.to}
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)} required step={300} className={cn(FIELD, "mt-1.5")} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            {a.label}
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={a.labelPlaceholder} required maxLength={60} className={cn(FIELD, "mt-1.5")} />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || !label.trim() || !employeeId}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800 disabled:opacity-60"
          >
            {a.submit}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Petit bouton « retirer » sur un blocage de l'agenda */
export function UnblockButton({ id, label }: { id: string; label: string }) {
  const { t, f } = useI18n();
  const a = t.dashboard.agenda;
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await api(`/api/dashboard/timeoff/${id}`, { method: "DELETE" });
      toast(a.unblocked);
      router.refresh();
    } catch (e) {
      toast.error(errorText(e, t.errors.generic));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={f(a.unblock, { label })}
      className="pointer-events-auto absolute end-1 top-1 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-card hover:text-destructive"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

/** Salon neuf : sans professionnel ni horaires, l'agenda reste vide — mise en route en un clic */
export function SalonSetupCard() {
  const { t } = useI18n();
  const a = t.dashboard.agenda;
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setup() {
    setPending(true);
    try {
      await api("/api/dashboard/setup", { method: "POST" });
      toast.success(a.setupDone, { description: a.setupDoneDesc });
      router.refresh();
    } catch (e) {
      toast.error(errorText(e, t.errors.generic));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center ring-1 ring-border">
      <span className="flex size-14 items-center justify-center rounded-full bg-blush text-plum-700">
        <Settings2 className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{a.noTeamTitle}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{a.noTeamText}</p>
      <p className="mt-3 max-w-md text-xs text-muted-foreground">{a.setupHint}</p>
      <button
        type="button"
        onClick={setup}
        disabled={pending}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800 disabled:opacity-60"
      >
        {a.setup}
      </button>
    </div>
  );
}
