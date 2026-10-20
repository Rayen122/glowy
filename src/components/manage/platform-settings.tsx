"use client";

import { useState } from "react";
import { Megaphone, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import { LOCALE_META, LOCALES, type Locale } from "@/i18n/config";
import type { PlatformSettingsView } from "@/modules/platform";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA, useAction } from "./kit";

type Section = keyof PlatformSettingsView;

/** Carte d'une section avec son propre bouton « Enregistrer » */
function SettingsCard({ title, hint, section, value, dirty, children }: { title: string; hint: string; section: Section; value: unknown; dirty: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const m = t.manage.platform;
  const { run, pending, error } = useAction();
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
      <FormError message={error} />
      <button type="button" disabled={!dirty || pending} onClick={() => run(() => api("/api/admin/settings", { method: "PATCH", body: { [section]: value } }), m.saved)} className={cn(SECONDARY_BUTTON, "h-10")}>
        {m.save}
      </button>
    </section>
  );
}

/** ADM-05 / ADM-06 : catalogue global, langues et commissions */
export function PlatformSettingsForm({ settings }: { settings: PlatformSettingsView }) {
  const { t, tc } = useI18n();
  const m = t.manage.platform;
  const [cities, setCities] = useState(settings.cities);
  const [newCity, setNewCity] = useState("");
  const [categories, setCategories] = useState(settings.categories);
  const [groups, setGroups] = useState(settings.serviceGroups);
  const [newGroup, setNewGroup] = useState("");
  const [locales, setLocales] = useState<Locale[]>(settings.locales);
  const [rates, setRates] = useState(settings.commissions);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const categoryLabel: Record<string, string> = t.categories;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard title={m.cities} hint={m.citiesHint} section="cities" value={cities} dirty={!same(cities, settings.cities)}>
        <ul className="divide-y divide-border rounded-2xl ring-1 ring-border">
          {cities.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3 px-3 py-2">
              <span className={cn("min-w-0 flex-1 text-sm font-medium", !c.active && "text-muted-foreground line-through")}>{tc(c.name)}</span>
              <Switch checked={c.active} aria-label={`${t.manage.common.active} — ${c.name}`} onCheckedChange={(active) => setCities((all) => all.map((x, j) => (j === i ? { ...x, active } : x)))} />
              <button type="button" aria-label={`${m.remove} — ${c.name}`} onClick={() => setCities((all) => all.filter((_, j) => j !== i))} className={ICON_BUTTON}>
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newCity.trim();
            if (name.length >= 2 && !cities.some((c) => c.name.toLowerCase() === name.toLowerCase())) setCities((all) => [...all, { name, active: true }]);
            setNewCity("");
          }}
          className="flex gap-2"
        >
          <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder={m.cityPlaceholder} aria-label={m.addCity} maxLength={40} className={cn(FIELD, "h-10")} />
          <button type="submit" className={cn(SECONDARY_BUTTON, "h-10 shrink-0")}>
            <Plus className="size-4" aria-hidden /> {m.addCity}
          </button>
        </form>
      </SettingsCard>

      <div className="space-y-4">
        <SettingsCard title={m.categories} hint={m.categoriesHint} section="categories" value={categories} dirty={!same(categories, settings.categories)}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm font-medium">
                {categoryLabel[c.id] ?? c.id}
                <Switch checked={c.active} aria-label={`${t.manage.common.active} — ${categoryLabel[c.id] ?? c.id}`} onCheckedChange={(active) => setCategories((all) => all.map((x, j) => (j === i ? { ...x, active } : x)))} />
              </li>
            ))}
          </ul>
        </SettingsCard>

        <SettingsCard title={m.languages} hint={m.languagesHint} section="locales" value={locales} dirty={!same([...locales].sort(), [...settings.locales].sort())}>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((l) => {
              const on = locales.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  disabled={l === "fr"}
                  onClick={() => setLocales((all) => (on ? all.filter((x) => x !== l) : [...all, l]))}
                  lang={l}
                  className={cn("h-10 rounded-full px-4 text-sm font-semibold ring-1 disabled:cursor-not-allowed", on ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
                >
                  {LOCALE_META[l].label}
                </button>
              );
            })}
          </div>
        </SettingsCard>
      </div>

      <SettingsCard title={m.serviceGroups} hint={m.serviceGroupsHint} section="serviceGroups" value={groups} dirty={!same(groups, settings.serviceGroups)}>
        <ul className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 ps-3 pe-1 text-sm font-medium">
              {tc(g)}
              <button type="button" aria-label={`${m.remove} — ${g}`} onClick={() => setGroups((all) => all.filter((x) => x !== g))} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-card">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const g = newGroup.trim();
            if (g.length >= 2 && !groups.some((x) => x.toLowerCase() === g.toLowerCase())) setGroups((all) => [...all, g]);
            setNewGroup("");
          }}
          className="flex gap-2"
        >
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder={m.groupPlaceholder} aria-label={m.serviceGroups} maxLength={40} className={cn(FIELD, "h-10")} />
          <button type="submit" className={cn(SECONDARY_BUTTON, "h-10 shrink-0")}>
            <Plus className="size-4" aria-hidden /> {m.addGroup}
          </button>
        </form>
      </SettingsCard>

      <SettingsCard title={m.commissions} hint={m.commissionsHint} section="commissions" value={rates} dirty={!same(rates, settings.commissions)}>
        <div className="grid grid-cols-3 gap-3">
          {(["gratuit", "pro", "premium"] as const).map((plan) => (
            <Field key={plan} label={t.manage.platform.rate.replace("{plan}", t.admin.plans[plan])}>
              <input type="number" inputMode="decimal" min={0} max={30} step={0.5} value={rates[plan]} onChange={(e) => setRates((r) => ({ ...r, [plan]: Number(e.target.value) }))} className={FIELD} />
            </Field>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

/** ADM-10 : annonce à tous, aux clientes ou aux salons (notification dans l'application) */
export function AnnouncementForm() {
  const { t, f } = useI18n();
  const m = t.manage.platform;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"ALL" | "CLIENTS" | "SALONS">("ALL");
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const done = await run(() => api<{ recipients: number }>("/api/admin/announcements", { method: "POST", body: { title, body, audience, link: link.trim() || null } }));
        if (done) {
          toast.success(f(m.sent, { n: done.recipients }));
          setTitle("");
          setBody("");
          setLink("");
        }
      }}
      className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Megaphone className="size-4 text-plum-600" aria-hidden /> {m.announcements}
      </h2>
      <div role="radiogroup" aria-label={m.audience} className="flex flex-wrap gap-2">
        {(["ALL", "CLIENTS", "SALONS"] as const).map((a) => (
          <button key={a} type="button" role="radio" aria-checked={audience === a} onClick={() => setAudience(a)} className={cn("h-9 rounded-full px-3.5 text-sm font-semibold ring-1", audience === a ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}>
            {m.audiences[a]}
          </button>
        ))}
      </div>
      <Field label={m.announceTitle}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className={FIELD} />
      </Field>
      <Field label={m.announceBody}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} required rows={3} className={TEXTAREA} />
      </Field>
      <Field label={m.announceLink}>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/salons" dir="ltr" maxLength={200} className={FIELD} />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={pending || title.trim().length < 3 || body.trim().length < 10} className={PRIMARY_BUTTON}>
        {m.send}
      </button>
    </form>
  );
}
