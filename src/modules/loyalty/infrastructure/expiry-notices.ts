import { objectId, User } from "@/infrastructure/db";
import { notify, pointsExpired, pointsExpiring, sendEmail } from "@/modules/notifications";
import type { ExpiryNotices } from "../application/ports";

/** FID-07 : prévenir la cliente (notification dans l'application + e-mail) avant et après l'expiration */
async function both(userId: string, message: { type: string; title: string; body: string; link?: string }) {
  await notify(userId, message);
  const user = await User.findById(objectId(userId), { email: 1 }).lean();
  if (user?.email) await sendEmail(user.email, message.title, `${message.body}\n\nVotre espace : /compte/fidelite`);
}

export const expiryNotices: ExpiryNotices = {
  expiring: (userId, balance, expiresAt) => both(userId, pointsExpiring(balance, expiresAt)),
  expired: (userId, points) => both(userId, pointsExpired(points)),
};
