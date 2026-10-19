/**
 * Données de démonstration (cahier §12.1 : comptes client, gérant, Super Admin).
 * Lancement : `npm run db:seed` — vide puis remplit la base MongoDB à partir de src/lib/data.ts.
 * Les dates sont recalculées autour d'aujourd'hui : la démo reste crédible quel que soit le jour.
 *
 * Comptes créés (mot de passe commun : SEED_DEMO_PASSWORD dans .env) :
 *   sarra@beautyhub.tn   cliente     (niveau Or, réservations, favoris)
 *   yasmine@beautyhub.tn gérante     (Salon Yasmine, La Marsa)
 *   nour@beautyhub.tn    employée    (Salon Yasmine)
 *   admin@beautyhub.tn   Super Admin
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import type { BookingStatus, Category, PlanId, PointReason } from "../src/core/domain/enums";
import { PLAN_PRICES } from "../src/core/domain/enums";
import { slugify } from "../src/core/domain/text";
import { addDays, toMinutes, tunisToday, tunisToUtc } from "../src/core/domain/time";
import {
  AuditLog,
  Booking,
  disconnectDb,
  Employee,
  Notification,
  PlanPayment,
  PointRule,
  PointTransaction,
  resetAll,
  Review,
  ReviewReport,
  Reward,
  Salon,
  TimeOff,
  User,
} from "../src/infrastructure/db";
import {
  ADMIN_AUDIT,
  AMENITIES,
  CLIENT,
  CLIENT_BOOKINGS,
  EMPLOYEES,
  FAVORITES,
  FLAGGED_REVIEWS,
  OPENING_HOURS,
  PENDING_SALONS,
  POINT_HISTORY,
  REVIEWS,
  REWARDS,
  SALON_BLOCKS,
  SALON_TODAY,
  SALONS,
  SERVICE_GROUPS,
  img,
} from "../src/lib/data";
import { DEFAULT_RULES } from "../src/modules/loyalty";
import { ACTIVE_STATUSES } from "../src/modules/booking";
import { acquireSlices } from "../src/modules/booking/infrastructure/slot-locks";

const PASSWORD = process.env.SEED_DEMO_PASSWORD;
if (!PASSWORD) throw new Error("SEED_DEMO_PASSWORD manquant dans .env");

/** La démo d'origine est datée du lundi 28/09/2026 : on décale tout pour que « aujourd'hui » = le jour du seed */
const DEMO_TODAY = "2026-09-28";
const TODAY = tunisToday();
const shift = (isoDate: string) => addDays(TODAY, Math.round((Date.parse(isoDate) - Date.parse(DEMO_TODAY)) / 86_400_000));

const STATUS: Record<string, BookingStatus> = {
  termine: "COMPLETED",
  en_cours: "IN_PROGRESS",
  confirme: "CONFIRMED",
  absent: "NO_SHOW",
  annule: "CANCELLED",
  en_attente: "PENDING",
};

const CATEGORY_LABEL: Record<Category, string> = {
  coiffure: "Coiffure",
  barbier: "Barbier",
  ongles: "Ongles",
  spa: "Spa",
  maquillage: "Maquillage",
  visage: "Soins du visage",
};

/** Équipe des autres salons (celle du Salon Yasmine vient de EMPLOYEES) */
const OTHER_TEAMS: Record<string, { key: string; name: string; title: string; rating: number }[]> = {
  "maison-elyssa-carthage": [
    { key: "dorra", name: "Dorra", title: "Esthéticienne", rating: 4.8 },
    { key: "salma", name: "Salma", title: "Esthéticienne", rating: 4.7 },
  ],
  "nail-studio-menzah": [
    { key: "rym", name: "Rym", title: "Prothésiste ongulaire", rating: 4.8 },
    { key: "lina", name: "Lina", title: "Prothésiste ongulaire", rating: 4.6 },
  ],
  "jasmin-spa-hammamet": [
    { key: "afef", name: "Afef", title: "Praticienne spa", rating: 4.7 },
    { key: "hana", name: "Hana", title: "Masseuse", rating: 4.8 },
  ],
  "atelier-beaute-sousse": [
    { key: "olfa", name: "Olfa", title: "Maquilleuse", rating: 4.7 },
    { key: "meriem", name: "Meriem", title: "Coiffeuse", rating: 4.6 },
  ],
};
const DEFAULT_TEAM = [
  { key: "karim", name: "Karim", title: "Coiffeur", rating: 4.6 },
  { key: "aziz", name: "Aziz", title: "Barbier", rating: 4.7 },
];

