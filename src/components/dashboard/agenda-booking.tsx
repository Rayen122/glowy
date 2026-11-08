"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Clock, NotebookPen, Phone, Scissors, User, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { BookingStatusActions, type BookingAction } from "./booking-status";

export type AgendaBookingDetails = {
  id: string;
  time: string;
  end: string;
  dateLabel: string;
  clientId: string;
  clientFullName: string;
  clientPhone: string | null;
  service: string;
  employeeName: string;
  statusLabel: string;
  price: number;
  deposit: number;
  note: string | null;
  actions: readonly BookingAction[];
};

/**
 * Rendez-vous de l'agenda : le bloc s'ouvre au clic sur sa fiche (cliente, prestations, horaire, professionnel,
 * statut, prix, note) avec les actions possibles maintenant (confirmer, refuser, annuler, commencer, terminer, absente).
 */
export function AgendaBooking({ booking, className, style, ariaLabel, children }: { booking: AgendaBookingDetails; className: string; style: CSSProperties; ariaLabel: string; children: ReactNode }) {
  const { t, money } = useI18n();
  const d = t.dashboard.agenda.details;
  const [open, setOpen] = useState(false);

  const row = (icon: ReactNode, label: string, value: ReactNode) => (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-plum-600">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words">{value}</dd>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={ariaLabel} aria-haspopup="dialog" className={className} style={style}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{booking.clientFullName}</DialogTitle>
            <DialogDescription>
              {booking.dateLabel} ·{" "}
              <span dir="ltr">
                {booking.time} – {booking.end}
              </span>{" "}
              · {booking.statusLabel}
            </DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-border">
            {row(<Scissors className="size-4" aria-hidden />, d.services, booking.service)}
            {row(<User className="size-4" aria-hidden />, d.professional, booking.employeeName)}
            {row(<Clock className="size-4" aria-hidden />, d.time, <span dir="ltr">{booking.time} – {booking.end}</span>)}
            {row(<Wallet className="size-4" aria-hidden />, d.price, booking.deposit > 0 ? `${money(booking.price)} · ${d.deposit} ${money(booking.deposit)}` : money(booking.price))}
            {booking.clientPhone &&
              row(
                <Phone className="size-4" aria-hidden />,
                d.phone,
                <a href={`tel:${booking.clientPhone.replace(/\s/g, "")}`} className="text-plum-700 hover:underline" dir="ltr">
                  {booking.clientPhone}
                </a>
              )}
            {row(<NotebookPen className="size-4" aria-hidden />, d.note, booking.note ?? <span className="font-normal text-muted-foreground">{d.noNote}</span>)}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Link href={`/dashboard/clients/${booking.clientId}`} className="text-sm font-semibold text-plum-700 hover:underline">
              {d.clientFile}
            </Link>
            {booking.actions.length > 0 ? (
              <BookingStatusActions bookingId={booking.id} actions={booking.actions} labelled />
            ) : (
              <span className="text-xs text-muted-foreground">{d.noAction}</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
