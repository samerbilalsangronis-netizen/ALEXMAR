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
  "app/clientes/[id]",
  "app/configuracion",
  "app/api/facturacion/cobrar",
  "app/api/facturacion/cliente",
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
  for (const modulo of [
    "formatos",
    "ventas",
    "origen",
    "documento-factura",
    "accesos",
  ]) {
    let destino = relative(dirname(join(dir, dest)), join(dir, "app", modulo));
    if (!destino.startsWith(".")) destino = "./" + destino;
    s = s.replaceAll("@/lib/" + modulo, destino);
  }
  let aviso = relative(
    dirname(join(dir, dest)),
    join(dir, "app/activar-facturacion"),
  );
  if (!aviso.startsWith(".")) aviso = "./" + aviso;
  s = s.replaceAll("@/components/activar-facturacion", aviso);
  let anular = relative(
    dirname(join(dir, dest)),
    join(dir, "app/anular-factura"),
  );
  if (!anular.startsWith(".")) anular = "./" + anular;
  s = s.replaceAll("@/components/anular-factura", anular);
  for (const [mod, pref] of [
    ["crear-personal", "components"],
    ["crear-identidad", "lib"],
  ]) {
    let r = relative(dirname(join(dir, dest)), join(dir, "app", mod));
    if (!r.startsWith(".")) r = "./" + r;
    s = s.replaceAll("@/" + pref + "/" + mod, r);
  }
  await writeFile(
    join(dir, dest),
    "// @ts-nocheck -- fixture con sesión y backend simulados\n" + s,
  );
};
await copiar(
  "app/activar-facturacion.tsx",
  "src/components/activar-facturacion.tsx",
);
await copiar("app/accesos.ts", "src/lib/accesos.ts");
await copiar("app/crear-personal.tsx", "src/components/crear-personal.tsx");
await copiar("app/crear-identidad.ts", "src/lib/crear-identidad.ts");
await copiar("app/origen.ts", "src/lib/origen.ts");
await copiar("app/formatos.ts", "src/lib/formatos.ts");
await copiar("app/ventas.ts", "src/lib/ventas.ts");
await copiar("app/documento-factura.ts", "src/lib/documento-factura.ts");
await copiar("app/tabla-facturas.tsx", "src/components/tabla-facturas.tsx");
await copiar("app/cobro-factura.tsx", "src/components/cobro-factura.tsx");
await copiar("app/anular-factura.tsx", "src/components/anular-factura.tsx", [
  ["@/app/actions", "./actions"],
]);
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
      ["@/components/tabla-facturas", nivel + "tabla-facturas"],
      ["@/components/cobro-factura", nivel + "cobro-factura"],
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
await copiar(
  "app/clientes/[id]/page.tsx",
  "src/app/(privado)/clientes/[id]/page.tsx",
  [
    ["@/lib/supabase", "../../datos"],
    ["@/components/tabla-facturas", "../../tabla-facturas"],
    ["@/components/comunes", "../../comunes"],
  ],
);
for (const ruta of ["cobrar", "cliente"])
  await copiar(
    "app/api/facturacion/" + ruta + "/route.ts",
    "src/app/api/facturacion/" + ruta + "/route.ts",
    [["@/lib/supabase", "../../../datos"]],
  );
