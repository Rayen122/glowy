"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CalendarCheck, Check, Clock, MessageCircle, ShieldAlert, Sparkles, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PointsBadge } from "@/components/salon/badges";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import type { ChatReply, ChatResponse, ChatSlot, ChatTurn } from "@/modules/assistant";
import { cn } from "@/lib/utils";

/** Les messages sont stockés sous forme de données : ils se re-traduisent si la langue change. */
type BotContent = ChatReply | { kind: "welcome" } | { kind: "courtesy" } | { kind: "prepare"; slot: ChatSlot } | { kind: "done"; slot: ChatSlot } | { kind: "login" } | { kind: "slotTaken" } | { kind: "error" };
type Message = { id: number; role: "user"; text: string } | ({ id: number; role: "bot" } & BotContent);

const SERVICE_ORDER = ["coupe", "brushing", "couleur", "chignon", "ongles", "soin", "massage", "maquillage", "barbe", "epilation"] as const;

/**
 * Assistante de réservation (IA P3) : comprend la demande (POST /api/ai/chat), propose de vrais créneaux libres,
 * et ne réserve (POST /api/bookings) qu'après confirmation explicite. Repli : formulaire de réservation.
 */
export function ChatbotWidget() {
  const { t, f, rich, money, df } = useI18n();
  const c = t.chatbot;
  const pathname = usePathname();
  const salonSlug = pathname.match(/^\/salons\/([^/]+)$/)?.[1];
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "bot", kind: "welcome" }]);
  const [lastSlots, setLastSlots] = useState<Extract<ChatReply, { kind: "slots" }> | null>(null);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  // Le bouton flottant ne recouvre jamais un élément marqué `data-launcher-avoid` (barre de recherche de l'accueil) :
  // tant qu'ils se chevaucheraient, il se réduit à son icône et remonte juste au-dessus
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const button = launcherRef.current;
        if (!button) return;
        // Position de repos d'après la règle CSS `bottom` (jamais d'après le rendu, faussé pendant la transition)
        const rect = button.getBoundingClientRect();
        const bottom = window.innerHeight - parseFloat(getComputedStyle(button).bottom);
        const top = bottom - button.offsetHeight;
        let next = 0;
        for (const el of document.querySelectorAll("[data-launcher-avoid]")) {
          const r = el.getBoundingClientRect();
          if (r.left < rect.right && r.right > rect.left && r.top < bottom && r.bottom > top) next = Math.max(next, Math.ceil(bottom - r.top + 12));
        }
        setLift(next);
      });
    };
    measure();
    // Les éléments de l'accueil arrivent avec une animation d'entrée : nouvelle mesure une fois en place
    const timers = [400, 1200, 2500].map((ms) => window.setTimeout(measure, ms));
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const longDate = (iso: string) => df(iso, { weekday: "long", day: "numeric", month: "long" });
  const pushUser = (text: string) => {
    const id = idRef.current++;
    setMessages((m) => [...m, { id, role: "user", text }]);
    return id;
  };
  const pushBot = (content: BotContent) => setMessages((m) => [...m, { id: idRef.current++, role: "bot", ...content }]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || typing) return;
    // Derniers échanges écrits (client et réponses rédigées par l'IA) : l'assistante suit la conversation
    const history: ChatTurn[] = messages
      .flatMap((m): ChatTurn[] => (m.role === "user" ? [{ role: "user", text: m.text }] : "text" in m && m.text ? [{ role: "bot", text: m.text }] : []))
      .slice(-8)
      .map((turn) => ({ ...turn, text: turn.text.slice(0, 1000) }));
    const userId = pushUser(value);
    setInput("");
    setTyping(true);
    try {
      const { masked, ...reply } = await api<ChatResponse>("/api/ai/chat", { method: "POST", body: { message: value, salonSlug, history } });
      // Gros mots : la bulle du client est réécrite masquée (et l'historique renvoyé ensuite aussi), avec un rappel à la politesse
      if (masked) {
        setMessages((m) => m.map((msg) => (msg.id === userId && msg.role === "user" ? { ...msg, text: masked } : msg)));
        pushBot({ kind: "courtesy" });
      }
      if (reply.kind === "slots") setLastSlots(reply);
      pushBot(reply);
    } catch {
      pushBot({ kind: "error" });
    } finally {
      setTyping(false);
    }
  }

  const pickSlot = (slot: ChatSlot) => {
    pushUser(f(c.pickUser, { salon: slot.salon, time: slot.time }));
    pushBot({ kind: "prepare", slot });
  };

  async function confirmSlot(slot: ChatSlot) {
    pushUser(c.userConfirm);
    setTyping(true);
    try {
      await api("/api/bookings", { method: "POST", body: { salonSlug: slot.slug, serviceKeys: [slot.serviceKey], employee: slot.employeeKey, date: slot.date, time: slot.time, paymentMethod: "ONSITE" } });
      pushBot({ kind: "done", slot });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) pushBot({ kind: "login" });
      else if (error instanceof ApiError && error.code === "SLOT_TAKEN") pushBot({ kind: "slotTaken" });
      else pushBot({ kind: "error" });
    } finally {
      setTyping(false);
    }
  }

  const slotButton = (s: ChatSlot) => (
    <button
      type="button"
      onClick={() => pickSlot(s)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-start transition-colors hover:border-plum-300 hover:bg-plum-50"
    >
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-blush text-plum-700">
        <Clock className="size-3.5" aria-hidden />
        <span className="text-xs font-semibold tabular-nums">{s.time}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{s.salon}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {s.serviceName} · {f(c.withPrice, { name: s.employeeName, price: money(s.price) })}
        </span>
      </span>
      {s.offPeak && <PointsBadge points={10} />}
    </button>
  );

  const renderBot = (m: BotContent) => {
    switch (m.kind) {
      case "welcome":
        return <p>{c.welcome}</p>;
      case "courtesy":
        return (
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden /> {c.courtesy}
          </p>
        );
      case "answer":
        return (
          <p className="whitespace-pre-line" dir="auto">
            {m.text}
          </p>
        );
      case "greeting":
        return <p>{c.greeting}</p>;
      case "thanks":
        return <p>{c.thanks}</p>;
      case "fallback":
        return (
          <p>
            {c.fallback}{" "}
            <Link href={salonSlug ? `/salons/${salonSlug}/reserver` : "/salons"} className="font-semibold text-plum-700 underline-offset-2 hover:underline">
              {c.useForm}
            </Link>
          </p>
        );
      case "error":
        return (
          <p>
            {c.error}{" "}
            <Link href="/salons" className="font-semibold text-plum-700 underline-offset-2 hover:underline">
              {c.useForm}
            </Link>
          </p>
        );
      case "faq":
        return (
          <div className="space-y-2">
            {m.topic === "hours" && m.hours ? (
              <>
                <p className="font-medium">{f(c.hoursFor, { salon: m.salon ?? "" })}</p>
                <ul className="space-y-0.5 text-[13px]">
                  {m.hours.map((h) => (
                    <li key={h.weekday} className="flex justify-between gap-4">
                      <span className="capitalize">{df(`2026-01-${String(4 + h.weekday).padStart(2, "0")}`, { weekday: "long" })}</span>
                      <span className="tabular-nums" dir="ltr">
                        {h.opensAt} – {h.closesAt}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{c.faq[m.topic]}</p>
            )}
          </div>
        );
      case "clarify":
        return (
          <div className="space-y-2">
            <p>{c.clarify}</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_ORDER.slice(0, 6).map((k) => (
                <button key={k} type="button" onClick={() => void send(c.services[k])} className="rounded-full border border-plum-200 bg-card px-3 py-1 text-[13px] text-plum-700 hover:bg-plum-50">
                  {c.services[k]}
                </button>
              ))}
            </div>
          </div>
        );
      case "none":
        return (
          <p>
            {m.text ? <span dir="auto">{m.text}</span> : f(m.closed ? c.noneClosed : c.none, { service: c.services[m.query.service], date: longDate(m.query.date) })}{" "}
            <Link href={m.query.city ? `/salons?ville=${encodeURIComponent(m.query.city)}` : "/salons"} className="font-semibold text-plum-700 underline-offset-2 hover:underline">
              {c.searchCta}
            </Link>
          </p>
        );
      case "slots":
        return (
          <div className="space-y-3">
            {m.text ? (
              <p className="whitespace-pre-line" dir="auto">
                {m.text}
              </p>
            ) : (
              <p>
                {rich(c.understood, {
                  service: <strong key="s">{c.services[m.query.service]}</strong>,
                  date: <strong key="d">{longDate(m.query.date)}</strong>,
                  place: m.query.city ? f(c.place, { city: m.query.city }) : "",
                })}
              </p>
            )}
            <ul className="space-y-2">
              {m.slots.map((s) => (
                <li key={`${s.slug}-${s.time}`}>{slotButton(s)}</li>
              ))}
            </ul>
          </div>
        );
      case "prepare":
        return (
          <div className="space-y-3">
            <p>
              {rich(c.prepare, {
                service: <strong key="s">{m.slot.serviceName}</strong>,
                salon: <strong key="n">{m.slot.salon}</strong>,
                date: longDate(m.slot.date),
                time: <strong key="t">{m.slot.time}</strong>,
                name: m.slot.employeeName,
                price: money(m.slot.price),
              })}
            </p>
            <p className="text-muted-foreground">{c.onlyAfterConfirm}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={typing}
                onClick={() => void confirmSlot(m.slot)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-plum-800 disabled:opacity-60"
              >
                <Check className="size-4" aria-hidden /> {c.confirm}
              </button>
              {lastSlots && (
                <button
                  type="button"
                  onClick={() => {
                    pushUser(c.moreSlots);
                    pushBot(lastSlots);
                  }}
                  className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  {c.change}
                </button>
              )}
            </div>
          </div>
        );
      case "login":
        return (
          <p>
            {c.loginToConfirm}{" "}
            <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`} className="font-semibold text-plum-700 underline-offset-2 hover:underline">
              {c.loginCta}
            </Link>
          </p>
        );
      case "slotTaken":
        return <p>{c.slotTaken}</p>;
      case "done":
        return (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-medium text-success">
              <CalendarCheck className="size-4" aria-hidden /> {c.confirmed}
            </p>
            <p>{f(c.confirmedText, { salon: m.slot.salon, date: longDate(m.slot.date), time: m.slot.time })}</p>
            {m.slot.offPeak && <PointsBadge points={10} label={c.offPeakLabel} />}
          </div>
        );
    }
  };

  // Le tunnel de réservation a sa propre barre d'action en bas d'écran
  if (pathname.endsWith("/reserver")) return null;
  const launcherStyle = lift > 0 ? { transform: `translateY(-${lift}px)` } : undefined;
  // Page salon : une barre « Réserver » occupe le bas de l'écran sur mobile
  const raised = /^\/salons\/[^/]+$/.test(pathname);

  return (
    <>
      <button
        ref={launcherRef}
        style={launcherStyle}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bh-chatbot"
        aria-label={c.launcher}
        className={cn(
          "fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 inline-flex size-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-white shadow-lift ring-1 ring-white/15 transition-[transform,background-color] duration-200 hover:bg-plum-800 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:end-6 sm:bottom-6 sm:h-14 sm:w-auto sm:ps-4 sm:pe-5",
          raised && "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-24 lg:bottom-6",
          open && "pointer-events-none translate-y-2 opacity-0",
          // Au-dessus d'un élément à ne pas recouvrir : icône seule (le libellé reste lu par aria-label)
          lift > 0 && "sm:size-14 sm:px-0"
        )}
      >
        <span className="relative">
          <MessageCircle className="size-5" aria-hidden />
          <Sparkles className="absolute -end-1.5 -top-1.5 size-3 text-plum-200" aria-hidden />
        </span>
        <span className={cn("hidden sm:inline", lift > 0 && "sm:hidden")}>{c.launcher}</span>
      </button>

      <section
        id="bh-chatbot"
        role="dialog"
        aria-label={c.dialogAria}
        aria-hidden={!open}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex h-[min(640px,88dvh)] w-full origin-bottom flex-col overflow-hidden rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_30px_80px_-20px_rgb(58_21_50/0.45)] ring-1 ring-border transition-[opacity,transform] duration-200 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px] sm:origin-bottom-right sm:rounded-3xl sm:pb-0 sm:rtl:origin-bottom-left",
          open ? "scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0"
        )}
      >
        <header className="flex items-center gap-3 bg-plum-700 px-4 py-3.5 text-white">
          <LogoMark inverted className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{c.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-plum-100">
              <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden /> {c.online}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex size-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            aria-label={c.close}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-ivory px-4 py-4" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[88%] animate-in rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed duration-300 fade-in-0 slide-in-from-bottom-2",
                  m.role === "user" ? "rounded-ee-md bg-plum-700 text-white" : "rounded-es-md bg-card text-foreground ring-1 ring-border"
                )}
              >
                {m.role === "user" ? <span dir="auto">{m.text}</span> : renderBot(m)}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex">
              <div className="flex items-center gap-1 rounded-2xl rounded-es-md bg-card px-4 py-3 ring-1 ring-border" aria-label={c.typing}>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-plum-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          {messages.length === 1 && !typing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {c.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-plum-200 bg-card px-3 py-1.5 text-[13px] text-plum-700 transition-colors hover:bg-plum-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="border-t border-border bg-card p-3"
        >
          <div className="flex items-center gap-2 rounded-full bg-muted ps-4 pe-1.5 ring-1 ring-transparent focus-within:bg-card focus-within:ring-ring/60">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={c.placeholder}
              aria-label={c.messageAria}
              dir="auto"
              className="h-11 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none lg:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label={c.send}
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 px-2 text-center text-[11px] text-muted-foreground">
            {c.unavailable}{" "}
            <Link href="/salons" className="font-medium text-plum-700 underline-offset-2 hover:underline">
              {c.useForm}
            </Link>
          </p>
        </form>
      </section>
    </>
  );
}
