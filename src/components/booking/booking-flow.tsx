"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarPlus, Check, Clock, CreditCard, Lock, MapPin, Store, TimerReset, Users } from "lucide-react";
import { toast } from "sonner";
import { PointsBadge, Rating } from "@/components/salon/badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import type { Employee, Salon, Service } from "@/lib/data";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const STEPS = ["service", "pro", "datetime", "confirm"] as const;
const LOCK_SECONDS = 10 * 60;

/** Créneaux regroupés par moment de la journée */
const PERIODS = [
  { id: "morning", until: "12:00" },
  { id: "afternoon", until: "17:00" },
  { id: "evening", until: "24:00" },
] as const;

type Slot = { time: string; employees: string[]; offPeak: boolean };

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Tunnel de réservation (RES-03) : prestations → professionnel → créneau (disponibilités réelles via
 * /api/salons/:slug/availability) → confirmation (POST /api/bookings, verrou anti-conflit côté serveur).
 */
export function BookingFlow({
  salon,
  serviceGroups,
  employees,
  openWeekdays,
  today,
  user,
  initialServiceId,
  initialTime,
}: {
  salon: Salon;
  serviceGroups: { id: string; label: string; services: Service[] }[];
  employees: Employee[];
  /** Jours d'ouverture (0 = dimanche) */
  openWeekdays: number[];
  /** Date du jour à Tunis (AAAA-MM-JJ), fournie par le serveur */
  today: string;
  /** Cliente connectée (null : connexion demandée au moment de confirmer) */
  user: { name: string; email: string; phone?: string | null } | null;
  initialServiceId?: string;
  initialTime?: string;
}) {
  const { t, tc, f, rich, money, dur, df } = useI18n();
  const b = t.booking;
  const router = useRouter();
  const pathname = usePathname();
  const allServices = useMemo(() => serviceGroups.flatMap((g) => g.services), [serviceGroups]);
  const DAYS = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const iso = addDays(today, i);
        const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
        return { index: i, iso, dow, closed: !openWeekdays.includes(dow) };
      }),
    [today, openWeekdays]
  );
  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceId ? [initialServiceId] : []);
  const [employee, setEmployee] = useState<string>("any");
  const [day, setDay] = useState(() => (initialTime ? 0 : Math.max(0, DAYS.findIndex((d) => !d.closed))));
  const [time, setTime] = useState<string | null>(initialTime ?? null);
  const [lockLeft, setLockLeft] = useState(initialTime ? LOCK_SECONDS : 0);
  const [payment, setPayment] = useState<"online" | "onsite">("online");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const services = serviceIds.map((id) => allServices.find((s) => s.id === id)).filter(Boolean) as Service[];
  const total = services.reduce((a, s) => a + s.price, 0);
  const duration = services.reduce((a, s) => a + s.duration, 0);
  const deposit = total ? Math.min(30, Math.max(10, Math.round(total * 0.2))) : 0;
  const emp = employees.find((e) => e.id === employee);

  // Disponibilités réelles du jour choisi ; `refresh` force un rechargement (créneau pris entre-temps)
  const [refresh, setRefresh] = useState(0);
  const [availability, setAvailability] = useState<{ key: string; slots: Slot[]; error?: boolean } | null>(null);
  const availabilityKey = `${DAYS[day].iso}|${serviceIds.join(",")}|${employee}|${refresh}`;
  const needSlots = step >= 2 && serviceIds.length > 0 && !DAYS[day].closed;
  useEffect(() => {
    if (!needSlots) return;
    let cancelled = false;
    const params = new URLSearchParams({ date: DAYS[day].iso, services: serviceIds.join(","), employee });
    api<{ slots: Slot[] }>(`/api/salons/${salon.slug}/availability?${params}`)
      .then((data) => !cancelled && setAvailability({ key: availabilityKey, slots: data.slots }))
      .catch(() => !cancelled && setAvailability({ key: availabilityKey, slots: [], error: true }));
    return () => {
      cancelled = true;
    };
  }, [needSlots, availabilityKey, DAYS, day, serviceIds, employee, salon.slug]);
  const slotsLoading = needSlots && availability?.key !== availabilityKey;
  const slots = availability?.key === availabilityKey ? availability.slots : [];
  const offPeak = time ? (slots.find((s) => s.time === time)?.offPeak ?? false) : false;
  const points = 10 + (salon.visited ? 0 : 30) + (offPeak ? 10 : 0) + (payment === "online" ? 5 : 0);
  const dayLong = df(DAYS[day].iso, { weekday: "long", day: "numeric", month: "long" });

  // Verrou de créneau (RES-04) : le créneau est bloqué 10 min pendant la finalisation
  const chooseTime = (slot: string | null) => {
    setTime(slot);
    setLockLeft(slot ? LOCK_SECONDS : 0);
  };

  useEffect(() => {
    if (!time || done) return;
    const id = window.setInterval(() => setLockLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [time, done]);

  const lockExpired = !!time && lockLeft === 0;

  // Transition entre étapes : glisse dans le sens de la navigation (inversé en arabe)
  const stepRef = useRef<HTMLDivElement>(null);
  const prevStep = useRef(step);
  useGSAP(
    () => {
      if (prevStep.current === step) return;
      const forward = step > prevStep.current ? 1 : -1;
      prevStep.current = step;
      const el = stepRef.current;
      if (!el || !window.matchMedia(MOTION_OK).matches) return;
      const x = 32 * forward * (document.documentElement.dir === "rtl" ? -1 : 1);
      gsap.fromTo(el, { autoAlpha: 0, x }, { autoAlpha: 1, x: 0, duration: 0.5, ease: "power3.out", clearProps: "transform" });
      gsap.from(el.querySelectorAll("fieldset, [role=radio], label"), { autoAlpha: 0, y: 12, duration: 0.4, stagger: 0.015, delay: 0.1 });
    },
    { dependencies: [step], scope: stepRef }
  );

  const canNext = [services.length > 0, true, !!time, accepted && !lockExpired][step];

  const goToLogin = () => {
    const back = `${pathname}?service=${serviceIds[0] ?? ""}${time ? `&heure=${time}` : ""}`;
    router.push(`/connexion?callbackUrl=${encodeURIComponent(back)}`);
  };

  const next = async () => {
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!user) return goToLogin();
    setSubmitting(true);
    try {
      await api("/api/bookings", {
        method: "POST",
        body: {
          salonSlug: salon.slug,
          serviceKeys: serviceIds,
          employee,
          date: DAYS[day].iso,
          time,
          paymentMethod: payment === "online" ? "ONLINE" : "ONSITE",
          note: note.trim() || undefined,
        },
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return goToLogin();
      if (error instanceof ApiError && error.code === "SLOT_TAKEN") {
        toast.error(t.errors.slotTaken);
        chooseTime(null);
        setRefresh((n) => n + 1);
        setStep(2);
        return;
      }
      toast.error(error instanceof ApiError && error.status === 403 ? b.clientOnly : t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  };

  const summary = (
    <Summary
      services={services}
      emp={emp?.name}
      when={time ? f(b.at, { date: dayLong, time }) : null}
      duration={duration}
      total={total}
      deposit={payment === "online" ? deposit : 0}
      points={points}
    />
  );

  if (done && time) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span className="mx-auto flex size-16 animate-in items-center justify-center rounded-full bg-success-soft text-success duration-700 zoom-in-50 fade-in-0">
          <Check className="size-8" aria-hidden />
        </span>
        <h1 className="display mt-6 text-4xl text-ink">{b.confirmed}</h1>
        <p className="mt-3 text-muted-foreground">{b.confirmedText}</p>
        <div className="mt-8 animate-in rounded-3xl border border-border bg-card p-5 text-start duration-700 fade-in-0 slide-in-from-bottom-4 sm:p-6">
          <p className="font-semibold">{salon.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden /> {salon.address}
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{b.date}</dt>
              <dd className="font-semibold">{f(b.at, { date: dayLong, time })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{b.with}</dt>
              <dd className="font-semibold">{emp?.name ?? b.anyPro}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{b.services}</dt>
              <dd className="font-semibold">{services.map((s) => tc(s.name)).join(" + ")}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{b.pointsAfter}</span>
            <PointsBadge points={points} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => toast.success(b.addedCalendar)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted"
          >
            <CalendarPlus className="size-4" aria-hidden /> {b.addCalendar}
          </button>
          <Link href="/compte/rendez-vous" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
            {b.seeBookings}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 pb-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <Link href={`/salons/${salon.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {salon.name}
        </Link>

        {/* Progression */}
        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label={b.stepsAria}>
          {STEPS.map((id, i) => (
            <li key={id}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${i + 1}. ${b.steps[id]}`}
                className="group w-full py-1 text-start disabled:cursor-default"
              >
                <span className={cn("block h-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
                <span
                  className={cn(
                    "mt-2 block truncate text-[11px] font-medium sm:text-xs",
                    i === step ? "text-foreground" : i < step ? "text-plum-700 group-hover:underline" : "text-muted-foreground"
                  )}
                >
                  {i + 1}. {b.steps[id]}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div ref={stepRef}>
          <h1 className="display mt-6 text-3xl text-ink sm:mt-8 sm:text-4xl">{b.titles[STEPS[step]]}</h1>

          {/* Étape 1 : prestations */}
          {step === 0 && (
            <div className="mt-6 space-y-6">
              {serviceGroups.map((g) => (
                <fieldset key={g.id}>
                  <legend className="text-sm font-semibold text-muted-foreground">{tc(g.label)}</legend>
                  <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    {g.services.map((s) => {
                      const on = serviceIds.includes(s.id);
                      return (
                        <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 p-4 transition-colors sm:gap-4", on ? "bg-plum-50" : "hover:bg-muted/60")}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                              on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
                            )}
                            aria-hidden
                          >
                            {on && <Check className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{tc(s.name)}</span>
                            <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="size-3.5" aria-hidden /> {dur(s.duration)}
                            </span>
                          </span>
                          <span className="shrink-0 text-end">
                            <span className="block font-semibold">{money(s.price)}</span>
                            {s.oldPrice && <span className="text-xs text-muted-foreground line-through">{money(s.oldPrice)}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {/* Étape 2 : professionnel */}
          {step === 1 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={b.proAria}>
              {[{ id: "any", name: b.anyPro, role: b.anyProHint, rating: 0 }, ...employees.map((e) => ({ ...e, role: tc(e.role) }))].map((e) => {
                const on = employee === e.id;
                const full = employees.find((x) => x.id === e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setEmployee(e.id)}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border bg-card p-4 text-start transition-colors",
                      on ? "border-primary ring-3 ring-ring/20" : "border-border hover:border-plum-300"
                    )}
                  >
                    {e.id === "any" ? (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blush text-plum-700">
                        <Users className="size-5" aria-hidden />
                      </span>
                    ) : (
                      <Avatar className="size-12">
                        {full?.avatar && <AvatarImage src={full.avatar} alt="" />}
                        <AvatarFallback className="bg-blush font-semibold text-plum-700">{e.name[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{e.name}</span>
                      <span className="block text-sm text-muted-foreground">{e.role}</span>
                    </span>
                    {e.rating > 0 && <Rating value={e.rating} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Étape 3 : date & heure */}
          {step === 2 && (
            <div className="mt-6">
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={b.dayAria}>
                {DAYS.map((d) => (
                  <button
                    key={d.index}
                    type="button"
                    role="radio"
                    aria-checked={day === d.index}
                    aria-label={df(d.iso, { weekday: "long", day: "numeric", month: "long" })}
                    disabled={d.closed}
                    onClick={() => {
                      setDay(d.index);
                      chooseTime(null);
                    }}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition-colors",
                      day === d.index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-plum-300",
                      d.closed && "cursor-not-allowed opacity-45 hover:border-border"
                    )}
                  >
                    <span className="text-xs">{df(d.iso, { weekday: "short" })}</span>
                    <span className="text-lg font-semibold">{df(d.iso, { day: "numeric" })}</span>
                    <span className="text-[11px] opacity-80">{d.closed ? b.closed : df(d.iso, { month: "short" })}</span>
                  </button>
                ))}
              </div>

              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold">
                  {f(t.common.plusPoints, { n: 10 })}
                </span>
                {b.offPeakHint}
              </p>

              <div className="mt-6 space-y-6" aria-busy={slotsLoading}>
                {DAYS[day].closed && <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{b.closedDay}</p>}
                {slotsLoading && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6" aria-label={b.loadingSlots}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <span key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                )}
                {!slotsLoading && needSlots && slots.length === 0 && (
                  <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{availability?.error ? t.errors.generic : b.noSlots}</p>
                )}
                {!slotsLoading && PERIODS.map((p, pi) => {
                  const from = pi === 0 ? "00:00" : PERIODS[pi - 1].until;
                  const periodSlots = slots.filter((s) => s.time >= from && s.time < p.until);
                  if (!periodSlots.length) return null;
                  return (
                  <div key={p.id}>
                    <h2 className="text-sm font-semibold text-muted-foreground">{b.periods[p.id]}</h2>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6" role="radiogroup" aria-label={b.periods[p.id]}>
                      {periodSlots.map(({ time: s, employees: free, offPeak: bonus }) => {
                        const taken = free.length === 0;
                        const on = time === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={taken}
                            onClick={() => chooseTime(s)}
                            aria-label={`${s}${taken ? b.slotFull : ""}${bonus ? b.slotBonus : ""}`}
                            className={cn(
                              "relative h-12 rounded-xl border text-sm font-semibold tabular-nums transition-colors",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : taken
                                  ? "cursor-not-allowed border-dashed border-border bg-transparent text-muted-foreground/60 line-through"
                                  : "border-border bg-card hover:border-plum-300 hover:bg-plum-50"
                            )}
                          >
                            {s}
                            {bonus && !taken && (
                              <span className={cn("absolute -top-2 end-1 rounded-full px-1.5 text-[10px] font-bold", on ? "bg-white text-gold" : "bg-gold-soft text-gold")}>
                                +10
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                {b.allFull}{" "}
                <button
                  type="button"
                  onClick={() => toast.success(b.waitlistToast, { description: b.waitlistToastDesc })}
                  className="font-semibold text-plum-700 hover:underline"
                >
                  {b.waitlist}
                </button>
              </p>
            </div>
          )}

          {/* Étape 4 : confirmation */}
          {step === 3 && time && (
            <div className="mt-6 space-y-5">
              {lockExpired ? (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-destructive ring-1 ring-destructive/20" role="alert">
                  <TimerReset className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">{f(b.lockExpired, { time })}</span>
                  <button
                    type="button"
                    onClick={() => {
                      chooseTime(null);
                      setStep(2);
                    }}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {b.chooseOther}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-plum-50 p-4 text-sm text-plum-800 ring-1 ring-plum-200" role="status">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  <span>
                    {rich(b.lockActive, {
                      slot: <strong key="slot">{f(b.at, { date: dayLong, time })}</strong>,
                      time: (
                        <strong key="time" className="tabular-nums" dir="ltr">
                          {Math.floor(lockLeft / 60)}:{String(lockLeft % 60).padStart(2, "0")}
                        </strong>
                      ),
                    })}
                  </span>
                  <TimerReset className="ms-auto size-4 shrink-0" aria-hidden />
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold">{b.contact}</h2>
                <p className="mt-1 text-sm break-words text-muted-foreground">
                  {user ? (
                    <>
                      {user.name}
                      {user.phone && (
                        <>
                          {" · "}
                          <span dir="ltr">{user.phone}</span>
                        </>
                      )}
                      {" · "}
                      <span dir="ltr">{user.email}</span>
                    </>
                  ) : (
                    b.loginToBook
                  )}
                </p>
                <label htmlFor="note" className="mt-4 block text-sm font-medium">
                  {b.noteLabel} <span className="font-normal text-muted-foreground">{b.noteHint}</span>
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={b.notePlaceholder}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none md:text-sm"
                />
              </div>

              <fieldset className="rounded-2xl border border-border bg-card p-5">
                <legend className="px-1 font-semibold">{b.payment}</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "online" as const, icon: CreditCard, title: f(b.payOnline, { amount: money(deposit) }), text: b.payOnlineHint },
                    { id: "onsite" as const, icon: Store, title: b.payOnsite, text: b.payOnsiteHint },
                  ].map(({ id, icon: Icon, title, text }) => (
                    <label
                      key={id}
                      className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors", payment === id ? "border-primary bg-plum-50" : "border-border hover:border-plum-300")}
                    >
                      <input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} className="mt-1 accent-[#6b2a5c]" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Icon className="size-4 shrink-0 text-plum-600" aria-hidden /> {title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{b.noCardStored}</p>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#6b2a5c]" />
                <span>{b.acceptPolicy}</span>
              </label>
            </div>
          )}
        </div>

        {/* Navigation desktop */}
        <div className="mt-10 hidden items-center justify-between gap-3 lg:flex">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:bg-muted">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {b.back}
            </button>
          ) : (
            <span />
          )}
          <NextButton step={step} disabled={!canNext || submitting} submitting={submitting} onClick={() => void next()} loginFirst={step === 3 && !user} />
        </div>
      </div>

      {/* Récapitulatif : à côté sur grand écran, sous les étapes sur petit écran */}
      <aside className="min-w-0">
        <div className="rounded-3xl lg:sticky lg:top-24 border border-border bg-card p-5 shadow-soft">
          <div className="flex gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
              <Image src={salon.cover} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{salon.name}</p>
              <Rating value={salon.rating} count={salon.reviewCount} />
              <p className="truncate text-xs text-muted-foreground">{tc(salon.city)}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-5">{summary}</div>
        </div>
      </aside>

      {/* Barre mobile */}
      <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border" aria-label={b.prevStep}>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{money(total)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {services.length ? `${f(services.length > 1 ? b.countOther : b.countOne, { n: services.length })} · ${dur(duration)}` : b.noService}
              {time ? ` · ${f(b.at, { date: df(DAYS[day].iso, { weekday: "short", day: "numeric" }), time })}` : ""}
            </p>
          </div>
          <NextButton step={step} disabled={!canNext || submitting} submitting={submitting} onClick={() => void next()} loginFirst={step === 3 && !user} />
        </div>
      </div>
    </div>
  );
}

function NextButton({
  step,
  disabled,
  submitting,
  onClick,
  loginFirst,
}: {
  step: number;
  disabled: boolean;
  submitting: boolean;
  onClick: () => void;
  loginFirst?: boolean;
}) {
  const { t } = useI18n();
  const b = t.booking;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-plum-800 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:px-7"
    >
      {submitting && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      {step === 3 ? (submitting ? b.confirming : loginFirst ? b.loginCta : b.confirm) : b.next}
    </button>
  );
}

function Summary({
  services,
  emp,
  when,
  duration,
  total,
  deposit,
  points,
}: {
  services: Service[];
  emp?: string;
  when: string | null;
  duration: number;
  total: number;
  deposit: number;
  points: number;
}) {
  const { t, tc, f, money, dur } = useI18n();
  const b = t.booking;
  return (
    <div className="space-y-4 text-sm">
      {services.length === 0 ? (
        <p className="text-muted-foreground">{b.selectOne}</p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span className="text-foreground">{tc(s.name)}</span>
              <span className="shrink-0 font-medium">{money(s.price)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="space-y-2 text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>{b.with}</dt>
          <dd className="text-end font-medium text-foreground">{emp ?? b.anyPro}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{b.when}</dt>
          <dd className="text-end font-medium text-foreground">{when ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{b.duration}</dt>
          <dd className="font-medium text-foreground">{duration ? dur(duration) : "—"}</dd>
        </div>
      </dl>
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex justify-between text-base font-semibold">
          <span>{b.total}</span>
          <span>{money(total)}</span>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>{b.depositToday}</span>
            <span>{money(deposit)}</span>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-gold-soft/70 px-3.5 py-3">
          <span className="text-xs text-foreground">{b.pointsAfter}</span>
          <span className="shrink-0 text-sm font-bold text-gold">{f(t.common.plusPoints, { n: points })}</span>
        </div>
      )}
    </div>
  );
}
