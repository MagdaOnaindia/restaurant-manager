/**
 * Genera las capturas de docs/screenshots a partir de la cuenta demo.
 * Requiere: servidores levantados + `node scripts/seed-demo.mjs` ejecutado antes.
 *
 * Uso: node scripts/screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

const WEB = "http://localhost:3100";
const PAY = "http://localhost:3001";
const OUT = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
const info = JSON.parse(readFileSync(new URL("./demo-info.json", import.meta.url), "utf8"));

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

/** goto con reintentos: el HMR del dev server puede interrumpir la primera navegación. */
async function goto(page, path) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90_000 });
      return;
    } catch (err) {
      if (attempt >= 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
}

async function shot(page, path, name, { fullPage = false } = {}) {
  await goto(page, path);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200); // fuentes + transiciones + primera compilación en dev
  // Oculta el botón de las dev tools de Next en las capturas
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  console.log(`✓ ${name}.png`);
}

// ── Escritorio ──────────────────────────────────────────────────────
const desktop = await browser.newContext({
  viewport: { width: 1360, height: 850 },
  locale: "es-ES",
  deviceScaleFactor: 1.5,
});
const page = await desktop.newPage();

await shot(page, `${WEB}/`, "01-landing", { fullPage: false });

// Login con la cuenta demo
await goto(page, `${WEB}/login`);
await page.waitForSelector("#email", { timeout: 60_000 });
// Espera a la hidratación de React: si se rellena antes, los campos controlados se vacían
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2000);
for (let attempt = 0; attempt < 3; attempt++) {
  await page.fill("#email", "demo@rms.local");
  await page.fill("#password", "demo1234");
  await page.click('button[type="submit"]');
  const arrived = await page
    .waitForURL("**/app", { timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (arrived) break;
  if (attempt === 2) throw new Error("El login no llegó a /app");
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(1500);

await shot(page, `${WEB}/app`, "02-dashboard");
await shot(page, `${WEB}/app/pos`, "03-comandero");
await shot(page, `${WEB}/app/pos/${info.checkId}`, "04-cuenta-mesa");
await shot(page, `${WEB}/app/menus/${info.cartaId}`, "05-editor-carta");
await shot(page, `${WEB}/app/reservations`, "06-reservas");
await shot(page, `${WEB}/r/${info.slug}`, "07-pagina-publica");
await desktop.close();

// ── Móvil (app del comensal) ────────────────────────────────────────
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "es-ES",
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const phone = await mobile.newPage();
await shot(phone, `${PAY}/c/${info.checkToken}`, "08-comensal-cuenta", { fullPage: true });
await mobile.close();

await browser.close();
console.log("\nCapturas generadas en docs/screenshots/");
