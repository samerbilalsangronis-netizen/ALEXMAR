// Interfaz y endpoints reales, sesión/DB simuladas. No escribe en Supabase.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/notas-"));
await writeFile(join(dir, "package.json"), "{}");
await writeFile(
  join(dir, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      skipLibCheck: true,
      strict: false,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      resolveJsonModule: true,
      paths: {
        "@/lib/supabase": ["./datos.ts"],
        "@/app/actions": ["./acciones.ts"],
        "@/app/notas-actions": ["./notas-actions.ts"],
        "@/*": ["../../src/*"],
      },
    },
    include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }),
);
await writeFile(
  join(dir, "next.config.mjs"),
  `export default {turbopack:{root:${JSON.stringify(repo)}}}`,
);
for (const path of [
  "layout.tsx",
  "globals.css",
  "(privado)/layout.tsx",
  "(privado)/notas/page.tsx",
]) {
  const destino = join(dir, "app", path);
  await mkdir(destino.slice(0, destino.lastIndexOf("/")), { recursive: true });
  await writeFile(
    destino,
    (path.endsWith("tsx") || path.endsWith(".ts")
      ? "// @ts-nocheck -- fixture sintética\n"
      : "") + (await readFile(join(repo, "src/app", path), "utf8")),
  );
}
await mkdir(join(dir, "public"), { recursive: true });
await writeFile(
  join(dir, "public/logo-alexmar-sin-telefono.png"),
  await readFile(join(repo, "public/logo-alexmar-sin-telefono.png")),
);
await writeFile(
  join(dir, "acciones.ts"),
  '"use server";export async function salir(){};',
);
const estadoFile = join(dir, "estado.json"),
  rolFile = join(dir, "rol.json"),
  falloFile = join(dir, "fallo.json");
