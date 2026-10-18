"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, ImagePlus, Info, LoaderCircle, Lock, RotateCcw, ScanFace, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PointsBadge } from "@/components/salon/badges";
import { useI18n } from "@/i18n/client";
import { IMAGES } from "@/lib/data";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type Phase = "idle" | "analyzing" | "result";
type Mode = "cheveux" | "visage";

/** Réponse structurée renvoyée par l'API (textes traduits via le dictionnaire « content ») */
const RESULT: Record<
  Mode,
  {
    summary: string;
    score: number;
    issues: { label: string; level: "moderate" | "light" }[];
    tips: string[];
    services: { name: string; salon: string; slug: string; service: string; price: number }[];
  }
> = {
  cheveux: {
    summary: "Cheveux épais et en bonne santé à la racine, avec des longueurs déshydratées et des pointes fragilisées.",
    score: 72,
    issues: [
      { label: "Pointes sèches", level: "moderate" },
      { label: "Frisottis", level: "light" },
      { label: "Manque de brillance", level: "light" },
    ],
    tips: [
      "Coupez 1 à 2 cm de pointes pour stopper la fourche.",
      "Masque hydratant une fois par semaine, sur les longueurs uniquement.",
      "Limitez le lisseur à 180 °C avec un protecteur thermique.",
    ],
    services: [
      { name: "Soin kératine", salon: "Salon Yasmine", slug: "salon-yasmine-la-marsa", service: "keratine", price: 150 },
      { name: "Coupe + soin hydratant", salon: "Salon Yasmine", slug: "salon-yasmine-la-marsa", service: "f-coupe-soin", price: 65 },
      { name: "Soin hydratant profond", salon: "Maison Elyssa", slug: "maison-elyssa-carthage", service: "hydratant", price: 40 },
    ],
  },
  visage: {
    summary: "Peau mixte, légèrement déshydratée sur les joues, zone T un peu brillante. Teint homogène.",
    score: 78,
    issues: [
      { label: "Déshydratation", level: "moderate" },
      { label: "Brillance zone T", level: "light" },
      { label: "Pores visibles", level: "light" },
    ],
    tips: [
      "Nettoyant doux matin et soir, sans savon.",
      "Sérum à l'acide hyaluronique avant la crème hydratante.",
      "Protection solaire SPF 50 tous les jours, même en hiver.",
    ],
    services: [
      { name: "Soin hydratant profond", salon: "Maison Elyssa", slug: "maison-elyssa-carthage", service: "hydratant", price: 60 },
      { name: "Hydrafacial", salon: "Maison Elyssa", slug: "maison-elyssa-carthage", service: "hydratant", price: 140 },
      { name: "Hammam + gommage", salon: "Jasmin Spa", slug: "jasmin-spa-hammamet", service: "hydratant", price: 60 },
    ],
  },
};

