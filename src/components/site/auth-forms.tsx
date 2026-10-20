"use client";

import Link from "next/link";
import { useRef, useState, type ComponentProps, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  FileUp,
  Gift,
  Info,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Phone,
  Store,
  UserRound,
} from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { homeForRole } from "@/auth.config";
import { AUTH_SUCCESS_EVENT } from "@/components/auth/auth-stage";
import { useI18n } from "@/i18n/client";
import { api, ApiError, safeCallback } from "@/lib/api";
import { PLANS, type CategoryId } from "@/lib/data";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const motionOK = () => window.matchMedia(MOTION_OK).matches;

type Status = "idle" | "loading" | "success";

/* ---------- Champs ---------- */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden /> {message}
    </p>
  );
}

const inputBase =
  "peer h-14 w-full rounded-2xl border border-input bg-white ps-11 pt-5 pb-1.5 text-base text-foreground lg:text-[15px] transition-[border-color,box-shadow] duration-200 outline-none focus:border-plum-400 focus:ring-4 focus:ring-plum-200/60 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10";
const floatLabel =
  "pointer-events-none absolute start-11 top-3.5 -translate-y-1/2 text-xs font-medium text-muted-foreground transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal sm:peer-placeholder-shown:text-[15px] peer-focus:top-3.5 peer-focus:text-xs peer-focus:font-medium peer-focus:text-plum-700";
const iconSlot =
  "pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-plum-600 [&_svg]:size-[18px]";

function FloatField({
  id,
  label,
  icon,
  error,
  className,
  ...props
}: { id: string; label: string; icon: React.ReactNode; error?: string } & ComponentProps<"input">) {
  return (
    <div data-auth-item className={className}>
      <div className="group relative">
        <span className={iconSlot} aria-hidden>
          {icon}
        </span>
        <input
          id={id}
          name={id}
          placeholder=" "
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputBase, "pe-4")}
          {...props}
        />
        <label htmlFor={id} className={floatLabel}>
          {label}
        </label>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = [
  { bar: "bg-destructive", text: "text-destructive" },
  { bar: "bg-destructive", text: "text-destructive" },
  { bar: "bg-warning", text: "text-warning" },
  { bar: "bg-success", text: "text-success" },
  { bar: "bg-success", text: "text-success" },
];
const CATEGORY_IDS: CategoryId[] = ["coiffure", "barbier", "ongles", "spa", "maquillage", "visage"];

function PasswordField({
  id = "password",
  label,
  autoComplete,
  error,
  showStrength,
}: {
  id?: string;
  label?: string;
  autoComplete: string;
  error?: string;
  showStrength?: boolean;
}) {
  const { t } = useI18n();
  const a = t.auth.form;
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const score = strength(value);
  return (
    <div data-auth-item>
      <div className="group relative">
        <span className={iconSlot} aria-hidden>
          <Lock />
        </span>
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder=" "
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={[error ? `${id}-error` : "", showStrength ? `${id}-strength` : ""].join(" ").trim() || undefined}
          className={cn(inputBase, "pe-12")}
        />
        <label htmlFor={id} className={floatLabel}>
          {label ?? a.password}
        </label>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute end-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={show ? a.hidePassword : a.showPassword}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div id={`${id}-strength`} className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-colors duration-300", i < score ? STRENGTH[score].bar : "bg-border")} />
            ))}
          </div>
          <span className={cn("text-xs font-semibold", STRENGTH[score].text)}>{a.strength[score]}</span>
        </div>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/* ---------- Boutons ---------- */

