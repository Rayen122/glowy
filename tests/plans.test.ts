import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import type { AppError } from "@/core/domain/errors";
import { Employee, Notification, Salon } from "@/infrastructure/db";
import { parseMessage } from "@/modules/assistant";
import { createEmployee, createService, employeeInput, listSalonServices, serviceInput, updateService } from "@/modules/dashboard";
import { canAddEmployee, effectivePlan, expirePlans, minimumPlanFor, planAllows, remindExpiringPlans, requirePlanFeature } from "@/modules/subscription";
import { closeDb, makeSalon, resetDb } from "./helpers";

const DAY = 86_400_000;

describe("Plans des salons : limites, fonctions réservées, échéance (ADM-05)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("règles pures : plan en vigueur, fonctions débloquées, nombre de professionnels", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    assert.equal(effectivePlan("pro", new Date(now.getTime() + DAY), now), "pro");
    assert.equal(effectivePlan("pro", new Date(now.getTime() - DAY), now), "gratuit", "période terminée");
    assert.equal(effectivePlan("premium", null, now), "gratuit", "plan payant sans période");
    assert.equal(planAllows("gratuit", "stats"), false);
    assert.equal(planAllows("pro", "stats"), true);
    assert.equal(planAllows("pro", "stocks"), false);
    assert.equal(minimumPlanFor("crm"), "pro");
    assert.equal(minimumPlanFor("branches"), "premium");
    assert.equal(canAddEmployee("gratuit", 0), true);
    assert.equal(canAddEmployee("gratuit", 1), false);
    assert.equal(canAddEmployee("pro", 8), false);
    assert.equal(canAddEmployee("premium", 500), true);
  });

  test("plan Gratuit : 2e professionnel actif refusé (PLAN_LIMIT), statistiques refusées (PLAN_REQUIRED)", async () => {
    const { salon, owner } = await makeSalon();
    await Employee.updateMany({ salon: salon.id }, { $set: { active: false } });
    const manager = { id: owner.id, role: "MANAGER" as const };
    await createEmployee(manager, employeeInput.parse({ name: "Première", title: "Coiffeuse" }));
    await assert.rejects(createEmployee(manager, employeeInput.parse({ name: "Deuxième", title: "Coiffeuse" })), (e: AppError) => e.code === "PLAN_LIMIT");
    await assert.rejects(requirePlanFeature(salon.id, "stats"), (e: AppError) => e.code === "PLAN_REQUIRED" && e.status === 403);

    // Plan Pro en cours : jusqu'à 8 professionnels, statistiques ouvertes, stocks toujours réservés au Premium
    await Salon.updateOne({ _id: salon.id }, { $set: { plan: "pro", planUntil: new Date(Date.now() + 10 * DAY) } });
    await createEmployee(manager, employeeInput.parse({ name: "Deuxième", title: "Coiffeuse" }));
    await requirePlanFeature(salon.id, "stats");
    await assert.rejects(requirePlanFeature(salon.id, "stocks"), (e: AppError) => e.code === "PLAN_REQUIRED");
  });

  test("échéance : rappel une seule fois 5 jours avant, puis retour au plan Gratuit avec notification", async () => {
    const { salon, owner } = await makeSalon();
    const now = new Date();
    await Salon.updateOne({ _id: salon.id }, { $set: { plan: "premium", planUntil: new Date(now.getTime() + 3 * DAY) } });
    assert.equal(await remindExpiringPlans(now), 1);
    assert.equal(await remindExpiringPlans(now), 0, "pas de second rappel");
    assert.equal(await Notification.countDocuments({ user: owner.id, type: "plan.expiring" }), 1);

    const later = new Date(now.getTime() + 4 * DAY);
    assert.equal(await expirePlans(later), 1);
    const doc = await Salon.findById(salon.id).orFail().lean();
    assert.equal(doc.plan, "gratuit");
    assert.equal(doc.planUntil, null);
    assert.equal(await Notification.countDocuments({ user: owner.id, type: "plan.expired" }), 1);
    assert.equal(await expirePlans(later), 0, "idempotent");
  });
});

describe("Corrections de la recette", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("QA-05 : la création d'une prestation renvoie l'identifiant attendu par la modification", async () => {
    const { owner } = await makeSalon();
    const manager = { id: owner.id, role: "MANAGER" as const };
    const created = await createService(manager, serviceInput.parse({ name: "Soin éclat", group: "Soins", durationMin: 45, price: 55 }));
    assert.ok(created.id && created.key);
    await updateService(manager, created.id, serviceInput.parse({ name: "Soin éclat", group: "Soins", durationMin: 45, price: 49, oldPrice: 55 }));
    const services = await listSalonServices((await Salon.findOne({ owner: owner.id }).orFail()).id);
    assert.equal(services.find((s) => s.id === created.id)?.price, 49);
  });

  test("QA-07 : l'assistante comprend la darija écrite en lettres latines", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    const a = parseMessage("nheb n9os chaari ghodwa", now, []);
    assert.equal(a.intent, "book");
    assert.equal(a.service, "coupe");
    assert.equal(a.date, "2026-10-27");
    const b = parseMessage("n7jez ta7fifa nhar el khmis l3chiya", now, []);
    assert.deepEqual([b.service, b.date, b.part], ["coupe", "2026-10-29", "afternoon"]);
  });
});
