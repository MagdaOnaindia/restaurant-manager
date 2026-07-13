/**
 * Creates the demo account "La Parrilla de Ana" with realistic data:
 * menu, daily menu, tables, shifts, reservations and a half-paid bill.
 *
 * Usage: node scripts/seed-demo.mjs  (with the API and Mailpit running)
 * Resulting credentials: demo@rms.local / demo1234
 */

const API = process.env.API_URL ?? "http://localhost:4000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const EMAIL = "demo@rms.local";
const PASSWORD = "demo1234";

let cookies = "";

function rememberCookies(res) {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  }
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie: cookies },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  rememberCookies(res);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${json.message ?? "error"}`);
  }
  return json;
}

async function verificationTokenFor(email) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const { messages } = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    const msg = messages?.find((m) => m.To?.[0]?.Address === email);
    if (msg) {
      const body = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const match = /verify-email\?token=([A-Za-z0-9_-]+)/.exec(`${body.Text}${body.HTML}`);
      if (match) return match[1];
    }
  }
  throw new Error("The verification email never reached Mailpit");
}

async function main() {
  // 1. Account (or reuse if it already exists)
  let fresh = false;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ana Demo", email: EMAIL, password: PASSWORD }),
  });
  if (reg.status === 201) {
    fresh = true;
    const token = await verificationTokenFor(EMAIL);
    await api("/auth/verify-email", { method: "POST", body: { token } });
    console.log("✓ Account created and verified");
  } else {
    console.log("• The demo account already existed, reusing it");
  }
  await api("/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } });

  const { organizations } = await api("/orgs");
  let org = organizations.find((o) => o.name === "Grupo La Parrilla");
  if (org && !fresh) {
    const restaurant = org.restaurants[0];
    console.log("• Demo data already present.");
    printSummary(restaurant?.slug);
    return;
  }

  // 2. Organization and restaurant
  org = (await api("/orgs", { method: "POST", body: { name: "Grupo La Parrilla" } })).organization;
  const restaurant = (
    await api(`/orgs/${org.id}/restaurants`, {
      method: "POST",
      body: {
        name: "La Parrilla de Ana",
        city: "Bilbao",
        address: "Calle Ledesma 12",
        phone: "944 123 456",
        description:
          "Brasa, producto de temporada y una barra de pintxos que quita el sentido, en pleno centro de Bilbao.",
      },
    })
  ).restaurant;
  const rid = restaurant.id;
  await api(`/restaurants/${rid}`, { method: "PATCH", body: { isPublic: true } });
  console.log(`✓ Restaurante: ${restaurant.name} (/r/${restaurant.slug})`);

  // 3. Floor: zones and tables
  const comedor = (await api(`/restaurants/${rid}/zones`, { method: "POST", body: { name: "Comedor" } })).zone;
  const terraza = (await api(`/restaurants/${rid}/zones`, { method: "POST", body: { name: "Terraza" } })).zone;
  const tables = [];
  for (const [zone, names] of [
    [comedor, ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6"]],
    [terraza, ["Terraza 1", "Terraza 2", "Terraza 3", "Terraza 4"]],
  ]) {
    for (const name of names) {
      const capacity = name.includes("1") || name.includes("5") ? 2 : 4;
      tables.push(
        (await api(`/restaurants/${rid}/zones/${zone.id}/tables`, { method: "POST", body: { name, capacity } }))
          .table,
      );
    }
  }
  console.log(`✓ ${tables.length} mesas en 2 zonas`);

  // 4. Seasonal menu
  const carta = (
    await api(`/restaurants/${rid}/menus`, {
      method: "POST",
      body: { name: "Carta de temporada", type: "A_LA_CARTE" },
    })
  ).menu;
  const cartaItems = {};
  const CARTA = [
    ["Entrantes", [
      ["Croquetas de jamón ibérico", 950, ["GLUTEN", "DAIRY", "EGGS"], ["de la casa"], "Cremosas, con jamón de bellota."],
      ["Ensalada de tomate y ventresca", 1250, ["FISH"], ["de temporada"], "Tomate de caserío y ventresca de bonito."],
      ["Pimientos de Gernika", 850, [], ["vegano"], "Fritos y con escamas de sal."],
    ]],
    ["A la brasa", [
      ["Chuleta de vaca vieja (1kg)", 4800, [], ["para compartir"], "Maduración 45 días, brasa de encina."],
      ["Lubina salvaje a la brasa", 2450, ["FISH"], [], "Con refrito de ajos al estilo Orio."],
      ["Pollo de caserío", 1890, [], [], "Medio pollo con patatas panadera."],
    ]],
    ["Postres", [
      ["Torrija caramelizada", 750, ["GLUTEN", "DAIRY", "EGGS"], ["favorito"], "Con helado de leche merengada."],
      ["Tarta de queso al horno", 700, ["DAIRY", "EGGS", "GLUTEN"], [], "Corazón fundente, receta propia."],
    ]],
    ["Bebidas", [
      ["Rioja crianza (botella)", 1800, ["SULPHITES"], [], null],
      ["Caña", 280, ["GLUTEN"], [], null],
      ["Agua mineral", 250, [], [], null],
    ]],
  ];
  for (const [catName, items] of CARTA) {
    const cat = (
      await api(`/restaurants/${rid}/menus/${carta.id}/categories`, { method: "POST", body: { name: catName } })
    ).category;
    for (const [name, priceCents, allergens, tags, description] of items) {
      const item = (
        await api(`/restaurants/${rid}/categories/${cat.id}/items`, {
          method: "POST",
          body: { name, priceCents, allergens, tags, description: description ?? undefined },
        })
      ).item;
      cartaItems[name] = item;
    }
  }
  await api(`/restaurants/${rid}/menus/${carta.id}`, { method: "PATCH", body: { status: "PUBLISHED" } });
  console.log("✓ Seasonal menu published (11 dishes)");

  // 5. Daily menu (Mon-Fri 13:00-16:00, 16,90 €)
  const menuDia = (
    await api(`/restaurants/${rid}/menus`, {
      method: "POST",
      body: { name: "Menú del día", type: "FIXED_PRICE", priceCents: 1690 },
    })
  ).menu;
  const MENU_DIA = [
    ["Primeros (a elegir)", 1, [["Ensalada mixta", []], ["Sopa de pescado", ["FISH", "CRUSTACEANS"]]]],
    ["Segundos (a elegir)", 1, [["Bacalao al pil-pil", ["FISH"]], ["Secreto ibérico a la brasa", []]]],
    ["Postre", 1, [["Flan casero", ["EGGS", "DAIRY"]], ["Fruta de temporada", []]]],
  ];
  for (const [catName, choiceCount, items] of MENU_DIA) {
    const cat = (
      await api(`/restaurants/${rid}/menus/${menuDia.id}/categories`, {
        method: "POST",
        body: { name: catName, choiceCount },
      })
    ).category;
    for (const [name, allergens] of items) {
      await api(`/restaurants/${rid}/categories/${cat.id}/items`, {
        method: "POST",
        body: { name, priceCents: 0, allergens },
      });
    }
  }
  await api(`/restaurants/${rid}/menus/${menuDia.id}/schedules`, {
    method: "PUT",
    body: { schedules: [{ daysOfWeek: [1, 2, 3, 4, 5], timeFrom: "13:00", timeTo: "16:00" }] },
  });
  await api(`/restaurants/${rid}/menus/${menuDia.id}`, { method: "PATCH", body: { status: "PUBLISHED" } });
  console.log("✓ Daily menu published (16,90 €, Mon-Fri 13-16h)");

  // 6. Reservation shifts
  for (const shift of [
    { name: "Comida", daysOfWeek: [], startTime: "13:00", endTime: "15:30", slotMinutes: 30, maxCoversPerSlot: 24 },
    { name: "Cena", daysOfWeek: [], startTime: "20:00", endTime: "22:30", slotMinutes: 30, maxCoversPerSlot: 20 },
  ]) {
    await api(`/restaurants/${rid}/shifts`, { method: "POST", body: shift });
  }

  // 7. Today's reservations
  const today = new Date().toLocaleDateString("en-CA");
  for (const r of [
    { time: "13:30", partySize: 4, customerName: "Familia García", customerPhone: "600 111 222", notes: "Trona para el peque" },
    { time: "14:00", partySize: 2, customerName: "Jon e Irati", customerPhone: "600 333 444" },
    { time: "21:00", partySize: 6, customerName: "Cena de cuadrilla", customerPhone: "600 555 666", notes: "Terraza si es posible" },
  ]) {
    await api(`/restaurants/${rid}/reservations`, {
      method: "POST",
      body: { date: today, force: true, ...r },
    });
  }
  console.log("✓ 3 reservations for today");

  // 8. Open bill on Table 2, half-paid via QR (demo mode)
  const mesa2 = tables.find((t) => t.name === "Mesa 2");
  const check = (await api(`/restaurants/${rid}/checks`, { method: "POST", body: { tableId: mesa2.id } })).check;
  for (const [name, qty] of [
    ["Croquetas de jamón ibérico", 1],
    ["Lubina salvaje a la brasa", 2],
    ["Rioja crianza (botella)", 1],
    ["Agua mineral", 1],
  ]) {
    await api(`/restaurants/${rid}/checks/${check.id}/lines`, {
      method: "POST",
      body: { menuItemId: cartaItems[name].id, quantity: qty },
    });
  }
  const view = await api(`/pay/checks/${check.publicToken}?sessionId=sesion-demo-ana01`);
  const croquetas = view.lines.find((l) => l.name.startsWith("Croquetas"));
  const agua = view.lines.find((l) => l.name.startsWith("Agua"));
  await api(`/pay/checks/${check.publicToken}/claims`, {
    method: "POST",
    body: { sessionId: "sesion-demo-ana01", lines: [{ lineId: croquetas.id, units: 1 }, { lineId: agua.id, units: 1 }] },
  });
  const intent = await api(`/pay/checks/${check.publicToken}/intents`, {
    method: "POST",
    body: { sessionId: "sesion-demo-ana01", mode: "ITEMS", tipCents: 100, payerName: "Ana" },
  });
  await api(`/pay/checks/${check.publicToken}/intents/${intent.paymentId}/dev-confirm`, { method: "POST" });
  console.log("✓ Open bill on Table 2 with a QR payment already made");

  const { writeFileSync } = await import("fs");
  writeFileSync(
    new URL("./demo-info.json", import.meta.url),
    JSON.stringify({ slug: restaurant.slug, checkToken: check.publicToken, cartaId: carta.id, checkId: check.id }, null, 2),
  );
  printSummary(restaurant.slug, check.publicToken);
}

function printSummary(slug, checkToken) {
  console.log("\n──────────────────────────────────────────");
  console.log("  DEMO ACCOUNT READY");
  console.log(`  Back office : http://localhost:3100/login`);
  console.log(`  Email       : ${EMAIL}`);
  console.log(`  Password    : ${PASSWORD}`);
  if (slug) console.log(`  Public page : http://localhost:3100/r/${slug}`);
  if (checkToken) console.log(`  Diner bill  : http://localhost:3001/c/${checkToken}`);
  console.log("──────────────────────────────────────────");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
