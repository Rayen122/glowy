"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/i18n/client";
import type { Salon } from "@/lib/data";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Carte des salons (RES-06) — Leaflet + OpenStreetMap, tuiles adoucies en CSS. */
export default function SalonMap({
  salons,
  activeSlug,
  onHover,
  onSelect,
}: {
  salons: Salon[];
  activeSlug: string | null;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string) => void;
}) {
  const { money } = useI18n();
  const priceLabel = (n: number) => money(n);
  const points = useMemo(() => salons.map((s) => [s.lat, s.lng] as [number, number]), [salons]);

  return (
    <MapContainer
      center={[36.84, 10.25]}
      zoom={11}
      scrollWheelZoom
      zoomControl={false}
      className="size-full"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        className="bh-tiles"
      />
      <ZoomControl position="topright" />
      <FitBounds points={points} />
      {salons.map((s) => {
        const active = s.slug === activeSlug;
        return (
          <Marker
            key={s.slug}
            position={[s.lat, s.lng]}
            title={s.name}
            alt={s.name}
            keyboard
            zIndexOffset={active ? 1000 : 0}
            icon={L.divIcon({
              className: `bh-pin${active ? " is-active" : ""}`,
              html: `<span>${priceLabel(s.priceFrom)}</span>`,
              iconSize: [0, 0],
            })}
            eventHandlers={{
              mouseover: () => onHover(s.slug),
              mouseout: () => onHover(null),
              click: () => onSelect(s.slug),
            }}
          />
        );
      })}
    </MapContainer>
  );
}