await writeFile(
  estadoFile,
  JSON.stringify([
    {
      id: "77777777-7777-4777-8777-777777777777",
      titulo: "Nota anterior",
      contenido: "Texto histórico <script>window.notaInsegura=true</script>",
    },
  ]),
);
await writeFile(rolFile, JSON.stringify("administrador"));
await writeFile(falloFile, "false");
await writeFile(
  join(dir, "datos.ts"),
  `// @ts-nocheck -- sesión/DB sintéticas de navegador
import {readFile,writeFile} from 'node:fs/promises';
const archivo=${JSON.stringify(estadoFile)},rol=${JSON.stringify(rolFile)},fallo=${JSON.stringify(falloFile)};
async function perfil(){return {rol:JSON.parse(await readFile(rol,'utf8')),nombre:'Admin de prueba'}}
const db={rpc:async(n,args)=>{
 const notas=JSON.parse(await readFile(archivo,'utf8'));
 if(n==='listar_notas') return {data:{filas:notas,total:notas.length,pagina:1,paginas:1}};
 if(n==='eliminar_nota'){const siguientes=notas.filter(x=>x.id!==args.p_id);await writeFile(archivo,JSON.stringify(siguientes));return {data:null};}
 if(n==='guardar_nota'){
  if(JSON.parse(await readFile(fallo,'utf8'))) return {error:{message:'Fallo simulado de guardado. Reintenta.'}};
  if((await perfil()).rol!=='administrador')return {error:{message:'Sin permiso'}};
  const i=notas.findIndex(x=>x.id===args.p.id);if(i>=0)notas[i]=args.p;else notas.unshift(args.p);
  await writeFile(archivo,JSON.stringify(notas));return {data:args.p.id};
 }
 throw new Error('RPC no simulada '+n);
}};
export async function sesion(){return {db,perfil:await perfil()}};
`,
);
await writeFile(
  join(dir, "notas-actions.ts"),
  "// @ts-nocheck\n" +
    (await readFile(join(repo, "src/app/notas-actions.ts"), "utf8")),
);
const sock = createServer();
await new Promise((r) => sock.listen(0, "127.0.0.1", r));
const port = sock.address().port;
await new Promise((r) => sock.close(r));
const child = spawn(
  process.execPath,
  [
    join(repo, "node_modules/next/dist/bin/next"),
    "dev",
    "--port",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  { cwd: dir, detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
let browser;
try {
  const base = "http://127.0.0.1:" + port,
    ruta = "/notas";
  const limite = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base + ruta)).ok) break;
    } catch {}
    if (Date.now() > limite) throw new Error(logs.slice(-4000));
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /hydration|did not match|cannot be a descendant/.test(m.text())
    )
      errores.push(m.text());
  });
  await page.goto(base + ruta);
  await expect(page.getByText("Nota anterior", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.notaInsegura)).toBeUndefined();
  await page.getByRole("link", { name: "Nueva nota", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nueva nota", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Título de la nota", { exact: true })
    .fill("Pendientes de prueba");
  const hoja = page.getByRole("textbox", {
    name: "Contenido de la nota",
    exact: true,
  });
  await hoja.fill("Comprar filtros Toyota");
  async function seleccionar(texto) {
    await hoja.evaluate((el, t) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const i = n.textContent.indexOf(t);
        if (i >= 0) {
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + t.length);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
          return;
        }
      }
      throw new Error("Texto no encontrado");
    }, texto);
  }
  await seleccionar("filtros");
  await page
    .getByLabel("Color de letra", { exact: true })
    .selectOption("#b42318");
  await seleccionar("filtros");
  await page
    .getByLabel("Resaltar texto", { exact: true })
    .selectOption("#fff1a8");
  await seleccionar("Toyota");
  await page.getByRole("button", { name: "Negrita", exact: true }).click();
  await hoja.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  });
  await page.getByText("Agregar sticker", { exact: true }).click();
  await page
    .getByRole("button", { name: "Sticker Estrella", exact: true })
    .click();
  await expect(hoja).toContainText("⭐");
  await writeFile(falloFile, "true");
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Fallo simulado");
  await expect(hoja).toContainText("Comprar filtros Toyota");
  await expect(
    page.getByLabel("Título de la nota", { exact: true }),
  ).toHaveValue("Pendientes de prueba");
  await writeFile(falloFile, "false");
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await page.waitForURL(/guardado=1/);
  const guardadas = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(guardadas).toHaveLength(2);
  const contenido = JSON.parse(
    guardadas[0].contenido.split("\n").slice(1).join("\n"),
  );
  expect(
    contenido.fragmentos.some(
      (f) =>
        f.texto.includes("filtros") &&
        f.color === "#b42318" &&
        f.fondo === "#fff1a8",
    ),
  ).toBeTruthy();
  expect(
    contenido.fragmentos.some((f) => f.texto.includes("Toyota") && f.negrita),
  ).toBeTruthy();
  expect(contenido.fragmentos.some((f) => f.texto.includes("⭐"))).toBeTruthy();
  const tarjeta = page.locator("article.nota").filter({
    has: page.getByRole("heading", { name: "Pendientes de prueba" }),
  });
  await expect(
    tarjeta.locator("span").filter({ hasText: "filtros" }).last(),
  ).toHaveCSS("color", "rgb(180, 35, 24)");
  await tarjeta
    .getByRole("link", { name: "Abrir y editar", exact: true })
    .click();
  await expect(hoja).toContainText("⭐");
  await expect(hoja).toContainText("Comprar filtros Toyota");
  await expect(
    hoja.locator("span").filter({ hasText: "filtros" }).last(),
  ).toHaveCSS("background-color", "rgb(255, 241, 168)");
  // Pegado HTML se reduce a texto; nunca se inserta una imagen ni se ejecutan scripts.
  await hoja.evaluate((el) => {
    const d = new DataTransfer();
    d.setData("text/plain", " texto pegado");
    d.setData("text/html", '<img src=x onerror="window.notaInsegura=true">');
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: d,
      }),
    );
  });
  await expect(hoja.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.notaInsegura)).toBeUndefined();
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await page.waitForURL(/guardado=1/);
  expect(JSON.parse(await readFile(estadoFile, "utf8"))).toHaveLength(2);
  const anterior = page.locator("article.nota").filter({
    has: page.getByRole("heading", { name: "Nota anterior", exact: true }),
  });
  await anterior
    .getByRole("button", { name: "Eliminar nota", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Eliminar nota", exact: true })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(anterior).toBeVisible();
  await anterior
    .getByRole("button", { name: "Eliminar nota", exact: true })
    .click();
  const eliminar = page.getByRole("dialog", {
    name: "Eliminar nota",
    exact: true,
  });
  await eliminar.getByRole("checkbox").check();
  await eliminar
    .getByRole("button", { name: "Confirmar eliminación", exact: true })
    .click();
  await expect(anterior).toHaveCount(0);
  expect(JSON.parse(await readFile(estadoFile, "utf8"))).toHaveLength(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/notas?nueva=1");
    await expect(hoja).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: join(repo, "test-results", "nota-hoja-" + width + ".png"),
      fullPage: true,
      caret: "initial",
    });
    await page.evaluate(
      () => (document.documentElement.dataset.tema = "oscuro"),
    );
    await expect(hoja).toHaveCSS("color", "rgb(23, 43, 58)");
  }
  const antes = await readFile(estadoFile, "utf8");
  await writeFile(rolFile, JSON.stringify("lectura"));
  await page.goto(base + "/notas?nueva=1");
  await expect(hoja).toHaveCount(0);
  expect(await readFile(estadoFile, "utf8")).toBe(antes);
  if (errores.length) throw new Error(errores.join("\\n"));
  console.log(
    "Notas: nueva hoja, formato, colores/resaltado, sticker, error sin pérdida, persistencia/reapertura, edición sin duplicar, pegado seguro, permisos y 1440/390 claro/oscuro. Backend simulado.",
  );
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((r) => child.once("exit", r));
  await rm(dir, { recursive: true, force: true });
}
