/** CLI-04 : « Refaire le même rendez-vous » — même prestation et même professionnel présélectionnés */
export function rebookHref(b: { salon: { slug: string }; items: { serviceKey: string | null }[]; employee: { key: string | null } }) {
  const params = new URLSearchParams();
  const service = b.items.find((i) => i.serviceKey)?.serviceKey;
  if (service) params.set("service", service);
  if (b.employee.key) params.set("pro", b.employee.key);
  const qs = params.toString();
  return `/salons/${b.salon.slug}/reserver${qs ? `?${qs}` : ""}`;
}