/** Textes d'avis vérifiés génériques pour les salons sans avis de démo */
const REVIEW_POOL = [
  { rating: 5, text: "Accueil chaleureux et résultat impeccable. Je reviendrai sans hésiter." },
  { rating: 5, text: "Très professionnel, à l'heure et de bon conseil. Le salon est très propre." },
  { rating: 4, text: "Bonne prestation, un peu d'attente à l'arrivée mais le résultat est là." },
  { rating: 5, text: "Exactement ce que je voulais. Merci à toute l'équipe pour sa gentillesse." },
  { rating: 4, text: "Prix correct pour la qualité. Réservation en ligne très pratique." },
];

type ServiceRow = { key: string; name: string; price: number; durationMin: number };

let clientCounter = 0;

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD!, 12);

  // ── Remise à zéro : on supprime les collections puis on recrée les index ──
  await resetAll();

  // ── Barème de fidélité et récompenses ──
  await PointRule.insertMany(
    (Object.entries(DEFAULT_RULES) as [PointReason, { points: number; monthlyCap?: number }][])
      .filter(([, rule]) => rule.points !== 0)
      .map(([reason, rule]) => ({ reason, points: rule.points, monthlyCap: rule.monthlyCap ?? null }))
  );
  await Reward.insertMany(REWARDS.map((r) => ({ label: r.label, cost: r.cost })));

  // ── Comptes de démonstration ──
  const user = async (data: { email: string; firstName: string; lastName: string; role?: "CLIENT" | "EMPLOYEE" | "MANAGER" | "ADMIN"; phone?: string; city?: string; avatarUrl?: string; referralCode?: string }) =>
    User.create({
      ...data,
      passwordHash,
      emailVerified: new Date(),
      referralCode: data.referralCode ?? `${slugify(data.firstName).toUpperCase().replace(/-/g, "").slice(0, 8) || "BH"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    });

  const admin = await user({ email: "admin@beautyhub.tn", firstName: "Amine", lastName: "Ben Salah", role: "ADMIN" });
  const moderator = await user({ email: "sarra.moderation@beautyhub.tn", firstName: "Sarra", lastName: "Gharbi", role: "ADMIN" });
  const sarra = await user({
    email: "sarra@beautyhub.tn",
    firstName: CLIENT.firstName,
    lastName: CLIENT.lastName,
    phone: "+216 22 345 482",
    city: CLIENT.city,
    avatarUrl: CLIENT.avatar,
    referralCode: CLIENT.referralCode,
  });
  const yasmine = await user({ email: "yasmine@beautyhub.tn", firstName: "Yasmine", lastName: "Trabelsi", role: "MANAGER", phone: "+216 71 000 111" });

  const clients = new Map<string, Types.ObjectId>(); // « Rania H. » → id
  async function clientFor(label: string) {
    const existing = clients.get(label);
    if (existing) return existing;
    const [firstName, last = "X."] = label.split(" ");
    clientCounter += 1;
    const created = await user({ email: `client${clientCounter}@exemple.tn`, firstName, lastName: last.replace(".", "") });
    clients.set(label, created._id);
    return created._id;
  }

  // ── Salons actifs ──
  const salonIds = new Map<string, Types.ObjectId>();
  const employeeIds = new Map<string, Types.ObjectId>(); // `${slug}:${key}` → id
  const serviceRows = new Map<string, ServiceRow>(); // `${slug}:${name}`

  for (const [index, s] of SALONS.entries()) {
    const owner =
      s.slug === "salon-yasmine-la-marsa"
        ? yasmine
        : await user({ email: `gerant.${s.slug}@beautyhub.tn`, firstName: s.name, lastName: "", role: "MANAGER" });

    // Services : catalogue complet pour le Salon Yasmine, prestations phares pour les autres
    const services =
      s.slug === "salon-yasmine-la-marsa"
        ? SERVICE_GROUPS.flatMap((g, gi) => g.services.map((sv, si) => ({ key: sv.id, name: sv.name, description: sv.description ?? null, group: g.label, durationMin: sv.duration, price: sv.price, oldPrice: sv.oldPrice ?? null, popular: sv.popular ?? false, position: gi * 100 + si })))
        : s.topServices.map((sv, si) => ({ key: slugify(sv.name), name: sv.name, description: null, group: CATEGORY_LABEL[s.category], durationMin: sv.duration, price: sv.price, oldPrice: null, popular: si === 0, position: si }));
    // Prestations citées dans l'historique de démo mais absentes du catalogue
    const extra = [...CLIENT_BOOKINGS.filter((b) => b.salonSlug === s.slug).map((b) => ({ name: b.service, price: b.price })), ...(s.slug === "salon-yasmine-la-marsa" ? SALON_TODAY.map((b) => ({ name: b.service, price: b.price })) : [])];
    const uniqueKey = (name: string) => {
      let key = slugify(name);
      while (services.some((sv) => sv.key === key)) key += "-2";
      return key;
    };
    for (const e of extra) {
      if (!services.some((sv) => sv.name === e.name)) {
        services.push({ key: uniqueKey(e.name), name: e.name, description: null, group: CATEGORY_LABEL[s.category], durationMin: 45, price: e.price, oldPrice: null, popular: false, position: 50 });
      }
    }

    const salon = await Salon.create({
      slug: s.slug,
      name: s.name,
      description: `${s.name} — ${s.specialties.join(", ")} à ${s.city}.`,
      category: s.category,
      specialties: s.specialties,
      city: s.city,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      coverUrl: s.cover,
      amenities: AMENITIES,
      status: "ACTIVE",
      verified: s.verified,
      plan: (["premium", "pro", "gratuit"] as PlanId[])[index % 3],
      planUntil: index % 3 === 2 ? null : new Date(Date.now() + (12 + index) * 86_400_000),
      owner: owner._id,
      createdAt: new Date(Date.parse(`${addDays(TODAY, -300 + index * 20)}T09:00:00Z`)),
      photos: s.gallery.map((url, position) => ({ url, position })),
      openingHours: OPENING_HOURS.filter((h) => h.hours).map((h) => ({ weekday: h.weekday, opensAt: h.hours!.slice(0, 5), closesAt: h.hours!.slice(-5) })),
      services,
    });
    salonIds.set(s.slug, salon._id);
    // Abonnements : les plans payants ont un paiement accepté dans l'historique, quelques demandes attendent le Super Admin
    if (salon.plan !== "gratuit") {
      await PlanPayment.create({
        salon: salon._id,
        requestedBy: owner._id,
        plan: salon.plan,
        amount: PLAN_PRICES[salon.plan],
        channel: index % 2 ? "D17" : "VIREMENT",
        reference: `${index % 2 ? "D17" : "VIR"}-26-${String(3100 + index * 37)}`,
        status: "ACCEPTED",
        decidedBy: admin._id,
        decidedAt: new Date(Date.now() - (18 - index) * 86_400_000),
        paidUntil: salon.planUntil,
        createdAt: new Date(Date.now() - (19 - index) * 86_400_000),
      });
    } else if ([2, 5].includes(index)) {
      await PlanPayment.create({
        salon: salon._id,
        requestedBy: owner._id,
        plan: index === 2 ? "pro" : "premium",
        amount: PLAN_PRICES[index === 2 ? "pro" : "premium"],
        channel: index === 2 ? "D17" : "VIREMENT",
        reference: index === 2 ? "D17-26-004471" : "VIR-BIAT-22918",
        createdAt: new Date(Date.now() - (index === 2 ? 5 : 26) * 3_600_000),
      });
    }
    for (const sv of services) serviceRows.set(`${s.slug}:${sv.name}`, { key: sv.key, name: sv.name, price: sv.price, durationMin: sv.durationMin });

    const team =
      s.slug === "salon-yasmine-la-marsa"
        ? EMPLOYEES.map((e) => ({ key: e.id, name: e.name, title: e.role, rating: e.rating, avatarUrl: e.avatar, color: e.color }))
        : (OTHER_TEAMS[s.slug] ?? DEFAULT_TEAM).map((e, i) => ({ ...e, avatarUrl: null, color: i + 1 }));
    for (const e of team) {
      const created = await Employee.create({ ...e, salon: salon._id });
      employeeIds.set(`${s.slug}:${e.key}`, created._id);
    }
  }

  // Compte employée (AUTH-07) : Nour se connecte et voit son planning
  const nourUser = await user({ email: "nour@beautyhub.tn", firstName: "Nour", lastName: "Hamdi", role: "EMPLOYEE" });
  await Employee.updateOne({ _id: employeeIds.get("salon-yasmine-la-marsa:nour")! }, { $set: { user: nourUser._id } });

  // ── Réservation utilitaire ──
  async function book(opts: { slug: string; employeeKey: string; clientId: Types.ObjectId; date: string; time: string; serviceNames: string[]; status: BookingStatus; paymentMethod?: "ONLINE" | "ONSITE"; createdDaysBefore?: number; durationOverride?: number }) {
    const items = opts.serviceNames.map((name) => {
      const sv = serviceRows.get(`${opts.slug}:${name}`);
      if (!sv) throw new Error(`Service inconnu : ${opts.slug} / ${name}`);
      return sv;
    });
    const durationMin = opts.durationOverride ?? items.reduce((a, i) => a + i.durationMin, 0);
    const startsAt = tunisToUtc(opts.date, opts.time);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const total = items.reduce((a, i) => a + i.price, 0);
    const deposit = opts.paymentMethod === "ONLINE" ? Math.min(30, Math.max(10, Math.round(total * 0.2))) : 0;
    const employee = employeeIds.get(`${opts.slug}:${opts.employeeKey}`)!;
    const _id = new Types.ObjectId();
    const booking = await Booking.create({
      _id,
      client: opts.clientId,
      salon: salonIds.get(opts.slug)!,
      employee,
      startsAt,
      endsAt,
      status: opts.status,
      totalPrice: total,
      deposit,
      paymentMethod: opts.paymentMethod ?? "ONSITE",
      // Jamais dans le futur, même pour un rendez-vous à venir
      createdAt: new Date(Math.min(startsAt.getTime() - (opts.createdDaysBefore ?? 3) * 86_400_000, Date.now() - 3_600_000)),
      completedAt: opts.status === "COMPLETED" ? endsAt : null,
      cancelledAt: opts.status === "CANCELLED" ? new Date(startsAt.getTime() - 2 * 86_400_000) : null,
      items: items.map((i) => ({ serviceKey: i.key, name: i.name, price: i.price, durationMin: i.durationMin })),
      payment: deposit ? { amount: deposit, status: "PAID", provider: "test", reference: "TEST-SEED" } : null,
    });
    // Tranches de 5 min verrouillées pour les réservations actives (anti double réservation)
    if ((ACTIVE_STATUSES as readonly string[]).includes(opts.status) && !(await acquireSlices(employee, startsAt, endsAt, { booking: _id }))) {
      console.warn(`[seed] chevauchement ignoré : ${opts.slug} / ${opts.employeeKey} ${opts.date} ${opts.time}`);
    }
    return booking;
  }

  // ── Agenda du jour du Salon Yasmine (dashboard) ──
  for (const b of SALON_TODAY) {
    await book({
      slug: "salon-yasmine-la-marsa",
      employeeKey: b.employee,
      clientId: b.client === "Sarra B." ? sarra._id : await clientFor(b.client),
      date: TODAY,
      time: b.time,
      serviceNames: [b.service],
      status: STATUS[b.status],
      durationOverride: toMinutes(b.end) - toMinutes(b.time),
    });
  }
  for (const block of SALON_BLOCKS) {
    const employee = employeeIds.get(`salon-yasmine-la-marsa:${block.employee}`)!;
    const startsAt = tunisToUtc(TODAY, block.time);
    const endsAt = tunisToUtc(TODAY, block.end);
    const _id = new Types.ObjectId();
    await TimeOff.create({ _id, employee, startsAt, endsAt, label: block.label });
    await acquireSlices(employee, startsAt, endsAt, { timeOff: _id });
  }

  // ── Historique de Sarra (espace client) ──
  const employeeKeyByName = (slug: string, name: string) =>
    [...employeeIds.keys()].find((k) => k.startsWith(`${slug}:`) && k.endsWith(`:${name.toLowerCase()}`))?.split(":")[1] ?? (OTHER_TEAMS[slug] ?? DEFAULT_TEAM)[0].key;
  for (const b of CLIENT_BOOKINGS) {
    const created = await book({
      slug: b.salonSlug,
      employeeKey: employeeKeyByName(b.salonSlug, b.employee),
      clientId: sarra._id,
      date: shift(b.date),
      time: b.time,
      serviceNames: [b.service],
      status: STATUS[b.status],
      paymentMethod: b.deposit ? "ONLINE" : "ONSITE",
      createdDaysBefore: 6,
    });
    if (b.reviewed) {
      await Review.create({
        booking: created._id,
        client: sarra._id,
        salon: created.salon,
        employee: created.employee,
        rating: 5,
        text: "Toujours un plaisir : résultat soigné, équipe à l'écoute et rendez-vous à l'heure.",
        sentiment: "positif",
        suspicion: 2,
        createdAt: new Date(created.startsAt.getTime() + 86_400_000),
      });
    }
  }

  // ── Avis vérifiés : ceux de la démo pour le Salon Yasmine, un échantillon pour les autres ──
  let reviewDay = 30;
  async function verifiedReview(slug: string, employeeKey: string, author: string, rating: number, text: string, extra: { reply?: string; photo?: string; helpful?: number; serviceName?: string; sentiment?: string; suspicion?: number; createdAt?: Date } = {}) {
    const serviceName = extra.serviceName ?? [...serviceRows.keys()].find((k) => k.startsWith(`${slug}:`))!.split(":")[1];
    const booking = await book({ slug, employeeKey, clientId: await clientFor(author), date: addDays(TODAY, -reviewDay), time: "10:00", serviceNames: [serviceName], status: "COMPLETED" });
    reviewDay += 2;
    return Review.create({
      booking: booking._id,
      client: booking.client,
      salon: booking.salon,
      employee: booking.employee,
      rating,
      text,
      photoUrl: extra.photo ?? null,
      reply: extra.reply ?? null,
      repliedAt: extra.reply ? extra.createdAt ?? new Date() : null,
      helpful: extra.helpful ?? 0,
      sentiment: extra.sentiment ?? (rating >= 4 ? "positif" : rating === 3 ? "neutre" : "negatif"),
      suspicion: extra.suspicion ?? 4,
      createdAt: extra.createdAt ?? new Date(booking.endsAt.getTime() + 3_600_000),
    });
  }

  for (const r of REVIEWS) {
    await verifiedReview("salon-yasmine-la-marsa", r.employee.toLowerCase(), r.author, r.rating, r.text, {
      reply: r.reply,
      photo: r.photo,
      helpful: r.helpful,
      serviceName: serviceRows.has(`salon-yasmine-la-marsa:${r.service}`) ? r.service : undefined,
    });
  }
  for (const s of SALONS.filter((x) => x.slug !== "salon-yasmine-la-marsa")) {
    const team = OTHER_TEAMS[s.slug] ?? DEFAULT_TEAM;
    for (const [i, r] of REVIEW_POOL.entries()) {
      if (i >= 3 + (s.name.length % 3)) break;
      await verifiedReview(s.slug, team[i % team.length].key, ["Amel S.", "Hela T.", "Salma B.", "Yosra M.", "Meriem K."][i], r.rating, r.text);
    }
  }

  // ── Avis signalés (modération Super Admin) ──
  for (const f of FLAGGED_REVIEWS) {
    const slug = SALONS.find((s) => s.name === f.salon)!.slug;
    const employeeKey = slug === "salon-yasmine-la-marsa" ? "ines" : (OTHER_TEAMS[slug] ?? DEFAULT_TEAM)[0].key;
    const review = await verifiedReview(slug, employeeKey, f.author, f.rating, f.text, { suspicion: f.score, sentiment: f.rating >= 4 ? "positif" : "negatif" });
    await ReviewReport.create({ review: review._id, source: f.reportedBy === "ai" ? "AI" : "SALON", reason: f.reasons.join(" · ") });
  }

  // ── Historique d'activité du Salon Yasmine sur 90 jours (statistiques, rapports, prédiction d'affluence) ──
  {
    const slug = "salon-yasmine-la-marsa";
    let seed = 20261019;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
    const FIRST = ["Rania", "Mouna", "Olfa", "Asma", "Hela", "Leila", "Emna", "Nadia", "Sonia", "Ines", "Yosra", "Meriem", "Salma", "Dorra", "Amel", "Rim", "Wafa", "Sana", "Khaoula", "Fatma", "Karim", "Walid", "Sami", "Mehdi"];
    const LAST = ["H.", "B.", "K.", "T.", "M.", "G.", "S.", "J.", "A.", "Z."];
    const regulars = await Promise.all(Array.from({ length: 36 }, (_, i) => clientFor(`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`)));
    const team = EMPLOYEES.map((e) => e.id);
    const catalog = [...serviceRows.entries()].filter(([k]) => k.startsWith(`${slug}:`)).map(([, v]) => v).filter((v) => v.durationMin <= 150);
    const rows: Record<string, unknown>[] = [];
    for (let back = 90; back >= 1; back--) {
      const date = addDays(TODAY, -back);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const hours = OPENING_HOURS.find((h) => h.weekday === weekday)?.hours;
      if (!hours) continue;
      const opens = toMinutes(hours.slice(0, 5));
      const closes = toMinutes(hours.slice(-5));
      // Plus de monde en fin de semaine et en fin de journée
      const perEmployee = weekday === 6 ? 4 : weekday >= 4 ? 3 : 2;
      for (const employeeKey of team) {
        let cursor = opens + Math.floor(rand() * 4) * 30;
        for (let n = 0; n < perEmployee + (rand() < 0.4 ? 1 : 0); n++) {
          const service = pick(catalog);
          cursor = Math.max(cursor, opens) + (rand() < 0.5 ? 0 : 30);
          if (cursor + service.durationMin > closes) break;
          const startsAt = tunisToUtc(date, `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
          const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
          const roll = rand();
          const status: BookingStatus = roll < 0.07 ? "CANCELLED" : roll < 0.12 ? "NO_SHOW" : "COMPLETED";
          const online = rand() < 0.3;
          const deposit = online ? Math.min(30, Math.max(10, Math.round(service.price * 0.2))) : 0;
          rows.push({
            client: pick(regulars),
            salon: salonIds.get(slug)!,
            employee: employeeIds.get(`${slug}:${employeeKey}`)!,
            startsAt,
            endsAt,
            status,
            totalPrice: service.price,
            deposit,
            paymentMethod: online ? "ONLINE" : "ONSITE",
            offPeak: weekday >= 1 && weekday <= 3 && cursor >= 600 && cursor < 720,
            createdAt: new Date(startsAt.getTime() - (1 + Math.floor(rand() * 10)) * 86_400_000),
            completedAt: status === "COMPLETED" ? endsAt : null,
            cancelledAt: status === "CANCELLED" ? new Date(startsAt.getTime() - 86_400_000) : null,
            items: [{ serviceKey: service.key, name: service.name, price: service.price, durationMin: service.durationMin }],
            payment: deposit ? { amount: deposit, status: status === "CANCELLED" ? "REFUNDED" : "PAID", provider: "test", reference: "TEST-SEED" } : null,
          });
          cursor += service.durationMin;
        }
      }
    }
    await Booking.insertMany(rows);
  }

  // Moyennes dénormalisées
  for (const salonId of salonIds.values()) {
    const [agg] = await Review.aggregate<{ avg: number; count: number }>([{ $match: { salon: salonId, status: "PUBLISHED" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]);
    await Salon.updateOne({ _id: salonId }, { $set: { ratingAvg: Math.round((agg?.avg ?? 0) * 10) / 10, reviewCount: agg?.count ?? 0 } });
  }

  // ── Fidélité de Sarra : historique de démo + solde de 420 pts, cumul 640 (niveau Or) ──
  const reasonByType: Record<string, PointReason> = {
    done: "BOOKING_COMPLETED",
    newSalon: "NEW_SALON",
    analysis: "PHOTO_ANALYSIS",
    reviewPhoto: "REVIEW",
    redeem: "REDEMPTION",
    referral: "REFERRAL",
    offPeak: "OFF_PEAK",
  };
  const historySum = POINT_HISTORY.reduce((a, h) => a + h.points, 0);
  await PointTransaction.create({ user: sarra._id, points: CLIENT.points - historySum, reason: "ADJUSTMENT", label: "Solde au lancement de la démo", createdAt: new Date(Date.parse(`${addDays(TODAY, -120)}T10:00:00Z`)) });
  for (const h of POINT_HISTORY) {
    await PointTransaction.create({
      user: sarra._id,
      points: h.points,
      reason: reasonByType[h.type],
      label: h.type === "redeem" ? "Réduction de 15 % sur un service" : (h.who ?? null),
      createdAt: new Date(Date.parse(`${shift(h.date)}T10:00:00Z`)),
    });
  }
  await User.updateOne(
    { _id: sarra._id },
    { $set: { "loyalty.balance": CLIENT.points, "loyalty.lifetime": CLIENT.lifetimePoints, "loyalty.lastActivityAt": new Date(), favorites: FAVORITES.map((slug) => salonIds.get(slug)!) } }
  );

  // ── Salons en attente de validation (ADM-02) ──
  for (const p of PENDING_SALONS) {
    const [firstName, ...rest] = p.owner.split(" ");
    const owner = await user({ email: `${slugify(p.owner)}@exemple.tn`, firstName, lastName: rest.join(" "), role: "MANAGER" });
    const category = (Object.entries(CATEGORY_LABEL).find(([, label]) => label === p.category)?.[0] ?? "coiffure") as Category;
    const pending = await Salon.create({
      slug: slugify(p.name),
      name: p.name,
      category,
      specialties: [p.category],
      city: p.city,
      address: `Centre-ville, ${p.city}`,
      lat: 36.8,
      lng: 10.18,
      plan: "gratuit",
      documentUrl: p.document,
      owner: owner._id,
      createdAt: new Date(Date.now() - p.hoursAgo * 3_600_000),
      coverUrl: img("photo-1560066984-138dadb4c035", 1200),
    });
    // Le plan payant choisi à l'inscription attend le paiement (comme dans l'inscription réelle)
    if (p.plan !== "gratuit") {
      await PlanPayment.create({ salon: pending._id, requestedBy: owner._id, plan: p.plan, amount: PLAN_PRICES[p.plan], channel: "VIREMENT", note: "Plan choisi à l'inscription", createdAt: new Date(Date.now() - p.hoursAgo * 3_600_000) });
    }
  }

  // ── Journal d'audit (ADM-07) ──
  for (const a of ADMIN_AUDIT) {
    await AuditLog.create({
      actor: a.role === "system" ? null : a.role === "moderator" ? moderator._id : admin._id,
      action: a.action,
      targetType: a.target ? "Salon" : "Platform",
      meta: a.target ? { name: a.target } : null,
      createdAt: new Date(Date.now() - a.minutesAgo * 60_000),
    });
  }

  await Notification.insertMany([
    { user: sarra._id, type: "booking.reminder", title: "Rappel", body: "Votre balayage au Salon Yasmine approche.", link: "/compte/rendez-vous" },
    { user: sarra._id, type: "points", title: "+40 points", body: "Merci pour votre visite chez Maison Elyssa.", link: "/compte/fidelite", readAt: new Date() },
  ]);

  const counts = await Promise.all([User.countDocuments(), Salon.countDocuments(), Booking.countDocuments(), Review.countDocuments()]);
  console.info(`Seed terminé (${TODAY}) : ${counts[0]} utilisateurs, ${counts[1]} salons, ${counts[2]} réservations, ${counts[3]} avis.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
