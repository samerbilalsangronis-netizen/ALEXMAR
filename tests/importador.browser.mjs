// Prueba del componente real con API simulada: nunca conecta a Supabase.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const fixture = await mkdtemp(join(repo, "test-results", "importador-"));
await mkdir(join(fixture, "app"));
await writeFile(
  join(fixture, "package.json"),
  JSON.stringify({ private: true }),
);
await writeFile(
  join(fixture, "jsconfig.json"),
  JSON.stringify({
    compilerOptions: { baseUrl: repo, paths: { "@/*": ["src/*"] } },
  }),
);
await writeFile(
  join(fixture, "next.config.mjs"),
  `export default {turbopack:{root:${JSON.stringify(repo)}}};`,
);
await writeFile(
  join(fixture, "app/layout.jsx"),
  'export default function Layout({children}) { return <html lang="es"><body>{children}</body></html>; }',
);
await writeFile(
  join(fixture, "app/importador.tsx"),
  (
    await readFile(join(repo, "src/components/importador.tsx"), "utf8")
  ).replaceAll("@/lib/migracion", "../../../src/lib/migracion"),
);
await writeFile(
  join(fixture, "app/page.jsx"),
  'import {Importador} from "./importador"; export default async function Page({searchParams}){const p=await searchParams;return <Importador modo={p.modo==="actualizacion"?"actualizacion":"inicial"}/>;}',
);
const socket = createServer();
await new Promise((done) => socket.listen(0, "127.0.0.1", done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const server = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "dev",
    "--port",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  { cwd: fixture, detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
server.stdout.on("data", (chunk) => {
  log += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  log += chunk.toString();
});
let browser;
try {
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) break;
    } catch {}
    if (Date.now() > deadline || server.exitCode !== null)
      throw new Error("No arrancó el fixture: " + log.slice(-2500));
    await new Promise((done) => setTimeout(done, 200));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const tablas = ["inventario", "clientes", "detalle_cuentas", "notas"];
  const llamadas = [];
  let fallo = false;
  let conflicto = false;
  await page.route("**/api/migracion", async (route) => {
    const req = route.request();
    const form = await new Request(req.url(), {
      method: "POST",
      headers: req.headers(),
      body: req.postDataBuffer(),
    }).formData();
    for (const t of tablas) {
      const f = form.get(t);
      if (!f || f.size === 0) throw new Error("Se perdió el CSV " + t);
    }
    const accion = form.get("accion");
    llamadas.push(accion);
    if (fallo) {
      await route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: "Bad Gateway",
      });
      return;
    }
    if (accion === "confirmar") {
      expect(form.get("huella")).toBe("a".repeat(64));
      if (form.get("modo") === "actualizacion")
        expect(form.get("revision")).toBe("b".repeat(64));
      await route.fulfill({ json: { importado: true } });
    } else {
      await route.fulfill({
        json: {
          resumen: Object.fromEntries(
            tablas.map((t) => [t, { total: 1, vigentes: 1, eliminados: 0 }]),
          ),
          errores: [],
          advertencias: [],
          diferencias: [],
          conciliacion: [],
          regla: "vista_saldos_clientes_sin_redondeo_v1",
          puedeImportar: !conflicto,
          ...(form.get("modo") === "actualizacion"
            ? {
                actualizacion: {
                  revision: "b".repeat(64),
                  resumen: Object.fromEntries(
                    tablas.map((t) => [
                      t,
                      { nuevos: 1, actualizados: 1, sin_cambios: 5 },
                    ]),
                  ),
                  conflictos: conflicto
                    ? [
                        {
                          tabla: "inventario",
                          id: "prueba",
                          motivo: "Cambió también en la web nueva: fisico",
                        },
                      ]
                    : [],
                },
              }
            : {}),
          huella: "a".repeat(64),
        },
      });
    }
  });
  await page.goto(url);
  async function archivos() {
    for (const t of tablas)
      await page.locator(`input[name="${t}"]`).setInputFiles({
        name: `${t}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from("id,contenido\nprueba,sintetica"),
      });
  }
  await archivos();
  await page.getByRole("button", { name: "1. Analizar y conciliar" }).click();
  await expect(
    page.getByRole("heading", { name: "Resultado de la simulación" }),
  ).toBeVisible();
  // Esta comprobación falla con form action: React limpia los file inputs tras analizar.
  for (const t of tablas)
    expect(
      await page.locator(`input[name="${t}"]`).evaluate((i) => i.files.length),
    ).toBe(1);
  const confirmar = page.getByRole("button", {
    name: "2. Confirmar importación",
  });
  await expect(confirmar).toBeDisabled();
  await page.getByRole("checkbox").check();
  await confirmar.click();
  await expect(
    page.getByText(
      "Importación confirmada. Consulta inventario, clientes y notas.",
    ),
  ).toBeVisible();
  expect(llamadas).toEqual(["simular", "confirmar"]);
  await page.reload();
  await archivos();
  await page.getByRole("button", { name: "1. Analizar y conciliar" }).click();
  await expect(page.getByRole("checkbox")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.locator('input[name="notas"]').setInputFiles({
    name: "notas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,contenido\nprueba,cambiada"),
  });
  await expect(
    page.getByRole("button", { name: "2. Confirmar importación" }),
  ).toHaveCount(0);
  fallo = true;
  await page.getByRole("button", { name: "1. Analizar y conciliar" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("502");
  for (const t of tablas)
    expect(
      await page.locator(`input[name="${t}"]`).evaluate((i) => i.files.length),
    ).toBe(1);
  fallo = false;
  await page.goto(url + "?modo=actualizacion");
  await archivos();
  await page.getByRole("button", { name: "1. Analizar y conciliar" }).click();
  await expect(
    page.getByRole("heading", { name: "Cambios respecto de la última carga" }),
  ).toBeVisible();
  for (const t of tablas)
    expect(
      await page.locator(`input[name="${t}"]`).evaluate((i) => i.files.length),
    ).toBe(1);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "2. Confirmar actualización" })
    .click();
  await expect(
    page.getByText(
      "Actualización confirmada. Consulta inventario, clientes y notas.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2. Confirmar actualización" }),
  ).toHaveCount(0);
  conflicto = true;
  await page.reload();
  await archivos();
  await page.getByRole("button", { name: "1. Analizar y conciliar" }).click();
  await expect(
    page.getByText(/Cambió también en la web nueva: fisico/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2. Confirmar actualización" }),
  ).toHaveCount(0);
  console.log(
    "Correcto: analizar→confirmar conserva cuatro CSV; cambiar archivo invalida simulación; error HTTP visible sin perder archivos; actualización con revisión y conflictos bloqueados. API simulada, sin escrituras en Supabase.",
  );
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await new Promise((done) =>
    server.exitCode !== null ? done() : server.once("exit", done),
  );
  await rm(fixture, { recursive: true, force: true });
}
