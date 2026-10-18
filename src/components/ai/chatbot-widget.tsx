"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CalendarCheck, Check, Clock, MessageCircle, Sparkles, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PointsBadge } from "@/components/salon/badges";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Slot = { id: string; salon: string; slug: string; time: string; with: string; price: number; offPeak?: boolean };

/** Les messages sont stockés sous forme de données : ils se re-traduisent si la langue change. */
type BotContent = { kind: "welcome" } | { kind: "slots" } | { kind: "prepare"; slot: Slot } | { kind: "done"; slot: Slot };
type Message = { id: number; role: "user"; text: string } | ({ id: number; role: "bot" } & BotContent);

const SLOTS: Slot[] = [
  { id: "s1", salon: "Salon Yasmine", slug: "salon-yasmine-la-marsa", time: "09:30", with: "Nour", price: 120, offPeak: true },
  { id: "s2", salon: "Salon Yasmine", slug: "salon-yasmine-la-marsa", time: "15:30", with: "Amira", price: 120 },
  { id: "s3", salon: "Studio Noor", slug: "studio-noor-ennasr", time: "11:00", with: "Rania", price: 95 },
];

const WEDDING_DAY = "2026-10-03";

/**
 * Chatbot de réservation (IA Personne 3).
 * Démo scriptée : l'API réelle appelle la recherche + la réservation et ne réserve
 * qu'après confirmation explicite. Repli vers le formulaire si le service est indisponible.
 */
export function ChatbotWidget() {
  const { t, tc, f, rich, money, df } = useI18n();
  const c = t.chatbot;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<"idle" | "slots" | "confirm" | "done">("idle");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "bot", kind: "welcome" }]);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const date = df(WEDDING_DAY, { weekday: "long", day: "numeric", month: "long" });

  const pushUser = (text: string) => setMessages((m) => [...m, { id: idRef.current++, role: "user", text }]);

  const botReply = (content: BotContent, next: typeof step, delay = 900) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: idRef.current++, role: "bot", ...content }]);
      setStep(next);
    }, delay);
  };

  const sendSlots = () => botReply({ kind: "slots" }, "slots", 1200);

  const pickSlot = (slot: Slot) => {
    pushUser(f(c.pickUser, { salon: slot.salon, time: slot.time }));
    botReply({ kind: "prepare", slot }, "confirm");
  };

  const confirmSlot = (slot: Slot) => {
    pushUser(c.userConfirm);
    botReply({ kind: "done", slot }, "done", 1100);
  };

  const send = (text: string) => {
    const value = text.trim();
    if (!value || typing) return;
    pushUser(value);
    setInput("");
    sendSlots();
  };

  const renderBot = (m: BotContent) => {
    if (m.kind === "welcome") return <p>{c.welcome}</p>;
    if (m.kind === "slots")
      return (
        <div className="space-y-3">
          <p>
            {rich(c.understood, {
              service: <strong key="s">{c.weddingHair}</strong>,
              date: <strong key="d">{date}</strong>,
              place: <strong key="p">{tc("La Marsa")}</strong>,
            })}
          </p>
          <ul className="space-y-2">
            {SLOTS.map((s) => (
              <li key={s.id}>
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
                    <span className="block text-xs text-muted-foreground">{f(c.withPrice, { name: s.with, price: money(s.price) })}</span>
                  </span>
                  {s.offPeak && <PointsBadge points={10} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    if (m.kind === "prepare")
      return (
        <div className="space-y-3">
          <p>
            {rich(c.prepare, {
              service: <strong key="s">{tc("Chignon de mariée")}</strong>,
              salon: <strong key="n">{m.slot.salon}</strong>,
              date,
              time: <strong key="t">{m.slot.time}</strong>,
              name: m.slot.with,
              price: money(m.slot.price),
              deposit: money(20),
            })}
          </p>
          <p className="text-muted-foreground">{c.onlyAfterConfirm}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => confirmSlot(m.slot)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-plum-800"
            >
              <Check className="size-4" aria-hidden /> {c.confirm}
            </button>
            <button
              type="button"
              onClick={() => {
                pushUser(c.moreSlots);
                sendSlots();
              }}
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              {c.change}
            </button>
          </div>
        </div>
      );
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 font-medium text-success">
          <CalendarCheck className="size-4" aria-hidden /> {c.confirmed}
        </p>
        <p>{f(c.confirmedText, { salon: m.slot.salon, date, time: m.slot.time })}</p>
        {m.slot.offPeak && <PointsBadge points={10} label={c.offPeakLabel} />}
      </div>
    );
  };

  // Le tunnel de réservation a sa propre barre d'action en bas d'écran
  if (pathname.endsWith("/reserver")) return null;
  // Page salon : une barre « Réserver » occupe le bas de l'écran sur mobile
  const raised = /^\/salons\/[^/]+$/.test(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bh-chatbot"
        aria-label={c.launcher}
        className={cn(
          "fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 inline-flex size-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-white shadow-lift ring-1 ring-white/15 transition-[transform,background-color] duration-200 hover:bg-plum-800 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:end-6 sm:bottom-6 sm:h-14 sm:w-auto sm:ps-4 sm:pe-5",
          raised && "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-24 lg:bottom-6",
          open && "pointer-events-none translate-y-2 opacity-0"
        )}
      >
        <span className="relative">
          <MessageCircle className="size-5" aria-hidden />
          <Sparkles className="absolute -end-1.5 -top-1.5 size-3 text-plum-200" aria-hidden />
        </span>
        <span className="hidden sm:inline">{c.launcher}</span>
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
          {step === "idle" && !typing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {c.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
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
            send(input);
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
              className="h-11 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none sm:text-sm"
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
