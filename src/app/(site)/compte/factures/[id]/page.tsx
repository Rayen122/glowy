import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceSheet } from "@/components/manage/invoice-sheet";
import { PrintButton } from "@/components/manage/kit";
import { AppError } from "@/core/domain/errors";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { invoiceDetail } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.cashier.invoice };
}

/** SAL-09 : facture côté cliente (CLI-02), imprimable ou enregistrable en PDF */
export default async function ClientInvoicePage({ params }: PageProps<"/compte/factures/[id]">) {
  const { id } = await params;
  const user = await requirePageUser("CLIENT");
  const invoice = await invoiceDetail(user, id).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const { t } = await getI18n();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/compte" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t.manage.common.back}
        </Link>
        <PrintButton label={t.manage.common.print} />
      </div>
      <InvoiceSheet invoice={invoice} />
    </div>
  );
}
