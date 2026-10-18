/**
 * Audit responsive : charge chaque page dans des cadres de largeurs différentes (même origine) et signale
 * ce qui déborde de l'écran. À coller dans la console du navigateur, sur n'importe quelle page du site lancé
 * en local (http://localhost:3000), connexion démo activée (DEMO_LOGIN=true).
 *
 *   await __login('MANAGER');                       // CLIENT | MANAGER | ADMIN | null (déconnecté)
 *   await __audit(['/dashboard', '/dashboard/agenda'], [320, 375, 768, 1280])
 *
 * Résultat : { chemin: 'OK' | { largeur: ['PAGE scrollWidth=…', 'OUT balise.classes "texte" [gauche→droite]'] } }
 * Règle du projet : « OK » partout, en français, en arabe (document.cookie = 'NEXT_LOCALE=ar; path=/') et en anglais.
 */
window.__login = async (role) => {
  const csrf = async () => (await (await fetch("/api/auth/csrf")).json()).csrfToken;
  await fetch("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: await csrf(), json: "true" }) });
  if (!role) return "anonyme";
  await fetch("/api/auth/callback/demo", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: await csrf(), role, json: "true" }), redirect: "manual" });
  return (await (await fetch("/api/auth/session")).json())?.user?.role ?? "ÉCHEC";
};

window.__measure = (doc, width) => {
  const win = doc.defaultView;
  const issues = [];
  const scrollWidth = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
  if (scrollWidth > width + 1) issues.push("PAGE scrollWidth=" + scrollWidth);
  // Un élément qui dépasse mais dont un ancêtre défile ou masque son débordement est volontaire (rangées de puces, tableaux)
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== doc.documentElement; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(win.getComputedStyle(p).overflowX)) return true;
    return false;
  };
  const flagged = new Set();
  for (const el of doc.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = win.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || el.closest(".sr-only")) continue;
    if (r.right <= width + 1.5 && r.left >= -1.5) continue;
    if (clipped(el)) continue;
    let ancestor = el.parentElement;
    let nested = false;
    while (ancestor) {
      if (flagged.has(ancestor)) { nested = true; break; }
      ancestor = ancestor.parentElement;
    }
    if (nested) continue;
    flagged.add(el);
    const classes = (el.getAttribute("class") || "").split(/\s+/).slice(0, 4).join(".");
    const text = (el.textContent || "").trim().slice(0, 28).replace(/\s+/g, " ");
    issues.push("OUT " + el.tagName.toLowerCase() + (classes ? "." + classes : "") + (text ? ' "' + text + '"' : "") + " [" + Math.round(r.left) + "→" + Math.round(r.right) + "]");
  }
  return issues.slice(0, 8);
};

window.__audit = async (paths, widths) => {
  const out = {};
  for (const path of paths) {
    const frames = widths.map((width) => {
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;left:0;top:0;border:0;visibility:hidden;height:900px;width:" + width + "px";
      f.src = path;
      document.body.appendChild(f);
      return { f, width };
    });
    await Promise.all(frames.map(({ f }) => new Promise((done) => { f.onload = done; setTimeout(done, 20000); })));
    await new Promise((done) => setTimeout(done, 3500)); // le temps que les animations d'entrée se posent
    out[path] = {};
    for (const { f, width } of frames) {
      try {
        const issues = window.__measure(f.contentDocument, width);
        if (issues.length) out[path][width] = issues;
      } catch (e) {
        out[path][width] = ["ERREUR " + e.message];
      }
      f.remove();
    }
    if (!Object.keys(out[path]).length) out[path] = "OK";
  }
  return out;
};
