// Recorrido del código de la aplicación con cliente, API y DB simulados.
// No conecta a Supabase ni escribe operaciones reales.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { join, resolve, dirname, relative } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/facturacion-"));
for (const sub of [
  "app/facturacion/nueva",
  "app/facturacion/[id]",
  "app/api/facturacion/buscar",
  "app/api/facturacion/guardar",
  "app/api/facturacion/[id]/imprimir",
])
  await mkdir(join(dir, sub), { recursive: true });
await writeFile(join(dir, "package.json"), "{}");
await writeFile(
  join(dir, "jsconfig.json"),
  JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["../../src/*"] } },
  }),
);
await writeFile(
  join(dir, "next.config.mjs"),
  `export default {turbopack:{root:${JSON.stringify(repo)}}};`,
);
await writeFile(
  join(dir, "app/globals.css"),
  await readFile(join(repo, "src/app/globals.css")),
);
await writeFile(
  join(dir, "app/layout.jsx"),
  'import "./globals.css";import {Navegacion} from "./navegacion";export default function Layout({children}){return <html lang="es"><body><div className="estructura"><aside className="barra"><strong>ALEXMAR</strong><Navegacion rol="administrador"/></aside><div className="contenido"><main>{children}</main></div></div></body></html>}',
);
const copiar = async (dest, src, reemplazos = []) => {
  let s = await readFile(join(repo, src), "utf8");
  for (const [a, b] of reemplazos) s = s.replaceAll(a, b);
  for (const modulo of ["formatos", "ventas", "origen"]) {
    let destino = relative(dirname(join(dir, dest)), join(dir, "app", modulo));
    if (!destino.startsWith(".")) destino = "./" + destino;
    s = s.replaceAll("@/lib/" + modulo, destino);
  }
  await writeFile(
    join(dir, dest),
    "// @ts-nocheck -- fixture con sesión y backend simulados\n" + s,
  );
};
await copiar("app/origen.ts", "src/lib/origen.ts");
await copiar("app/formatos.ts", "src/lib/formatos.ts");
await copiar("app/ventas.ts", "src/lib/ventas.ts");
await copiar("app/editor-venta.tsx", "src/components/editor-venta.tsx");
await copiar("app/navegacion.tsx", "src/components/navegacion.tsx");
await copiar("app/comunes.tsx", "src/components/comunes.tsx");
await copiar("app/actions.ts", "src/app/actions.ts", [
  ["@/lib/supabase", "./datos"],
]);
for (const sub of ["page.tsx", "nueva/page.tsx", "[id]/page.tsx"]) {
  const nivel = sub === "page.tsx" ? "../" : "../../";
  await copiar(
    "app/facturacion/" + sub,
    "src/app/(privado)/facturacion/" + sub,
    [
      ["@/lib/supabase", nivel + "datos"],
      ["@/components/comunes", nivel + "comunes"],
      ["@/components/editor-venta", nivel + "editor-venta"],
      ["@/app/actions", nivel + "actions"],
    ],
  );
}
await copiar(
  "app/api/facturacion/buscar/route.ts",
  "src/app/api/facturacion/buscar/route.ts",
  [["@/lib/supabase", "../../../datos"]],
);
await copiar(
  "app/api/facturacion/guardar/route.ts",
  "src/app/api/facturacion/guardar/route.ts",
  [["@/lib/supabase", "../../../datos"]],
);
await copiar(
  "app/api/facturacion/[id]/imprimir/route.ts",
  "src/app/api/facturacion/[id]/imprimir/route.ts",
  [["@/lib/supabase", "../../../../datos"]],
);
const stateFile = join(dir, "estado.json");
await writeFile(stateFile, JSON.stringify({ doc: null, emisiones: 0 }));
await writeFile(
  join(dir, "app/datos.ts"),
  `// @ts-nocheck -- backend simulado, únicamente datos inventados
import {readFile,writeFile} from 'node:fs/promises';import DecimalBase from 'decimal.js';const Decimal=DecimalBase.clone({precision:128});
const archivo=${JSON.stringify(stateFile)};
async function rpc(nombre,args={}){const estado=JSON.parse(await readFile(archivo,'utf8'));if(nombre==='mi_perfil')return {data:{rol:'administrador',nombre:'Prueba'},error:null};
if(nombre==='buscar_clientes')return {data:{filas:[{id:'11111111-1111-4111-8111-111111111111',nombre:'Cliente de muestra',documento:'PRUEBA'}],total:1,pagina:1,paginas:1},error:null};
if(nombre==='buscar_productos')return {data:{filas:[{id:'22222222-2222-4222-8222-222222222222',variante_id:'33333333-3333-4333-8333-333333333333',nombre:'Producto de muestra',precio:'10.25',disponible:'8'}],total:1,pagina:1,paginas:1},error:null};
if(nombre==='guardar_venta'){const p=args.p;const lineas=p.lineas.map((l,i)=>({...l,id:String(i),importe:new Decimal(l.cantidad).times(l.precio).toFixed()}));const subtotal=lineas.reduce((s,l)=>s.plus(l.importe),new Decimal(0)).toFixed();estado.doc={...p,numero:null,estado:'borrador',version:1,subtotal,total:new Decimal(subtotal).minus(p.descuento).toFixed(),creado:'2026-11-15T12:00:00Z',emitido:null,cliente:{nombre:'Cliente de muestra',documento:'PRUEBA',telefono:'',direccion:''},lineas,pagos:[]};await writeFile(archivo,JSON.stringify(estado));return {data:p.id,error:null};}
if(nombre==='ficha_venta')return {data:estado.doc,error:null};
if(nombre==='emitir_venta'){if(estado.doc.estado!=='confirmada'){estado.doc.estado='confirmada';estado.doc.numero=1;estado.doc.emitido='2026-11-15T12:00:00Z';estado.emisiones++;}await writeFile(archivo,JSON.stringify(estado));return {data:args.p_id,error:null};}
if(nombre==='buscar_ventas')return {data:{filas:estado.doc?[{...estado.doc,cliente:estado.doc.cliente.nombre}]:[],total:estado.doc?1:0,pagina:1,paginas:1},error:null};throw new Error('RPC inesperada '+nombre);}
export async function conexion(){return {rpc,auth:{getUser:async()=>({data:{user:{id:'44444444-4444-4444-8444-444444444444'}}})}};}
export async function sesion(){return {perfil:{rol:'administrador',nombre:'Prueba'},db:await conexion()};}
`,
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
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
  const plazo = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base + "/facturacion")).ok) break;
    } catch {}
    if (Date.now() > plazo) throw new Error(logs.slice(-3000));
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto(base + "/facturacion");
  await expect(
    page.getByRole("link", { name: "Importación", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Facturación", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Importar archivos", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Nueva factura", exact: true }).click();
  await page.waitForURL("**/facturacion/nueva");
  await page.getByRole("button", { name: /Cliente de muestra/ }).click();
  await page.getByRole("button", { name: /Producto de muestra/ }).click();
  await page
    .getByRole("textbox", { name: "Cantidad 1", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Añadir servicio", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Descripción 2", exact: true })
    .fill("Instalación <demo>");
  await page
    .getByRole("textbox", { name: "Precio 2", exact: true })
    .fill("3.50");
  await page.getByRole("textbox", { name: /Pago inicial USD/ }).fill("5");
  await page.getByLabel("Método del pago inicial").selectOption("Efectivo");
  const guardado = page.waitForResponse((r) =>
    r.url().includes("/api/facturacion/guardar"),
  );
  await page
    .getByRole("button", { name: "Guardar y revisar borrador" })
    .click();
  const rGuardado = await guardado;
  if (!rGuardado.ok())
    throw new Error(
      "Guardar borrador: " +
        rGuardado.status() +
        " " +
        (await rGuardado.text()),
    );
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/facturacion/") &&
      url.pathname.split("/").at(-1).length === 36,
  );
  await expect(
    page.getByRole("heading", { name: "Borrador", exact: true }),
  ).toBeVisible();
  let estado = JSON.parse(await readFile(stateFile, "utf8"));
  expect(estado.emisiones).toBe(0);
  expect(estado.doc.total).toBe("24");
  expect(estado.doc.lineas.length).toBe(2);
  await page.screenshot({
    path: "/tmp/alexmar-factura-borrador.png",
    fullPage: true,
  });
  await page
    .locator('form:has(button:text("Emitir factura")) input[name="confirmar"]')
    .check();
  await page
    .getByRole("button", { name: "Emitir factura", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "V-000001", exact: true }),
  ).toBeVisible();
  estado = JSON.parse(await readFile(stateFile, "utf8"));
  expect(estado.emisiones).toBe(1);
  expect(estado.doc.estado).toBe("confirmada");
  const respuesta = await page.request.get(
    base + "/api/facturacion/" + estado.doc.id + "/imprimir",
  );
  expect(respuesta.status()).toBe(200);
  const html = await respuesta.text();
  expect(html).toContain("Instalación &lt;demo&gt;");
  expect(html).not.toContain("Instalación <demo>");
  for (const [ancho, alto, nombre] of [
    [1440, 1000, "escritorio"],
    [390, 844, "movil"],
  ]) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.reload();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Desbordamiento horizontal");
    await page.screenshot({
      path: "/tmp/alexmar-factura-" + nombre + ".png",
      fullPage: true,
    });
  }
  expect(errores).toEqual([]);
  console.log(
    "Facturación navegador: menú con Importar archivos temporal para administrador; cliente/producto/servicio; borrador revisado antes de emitir; impresión con HTML escapado; 1440/390 px sin errores ni desbordamiento. Sesión/DB simuladas, sin operaciones reales.",
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
