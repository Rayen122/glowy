import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { demoLoginEnabled } from "@/auth";
import { DemoRoleLink } from "@/components/auth/demo-role-link";
import {
  BadgeCheck,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  FileCheck,
  MessageSquareText,
  Percent,
  Receipt,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { SectionHeading } from "@/components/site/section-heading";
import { getI18n } from "@/i18n/server";
import { IMAGES, PLANS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { platformShowcase } from "@/modules/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pro.metaTitle, description: t.pro.metaDescription };
}

const FEATURE_ICONS = [CalendarDays, Users, UserRound, TrendingUp, ChartColumn, Receipt, Percent, MessageSquareText];
const STEP_ICONS = [UserRound, FileCheck, BadgeCheck];

export default async function ProPage() {
  const [{ t, tc, f, nf }, showcase] = await Promise.all([getI18n(), platformShowcase()]);
  const p = t.pro;

  return (
    <>
      <section className="container-page grid grid-cols-1 items-center gap-12 pt-10 pb-16 lg:grid-cols-2 lg:pt-16 lg:pb-24">
        <div>
          <p data-animate="fade-up" className="eyebrow">
            Glowy Pro
          </p>
          <h1 data-animate="split" className="display mt-4 text-[2.6rem] text-ink sm:text-6xl">
            {p.titleStart} <em className="text-plum-600">{p.titleEm}</em>
          </h1>
          <p data-animate="fade-up" className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {p.lead}
          </p>
          <div data-animate="fade-up" className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/inscription?type=salon"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
            >
              {p.ctaRegister}
            </Link>
            <DemoRoleLink role="MANAGER" href="/dashboard" demoEnabled={demoLoginEnabled} className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-semibold hover:bg-muted">
              {p.ctaDemo}
            </DemoRoleLink>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <BadgeCheck className="size-4 shrink-0 text-plum-600" aria-hidden /> {f(p.trust, { n: nf(showcase.salons) })}
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div data-animate="clip" className="arch relative aspect-[4/5] overflow-hidden bg-muted lg:ms-auto lg:w-[85%]">
            <Image src={IMAGES.proDashboard} alt={p.imageAlt} fill priority sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
          </div>
          <div data-animate="pop" className="absolute start-0 bottom-6 w-56 rounded-2xl bg-card p-4 shadow-lift ring-1 ring-border sm:bottom-10 sm:w-64">
            <p className="text-xs text-muted-foreground">{p.fillRate}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight" data-animate="count" dir="ltr">
              78 %
            </p>
            <p className="mt-1 text-xs font-medium text-success">▲ {p.fillDelta}</p>
          </div>
          <div data-animate="pop" className="absolute end-0 top-6 max-w-[200px] rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift sm:top-10 lg:end-6">
            <p className="font-semibold">{p.noShows}</p>
            <p className="text-xs text-white/70">{p.noShowsHint}</p>
          </div>
        </div>
      </section>

      <section className="bg-sand/70 py-16 lg:py-24" aria-labelledby="features-title">
        <div className="container-page">
          <SectionHeading eyebrow={p.featuresEyebrow} title={<span id="features-title">{p.featuresTitle}</span>} />
          <ul data-animate="stagger" data-stagger="0.07" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <li key={feature.title} className="rounded-3xl bg-card p-6 ring-1 ring-border">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-blush text-plum-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="tarifs" className="container-page scroll-mt-24 py-16 lg:py-24" aria-labelledby="tarifs-title">
        <SectionHeading align="center" eyebrow={p.pricingEyebrow} title={<span id="tarifs-title">{p.pricingTitle}</span>} description={p.pricingDescription} />
        <div data-animate="stagger" data-stagger="0.12" className="mx-auto mt-12 grid grid-cols-1 max-w-5xl gap-6 md:grid-cols-3 md:gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn("relative flex flex-col rounded-3xl p-6 sm:p-7", plan.highlighted ? "bg-ink text-white shadow-lift" : "bg-card ring-1 ring-border")}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 start-6 rounded-full bg-plum-300 px-3 py-1 text-xs font-bold text-plum-900 sm:start-7">{p.mostChosen}</span>
              )}
              <h3 className="text-lg font-semibold">{tc(plan.name)}</h3>
              <p className={cn("text-sm", plan.highlighted ? "text-white/70" : "text-muted-foreground")}>{tc(plan.audience)}</p>
              <p className="mt-6">
                <span className="text-5xl font-semibold tracking-tight">{nf(plan.price)}</span>
                <span className={cn("ms-1 text-sm", plan.highlighted ? "text-white/70" : "text-muted-foreground")}>{p.perMonth}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <Check className={cn("mt-0.5 size-4 shrink-0", plan.highlighted ? "text-plum-200" : "text-plum-600")} aria-hidden />
                    {tc(feature)}
                  </li>
                ))}
              </ul>
              <Link
                href={`/inscription?type=salon&offre=${plan.id}`}
                className={cn(
                  "mt-8 inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  plan.highlighted ? "bg-white text-ink hover:bg-plum-100" : "border border-border hover:bg-muted"
                )}
              >
                {plan.price === 0 ? p.startFree : f(p.choosePlan, { name: tc(plan.name) })}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-16 lg:pb-24" aria-labelledby="etapes-title">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow={p.stepsEyebrow} title={<span id="etapes-title">{p.stepsTitle}</span>} />
            <ol data-animate="stagger" data-stagger="0.12" className="mt-8 space-y-5">
              {p.steps.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush text-plum-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{step.title}</span>
                      <span className="text-sm text-muted-foreground">{step.text}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div id="faq" className="scroll-mt-24">
            <h2 className="text-lg font-semibold">{p.faqTitle}</h2>
            <div data-animate="fade-up" className="mt-4 divide-y divide-border rounded-3xl border border-border bg-card">
              {p.faq.map((item) => (
                <details key={item.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-6 cursor-pointer items-center justify-between gap-4 font-medium">
                    {item.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
