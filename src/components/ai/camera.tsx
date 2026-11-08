"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, SwitchCamera, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Facing = "user" | "environment";
type CameraTexts = { live: string; take: string; cancel: string; switch: string; denied: string; missing: string; error: string };

/**
 * Caméra dans la page (getUserMedia) pour les IA photo : aperçu en direct, puis la photo prise suit le même chemin
 * qu'un fichier choisi. Sans connexion sécurisée (https ou localhost) ni caméra, `onFallback` ouvre l'appareil photo du téléphone.
 */
export function useCamera({ texts, onPhoto, onFallback }: { texts: CameraTexts; onPhoto: (file: File) => void; onFallback: (face: Facing) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"off" | "starting" | "on">("off");
  const [facing, setFacing] = useState<Facing>("user");
  const [cameras, setCameras] = useState(0);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  // Flux de la caméra branché sur l'aperçu dès que la vidéo est affichée
  useEffect(() => {
    const video = videoRef.current;
    if (state !== "off" && video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => {});
    }
  }, [state]);

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState("off");
  };

  async function open(face: Facing) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onFallback(face);
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setFacing(face);
    setState("starting");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      setState("on");
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput").length);
    } catch (error) {
      stop();
      const name = (error as DOMException).name;
      toast.error(name === "NotAllowedError" || name === "SecurityError" ? texts.denied : name === "NotFoundError" || name === "OverconstrainedError" ? texts.missing : texts.error);
    }
  }

  async function take() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Caméra frontale : même image que l'aperçu (effet miroir, comme un selfie)
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    stop();
    if (blob) onPhoto(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  }

  /** Référence de la vidéo d'aperçu (fonction plutôt qu'objet : l'état de la caméra reste lisible pendant le rendu) */
  const attachVideo = (video: HTMLVideoElement | null) => {
    videoRef.current = video;
  };

  return { attachVideo, state, facing, cameras, open, stop, take, texts };
}

/** Aperçu en direct, à placer dans un cadre `relative` : annuler, déclencher, changer de caméra */
export function CameraView({ attachVideo, state, facing, cameras, open, stop, take, texts }: ReturnType<typeof useCamera>) {
  return (
    <>
      <video ref={attachVideo} playsInline muted autoPlay aria-label={texts.live} className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")} />
      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <LoaderCircle className="size-7 animate-spin" aria-hidden />
        </div>
      )}
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2">
        <button type="button" onClick={stop} className="inline-flex h-10 items-center gap-2 rounded-full bg-card/95 px-4 text-sm font-medium backdrop-blur hover:bg-card">
          <X className="size-4" aria-hidden /> {texts.cancel}
        </button>
        <button
          type="button"
          onClick={() => void take()}
          disabled={state !== "on"}
          aria-label={texts.take}
          className="size-16 rounded-full border-4 border-white bg-white/30 shadow-lg backdrop-blur transition-transform active:scale-95 disabled:opacity-50"
        />
        {cameras > 1 ? (
          <button
            type="button"
            onClick={() => void open(facing === "user" ? "environment" : "user")}
            aria-label={texts.switch}
            className="inline-flex size-10 items-center justify-center rounded-full bg-card/95 backdrop-blur hover:bg-card"
          >
            <SwitchCamera className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="size-10" aria-hidden />
        )}
      </div>
    </>
  );
}