/** AUTH-08 : connexion Google (affichée seulement si l'application OAuth est configurée côté serveur) */
function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  const { t } = useI18n();
  const a = t.auth.form;
  return (
    <button
      type="button"
      data-auth-item
      onClick={() => void signIn("google", { redirectTo: callbackUrl ?? "/compte" })}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white text-sm font-semibold transition-colors hover:bg-muted"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {a.google}
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div data-auth-item className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function SubmitButton({ status, idle, loading, success }: { status: Status; idle: string; loading: string; success: string }) {
  return (
    <button
      type="submit"
      data-auth-item
      disabled={status !== "idle"}
      className={cn(
        "group relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[15px] font-semibold text-primary-foreground transition-colors duration-300 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-wait",
        status === "success" ? "bg-success" : "bg-primary hover:bg-plum-800"
      )}
    >
      {status === "loading" && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {status === "success" && <Check className="size-5" aria-hidden />}
      <span aria-live="polite">{status === "loading" ? loading : status === "success" ? success : idle}</span>
      {status === "idle" && (
        <ArrowRight className="size-[18px] transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
      )}
    </button>
  );
}

/** Secousse de la carte (erreur) et sortie animée (succès) */
function useCardMotion(scope: React.RefObject<HTMLFormElement | null>) {
  const { contextSafe } = useGSAP({ scope });
  const card = () => scope.current?.closest<HTMLElement>("[data-auth-card]") ?? null;

  const shake = contextSafe(() => {
    const el = card();
    if (!el || !motionOK()) return;
    gsap.to(el, { keyframes: { x: [0, -12, 10, -7, 4, 0] }, duration: 0.55, ease: "power1.inOut" });
  });

  const exit = contextSafe(() => {
    window.dispatchEvent(new Event(AUTH_SUCCESS_EVENT));
    const el = card();
    if (el && motionOK()) gsap.to(el, { autoAlpha: 0, y: -28, scale: 0.96, duration: 0.6, ease: "power3.in", delay: 0.5 });
  });

  return { shake, exit };
}

/* ---------- Connexion ---------- */

/**
 * Après connexion : page demandée (si interne) ou espace du rôle.
 * Navigation complète (et non router.push) : toutes les mises en page serveur relisent le nouveau cookie de session.
 */
function useAfterLogin(callbackUrl?: string) {
  return async () => {
    const session = await getSession();
    const target = safeCallback(callbackUrl) ?? homeForRole(session?.user.role ?? "CLIENT");
    window.setTimeout(() => window.location.assign(target), motionOK() ? 900 : 100);
  };
}

const DEMO_ROLES = ["CLIENT", "MANAGER", "EMPLOYEE", "ADMIN"] as const;

export function LoginForm({ callbackUrl, demoEnabled, googleEnabled = false }: { callbackUrl?: string; demoEnabled: boolean; googleEnabled?: boolean }) {
  const { t, f } = useI18n();
  const a = t.auth.form;
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [demoPending, setDemoPending] = useState<string | null>(null);
  const { shake, exit } = useCardMotion(formRef);
  const afterLogin = useAfterLogin(callbackUrl);

  const loginAsDemo = async (role: (typeof DEMO_ROLES)[number]) => {
    setDemoPending(role);
    const result = await signIn("demo", { role, redirect: false });
    if (!result || result.error) {
      setDemoPending(null);
      toast.error(t.errors.generic);
      return;
    }
    exit();
    await afterLogin();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next: typeof errors = {};
    if (!EMAIL.test(email)) next.email = a.errors.email;
    if (password.length < 8) next.password = a.errors.passwordLogin;
    setErrors(next);
    if (next.email || next.password) {
      (form.elements.namedItem(next.email ? "email" : "password") as HTMLInputElement | null)?.focus();
      shake();
      return;
    }
    setStatus("loading");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      setStatus("idle");
      const code = result?.code;
      setErrors({
        password: code === "account_locked" ? t.errors.accountLocked : code === "account_blocked" ? t.errors.accountBlocked : t.errors.invalidCredentials,
      });
      (form.elements.namedItem("password") as HTMLInputElement | null)?.focus();
      shake();
      return;
    }
    setStatus("success");
    exit();
    await afterLogin();
  };

  return (
    <div className="space-y-5">
      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-4">
        <FloatField id="email" label={a.email} type="email" autoComplete="email" inputMode="email" dir="ltr" icon={<Mail />} error={errors.email} />
        <PasswordField autoComplete="current-password" error={errors.password} />
        <div data-auth-item className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" name="remember" className="size-4 rounded accent-[#6b2a5c]" /> {a.remember}
          </label>
          <Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-plum-700 hover:underline">
            {a.forgot}
          </Link>
        </div>
        <SubmitButton status={status} idle={a.signIn} loading={a.signingIn} success={a.welcome} />
      </form>

      {googleEnabled && (
        <>
          <Divider label={a.orContinue} />
          <GoogleButton callbackUrl={callbackUrl} />
        </>
      )}

      <p data-auth-item className="text-center text-sm text-muted-foreground">
        {a.newHere}{" "}
        <Link href="/inscription" className="font-semibold text-plum-700 hover:underline">
          {f(a.createAccount, { pts: f(t.common.plusPoints, { n: 20 }) })}
        </Link>
      </p>

      {demoEnabled && (
        <div data-auth-item className="rounded-2xl border border-dashed border-plum-200 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Info className="size-3.5 text-plum-600" aria-hidden /> {a.demoAccess}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {DEMO_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                disabled={demoPending !== null}
                onClick={() => void loginAsDemo(role)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold ring-1 ring-border transition-colors hover:bg-plum-50 hover:ring-plum-300 disabled:opacity-60"
              >
                {demoPending === role && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
                {a.roles[({ CLIENT: "client", MANAGER: "manager", EMPLOYEE: "employee", ADMIN: "admin" } as const)[role]]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Inscription ---------- */

type SignupErrors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "salonName" | "city" | "address" | "phone" | "terms", string>>;

export function SignupForm({ initialType = "client", googleEnabled = false }: { initialType?: "client" | "salon"; googleEnabled?: boolean }) {
  const { t, f, money, locale } = useI18n();
  const a = t.auth.form;
  const formRef = useRef<HTMLFormElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const prevType = useRef(initialType);
  const [type, setType] = useState<"client" | "salon">(initialType);
  const [plan, setPlan] = useState("gratuit");
  const [file, setFile] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [sent, setSent] = useState(false);
  const { shake, exit } = useCardMotion(formRef);
  const afterLogin = useAfterLogin("/compte");

  // Changement client ↔ salon : les champs arrivent en cascade
  useGSAP(
    () => {
      if (prevType.current === type) return;
      prevType.current = type;
      const el = fieldsRef.current;
      if (!el || !motionOK()) return;
      gsap.from(el.children, { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05, ease: "power2.out" });
    },
    { dependencies: [type], scope: fieldsRef }
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const next: SignupErrors = {};
    if (type === "client") {
      if (!v("firstName")) next.firstName = a.errors.firstName;
      if (!v("lastName")) next.lastName = a.errors.lastName;
    } else {
      if (!v("salonName")) next.salonName = a.errors.salonName;
      if (!v("city")) next.city = a.errors.city;
      if (!v("address")) next.address = a.errors.address;
      if (v("phone").replace(/\D/g, "").length < 8) next.phone = a.errors.phone;
    }
    if (!EMAIL.test(v("email"))) next.email = a.errors.email;
    if (String(d.get("password") ?? "").length < 8) next.password = a.errors.password;
    if (!d.get("terms")) next.terms = a.errors.terms;
    setErrors(next);
    const firstError = Object.keys(next)[0];
    if (firstError) {
      (form.elements.namedItem(firstError) as HTMLElement | null)?.focus();
      shake();
      return;
    }
    setStatus("loading");
    const password = String(d.get("password") ?? "");
    const body =
      type === "client"
        ? { type, firstName: v("firstName"), lastName: v("lastName"), email: v("email"), password, referralCode: v("referral") || undefined, locale }
        : { type, salonName: v("salonName"), category: v("category"), city: v("city"), address: v("address"), email: v("email"), phone: v("phone"), password, plan, documentName: file ?? undefined, locale };
    try {
      await api("/api/auth/register", { method: "POST", body });
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") setErrors({ email: t.errors.emailTaken });
      else toast.error(error instanceof ApiError && error.status === 400 ? t.errors.validation : t.errors.generic);
      shake();
      return;
    }
    if (type === "salon") {
      setStatus("idle");
      setSent(true);
      return;
    }
    const result = await signIn("credentials", { email: v("email"), password, redirect: false });
    setStatus("success");
    exit();
    if (result && !result.error) await afterLogin();
  };

  if (sent) {
    return (
      <div className="animate-in fade-in-0 slide-in-from-bottom-3 rounded-2xl bg-white p-6 text-center ring-1 ring-border duration-500">
        <span className="mx-auto flex size-14 animate-in items-center justify-center rounded-full bg-success-soft text-success zoom-in-50 duration-500">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold tracking-tight">{a.sentTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{a.sentText}</p>
        <Link href="/pro" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
          {a.discoverPro}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Type de compte */}
      <div data-auth-item className="relative grid grid-cols-2 rounded-2xl bg-muted p-1" role="tablist" aria-label={a.accountType}>
        <span
          className={cn(
            "absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out",
            type === "salon" && "translate-x-full rtl:-translate-x-full"
          )}
          aria-hidden
        />
        {[
          { id: "client" as const, label: a.typeClient, icon: UserRound },
          { id: "salon" as const, label: a.typeSalon, icon: Store },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={type === id}
            onClick={() => {
              setType(id);
              setErrors({});
            }}
            className={cn(
              "relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-center text-sm font-semibold transition-colors duration-300",
              type === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-4">
        <div ref={fieldsRef} className="space-y-4">
          {type === "client" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FloatField id="firstName" label={a.firstName} autoComplete="given-name" icon={<UserRound />} error={errors.firstName} />
                <FloatField id="lastName" label={a.lastName} autoComplete="family-name" icon={<UserRound />} error={errors.lastName} />
              </div>
              <FloatField id="email" label={a.email} type="email" autoComplete="email" inputMode="email" dir="ltr" icon={<Mail />} error={errors.email} />
              <PasswordField autoComplete="new-password" error={errors.password} showStrength />
              <FloatField id="referral" label={a.referral} icon={<Gift />} />
              <p className="-mt-2 text-xs text-muted-foreground">{f(a.referralHint, { pts: f(t.common.plusPoints, { n: 50 }) })}</p>
            </>
          ) : (
            <>
              <FloatField id="salonName" label={a.salonName} icon={<Store />} error={errors.salonName} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div data-auth-item className="group relative">
                  <span className={iconSlot} aria-hidden>
                    <Building2 />
                  </span>
                  <select id="category" name="category" defaultValue="coiffure" className={cn(inputBase, "appearance-none pe-4")}>
                    {CATEGORY_IDS.map((c) => (
                      <option key={c} value={c}>
                        {t.categories[c]}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="category" className="pointer-events-none absolute start-11 top-3.5 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    {a.activity}
                  </label>
                </div>
                <FloatField id="city" label={a.city} autoComplete="address-level2" icon={<MapPin />} error={errors.city} />
              </div>
              <FloatField id="address" label={a.address} autoComplete="street-address" icon={<MapPin />} error={errors.address} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FloatField id="email" label={a.managerEmail} type="email" autoComplete="email" dir="ltr" icon={<Mail />} error={errors.email} />
                <FloatField id="phone" label={a.phone} type="tel" autoComplete="tel" dir="ltr" icon={<Phone />} error={errors.phone} />
              </div>
              <PasswordField autoComplete="new-password" error={errors.password} showStrength />

              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-plum-200 bg-white p-4 transition-colors hover:border-plum-300 hover:bg-plum-50">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blush text-plum-700">
                  <FileUp className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium">{file ?? a.document}</span>
                  <span className="text-muted-foreground">{a.documentHint}</span>
                </span>
                <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
              </label>

              <fieldset>
                <legend className="text-sm font-medium">{a.plan}</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PLANS.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "cursor-pointer rounded-xl border bg-white p-3 text-center transition-colors",
                        plan === p.id ? "border-primary ring-3 ring-ring/20" : "border-border hover:border-plum-300"
                      )}
                    >
                      <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
                      <span className="block text-sm font-semibold">{t.content[p.name] ?? p.name}</span>
                      <span className="text-xs text-muted-foreground">{f(a.perMonth, { price: money(p.price) })}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>

        <div data-auth-item>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="terms"
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5 size-4 accent-[#6b2a5c]"
            />
            <span className="text-muted-foreground">{a.terms}</span>
          </label>
          <FieldError id="terms-error" message={errors.terms} />
        </div>

        <SubmitButton
          status={status}
          idle={type === "client" ? f(a.createCta, { pts: f(t.common.plusPoints, { n: 20 }) }) : a.sendRequest}
          loading={a.sending}
          success={a.created}
        />
      </form>

      {type === "client" && googleEnabled && (
        <>
          <Divider label={a.orContinue} />
          <GoogleButton />
        </>
      )}
      <p data-auth-item className="text-center text-sm text-muted-foreground">
        {a.haveAccount}{" "}
        <Link href="/connexion" className="font-semibold text-plum-700 hover:underline">
          {a.signIn}
        </Link>
      </p>
    </div>
  );
}
