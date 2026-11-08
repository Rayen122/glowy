"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";
import { Camera, CircleAlert, Download, ImagePlus, LoaderCircle, MoveHorizontal, Palette, RotateCcw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CameraView, useCamera, type Facing } from "@/components/ai/camera";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { IMAGES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { REFERENCE_MAX } from "@/modules/beauty/domain/pro-render";
import { applyShade, blendRender, HAIR_SHADES, headCrop, hexToLab, mergeCropMask, prepareHair, renderAlpha, renderZone, type FaceBox, type RenderZone, type HairPrep, type ShadeFamily, type ShadeId } from "@/modules/beauty/domain/try-on";

/** Côté le plus long de la photo traitée : assez net pour les mèches, assez léger pour un téléphone */
const WORK_SIZE = 1024;
const FAMILIES: ShadeFamily[] = ["natural", "warm", "fashion"];
/** Recherche des salons qui proposent une coloration (noms des prestations en français dans le catalogue) */
const BOOK_QUERY = "Coloration";

/**
 * Modèles MediaPipe (Apache 2.0), chargés une seule fois et exécutés dans le navigateur : segmentation des cheveux
 * et détecteur de visage (situe la tête : le décor et le visage ne sont jamais recolorés). Moteur WebAssembly servi
 * par le site (public/mediapipe, copié par scripts/copy-mediapipe.mjs), modèles dans public/models.
 * Carte graphique si possible, sinon processeur ; sans détecteur de visage, l'essai fonctionne quand même.
 */
let segmenter: Promise<{ model: ImageSegmenter; hair: number; faces: FaceDetector | null }> | null = null;
function loadSegmenter() {
  segmenter ??= (async () => {
    const { FaceDetector, FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/mediapipe");
    const create = (delegate: "GPU" | "CPU") =>
      ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/models/hair_segmenter.tflite", delegate },
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    const createFaces = (delegate: "GPU" | "CPU") =>
      FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    const [model, faces] = await Promise.all([
      create("GPU").catch(() => create("CPU")),
      createFaces("GPU")
        .catch(() => createFaces("CPU"))
        .catch(() => null),
    ]);
    const hair = model.getLabels().findIndex((label) => /hair/i.test(label));
    return { model, hair: hair >= 0 ? hair : 1, faces };
  })().catch((error: unknown) => {
    segmenter = null;
    throw error;
  });
  return segmenter;
}

/** `zone` : où recoller le rendu photoréaliste (cheveux et leurs abords, hors visage) */
type Work = { width: number; height: number; original: Uint8ClampedArray; prep: HairPrep; zone: RenderZone };
/** Rendu photoréaliste d'une teinte : pixels à la taille de travail et opacité de recollage */
type Render = { pixels: Uint8ClampedArray; alpha: Float32Array };
type Phase = "idle" | "loading" | "detecting" | "ready" | "nohair" | "error";

/** Confiance « cheveux » de chaque pixel du canevas (copie : le résultat du modèle est libéré aussitôt) */
function hairMask(ai: { model: ImageSegmenter; hair: number }, canvas: HTMLCanvasElement) {
  const result = ai.model.segment(canvas);
  const mask = result.confidenceMasks?.[ai.hair]?.getAsFloat32Array().slice();
  result.close();
  return mask;
}

/** Plus grand visage de la photo, en pixels du canevas de travail (yeux : deux premiers points clés) */
function largestFace(faces: FaceDetector | null, canvas: HTMLCanvasElement): FaceBox | null {
  if (!faces) return null;
  try {
    const best = faces
      .detect(canvas)
      .detections.filter((d) => d.boundingBox)
      .sort((a, b) => b.boundingBox!.width * b.boundingBox!.height - a.boundingBox!.width * a.boundingBox!.height)[0];
    if (!best?.boundingBox) return null;
    const { originX, originY, width, height } = best.boundingBox;
    // Points clés normalisés (0 à 1) : les deux premiers sont les yeux
    const eyes = best.keypoints.slice(0, 2).map((k) => ({ x: k.x * canvas.width, y: k.y * canvas.height }));
    return { x: originX, y: originY, width, height, eyes: eyes.length === 2 ? eyes : null };
  } catch {
    return null;
  }
}

/** Photo redessinée à WORK_SIZE px au plus (le modèle et la recoloration travaillent sur ce canevas) */
async function drawPhoto(src: string) {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const scale = Math.min(1, WORK_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(16, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

/**
 * Essai virtuel de couleur : l'IA de segmentation trouve les cheveux sur la photo, puis la teinte choisie est appliquée
 * (src/modules/beauty/domain/try-on.ts). Aperçu instantané sur l'appareil, sans envoi.
 * `proEnabled` : rendu photoréaliste à la demande (Gemini, POST /api/ai/try-on), seulement après accord de la cliente.
 */
export function HairTryOn({ proEnabled = false }: { proEnabled?: boolean }) {
  const { t, f } = useI18n();
  const c = t.tryOn;
  const p = c.pro;
  const [photo, setPhoto] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [work, setWork] = useState<Work | null>(null);
  const [shade, setShade] = useState<ShadeId>("copper");
  const [intensity, setIntensity] = useState(85);
  const [split, setSplit] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);
  // Rendu photoréaliste : pixels du rendu (taille de travail) par teinte pour la photo en cours ; envoi après accord seulement
  const [renders, setRenders] = useState<Partial<Record<ShadeId, Render>>>({});
  const [viewPro, setViewPro] = useState(true);
  const [proBusy, setProBusy] = useState<ShadeId | null>(null);
  const [consent, setConsent] = useState<"no" | "asking" | "yes">("no");
  const proImage = viewPro ? renders[shade] : undefined;
  // Après l'accord, chaque teinte choisie est rendue automatiquement ; la teinte demandée pendant un rendu est
  // traitée juste après (les teintes cliquées entre-temps sont sautées). Une teinte en échec n'est pas relancée seule.
  const shadeRef = useRef(shade);
  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const failedRef = useRef(new Set<ShadeId>());
  const doneRef = useRef(renders);
  useEffect(() => {
    doneRef.current = renders;
  }, [renders]);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  // Photo d'origine (côté « avant ») dessinée une fois par photo
  useEffect(() => {
    const canvas = beforeRef.current;
    if (!work || !canvas) return;
    canvas.width = work.width;
    canvas.height = work.height;
    canvas.getContext("2d")?.putImageData(new ImageData(Uint8ClampedArray.from(work.original), work.width, work.height), 0, 0);
  }, [work]);

  // Teinte appliquée à chaque changement (une image par rafraîchissement d'écran au plus pendant le glissement du curseur),
  // ou rendu photoréaliste de la teinte s'il existe et qu'il est affiché
  useEffect(() => {
    const canvas = afterRef.current;
    if (!work || !canvas) return;
    const frame = requestAnimationFrame(() => {
      canvas.width = work.width;
      canvas.height = work.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const hex = HAIR_SHADES.find((s) => s.id === shade)!.hex;
      const pixels = proImage ? blendRender(proImage.alpha, work.original, proImage.pixels, intensity / 100) : applyShade(work.prep, work.original, hexToLab(hex), intensity / 100);
      ctx.putImageData(new ImageData(pixels, work.width, work.height), 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [work, shade, intensity, proImage]);

  async function process(src: string) {
    const id = ++run.current;
    setWork(null);
    setRenders({});
    setProBusy(null);
    failedRef.current.clear();
    setPhase("loading");
    try {
      const [{ canvas, data }, ai] = await Promise.all([drawPhoto(src), loadSegmenter()]);
      if (id !== run.current) return;
      setPhase("detecting");
      const full = hairMask(ai, canvas);
      if (!full || full.length !== canvas.width * canvas.height) throw new Error("mask");
      const face = largestFace(ai.faces, canvas);
      // Photo large (visage petit) : seconde segmentation sur un recadrage autour de la tête, bien plus précise
      const crop = face && headCrop(face, canvas.width, canvas.height);
      let mask = full;
      if (crop) {
        const zoom = document.createElement("canvas");
        zoom.width = crop.width;
        zoom.height = crop.height;
        zoom.getContext("2d")?.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        const cropMask = hairMask(ai, zoom);
        if (cropMask?.length === crop.width * crop.height) mask = mergeCropMask(full, canvas.width, crop, cropMask);
      }
      const prep = prepareHair(data, mask, canvas.width, canvas.height, face);
      if (id !== run.current) return;
      if (!prep.found) {
        setPhase("nohair");
        return;
      }
      const ready = { width: canvas.width, height: canvas.height, original: data, prep, zone: renderZone(prep, mask, canvas.width, canvas.height, face) };
      setWork(ready);
      setSplit(50);
      setPhase("ready");
      if (autoRef.current) void renderPro(shadeRef.current, ready);
    } catch {
      if (id === run.current) setPhase("error");
    }
  }

  /**
   * Rendu photoréaliste de la teinte choisie : photo de travail (JPEG) et sa version de moins de 512 px envoyées au serveur ;
   * l'image retouchée revient, ramenée à la taille de travail (seuls ses cheveux seront recollés sur la photo)
   */
  async function renderPro(target: ShadeId = shadeRef.current, photo: Work | null = work) {
    if (!photo || busyRef.current) return;
    const work = photo;
    const id = run.current;
    busyRef.current = true;
    setProBusy(target);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = work.width;
      canvas.height = work.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("canvas");
      ctx.putImageData(new ImageData(Uint8ClampedArray.from(work.original), work.width, work.height), 0, 0);
      const scale = Math.min(1, REFERENCE_MAX / Math.max(work.width, work.height));
      const small = document.createElement("canvas");
      small.width = Math.round(work.width * scale);
      small.height = Math.round(work.height * scale);
      small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
      const res = await api<{ image: string }>("/api/ai/try-on", {
        method: "POST",
        body: { shade: target, image: canvas.toDataURL("image/jpeg", 0.9), small: small.toDataURL("image/jpeg", 0.92), width: work.width, height: work.height },
      });
      const img = new window.Image();
      img.src = res.image;
      await img.decode();
      if (id !== run.current) return;
      ctx.drawImage(img, 0, 0, work.width, work.height);
      const pixels = ctx.getImageData(0, 0, work.width, work.height).data;
      setRenders((done) => ({ ...done, [target]: { pixels, alpha: renderAlpha(work.zone, work.original, pixels) } }));
      setViewPro(true);
    } catch (error) {
      if (id !== run.current) return;
      failedRef.current.add(target);
      const code = error instanceof ApiError ? error.code : "";
      // Service indisponible ou quota atteint : plus de rendu automatique (le bouton reste là pour réessayer)
      if (code === "TRY_ON_UNAVAILABLE" || code === "RATE_LIMITED") autoRef.current = false;
      toast.error(code === "RATE_LIMITED" ? t.errors.rateLimited : code === "TRY_ON_UNAVAILABLE" ? p.unavailable : code === "TRY_ON_BLOCKED" ? p.blocked : p.failed);
    } finally {
      busyRef.current = false;
      if (id === run.current) {
        setProBusy(null);
        // Teinte choisie pendant le rendu : à son tour
        const next = shadeRef.current;
        if (autoRef.current && next !== target && !doneRef.current[next] && !failedRef.current.has(next)) void renderPro(next, work);
      }
    }
  }

  const chooseShade = (id: ShadeId) => {
    setShade(id);
    shadeRef.current = id;
    if (autoRef.current && work && !renders[id] && !failedRef.current.has(id)) void renderPro(id);
  };

  const pickFile = (capture?: Facing) => {
    const input = inputRef.current;
    if (!input) return;
    if (capture) input.setAttribute("capture", capture);
    else input.removeAttribute("capture");
    input.click();
  };

  const loadFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t.analysis.badFormat, { description: t.analysis.badFormatDesc });
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPhoto(objectUrl.current);
    void process(objectUrl.current);
  };

  const camera = useCamera({ texts: t.analysis.camera, onPhoto: loadFile, onFallback: pickFile });

  const trySample = () => {
    setPhoto(IMAGES.analysisSample);
    void process(IMAGES.analysisSample);
  };

  const removePhoto = () => {
    run.current += 1;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPhoto(null);
    setWork(null);
    setPhase("idle");
    const sent = Object.keys(renders).length > 0;
    setRenders({});
    setProBusy(null);
    toast.success(t.analysis.removed, { description: sent ? p.removedDesc : c.removedDesc });
  };

  const download = () => {
    afterRef.current?.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `glowy-${shade}${proImage ? "-ia" : ""}.jpg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
      },
      "image/jpeg",
      0.9,
    );
  };

  const busy = phase === "loading" || phase === "detecting";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      {/* Photo : avant / après */}
      <div className="min-w-0 space-y-4">
        <div
          className={cn(
            "relative mx-auto w-full overflow-hidden rounded-3xl",
            work ? "bg-ink" : "aspect-[4/5] max-h-[70vh] sm:max-h-none",
            !work && (photo || camera.state !== "off" ? "bg-ink" : "border-2 border-dashed border-plum-200 bg-card"),
          )}
          style={work ? { aspectRatio: `${work.width} / ${work.height}`, maxWidth: `min(100%, calc(75vh * ${work.width} / ${work.height}))` } : undefined}
        >
          {work && (
            // Comparaison physique (gauche = avant, droite = après), identique quel que soit le sens de lecture
            <div dir="ltr" className="absolute inset-0">
              <canvas ref={beforeRef} aria-label={c.before} role="img" className="absolute inset-0 size-full" />
              <canvas ref={afterRef} aria-label={c.after} role="img" className="absolute inset-0 size-full" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)]" style={{ left: `${split}%` }} aria-hidden>
                <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg">
                  <MoveHorizontal className="size-5" />
                </span>
              </div>
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{c.before}</span>
              <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                {proImage && <Sparkles className="size-3.5" aria-hidden />}
                {proImage ? p.badge : c.after}
              </span>
              {proBusy && (
                <span role="status" className="pointer-events-none absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/75 px-3.5 py-2 text-xs font-medium whitespace-nowrap text-white backdrop-blur">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> {p.loading}
                </span>
              )}
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                aria-label={c.compare}
                className="absolute inset-0 size-full cursor-ew-resize opacity-0"
              />
            </div>
          )}
          {camera.state !== "off" ? (
            <div className="absolute inset-0 bg-ink">
              <CameraView {...camera} />
            </div>
          ) : work ? null : photo ? (
            <div className="absolute inset-0 isolate flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {/* La photo reste visible, assombrie, derrière l'attente ou le message d'erreur */}
              <Image src={photo} alt="" fill unoptimized sizes="(min-width:1024px) 50vw, 100vw" className="-z-10 object-contain opacity-35" />
              {busy ? (
                <>
                  <LoaderCircle className="size-8 animate-spin" aria-hidden />
                  <p className="font-semibold">{phase === "loading" ? c.loading : c.detecting}</p>
                  {phase === "loading" && <p className="max-w-xs text-sm text-white/70">{c.firstTime}</p>}
                </>
              ) : (
                <>
                  <CircleAlert className="size-8 text-gold" aria-hidden />
                  <p className="font-semibold">{phase === "nohair" ? c.noHair : c.error}</p>
                  <p className="max-w-xs text-sm text-white/70">{phase === "nohair" ? c.noHairDesc : c.errorDesc}</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center sm:p-8">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-blush text-plum-700">
                <Palette className="size-7" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{c.dropTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.dropHint}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void camera.open("user")}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
                >
                  <Camera className="size-4" aria-hidden /> {t.analysis.openCamera}
                </button>
                <button
                  type="button"
                  onClick={() => pickFile()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted"
                >
                  <ImagePlus className="size-4" aria-hidden /> {t.analysis.pick}
                </button>
                <button type="button" onClick={trySample} className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted">
                  {t.analysis.sample}
                </button>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" aria-label={t.analysis.pickAria} onChange={(e) => loadFile(e.target.files?.[0])} />
        </div>

        {photo && camera.state === "off" && (
          <div className="flex flex-wrap justify-between gap-2">
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => pickFile()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="size-4" aria-hidden /> {t.analysis.change}
              </button>
              <button
                type="button"
                onClick={() => void camera.open("user")}
                disabled={busy}
                aria-label={t.analysis.openCamera}
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted disabled:opacity-50"
              >
                <Camera className="size-4" aria-hidden />
              </button>
            </span>
            <button
              type="button"
              onClick={removePhoto}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-destructive hover:bg-muted"
            >
              <Trash2 className="size-4" aria-hidden /> {t.analysis.remove}
            </button>
          </div>
        )}
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-plum-600" aria-hidden />
          {proEnabled ? p.privacy : c.privacy}
        </p>
      </div>

      {/* Teintes, intensité, réservation */}
      <div className="min-w-0 space-y-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
        <div>
          <p className="eyebrow">{c.shadesTitle}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{c.shades[shade]}</p>
        </div>
        {FAMILIES.map((family) => (
          <fieldset key={family}>
            <legend className="text-sm font-semibold text-muted-foreground">{c.families[family]}</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {HAIR_SHADES.filter((s) => s.family === family).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseShade(s.id)}
                  aria-pressed={shade === s.id}
                  aria-label={c.shades[s.id]}
                  title={c.shades[s.id]}
                  className={cn(
                    "size-12 rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-105",
                    shade === s.id ? "ring-2 ring-plum-700" : "ring-1 ring-border",
                  )}
                  style={{ background: `radial-gradient(circle at 30% 28%, color-mix(in srgb, ${s.hex} 55%, white) 0%, ${s.hex} 55%, color-mix(in srgb, ${s.hex} 70%, black) 100%)` }}
                />
              ))}
            </div>
          </fieldset>
        ))}

        <label className="block">
          <span className="flex items-center justify-between text-sm font-semibold">
            {c.intensity} <span className="font-normal text-muted-foreground">{intensity} %</span>
          </span>
          <input
            type="range"
            min={30}
            max={100}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="mt-3 w-full accent-[#6b2a5c]"
          />
        </label>

        {proEnabled && work && (
          <section aria-labelledby="pro-title" className="rounded-2xl bg-blush/50 p-4 ring-1 ring-plum-200/60">
            <h3 id="pro-title" className="flex items-center gap-2 text-sm font-semibold text-plum-800">
              <Sparkles className="size-4" aria-hidden /> {p.title}
            </h3>
            {renders[shade] ? (
              <div role="group" aria-label={p.title} className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-card p-1 ring-1 ring-border">
                {[false, true].map((pro) => (
                  <button
                    key={String(pro)}
                    type="button"
                    aria-pressed={viewPro === pro}
                    onClick={() => setViewPro(pro)}
                    className={cn("h-9 rounded-full px-2 text-sm font-medium transition-colors", viewPro === pro ? "bg-plum-700 text-white" : "hover:bg-muted")}
                  >
                    {pro ? p.real : p.instant}
                  </button>
                ))}
              </div>
            ) : consent === "asking" ? (
              <div className="mt-2 space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{p.consent}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConsent("yes");
                      autoRef.current = true;
                      void renderPro();
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-plum-700 px-4 text-sm font-semibold text-white hover:bg-plum-800"
                  >
                    <Sparkles className="size-4" aria-hidden /> {p.send}
                  </button>
                  <button type="button" onClick={() => setConsent("no")} className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                    {p.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.hint}</p>
                <button
                  type="button"
                  disabled={proBusy !== null}
                  onClick={() => {
                    if (consent !== "yes") return setConsent("asking");
                    failedRef.current.delete(shade);
                    autoRef.current = true;
                    void renderPro();
                  }}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-plum-700 px-5 py-2 text-sm font-semibold text-white hover:bg-plum-800 disabled:opacity-60"
                >
                  {proBusy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                  {proBusy ? p.loading : f(p.create, { shade: c.shades[shade] })}
                </button>
              </>
            )}
          </section>
        )}

        <p className="rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">{c.disclaimer}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/salons?q=${BOOK_QUERY}`}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-plum-800"
          >
            {c.book}
          </Link>
          <button
            type="button"
            onClick={download}
            disabled={phase !== "ready"}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted disabled:opacity-40"
          >
            <Download className="size-4" aria-hidden /> {c.download}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{f(c.shadeNote, { shade: c.shades[shade] })}</p>
      </div>
    </div>
  );
}