/** Analyse beauté par photo (IA Personne 5) — réponse structurée JSON côté API. */
export function BeautyAnalysis() {
  const { t, tc, f, nf, money } = useI18n();
  const a = t.analysis;
  const [mode, setMode] = useState<Mode>("cheveux");
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const loadFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(a.badFormat, { description: a.badFormatDesc });
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPhoto(objectUrl.current);
    setPhase("idle");
  };

  const analyze = () => {
    setPhase("analyzing");
    setStepIdx(0);
    a.steps.forEach((_, i) => window.setTimeout(() => setStepIdx(i), i * 900));
    window.setTimeout(() => setPhase("result"), a.steps.length * 900 + 300);
  };

  const removePhoto = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPhoto(null);
    setPhase("idle");
    toast.success(a.removed, { description: a.removedDesc });
  };

  const r = RESULT[mode];

  // Révélation des résultats en cascade
  const resultRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = resultRef.current;
      if (phase !== "result" || !el || !window.matchMedia(MOTION_OK).matches) return;
      gsap.from(el.children, { autoAlpha: 0, y: 28, duration: 0.7, stagger: 0.14, ease: "power3.out" });
      gsap.from(el.querySelectorAll("li"), { autoAlpha: 0, y: 8, duration: 0.45, stagger: 0.05, delay: 0.3 });
    },
    { dependencies: [phase], scope: resultRef }
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Colonne gauche : photo */}
      <div className="min-w-0 space-y-5">
        <div className="inline-flex rounded-full bg-muted p-1" role="tablist" aria-label={a.modeAria}>
          {(["cheveux", "visage"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setPhase("idle");
              }}
              className={cn(
                "h-10 rounded-full px-5 text-sm font-medium transition-colors",
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {a.modes[m]}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            loadFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "relative aspect-[4/5] max-h-[70vh] w-full overflow-hidden rounded-3xl border-2 border-dashed transition-colors sm:max-h-none",
            photo ? "border-transparent bg-ink" : dragging ? "border-plum-400 bg-plum-50" : "border-plum-200 bg-card"
          )}
        >
          {photo ? (
            <>
              <Image src={photo} alt={a.photoAlt} fill unoptimized sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" />
              {phase === "analyzing" && (
                <div className="absolute inset-0 bg-ink/30" aria-hidden>
                  <div className="absolute inset-x-0 h-24 animate-[scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-plum-300/50 to-transparent" />
                </div>
              )}
              <div className="absolute inset-8" aria-hidden>
                {[
                  "start-0 top-0 border-s-2 border-t-2 rounded-ss-2xl",
                  "end-0 top-0 border-e-2 border-t-2 rounded-se-2xl",
                  "start-0 bottom-0 border-s-2 border-b-2 rounded-es-2xl",
                  "end-0 bottom-0 border-e-2 border-b-2 rounded-ee-2xl",
                ].map((c) => (
                  <span key={c} className={cn("absolute size-10 border-white/90", c)} />
                ))}
              </div>
              <div className="absolute inset-x-4 bottom-4 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-card/95 px-4 text-sm font-medium backdrop-blur hover:bg-card"
                >
                  <RotateCcw className="size-4" aria-hidden /> {a.change}
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-card/95 px-4 text-sm font-medium text-destructive backdrop-blur hover:bg-card"
                >
                  <Trash2 className="size-4" aria-hidden /> {a.remove}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center sm:p-8">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-blush text-plum-700">
                <ImagePlus className="size-7" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{a.dropTitle[mode]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.dropHint}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
                >
                  <Camera className="size-4" aria-hidden /> {a.pick}
                </button>
                <button
                  type="button"
                  onClick={() => setPhoto(IMAGES.analysisSample)}
                  className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted"
                >
                  {a.sample}
                </button>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            aria-label={a.pickAria}
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#6b2a5c]" />
          <span>
            <span className="font-medium">{a.consentTitle}</span> <span className="text-muted-foreground">{a.consentText}</span>
          </span>
        </label>

        <button
          type="button"
          disabled={!photo || !consent || phase === "analyzing"}
          onClick={analyze}
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-plum-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "analyzing" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ScanFace className="size-5" aria-hidden />}
          {phase === "analyzing" ? a.analyzing : a.launch}
        </button>
        {!consent && photo && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden /> {a.consentNeeded}
          </p>
        )}
      </div>

      {/* Colonne droite : résultat */}
      <div aria-live="polite" className="min-w-0">
        {phase === "idle" && (
          <div className="flex h-full flex-col rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
            <p className="eyebrow">{a.howTitle}</p>
            <ol className="mt-6 space-y-6">
              {a.how.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush text-base font-bold text-plum-700">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{s.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-soft/70 p-4 lg:mt-auto">
              <span className="text-sm">{a.monthlyPoints}</span>
              <PointsBadge points={10} className="bg-white" />
            </div>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="flex h-full flex-col justify-center rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
            <ol className="space-y-5">
              {a.steps.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-3 transition-opacity", i > stepIdx && "opacity-40")}>
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", i < stepIdx ? "bg-success-soft text-success" : "bg-blush text-plum-700")}>
                    {i < stepIdx ? <Check className="size-4" aria-hidden /> : <LoaderCircle className={cn("size-4", i === stepIdx && "animate-spin")} aria-hidden />}
                  </span>
                  <span className="font-medium">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 space-y-3" aria-hidden>
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        )}

        {phase === "result" && (
          <div ref={resultRef} className="space-y-4">
            <div className="rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">{f(a.diagnosis, { mode: a.modes[mode] })}</p>
                  <h2 className="display mt-2 text-3xl text-ink">{a.overall}</h2>
                </div>
                <div className="text-end">
                  <p className="text-4xl font-semibold tracking-tight" dir="ltr">
                    {nf(r.score)}
                    <span className="text-lg text-muted-foreground">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{a.healthIndex}</p>
                </div>
              </div>
              <p className="mt-4 leading-relaxed">{tc(r.summary)}</p>

              <h3 className="mt-6 text-sm font-semibold">{a.issuesTitle}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.issues.map((i) => (
                  <li key={i.label} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                    <CircleAlert className={cn("size-4 shrink-0", i.level === "moderate" ? "text-warning" : "text-muted-foreground")} aria-hidden />
                    {tc(i.label)}
                    <span className="text-xs text-muted-foreground">· {a.levels[i.level]}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 text-sm font-semibold">{a.tipsTitle}</h3>
              <ol className="mt-2 space-y-2">
                {r.tips.map((tip, i) => (
                  <li key={tip} className="flex gap-3 text-sm leading-relaxed">
                    <span className="font-bold text-plum-600">{i + 1}.</span>
                    {tc(tip)}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-3xl bg-blush p-6 ring-1 ring-plum-200 sm:p-8">
              <h3 className="flex items-center gap-2 font-semibold text-plum-800">
                <Sparkles className="size-4 shrink-0" aria-hidden /> {a.recommended}
              </h3>
              <ul className="mt-4 space-y-2">
                {r.services.map((s) => (
                  <li key={s.name + s.salon}>
                    <Link
                      href={`/salons/${s.slug}/reserver?service=${s.service}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 transition-shadow hover:shadow-soft"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{tc(s.name)}</span>
                        <span className="text-sm text-muted-foreground">{s.salon}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">{money(s.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {a.disclaimer}
              </p>
              <PointsBadge points={10} label={a.credited} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
