import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import type { AppError } from "@/core/domain/errors";
import { tunisToUtc } from "@/core/domain/time";
import { Attendance, Employee, Notification, Payslip } from "@/infrastructure/db";
import { annualIncomeTax, clock, computePayslip, correctAttendance, employeeMonth, generatePayslips, myPayslips, myToday, payslipFor, updatePayslip } from "@/modules/payroll";
import { classifyDay } from "@/modules/payroll/domain/payroll";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

describe("Paie & pointage : règles pures", () => {
  test("journée : heures sup au-delà du prévu, congé payé, absence passée, jour à venir, repos", () => {
    const today = "2026-09-15";
    assert.deepEqual(classifyDay({ date: "2026-09-10", plannedMinutes: 480, workedMinutes: 600, leave: false }, today), { date: "2026-09-10", kind: "worked", plannedMinutes: 480, workedMinutes: 600, overtimeMinutes: 120 });
    assert.equal(classifyDay({ date: "2026-09-12", plannedMinutes: 0, workedMinutes: 120, leave: false }, today).overtimeMinutes, 120, "jour de repos travaillé : tout en heures sup");
    assert.equal(classifyDay({ date: "2026-09-11", plannedMinutes: 480, workedMinutes: 492, leave: false }, today).overtimeMinutes, 0, "12 minutes de plus : sous la tolérance de 15 minutes");
    assert.equal(classifyDay({ date: "2026-09-09", plannedMinutes: 480, workedMinutes: null, leave: true }, today).kind, "leave");
    assert.equal(classifyDay({ date: "2026-09-08", plannedMinutes: 480, workedMinutes: null, leave: false }, today).kind, "absent");
    assert.equal(classifyDay({ date: "2026-09-20", plannedMinutes: 480, workedMinutes: null, leave: false }, today).kind, "upcoming");
    assert.equal(classifyDay({ date: today, plannedMinutes: 480, workedMinutes: null, leave: false }, today).kind, "upcoming", "aujourd'hui sans pointage : pas encore absente");
    assert.equal(classifyDay({ date: "2026-09-13", plannedMinutes: 0, workedMinutes: null, leave: false }, today).kind, "rest");
  });

  test("IRPP : barème annuel tranche par tranche", () => {
    assert.equal(annualIncomeTax(5_000), 0);
    assert.equal(annualIncomeTax(10_000), 750);
    assert.equal(annualIncomeTax(20_000), 3_250);
    assert.equal(annualIncomeTax(60_000), 750 + 2_500 + 3_000 + 3_300 + 3_600 + 3_500);
  });

  test("fiche : absences retenues, heures sup majorées, commission, prime, CNSS, IRPP, avance", () => {
    const summary = { scheduledDays: 22, workedDays: 21, leaveDays: 1, absentDays: 1, plannedMinutes: 22 * 480, workedMinutes: 21 * 480, overtimeMinutes: 240 };
    const lines = computePayslip({ baseSalary: 1100, overtimeRate: 25, commissionRate: 10, revenue: 3000, summary, bonus: 40, advance: 100, rates: { cnssRate: 9.18, cssRate: 0.5, irpp: true } });
    assert.equal(lines.hourlyRate, 6.25, "1100 DT / 176 h");
    assert.equal(lines.absenceDeduction, 50, "1100 DT / 22 jours");
    assert.equal(lines.overtimePay, 31.25, "4 h × 6,25 DT × 1,25");
    assert.equal(lines.commission, 300);
    assert.equal(lines.gross, 1100 - 50 + 31.25 + 300 + 40);
    assert.equal(lines.cnss, Math.round(lines.gross * 0.0918 * 1000) / 1000);
    assert.ok(lines.irpp > 0 && lines.css > 0);
    assert.equal(lines.net, Math.round((lines.gross - lines.cnss - lines.irpp - lines.css - 100) * 1000) / 1000);
    const noTax = computePayslip({ baseSalary: 1100, overtimeRate: 25, commissionRate: 0, revenue: 0, summary, bonus: 0, advance: 0, rates: { cnssRate: 9.18, cssRate: 0.5, irpp: false } });
    assert.equal(noTax.irpp + noTax.css, 0, "IRPP désactivé dans les paramètres");
  });
});

