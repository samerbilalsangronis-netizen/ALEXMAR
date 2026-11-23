// Interfaz y endpoints reales, sesión/DB simuladas. No escribe en Supabase.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/compras-"));
const proveedor = "66666666-6666-4666-8666-666666666666";
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
        "@/lib/compra-api": ["./compra-api.ts"],
        "@/app/actions": ["./acciones.ts"],
        "@/app/compras-actions": ["./compras-actions.ts"],
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
  "(privado)/proveedores/page.tsx",
  "(privado)/proveedores/[id]/page.tsx",
  "(privado)/proveedores/[id]/recepciones/nueva/page.tsx",
  "(privado)/proveedores/[id]/recepciones/[compra]/page.tsx",
  "api/compras/buscar/route.ts",
  "api/compras/recibir/route.ts",
  "api/compras/pagar/route.ts",
  "api/compras/precio/route.ts",
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
  '"use server";export async function salir(){};export async function guardarProveedor(){};',
);
await writeFile(
  join(dir, "compras-actions.ts"),
  "// @ts-nocheck\n" +
    (await readFile(join(repo, "src/app/compras-actions.ts"), "utf8")),
);
await writeFile(
  join(dir, "compra-api.ts"),
  "// @ts-nocheck\n" +
    (await readFile(join(repo, "src/lib/compra-api.ts"), "utf8"))
      .replace('"./supabase"', '"./datos"')
      .replace('"./origen"', '"../../src/lib/origen"'),
);
const estadoFile = join(dir, "estado.json"),
  rolFile = join(dir, "rol.json");