await mkdir(join(dir, "public"), { recursive: true });
await writeFile(
  join(dir, "public/logo-alexmar-sin-telefono.png"),
  await readFile(join(repo, "public/logo-alexmar-sin-telefono.png")),
);
await copiar(
  "app/configuracion/page.tsx",
  "src/app/(privado)/configuracion/page.tsx",
  [
    ["@/lib/supabase", "../datos"],
    ["@/components/comunes", "../comunes"],
    ["@/app/actions", "../actions"],
  ],
);
const stateFile = join(dir, "estado.json");
await writeFile(stateFile, JSON.stringify({ doc: null, emisiones: 0 }));
await writeFile(
  join(dir, "app/datos.ts"),
  `// @ts-nocheck -- backend simulado, únicamente datos inventados
import {readFile,writeFile} from 'node:fs/promises';import DecimalBase from 'decimal.js';const Decimal=DecimalBase.clone({precision:128});
const archivo=${JSON.stringify(stateFile)};
async function rpc(nombre,args={}){const estado=JSON.parse(await readFile(archivo,'utf8'));if(nombre==='configuracion_facturacion')return {data:{version:11,moneda:'USD',descontar_stock:estado.stock??false,version_stock:estado.version_stock??1},error:null};if(nombre==='mi_perfil')return {data:{rol:'administrador',nombre:'Prueba'},error:null};
const cliente={id:'11111111-1111-4111-8111-111111111111',nombre:'Cliente de muestra',documento:'PRUEBA',telefono:'',direccion:''};
if(nombre==='configurar_descuento_stock'){estado.stock=args.p_activo;estado.version_stock=(estado.version_stock||1)+1;await writeFile(archivo,JSON.stringify(estado));return {data:null,error:null};}
if(nombre==='estado_control_acceso'||nombre==='historial_accesos')return {data:null,error:{code:'PGRST202',message:'Módulo de accesos no simulado en este recorrido'}};if(nombre==='listar_perfiles')return {data:[{id:'44444444-4444-4444-8444-444444444444',nombre:'Prueba',rol:'administrador',activo:true}],error:null};
if(nombre==='anular_factura_revisada'){estado.doc.estado='anulada';estado.doc.motivo_anulacion=args.p_motivo;estado.doc.pagado='0';estado.doc.saldo='0';estado.anulaciones=(estado.anulaciones||0)+1;await writeFile(archivo,JSON.stringify(estado));return {data:null,error:null};}
if(nombre==='buscar_clientes')return {data:{filas:[cliente],total:1,pagina:1,paginas:1},error:null};
if(nombre==='buscar_productos')return {data:{filas:[{id:'22222222-2222-4222-8222-222222222222',variante_id:'33333333-3333-4333-8333-333333333333',nombre:'Filtro Toyota de muestra',precio:'10.25',disponible:'8'}],total:1,pagina:1,paginas:1},error:null};
if(nombre==='guardar_cliente')return {data:args.p.id,error:null};
if(nombre==='guardar_venta'||nombre==='guardar_borrador_factura'||nombre==='emitir_factura'){const p=args.p;const lineas=p.lineas.map((l,i)=>({...l,id:String(i),importe:new Decimal(l.cantidad).times(l.precio).toFixed()}));const subtotal=lineas.reduce((s,l)=>s.plus(l.importe),new Decimal(0)).toFixed();const emite=nombre==='emitir_factura';estado.doc={...p,descontar_stock:estado.stock??false,numero:emite?1:null,estado:emite?'confirmada':'borrador',version:emite?2:1,subtotal,total:new Decimal(subtotal).minus(p.descuento).toFixed(),pagado:emite?p.abono:'0',saldo:emite?new Decimal(subtotal).minus(p.descuento).minus(p.abono).toFixed():'0',creado:'2026-11-22T12:00:00Z',emitido:emite?'2026-11-22T12:00:00Z':null,cliente,lineas,pagos:emite&&new Decimal(p.abono).gt(0)?[{tipo:'cobro',monto:p.abono,metodo:p.metodo_pago,creado:'2026-11-22T12:00:00Z'}]:[]};if(emite)estado.emisiones++;await writeFile(archivo,JSON.stringify(estado));return {data:p.id,error:null};}
if(nombre==='ficha_venta')return {data:estado.doc,error:null};
if(nombre==='emitir_venta'){if(estado.doc.estado!=='confirmada'){estado.doc.estado='confirmada';estado.doc.numero=1;estado.doc.emitido='2026-11-22T12:00:00Z';estado.doc.pagado=estado.doc.abono;estado.doc.saldo=new Decimal(estado.doc.total).minus(estado.doc.pagado).toFixed();estado.doc.pagos=[{tipo:'cobro',monto:estado.doc.abono,metodo:estado.doc.metodo_pago,creado:estado.doc.emitido}];estado.emisiones++;}await writeFile(archivo,JSON.stringify(estado));return {data:args.p_id,error:null};}
if(nombre==='cobrar_factura'){if(estado.claves?.includes(args.p.idempotencia))return {data:args.p.idempotencia,error:null};estado.claves??=[];estado.claves.push(args.p.idempotencia);estado.doc.pagado=new Decimal(estado.doc.pagado).plus(args.p.monto).toFixed();estado.doc.saldo=new Decimal(estado.doc.total).minus(estado.doc.pagado).toFixed();estado.doc.pagos.push({tipo:'cobro',monto:args.p.monto,metodo:args.p.metodo,creado:'2026-11-22T12:10:00Z'});await writeFile(archivo,JSON.stringify(estado));return {data:args.p.idempotencia,error:null};}
if(nombre==='buscar_ventas')return {data:{filas:estado.doc?[{...estado.doc,fecha:estado.doc.emitido||estado.doc.creado,cliente:cliente.nombre,cliente_id:cliente.id}]:[],total:estado.doc?1:0,pagina:1,paginas:1,resumen:{facturado:estado.doc?.total||'0',cobrado:estado.doc?.pagado||'0',pendiente:estado.doc?.saldo||'0',emitidas:estado.emisiones}},error:null};
if(nombre==='estado_cliente'||nombre==='historial_cliente_anterior')return {data:{cliente,moneda:'USD',anterior:'0',final:nombre==='estado_cliente'?new Decimal(100).plus(estado.doc?.saldo||0).toFixed():'100',cargos:'120',abonos:'20',filas:[{id:'historico-1',fecha:'2026-11-01T12:00:00Z',descripcion:'Faro original del sistema anterior',tipo:'CARGO',importe:'120',saldo:'120'}],total:1,pagina:1,paginas:1},error:null};
throw new Error('RPC inesperada '+nombre);}
export async function conexion(){return {rpc,auth:{getUser:async()=>({data:{user:{id:'44444444-4444-4444-8444-444444444444'}}})}};}
export async function sesion(){return {perfil:{rol:'administrador',nombre:'Prueba'},db:await conexion()};}
export async function consultar(nombre,args){const r=await rpc(nombre,args);if(r.error)throw new Error(r.error.message);return r.data;}

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
  await page.getByRole("combobox", { name: "Buscar cliente" }).focus();
  await page
    .getByRole("combobox", { name: "Buscar cliente" })
    .press("ArrowDown");
  await page.getByRole("combobox", { name: "Buscar cliente" }).press("Enter");
  await expect(page.locator(".factura-cliente-elegido")).toContainText(
    "Cliente de muestra",
  );
  await page
    .getByRole("combobox", { name: "Añadir producto" })
    .fill("filt toy");
  await page.getByRole("option", { name: /Filtro Toyota/ }).click();
  await page
    .getByRole("textbox", { name: "Cantidad Filtro Toyota de muestra" })
    .fill("2");
  await expect(page.locator(".factura-barra")).toContainText("20,50");
  await expect(
    page.getByRole("radio", { name: "Contado", exact: true }),
  ).toBeChecked();
  // Cliente nuevo se guarda sin abandonar el formulario ni perder las piezas.
  await page
    .getByRole("button", { name: "+ Cliente nuevo", exact: true })
    .click();
  await page
    .getByLabel("Nombre del cliente", { exact: true })
    .fill("Cliente de muestra");
  await page.getByRole("button", { name: "Guardar y seleccionar" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".factura-barra")).toContainText("20,50");
  await page.getByRole("button", { name: /Añadir servicio/ }).click();
  await page
    .getByRole("textbox", { name: "Descripción servicio 2" })
    .fill("Instalación <demo>");
  await page.getByRole("textbox", { name: "Precio servicio 2" }).fill("3.50");
  await page.getByRole("radio", { name: "Crédito", exact: true }).check();
  await page.getByLabel("Abono inicial USD").fill("5");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.split("/").at(-1)?.length === 36);
  await expect(
    page.getByRole("heading", { name: "Borrador", exact: true }),
  ).toBeVisible();
  let estado = JSON.parse(await readFile(stateFile, "utf8"));
  expect(estado.emisiones).toBe(0);
  expect(estado.doc.total).toBe("24");
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
  await expect(page.locator(".papel-factura")).toContainText("Tovar · Mérida");
  await expect(
    page.getByRole("heading", { name: "Registrar cobro" }),
  ).toBeVisible();
  for (const [importe, restante] of [
    ["7", "12"],
    ["7", "5"],
    ["5", "0"],
  ]) {
    await page.getByLabel("Monto USD", { exact: true }).fill(importe);
    await page
      .getByRole("button", { name: "Revisar cobro", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cobro recibido" })
      .click();
    await expect
      .poll(async () => JSON.parse(await readFile(stateFile, "utf8")).doc.saldo)
      .toBe(restante);
    if (restante !== "0")
      await expect(page.getByLabel("Monto USD", { exact: true })).toHaveValue(
        restante,
      );
  }
  estado = JSON.parse(await readFile(stateFile, "utf8"));
  expect(new Set(estado.claves).size).toBe(3);
  await expect(
    page.getByRole("heading", { name: "Registrar cobro" }),
  ).toHaveCount(0);
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
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      caret: "initial",
      path: "/tmp/alexmar-factura-" + nombre + ".png",
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: /Ver cuenta e historial/ }).click();
  await page
    .getByRole("link", { name: "Historial del sistema anterior", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Faro original del sistema anterior" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "CSV completo" }),
  ).toHaveAttribute("href", /origen=anterior/);
  await page.goto(base + "/facturacion");
  await expect(page.locator(".factura-estado")).toContainText("Pagada");
  await page.getByRole("link", { name: "Anular", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await page
    .getByRole("link", { name: "← Volver a facturación", exact: true })
    .click();
  await page.getByRole("link", { name: "Nueva factura", exact: true }).click();
  await page.getByRole("combobox", { name: "Buscar cliente" }).focus();
  await page.getByRole("option", { name: /Cliente de muestra/ }).click();
  await page.getByRole("combobox", { name: "Añadir producto" }).focus();
  await page.getByRole("option", { name: /Filtro Toyota/ }).click();
  await page
    .getByRole("button", { name: "Revisar y emitir", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revisa tu factura" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar y emitir" }).click();
  await page.waitForURL((url) => url.pathname.split("/").at(-1)?.length === 36);
  estado = JSON.parse(await readFile(stateFile, "utf8"));
  expect(estado.doc.condicion).toBe("contado");
  expect(estado.doc.pagado).toBe(estado.doc.total);
  await page
    .getByRole("button", { name: "Anular factura", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Motivo de anulación").fill("Venta de prueba anulada");
  await page.locator('input[name="reembolso"]').check();
  await page.locator('input[name="confirmar"]').check();
  await page
    .getByRole("button", { name: "Confirmar anulación", exact: true })
    .click();
  await expect(page.locator(".papel-aviso")).toContainText("ANULADA");
  expect(JSON.parse(await readFile(stateFile, "utf8")).anulaciones).toBe(1);
  await page.goto(base + "/configuracion");
  const control = page.getByRole("checkbox", {
    name: "Descontar inventario al facturar",
  });
  await expect(control).not.toBeChecked();
  await control.check();
  await page
    .getByRole("button", { name: "Guardar configuración de inventario" })
    .click();
  await expect(page.locator('input[name="version_stock"]')).toHaveValue("2");
  await expect(control).toBeChecked();
  await control.uncheck();
  await page
    .getByRole("button", { name: "Guardar configuración de inventario" })
    .click();
  await expect(page.locator('input[name="version_stock"]')).toHaveValue("3");
  await expect(control).not.toBeChecked();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/facturacion/nueva");
  await expect(page.locator(".factura-stock-aviso")).toContainText(
    "Descuento de inventario desactivado",
  );
  await page.screenshot({
    caret: "initial",
    path: "/tmp/alexmar-editor-escritorio.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-tema", "oscuro"),
  );
  await page.screenshot({
    caret: "initial",
    path: "/tmp/alexmar-editor-oscuro.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    caret: "initial",
    path: "/tmp/alexmar-editor-movil.png",
    fullPage: true,
  });
  expect(errores).toEqual([]);
  console.log(
    "Facturación: teclado, búsqueda por palabras, cliente nuevo sin perder líneas, precio automático, contado/crédito, borrador y emisión directa revisada, cobro, historia separada, impresión escapada y 1440/390 claro/oscuro. DB simulada, sin operaciones reales.",
  );
} catch (e) {
  console.error(logs.slice(-6000));
  const fallo = browser?.contexts()[0]?.pages()[0];
  if (fallo)
    console.error((await fallo.locator("body").innerText()).slice(0, 3000));
  throw e;
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
