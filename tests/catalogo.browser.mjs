import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/catalogo-"));
await mkdir(join(dir, "app/inventario"), { recursive: true });
await writeFile(join(dir, "package.json"), "{}");
await writeFile(
  join(dir, "next.config.mjs"),
  `export default {turbopack:{root:${JSON.stringify(repo)}}}`,
);
await writeFile(
  join(dir, "app/globals.css"),
  await readFile(join(repo, "src/app/globals.css")),
);
await writeFile(
  join(dir, "app/layout.jsx"),
  'import "./globals.css";export default function Layout({children}){return <html lang="es"><body><main style={{maxWidth:1200,margin:"auto",padding:20}}>{children}</main></body></html>}',
);
let page = await readFile(
  join(repo, "src/app/(privado)/inventario/page.tsx"),
  "utf8",
);
page = page
  .replace("@/lib/supabase", "./datos")
  .replace("@/lib/formatos", "../../../../src/lib/formatos")
  .replace("@/lib/catalogo", "../../../../src/lib/catalogo")
  .replace("@/components/comunes", "./comunes")
  .replace("@/app/actions", "./actions");
await writeFile(
  join(dir, "app/inventario/page.tsx"),
  "// @ts-nocheck -- fixture con datos sintéticos\n" + page,
);
await writeFile(
  join(dir, "app/inventario/comunes.tsx"),
  await readFile(join(repo, "src/components/comunes.tsx")),
);
await writeFile(
  join(dir, "app/inventario/actions.ts"),
  '"use server";export async function guardarProducto(){};export async function guardarConsulta(){};',
);
await writeFile(
  join(dir, "app/inventario/datos.ts"),
  `// @ts-nocheck -- API simulada solo para el navegador

const filas=[{id:'11111111-1111-4111-8111-111111111111',nombre:'Faro de muestra Fiesta',categoria:'Iluminación',categoria_origen:'FORD',vehiculos:['Fiesta'],precio:'20',fisico:'3',reservado:'0',disponible:'3',minimo:'1',marca:'',referencia:'MUESTRA-01',ubicacion:'Prueba',activo:true},{id:'22222222-2222-4222-8222-222222222222',nombre:'Espejo de muestra Hilux',categoria:'Espejos y retrovisores',categoria_origen:'TOYOTA',vehiculos:['Hilux'],precio:null,fisico:'0',reservado:'0',disponible:'0',minimo:'1',marca:'',referencia:'',ubicacion:'',activo:true}];
function filtrar(p){return filas.filter(a=>(!p.modelo||a.vehiculos.includes(p.modelo))&&(!p.categoria||a.categoria===p.categoria));}
export async function sesion(){return {perfil:{rol:'ventas'},db:{rpc:async(n,{p})=>p.pendiente ? {data:null,error:{code:'PGRST202',message:'Función pendiente'}}:{data:{total:filtrar(p).length,categorias:[...new Set(filtrar(p).map(a=>a.categoria))].map(nombre=>({nombre,total:filtrar(p).filter(a=>a.categoria===nombre).length})),vehiculos:[...new Set(filtrar(p).flatMap(a=>a.vehiculos))].map(nombre=>({nombre,total:filtrar(p).filter(a=>a.vehiculos.includes(nombre)).length}))},error:null}}};}
export async function consultar(n,{p}={p:{}}){if(n==='opciones_catalogo')return {categorias:['Iluminación','Espejos y retrovisores'],categorias_origen:['FORD','TOYOTA'],vehiculos:['Fiesta','Hilux'],marcas:[],consultas:[{nombre:'Mi Fiesta',filtros:'modelo=Fiesta'}]};const f=filtrar(p);return {total:f.length,pagina:1,paginas:1,filas:f};}
`,
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
  const base = "http://127.0.0.1:" + port;
  const until = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base + "/inventario")).ok) break;
    } catch {}
    if (Date.now() > until) throw new Error(logs.slice(-2200));
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await browser.newPage();
  for (const [nombre, width, height] of [
    ["escritorio", 1440, 1000],
    ["movil", 390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.goto(base + "/inventario");
    await expect(
      p.getByRole("heading", { name: "Encuentra lo que necesitas" }),
    ).toBeVisible();
    await p.getByRole("link", { name: "Por vehículo", exact: true }).click();
    await expect(
      p.getByRole("link", { name: /^Fiesta.*Ver productos/ }),
    ).toBeVisible();
    await p.getByRole("link", { name: /^Fiesta.*Ver productos/ }).click();
    await p.waitForURL("**/*modelo=Fiesta*");
    await expect(p.locator(".producto")).toHaveCount(1);
    await expect(p.locator('select[name="modelo"]')).toHaveValue("Fiesta");
    const href = await p.locator(".producto").getAttribute("href");
    if (!decodeURIComponent(href).includes("modelo=Fiesta"))
      throw new Error("Se perdió el filtro de retorno");
    if (
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    )
      throw new Error("Desbordamiento horizontal");
    await p.goto(base + "/inventario");
    await p.screenshot({
      path: "/tmp/alexmar-catalogo-" + nombre + ".png",
      fullPage: true,
    });
  }
  await p.goto(base + "/inventario?pendiente=1");
  await expect(
    p.getByText(
      "La organización por piezas y vehículos está pendiente de activar.",
    ),
  ).toBeVisible();
  await expect(p.locator(".producto")).toHaveCount(2);
  console.log(
    "Navegador: grupos categoría/vehículo, Fiesta filtrado, retorno a ficha, 1440/390 px sin desbordamiento y catálogo disponible sin SQL 005. Datos sintéticos/sesión simulada; sin conexiones a Supabase.",
  );
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((r) =>
    child.exitCode !== null ? r() : child.once("exit", r),
  );
  await rm(dir, { recursive: true, force: true });
}