await writeFile(rolFile, JSON.stringify("administrador"));
await writeFile(
  estadoFile,
  JSON.stringify({
    productos: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        variante_id: "88888888-8888-4888-8888-888888888888",
        nombre: "Starlink de muestra",
        costo: "60",
        precio: "150",
        fisico: "2",
        disponible: "2",
        referencia: "PRUEBA",
      },
    ],
    compras: {},
    pagos: [],
  }),
);
await writeFile(
  join(dir, "datos.ts"),
  `// @ts-nocheck
import {readFile,writeFile} from 'node:fs/promises';import Decimal from 'decimal.js';
const archivo=${JSON.stringify(estadoFile)},archivoRol=${JSON.stringify(rolFile)},proveedor=${JSON.stringify(proveedor)};
const datosProveedor={id:proveedor,nombre:'Proveedor de Starlink de prueba',documento:'PRUEBA',activo:true,monedas:['USD'],telefono:''};
const perfil=async()=>({rol:JSON.parse(await readFile(archivoRol,'utf8')),nombre:'Usuario de prueba'});
function doc(e,id){const c=e.compras[id];if(!c)return null;const pagos=e.pagos.filter(p=>p.compra_id===id);const pagado=pagos.filter(p=>!p.anulado).reduce((s,p)=>s.plus(p.monto),new Decimal(0)).toFixed();return {...c,pagado,saldo:c.estado==='anulada'?'0':new Decimal(c.total).minus(pagado).toFixed(),lineas:c.lineas.map(l=>({...l,precio_venta:e.productos.find(a=>a.variante_id===l.variante_id).precio})),pagos:{filas:pagos,total:pagos.length,pagina:1,paginas:1}};}
async function rpc(n,args={}){const e=JSON.parse(await readFile(archivo,'utf8'));
if(n==='mi_perfil')return {data:await perfil(),error:null};
if(n==='buscar_productos')return {data:{filas:e.productos.filter(a=>!args.p.q||a.nombre.toLowerCase().includes(args.p.q.toLowerCase())),total:e.productos.length,pagina:1,paginas:1},error:null};
if(n==='buscar_proveedores')return {data:{filas:[datosProveedor],total:1,pagina:1,paginas:1},error:null};
if(n==='ficha_compra')return {data:doc(e,args.p_id),error:null};
if(n==='ficha_proveedor_compras'){
const compras=Object.keys(e.compras).map(id=>doc(e,id));const comprado=compras.filter(c=>c.estado==='confirmada').reduce((s,c)=>s.plus(c.total),new Decimal(0));const pagado=e.pagos.filter(p=>!p.anulado).reduce((s,p)=>s.plus(p.monto),new Decimal(0));const productos=e.productos.filter(a=>compras.some(c=>c.lineas.some(l=>l.variante_id===a.variante_id))).map(a=>({id:a.variante_id,producto_id:a.id,nombre:a.nombre,cantidad_recibida:compras.flatMap(c=>c.lineas).filter(l=>l.variante_id===a.variante_id).reduce((s,l)=>s.plus(l.cantidad),new Decimal(0)).toFixed(),ultimo_costo:a.costo,precio_venta:a.precio,ultima_recepcion:'2026-11-17T15:00:00Z'}));return {data:{proveedor:datosProveedor,resumen:{comprado:comprado.toFixed(),pagado:pagado.toFixed(),saldo:comprado.minus(pagado).toFixed()},compras:{filas:compras,total:compras.length,pagina:1,paginas:1},productos:{filas:productos,total:productos.length,pagina:1,paginas:1}},error:null};}
if(n==='asignar_precio_venta'){const a=e.productos.find(a=>a.id===args.p.producto_id);a.precio=args.p.precio;await writeFile(archivo,JSON.stringify(e));return {data:a.id,error:null};}
if(n==='recibir_compra'){
const p=args.p;if(e.compras[p.id])return {data:p.id,error:null};let total=new Decimal(0);const lineas=p.lineas.map((l,i)=>{let a=e.productos.find(a=>a.variante_id===l.variante_id);if(!a){a={id:l.nuevo.id,variante_id:l.nuevo.id,nombre:l.nuevo.nombre,precio:null,costo:null,fisico:'0',disponible:'0',referencia:''};e.productos.push(a);}a.costo=l.costo_unitario;a.fisico=new Decimal(a.fisico).plus(l.cantidad).toFixed();a.disponible=a.fisico;const importe=new Decimal(l.cantidad).times(l.costo_unitario).toFixed();total=total.plus(importe);return {id:String(i),orden:i+1,variante_id:a.variante_id,producto_id:a.id,descripcion:a.nombre,cantidad:l.cantidad,costo_unitario:l.costo_unitario,importe,precio_venta:a.precio};});e.compras[p.id]={id:p.id,version:1,numero:Object.keys(e.compras).length+1,proveedor_id:proveedor,proveedor_snapshot:datosProveedor,referencia:p.referencia,total:total.toFixed(),moneda:'USD',estado:'confirmada',creado:'2026-11-17T15:00:00Z',observaciones:p.observaciones,lineas};await writeFile(archivo,JSON.stringify(e));return {data:p.id,error:null};}
if(n==='pagar_compra'){const p=args.p;if(!e.pagos.some(x=>x.id===p.id)){if(new Decimal(p.monto).gt(doc(e,p.compra_id).saldo))return {data:null,error:{message:'El pago supera el saldo pendiente.'}};e.compras[p.compra_id].version++;e.pagos.push({...p,creado:'2026-11-17T15:00:00Z'});await writeFile(archivo,JSON.stringify(e));}return {data:p.id,error:null};}
if(n==='editar_compra'){
const p=args.p,c=e.compras[p.id];if(c.version!==p.version)return {error:{message:'La orden cambió. Recarga y revisa los datos antes de guardar.'}};
const total=p.lineas.reduce((s,l)=>s.plus(new Decimal(l.cantidad).times(l.costo_unitario)),new Decimal(0));if(total.lt(doc(e,c.id).pagado))return {error:{message:'El total no puede quedar por debajo de los abonos vigentes.'}};
for(const x of p.lineas){const l=c.lineas.find(l=>l.id===x.id),a=e.productos.find(a=>a.variante_id===l.variante_id);a.fisico=new Decimal(a.fisico).plus(x.cantidad).minus(l.cantidad).toFixed();a.costo=x.costo_unitario;l.cantidad=x.cantidad;l.costo_unitario=x.costo_unitario;l.importe=new Decimal(x.cantidad).times(x.costo_unitario).toFixed();}
c.total=total.toFixed();c.referencia=p.referencia;c.observaciones=p.observaciones;c.version++;await writeFile(archivo,JSON.stringify(e));return {data:null,error:null};}
if(n==='corregir_pago_compra'){
const p=args.p,c=e.compras[p.compra_id],pg=e.pagos.find(x=>x.id===p.id);if(c.version!==p.version)return {error:{message:'La orden cambió. Recarga y revisa los datos antes de guardar.'}};
if(p.accion==='anular')pg.anulado=true;else {pg.monto=p.monto;pg.metodo=p.metodo;pg.referencia=p.referencia;}c.version++;await writeFile(archivo,JSON.stringify(e));return {data:null,error:null};}
if(n==='anular_orden_compra'){
const c=e.compras[args.p_id];for(const l of c.lineas){const a=e.productos.find(a=>a.variante_id===l.variante_id);a.fisico=new Decimal(a.fisico).minus(l.cantidad).toFixed();}c.estado='anulada';c.motivo_anulacion=args.p_motivo;c.version++;for(const pg of e.pagos.filter(p=>p.compra_id===c.id))pg.anulado=true;await writeFile(archivo,JSON.stringify(e));return {data:null,error:null};}
throw new Error('RPC no simulada '+n);}
const db={rpc,auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})}};
export async function conexion(){return db;}export async function sesion(){return {db,perfil:await perfil()};}export async function consultar(n,p={}){const d=await rpc(n,p);return d.data;}
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
  const base = "http://127.0.0.1:" + port,
    ruta = "/proveedores/" + proveedor;
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
  await page
    .getByRole("link", { name: "Recibir mercancía", exact: true })
    .click();
  await page.getByRole("button", { name: /Starlink de muestra/ }).click();
  await page.getByLabel("Cantidad recibida 1", { exact: true }).fill("5");
  await page.getByLabel("Costo unitario 1", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Revisar recepción", exact: true })
    .click();
  let e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(e.productos[0].fisico).toBe("2");
  expect(Object.keys(e.compras)).toHaveLength(0);
  await expect(
    page.getByRole("button", {
      name: "Confirmar recepción y deuda",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /Confirmo que recibí/ }).check();
  await page
    .getByRole("button", { name: "Confirmar recepción y deuda", exact: true })
    .click();
  await page.waitForURL(/\/recepciones\/[a-f0-9-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Recepción C-000001" }),
  ).toBeVisible();
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(e.productos[0].fisico).toBe("7");
  expect(e.productos[0].costo).toBe("100");
  expect(e.productos[0].precio).toBe("150");
  expect(Object.values(e.compras)[0].total).toBe("500");
  await page.getByText("Registrar pago al proveedor", { exact: true }).click();
  await page.getByLabel("Importe pagado USD").fill("200");
  await page
    .getByLabel("Método del pago", { exact: true })
    .selectOption("Transferencia");
  await page
    .getByRole("checkbox", {
      name: "Confirmo que este pago se realizó al proveedor.",
    })
    .check();
  const pago = page.waitForResponse((r) =>
    r.url().endsWith("/api/compras/pagar"),
  );
  await page
    .getByRole("button", { name: "Registrar pago realizado", exact: true })
    .click();
  expect((await pago).ok()).toBeTruthy();
  await expect(page.locator(".indicadores article").last()).toContainText(
    "300",
  );
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(e.pagos).toHaveLength(1);
  expect(e.productos[0].fisico).toBe("7");
  await page
    .getByRole("link", { name: "Cuenta del proveedor", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Starlink de muestra", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Recibir mercancía", exact: true })
    .click();
  await page
    .getByText("¿No existe todavía? Crear producto nuevo", { exact: true })
    .click();
  await page
    .getByLabel("Nombre del producto nuevo")
    .fill("Kit Starlink nuevo de muestra");
  await page.getByLabel("Categoría o etiqueta").fill("Conectividad");
  await page
    .getByRole("button", { name: "Añadir producto nuevo", exact: true })
    .click();
  await page.getByLabel("Cantidad recibida 1", { exact: true }).fill("5");
  await page.getByLabel("Costo unitario 1", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Revisar recepción", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Confirmo que recibí/ }).check();
  await page
    .getByRole("button", { name: "Confirmar recepción y deuda", exact: true })
    .click();
  await page.waitForURL(/\/recepciones\/[a-f0-9-]{36}$/);
  await expect(
    page.getByRole("link", { name: "Asignar precio de venta →", exact: true }),
  ).toBeVisible();
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(
    e.productos.find((p) => p.nombre === "Kit Starlink nuevo de muestra")
      .precio,
  ).toBe(null);
  expect(
    e.productos.find((p) => p.nombre === "Kit Starlink nuevo de muestra")
      .fisico,
  ).toBe("5");
  await page
    .getByLabel("Precio de venta USD · Kit Starlink nuevo de muestra", {
      exact: true,
    })
    .fill("150");
  const precio = page.waitForResponse((r) =>
    r.url().endsWith("/api/compras/precio"),
  );
  await page
    .getByRole("button", { name: "Guardar precio de venta", exact: true })
    .click();
  expect((await precio).ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", {
      name: "Pendiente de precio de venta",
      exact: true,
    }),
  ).toHaveCount(0);
  const conPrecio = JSON.parse(
    await readFile(estadoFile, "utf8"),
  ).productos.find((p) => p.nombre === "Kit Starlink nuevo de muestra");
  expect(conPrecio.precio).toBe("150");
  expect(conPrecio.costo).toBe("100");
  expect(conPrecio.fisico).toBe("5");
  // Edición con acciones reales y errores que conservan los valores escritos.
  const orden = page.locator("#editar-orden");
  await orden.locator("summary").click();
  await orden.getByLabel("Cantidad", { exact: true }).fill("6");
  await orden.getByLabel("Costo unitario USD", { exact: true }).fill("110");
  await orden
    .getByLabel("Motivo de la corrección")
    .fill("Corregir recepción de prueba");
  await orden
    .getByRole("button", { name: "Guardar cambios de la orden" })
    .click();
  await expect(page.locator(".indicadores article").first()).toContainText(
    "660",
  );
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  const actualId = Object.keys(e.compras).at(-1);
  expect(e.productos.at(-1).fisico).toBe("6");
  expect(e.productos.at(-1).costo).toBe("110");
  await page.getByText("Registrar pago al proveedor", { exact: true }).click();
  await page.getByLabel("Importe pagado USD").fill("100");
  await page
    .getByLabel("Método del pago", { exact: true })
    .selectOption("Efectivo");
  await page
    .getByRole("checkbox", {
      name: "Confirmo que este pago se realizó al proveedor.",
    })
    .check();
  await page
    .getByRole("button", { name: "Registrar pago realizado", exact: true })
    .click();
  await expect(page.locator(".indicadores article").last()).toContainText(
    "560",
  );
  await orden.getByLabel("Cantidad", { exact: true }).fill("1");
  await orden.getByLabel("Costo unitario USD", { exact: true }).fill("1");
  await orden
    .getByLabel("Motivo de la corrección")
    .fill("No perder estos datos");
  await orden
    .getByRole("button", { name: "Guardar cambios de la orden" })
    .click();
  await expect(orden.getByRole("alert")).toContainText("por debajo");
  await expect(orden.getByLabel("Cantidad", { exact: true })).toHaveValue("1");
  await expect(orden.getByLabel("Motivo de la corrección")).toHaveValue(
    "No perder estos datos",
  );
  const abono = page.locator("td details").last();
  await abono.locator("summary").click();
  await abono.getByLabel("Importe correcto USD").fill("150");
  await abono.getByLabel("Método de pago").selectOption("Transferencia");
  await abono
    .getByLabel("Motivo de la corrección")
    .fill("Ajustar abono sintético");
  await abono.getByRole("checkbox").check();
  await abono
    .getByRole("button", { name: "Guardar corrección del abono" })
    .click();
  await expect(page.locator(".indicadores article").last()).toContainText(
    "510",
  );
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(e.compras[actualId].total).toBe("660");
  expect(e.pagos.at(-1).monto).toBe("150");
  if (!(await abono.getByLabel("Acción").isVisible()))
    await abono.locator("summary").click();
  await abono.getByLabel("Acción").selectOption("anular");
  await abono.getByRole("button", { name: "Anular este abono" }).click();
  await expect(page.locator(".indicadores article").last()).toContainText(
    "660",
  );
  await expect(page.getByText("Anulado", { exact: true })).toBeVisible();
  // Cerrar edición tras la corrección para revisar la vista general.
  await page.goto(page.url());
  const docUrl = page.url();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      docUrl,
      base + ruta,
      base + ruta + "/recepciones/nueva",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      if (path === docUrl) await page.locator("#editar-orden summary").click();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("Desbordamiento " + path + " " + width);
    }
    await page.goto(base + ruta);
    await page.screenshot({
      path: join(repo, "test-results", `proveedor-cuenta-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.goto(docUrl);
    await page.screenshot({
      path: join(repo, "test-results", `recepcion-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
  }
  await page.goto(docUrl);
  await page
    .getByText("Anular orden / eliminar registro de prueba", { exact: true })
    .click();
  await page
    .getByLabel("Motivo de la anulación")
    .fill("Orden de prueba sin pago real");
  await page
    .getByRole("checkbox", { name: /esta orden es incorrecta/ })
    .check();
  await page
    .getByRole("button", { name: "Anular orden y revertir", exact: true })
    .click();
  await expect(page.getByText(/Recepción anulada:/)).toBeVisible();
  e = JSON.parse(await readFile(estadoFile, "utf8"));
  expect(e.compras[actualId].estado).toBe("anulada");
  expect(e.productos.at(-1).fisico).toBe("0");
  const antes = await readFile(estadoFile, "utf8");
  const origenAjeno = await page.request.post(base + "/api/compras/recibir", {
    headers: { origin: "https://otro.example" },
    data: {},
  });
  expect(origenAjeno.status()).toBe(403);
  await writeFile(rolFile, JSON.stringify("ventas"));
  expect((await page.request.get(base + "/api/compras/buscar")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.post(base + "/api/compras/recibir", {
        headers: { origin: base },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await writeFile(rolFile, JSON.stringify("inventario"));
  expect(
    (
      await page.request.post(base + "/api/compras/pagar", {
        headers: { origin: base },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(await readFile(estadoFile, "utf8")).toBe(antes);
  if (errores.length) throw new Error(errores.join("\n"));
  console.log(
    "Compras navegador: proveedor → producto existente/nuevo → 5 × 100 → revisión sin escritura → stock y deuda 500; último costo, precio de venta pendiente, pago parcial, edición de orden/abono, error sin perder campos, anulación de abono/orden, permisos y 1440/390 sin desbordamiento. DB simulada.",
  );
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((r) => child.once("exit", r));
  await rm(dir, { recursive: true, force: true });
}
