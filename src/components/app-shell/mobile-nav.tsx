"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";

export function MobileNav({ children, label }: { children: React.ReactNode; label: string }) {
  const { dir } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted lg:hidden" aria-label={label}>
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[86vw] max-w-[300px] bg-sidebar p-4" showCloseButton={false}>
        <SheetTitle className="sr-only">{label}</SheetTitle>
        {/* Ferme le tiroir dès qu'un lien est suivi */}
        <div className="h-full" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