describe("Paie & pointage : pointage, dossier et fiches de paie", () => {
  beforeEach(resetDb);
  after(closeDb);

  /** Professionnelle « Amira » avec un compte, du lundi au vendredi 09:00–17:00, 1 100 DT par mois */
  async function setup() {
    const { salon, owner } = await makeSalon();
    const employeeUser = await makeUser("EMPLOYEE");
    const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "09:00", endsAt: "17:00", off: false }));
    const weekend = [0, 6].map((weekday) => ({ weekday, startsAt: "09:00", endsAt: "17:00", off: true }));
    await Employee.updateOne({ salon: salon.id, key: "amira" }, { $set: { user: employeeUser.id, baseSalary: 1100, overtimeRate: 25, workingHours: [...weekdays, ...weekend] } });
    const amira = await Employee.findOne({ salon: salon.id, key: "amira" }).orFail().lean();
    return { salon, manager: { id: owner.id, role: "MANAGER" as const }, employee: { id: employeeUser.id, role: "EMPLOYEE" as const }, amiraId: String(amira._id) };
  }

  test("arrivée puis départ : une seule période ouverte à la fois ; un départ après minuit ferme l'arrivée de la veille", async () => {
    const { employee } = await setup();
    const t0 = tunisToUtc("2026-09-14", "10:00");
    await clock(employee.id, "in", t0);
    await assert.rejects(clock(employee.id, "in", t0), (e: AppError) => e.code === "ALREADY_IN");
    await clock(employee.id, "out", new Date(t0.getTime() + 90 * 60_000));
    await assert.rejects(clock(employee.id, "out", t0), (e: AppError) => e.code === "NOT_IN");
    const today = await myToday(employee.id, new Date(t0.getTime() + 2 * 3_600_000));
    assert.equal(today.present, false);
    assert.equal(today.workedMinutes, 90);

    await clock(employee.id, "in", tunisToUtc("2026-09-14", "23:00"));
    await clock(employee.id, "out", tunisToUtc("2026-09-15", "00:30"));
    const late = await Attendance.findOne({ date: "2026-09-14" }).orFail().lean();
    assert.equal(late.segments.filter((x) => x.out).length, 2, "la période de la veille est fermée");
    assert.equal(await Attendance.countDocuments({ date: "2026-09-15" }), 0);
  });

  test("mois complet : absence, congé justifié, heures sup, puis fiche validée et visible par l'employée seulement", async () => {
    const { salon, manager, employee, amiraId } = await setup();
    const now = new Date("2026-10-01T10:00:00Z");
    // Septembre 2026 : 22 jours prévus ; pointage 09:00–17:00, sauf le 8 (absente), le 9 (justifié), le 10 (jusqu'à 19:00), samedi 12 (10:00–12:00)
    const weekdays = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`).filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()));
    const day = (date: string, from: string, to: string) => ({ salon: salon.id, employee: amiraId, date, segments: [{ in: tunisToUtc(date, from), out: tunisToUtc(date, to) }] });
    await Attendance.insertMany([
      ...weekdays.filter((d) => !["2026-09-08", "2026-09-09", "2026-09-10"].includes(d)).map((d) => day(d, "09:00", "17:00")),
      day("2026-09-10", "09:00", "19:00"),
      day("2026-09-12", "10:00", "12:00"),
    ]);
    await correctAttendance(manager, { employeeId: amiraId, date: "2026-09-09", status: "EXCUSED", segments: [], note: "Rendez-vous médical" }, now);

    const month = await employeeMonth(amiraId, "2026-09", now);
    assert.deepEqual(
      { scheduled: month.summary.scheduledDays, worked: month.summary.workedDays, absent: month.summary.absentDays, leave: month.summary.leaveDays, overtime: month.summary.overtimeMinutes },
      { scheduled: 22, worked: 21, absent: 1, leave: 1, overtime: 240 }
    );

    assert.equal(await generatePayslips(salon.id, "2026-09", now), 2, "une fiche par professionnel actif");
    const slip = await Payslip.findOne({ employee: amiraId, period: "2026-09" }).orFail().lean();
    assert.equal(slip.status, "DRAFT");
    assert.deepEqual([slip.lines.absenceDeduction, slip.lines.overtimePay, slip.lines.gross], [50, 31.25, 1081.25]);
    await assert.rejects(payslipFor(employee, String(slip._id)), (e: AppError) => e.status === 403, "brouillon invisible pour l'employée");
    assert.equal((await myPayslips(employee.id)).length, 0);

    const validated = await updatePayslip(manager, String(slip._id), { bonus: 40, action: "validate" }, now);
    assert.equal(validated.status, "VALIDATED");
    assert.equal(validated.lines.gross, 1121.25, "prime ajoutée et fiche recalculée avant validation");
    assert.equal(await Notification.countDocuments({ user: employee.id, type: "payslip.ready" }), 1);
    await assert.rejects(updatePayslip(manager, String(slip._id), { bonus: 0, action: "save" }, now), (e: AppError) => e.code === "PAYSLIP_VALIDATED");
    assert.deepEqual((await myPayslips(employee.id)).map((s) => s.period), ["2026-09"]);
    assert.equal((await payslipFor(employee, String(slip._id))).lines.net, validated.lines.net);

    // La fiche de Nour ne regarde pas Amira
    const other = await Payslip.findOne({ period: "2026-09", employee: { $ne: amiraId } }).orFail().lean();
    await Payslip.updateOne({ _id: other._id }, { $set: { status: "VALIDATED" } });
    await assert.rejects(payslipFor(employee, String(other._id)), (e: AppError) => e.status === 403);
    // Une fiche validée n'est jamais recalculée
    assert.equal(await generatePayslips(salon.id, "2026-09", now), 2);
    assert.equal((await Payslip.findById(slip._id).orFail().lean()).lines.gross, 1121.25);
  });
});
