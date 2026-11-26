// Interfaz y endpoints reales, sesión/DB simuladas. No escribe en Supabase.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/rapida-"));
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
        "@/lib/pdf-publico": ["./datos.ts"],
        "@/app/actions": ["./acciones.ts"],
        "@/app/clientes-actions": ["./clientes-actions.ts"],
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
  "(privado)/facturacion/page.tsx",
  "(privado)/facturacion/nueva/page.tsx",
  "(privado)/facturacion/[id]/page.tsx",
  "(privado)/clientes/[id]/page.tsx",
  "(privado)/clientes/page.tsx",
  "(privado)/inventario/[id]/page.tsx",
  "api/gestion/route.ts",
  "(privado)/clientes/nuevo/page.tsx",
  "(privado)/inventario/pendientes/page.tsx",
  "api/facturacion/buscar/route.ts",
  "api/facturacion/rapida/route.ts",
  "api/facturacion/producto/route.ts",
  "api/clientes/abonar/route.ts",
  "api/clientes/abonos/corregir/route.ts",
  "api/clientes/abonos/historial/route.ts",
  "api/clientes/[id]/documento/route.ts",
  "compartir/pdf/[token]/route.ts",
  "api/inventario/pendientes/route.ts",
  "api/facturacion/[id]/imprimir/route.ts",
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
  '"use server";export async function salir(){};export async function anularVenta(){};export async function emitirVenta(){};export async function guardarProducto(){};export async function ajustarStock(){};export async function guardarClasificacion(){};export async function guardarCompatibilidad(){};export async function eliminarCompatibilidad(){};',
);
await mkdir(join(dir, "assets/fonts"), { recursive: true });
for (const f of ["OpenSans-Regular.ttf", "OpenSans-Bold.ttf"])
  await writeFile(
    join(dir, "assets/fonts", f),
    await readFile(join(repo, "assets/fonts", f)),
  );
const stateFile = join(dir, "estado.json"),
  rolFile = join(dir, "rol.json");
const clienteId = "11111111-1111-4111-8111-111111111111",
  variante = "33333333-3333-4333-8333-333333333333";
await writeFile(rolFile, JSON.stringify("administrador"));
await writeFile(
  stateFile,
  JSON.stringify({
    clientes: [
      {
        id: clienteId,
        nombre: "Cliente de crédito de prueba",
        documento: "PRUEBA",
        telefono: "",
        direccion: "",
      },
    ],
    productos: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        variante_id: variante,
        nombre: "Faro Toyota de muestra",
        precio: "60",
        disponible: "10",
      },
    ],
    ventas: [],
    pendientes: [],
    abonos: [],
  }),
);
await writeFile(
  join(dir, "clientes-actions.ts"),
  "// @ts-nocheck\n" +
    (await readFile(join(repo, "src/app/clientes-actions.ts"), "utf8")),
);
await writeFile(
  join(dir, "datos.ts"),
  `// @ts-nocheck -- datos sintéticos
import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import Decimal from 'decimal.js';
const archivo=${JSON.stringify(stateFile)},roles=${JSON.stringify(rolFile)};
const perfil=async()=>({rol:JSON.parse(await readFile(roles,'utf8')),nombre:'Admin de prueba'});
async function rpc(n,args={}){const e=JSON.parse(await readFile(archivo,'utf8'));const guardar=()=>writeFile(archivo,JSON.stringify(e));const pag=(filas)=>({filas,total:filas.length,pagina:1,paginas:1});
if(n==='mi_perfil')return {data:await perfil()};
if(n==='configuracion_facturacion')return {data:{version:11,version_rapida:18,descontar_stock:false}};
if(n==='buscar_clientes')return {data:pag(e.clientes.filter(c=>c.activo!==false&&(!args.p.q||c.nombre.toLowerCase().includes(args.p.q.toLowerCase()))).map(c=>({...c,saldo:'0'})))};
if(n==='editar_cliente'){Object.assign(e.clientes.find(c=>c.id===args.p.id),args.p);await guardar();return {data:args.p.id};}
if(n==='retirar_cliente'){e.clientes.find(c=>c.id===args.p.id).activo=false;await guardar();return {data:null};}
if(n==='ficha_producto'){const a=e.productos.find(a=>a.id===args.p_id);return {data:a?{...a,activo:true,fisico:a.disponible,reservado:'0',costo:null,minimo:'0'}:null};}
if(n==='listar_compatibilidades')return {data:pag([])};
if(n==='clasificacion_producto')return {data:null};
if(n==='kardex')return {data:pag((e.movimientos||[]).filter(m=>m.producto===args.p_id).slice().reverse())};
if(n==='mover_existencia'){const a=e.productos.find(a=>a.id===args.p.id),antes=a.disponible,delta=new Decimal(args.p.cantidad).times(args.p.tipo==='entrada'?1:-1);a.disponible=new Decimal(antes).plus(delta).toFixed();e.movimientos??=[];e.movimientos.push({id:args.p.clave,producto:a.id,antes,saldo:a.disponible,cantidad:delta.toFixed(),usuario:'Admin de prueba',creado:new Date().toISOString(),motivo:args.p.motivo});await guardar();return {data:null};}
if(n==='registrar_producto_pendiente'){const p=args.p,q=e.pendientes.find(q=>q.linea_id===p.linea);e.productos.push({id:p.linea,variante_id:p.linea,nombre:p.nombre,precio:p.precio,disponible:p.stock});e.pendientes=e.pendientes.filter(q=>q.linea_id!==p.linea);await guardar();return {data:p.linea};}

if(n==='buscar_productos')return {data:pag(e.productos.filter(a=>!args.p.q||a.nombre.toLowerCase().includes(args.p.q.toLowerCase())))};
if(n==='documento_cuenta_pdf'){const r=await rpc('estado_cliente',{p_id:args.p_cliente});return {data:{...r.data,generado:new Date().toISOString()}};}
if(n==='guardar_pdf_compartido'){e.pdfs??=[];const p={id:randomUUID(),token:args.p_token,nombre:args.p_nombre,base64:args.p_base64,vence:new Date(Date.now()+7*86400000).toISOString()};e.pdfs.push(p);await guardar();return {data:{id:p.id,vence:p.vence}};}
if(n==='leer_pdf_compartido'){const p=e.pdfs?.find(p=>p.token===args.p_token&&!p.revocado&&new Date(p.vence).getTime()>Date.now());return {data:p?{nombre:p.nombre,base64:p.base64}:null};}
if(n==='revocar_pdf_compartido'){e.pdfs.find(p=>p.id===args.p_id).revocado=true;await guardar();return {data:null};}
if(n==='ficha_venta')return {data:e.ventas.find(v=>v.id===args.p_id)};
if(n==='emitir_factura_rapida'){
 const p=args.p,previo=e.ventas.find(v=>v.id===p.id);if(previo)return {data:p.id};
 const lineas=p.lineas.map((l,i)=>({...l,id:randomUUID(),orden:i+1,importe:new Decimal(l.cantidad).times(l.precio).toFixed()})),total=lineas.reduce((s,l)=>s.plus(l.importe),new Decimal(0)).toFixed();
 const c=e.clientes.find(c=>c.id===p.cliente_id)||{nombre:p.cliente_contado?.nombre||'Consumidor final',documento:p.cliente_contado?.documento||'',telefono:p.cliente_contado?.telefono||'',direccion:''};
 const v={...p,cliente:c,numero:e.ventas.length+1,estado:'confirmada',version:2,total,subtotal:total,descontar_stock:false,pagado:p.abono,saldo:new Decimal(total).minus(p.abono).toFixed(),creado:'2026-11-23T15:00:00Z',emitido:'2026-11-23T15:00:00Z',lineas,pagos:new Decimal(p.abono).gt(0)?[{tipo:'cobro',monto:p.abono,metodo:p.metodo_pago,creado:'2026-11-23T15:00:00Z'}]:[]};e.ventas.push(v);
 for(const l of lineas)if(l.clase_linea==='producto_pendiente')e.pendientes.push({linea_id:l.id,venta_id:v.id,numero:v.numero,cliente:c.nombre,descripcion:l.descripcion,cantidad:l.cantidad,precio:l.precio,importe:l.importe});await guardar();return {data:p.id};}
if(n==='buscar_ventas'){const filas=e.ventas.map(v=>({...v,cliente:v.cliente.nombre,fecha:v.emitido}));return {data:{version_operacion:20,...pag(filas),resumen:{facturado:filas.reduce((s,v)=>s.plus(v.total),new Decimal(0)).toFixed(),cobrado:filas.reduce((s,v)=>s.plus(v.pagado),new Decimal(0)).toFixed(),pendiente:filas.reduce((s,v)=>s.plus(v.saldo),new Decimal(0)).toFixed(),emitidas:filas.length}}};}
if(n==='estado_cliente'){const cliente=e.clientes.find(c=>c.id===args.p_id);const vs=e.ventas.filter(v=>v.cliente_id===args.p_id),cargos=vs.reduce((s,v)=>s.plus(v.total),new Decimal(0)),abonos=vs.reduce((s,v)=>s.plus(v.pagado),new Decimal(0));const filas=vs.flatMap(v=>[{id:v.id,fecha:v.emitido,descripcion:'Factura V-'+v.numero+' · '+v.lineas.map(l=>l.descripcion).join(', '),tipo:'CARGO',importe:v.total,saldo:v.saldo},...v.pagos.map((p,i)=>({id:v.id+'-pago-'+i,fecha:p.creado,descripcion:'Abono '+p.metodo,tipo:'ABONO',importe:p.monto,saldo:v.saldo}))]);return {data:{...pag(filas),cliente,anterior:'0',final:cargos.minus(abonos).toFixed(),cargos:cargos.toFixed(),abonos:abonos.toFixed(),moneda:'USD'}};}
if(n==='guardar_cliente'){const i=e.clientes.findIndex(c=>c.id===args.p.id);if(i<0)e.clientes.push(args.p);else e.clientes[i]=args.p;await guardar();return {data:args.p.id};}
if(n==='listar_productos_sin_cargar')return {data:pag(e.pendientes)};
if(n==='vincular_producto_pendiente'){const q=e.pendientes.find(q=>q.linea_id===args.p_linea);if(q){const v=e.ventas.find(v=>v.id===q.venta_id);v.lineas.find(l=>l.id===q.linea_id).variante_id=args.p_variante;e.pendientes=e.pendientes.filter(q=>q.linea_id!==args.p_linea);}await guardar();return {data:null};}
if(n==='crear_producto_venta'){const a={id:args.p.id,variante_id:args.p.id,nombre:args.p.nombre,precio:args.p.precio,disponible:'0'};if(!e.productos.some(a=>a.id===args.p.id))e.productos.push(a);await guardar();return {data:a};}
if(n==='abonar_cuenta_cliente'){if(e.abonos.some(a=>a.id===args.p.id))return {data:args.p.id};const v=e.ventas.find(v=>v.cliente_id===args.p.cliente_id);v.pagado=new Decimal(v.pagado).plus(args.p.monto).toFixed();v.saldo=new Decimal(v.total).minus(v.pagado).toFixed();v.pagos.push({tipo:'cobro',monto:args.p.monto,metodo:args.p.metodo,creado:'2026-11-23T16:00:00Z'});e.abonos.push({...args.p,original:args.p.monto,actual:args.p.monto,correcciones:0});await guardar();return {data:args.p.id};}
if(n==='listar_abonos_cliente')return {data:pag(e.abonos.filter(a=>a.cliente_id===args.p_id).map(a=>({...a,tipo:'cuenta',moneda:'USD',editable:true,impedimento:'',creado:'2026-11-23T16:00:00Z',autor:'Admin de prueba',referencia:a.referencia||'',revision:'rev-'+a.correcciones+'-'+a.actual})))};
if(n==='historial_correcciones_abono')return {data:pag((e.correccionesAbonos||[]).filter(c=>c.origen_id===args.p_id))};
if(n==='corregir_abono_cliente'){
 const p=args.p,a=e.abonos.find(a=>a.id===p.id);if(e.correccionesAbonos?.some(c=>c.id===p.clave))return {data:p.clave};
 if(!a||a.cliente_id!==p.cliente_id)return {error:{message:'Abono no encontrado.'}};
 const v=e.ventas.find(v=>v.cliente_id===a.cliente_id),nuevo=new Decimal(p.monto),total=new Decimal(v.total);
 if(nuevo.gt(total))return {error:{message:'El abono corregido supera la deuda disponible.'}};
 const anterior=a.actual;e.correccionesAbonos??=[];e.correccionesAbonos.push({id:p.clave,origen_id:a.id,anterior,nuevo:p.monto,metodo_anterior:a.metodo,metodo:p.metodo,referencia_anterior:a.referencia||'',referencia:p.referencia,motivo:p.motivo,autor:'Admin de prueba',creado:'2026-11-26T15:00:00Z'});
 v.pagado=new Decimal(v.pagado).minus(anterior).plus(p.monto).toFixed();v.saldo=total.minus(v.pagado).toFixed();a.actual=p.monto;a.metodo=p.metodo;a.referencia=p.referencia;a.correcciones++;
 v.pagos.push({tipo:'reversion',monto:new Decimal(anterior).negated().toFixed(),metodo:'Zelle',creado:'2026-11-26T15:00:00Z'},{tipo:'cobro',monto:p.monto,metodo:p.metodo,creado:'2026-11-26T15:00:00Z'});await guardar();return {data:p.clave};}
throw new Error('RPC no simulada '+n);}
const db={rpc,auth:{getUser:async()=>({data:{user:{id:'44444444-4444-4444-8444-444444444444'}}})}};
export function conexionPublicaPdf(){return db;}export async function conexion(){return db;}export async function sesion(){return {db,perfil:await perfil()};}export async function consultar(n,p={}){const r=await rpc(n,p);if(r.error)throw new Error(r.error.message);return r.data;}
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
    limite = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base + "/facturacion")).ok) break;
    } catch {}
    if (Date.now() > limite) throw new Error(logs.slice(-5000));
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
  await page.goto(base + "/facturacion");
  await page
    .locator("main")
    .getByRole("link", { name: "Registrar venta", exact: true })
    .click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByText("Observaciones, descuento y autorizaciones", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator("tr[data-fila]")).toHaveCount(15);
  await page
    .getByLabel("Nombre (opcional)", { exact: true })
    .fill("Comprador de mostrador");
  await page
    .getByRole("combobox", { name: "Producto o servicio fila 1", exact: true })
    .focus();
  await page.getByRole("option", { name: /Faro Toyota de muestra/ }).click();
  await expect(page.getByLabel("Precio fila 1", { exact: true })).toHaveValue(
    "60",
  );
  await page.getByLabel("Precio fila 1", { exact: true }).fill("70");
  await page.getByLabel("Cantidad fila 1", { exact: true }).fill("3");
  for (let i = 2; i <= 15; i++) {
    await page
      .getByRole("combobox", {
        name: "Producto o servicio fila " + i,
        exact: true,
      })
      .fill("Artículo de prueba " + i);
    await page.getByLabel("Cantidad fila " + i, { exact: true }).fill("2");
    await page.getByLabel("Precio fila " + i, { exact: true }).fill(String(i));
  }
  await page
    .locator('tr[data-fila="14"]')
    .getByRole("button", { name: "Producto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar 5 filas", exact: true })
    .click();
  await expect(page.locator("tr[data-fila]")).toHaveCount(20);
  await page
    .getByRole("combobox", { name: "Producto o servicio fila 20", exact: true })
    .fill("Producto extra de prueba");
  await page.getByLabel("Precio fila 20", { exact: true }).fill("5");
  await page.getByLabel("Cantidad fila 2", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByLabel("Cantidad fila 3", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("combobox", {
      name: "Producto o servicio fila 3",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Precio fila 3", { exact: true })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("Precio fila 2", { exact: true })).toBeFocused();
  await page
    .getByLabel("Método de pago", { exact: true })
    .selectOption("Binance");
  await expect(page.locator(".rapida-total")).toContainText("453");
  await page.getByLabel("Generar factura al registrar la venta").check();
  await page
    .getByRole("button", { name: "Revisar venta", exact: true })
    .click();
  expect(JSON.parse(await readFile(stateFile, "utf8")).ventas).toHaveLength(0);
  await page
    .getByRole("button", { name: "Registrar venta y ver factura", exact: true })
    .click();
  await page.waitForURL(/facturacion\/[a-f0-9-]{36}$/);
  let e = JSON.parse(await readFile(stateFile, "utf8"));
  expect(e.ventas).toHaveLength(1);
  expect(e.ventas[0].cliente_id).toBe(null);
  expect(e.clientes).toHaveLength(1);
  expect(e.ventas[0].total).toBe("453");
  expect(e.ventas[0].lineas).toHaveLength(16);
  expect(e.pendientes).toHaveLength(14);
  expect(e.productos[0].precio).toBe("60");
  await expect(
    page.getByRole("link", { name: /Ver cuenta e historial/ }),
  ).toHaveCount(0);
  const cash = e.ventas[0].id;
  const imprimir = await page.request.get(
    base + "/api/facturacion/" + cash + "/imprimir",
  );
  expect(imprimir.ok()).toBeTruthy();
  expect(await imprimir.text()).toContain("Comprador de mostrador");
  await page.goto(base + "/inventario/pendientes");
  await expect(
    page.getByRole("heading", { name: "Productos sin cargar", exact: true }),
  ).toBeVisible();
  const tarjeta = page.locator("article.producto").first();
  await tarjeta
    .getByText("Completar producto en inventario", { exact: true })
    .click();
  await tarjeta
    .getByText("Vincular producto existente", { exact: true })
    .click();
  await tarjeta
    .getByRole("combobox", { name: "Añadir producto", exact: true })
    .focus();
  await tarjeta.getByRole("option", { name: /Faro Toyota/ }).click();
  await tarjeta
    .getByRole("button", { name: "Vincular y completar", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        JSON.parse(await readFile(stateFile, "utf8")).pendientes.length,
    )
    .toBe(13);
  expect(JSON.parse(await readFile(stateFile, "utf8")).ventas[0].total).toBe(
    "453",
  );
  const directo = page.locator("article.producto").first();
  await directo
    .getByText("Completar producto en inventario", { exact: true })
    .click();
  await directo.getByLabel("Stock físico actual", { exact: true }).fill("8");
  await directo.getByLabel("Precio de venta USD", { exact: true }).fill("40");
  await directo
    .getByRole("button", { name: "Agregar al inventario", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        JSON.parse(await readFile(stateFile, "utf8")).pendientes.length,
    )
    .toBe(12);
  expect(
    JSON.parse(await readFile(stateFile, "utf8")).productos.at(-1).disponible,
  ).toBe("8");
  await page.goto(base + "/clientes/nuevo");
  await page
    .getByLabel("Nombre del cliente", { exact: true })
    .fill("Cuenta nueva de prueba");
  await page
    .getByRole("button", {
      name: "Crear cuenta y cargar productos",
      exact: true,
    })
    .click();
  await page.waitForURL(/clientes\/[a-f0-9-]{36}\?accion=cargo/);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Producto o servicio fila 1", exact: true })
    .fill("Pieza para crédito");
  await page.getByLabel("Cantidad fila 1", { exact: true }).fill("3");
  await page.getByLabel("Precio fila 1", { exact: true }).fill("70");
  await page
    .getByRole("button", { name: "Revisar cargo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar cargo a la cuenta", exact: true })
    .click();
  await page.waitForURL(/clientes\/.*guardado=1/);
  await expect(
    page.getByRole("heading", { name: "Historial completo", exact: true }),
  ).toBeVisible();
  e = JSON.parse(await readFile(stateFile, "utf8"));
  expect(e.clientes).toHaveLength(2);
  expect(e.ventas[1].condicion).toBe("credito");
  expect(e.ventas[1].total).toBe("210");
  expect(e.ventas[1].pagado).toBe("0");
  await expect(page.getByLabel("Desde", { exact: true })).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar filtros del historial", exact: true })
    .click();
  await expect(page.getByLabel("Desde", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Registrar abono", exact: true })
    .click();
  await page.getByLabel("Monto USD", { exact: true }).fill("50");
  await page.getByLabel("Método", { exact: true }).selectOption("Zelle");
  await page
    .getByRole("button", { name: "Revisar abono", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar abono recibido", exact: true })
    .click();
  await expect
    .poll(
      async () => JSON.parse(await readFile(stateFile, "utf8")).ventas[1].saldo,
    )
    .toBe("160");
  const cuentaActual = e.ventas[1].cliente_id;
  await page.getByRole("link", { name: "Editar abonos", exact: true }).click();
  const panelAbonos = page.locator("#abonos-del-cliente");
  await panelAbonos
    .getByRole("button", { name: "Editar abono", exact: true })
    .click();
  const editarAbono = page.getByRole("dialog", {
    name: "Corregir abono",
    exact: true,
  });
  await editarAbono
    .getByLabel("Monto correcto USD", { exact: true })
    .fill("999");
  await editarAbono
    .getByLabel("Método correcto", { exact: true })
    .selectOption("Binance");
  await editarAbono.getByLabel("Referencia", { exact: true }).fill("PRUEBA");
  await editarAbono
    .getByLabel("Motivo de corrección", { exact: true })
    .fill("Se cargó un importe incorrecto de prueba");
  await editarAbono
    .getByRole("button", { name: "Revisar corrección", exact: true })
    .click();
  await editarAbono
    .getByRole("button", { name: "Confirmar corrección", exact: true })
    .click();
  await expect(editarAbono.getByRole("alert")).toContainText("supera");
  await expect(
    editarAbono.getByLabel("Monto correcto USD", { exact: true }),
  ).toHaveValue("999");
  await editarAbono
    .getByLabel("Monto correcto USD", { exact: true })
    .fill("30");
  await editarAbono
    .getByRole("button", { name: "Revisar corrección", exact: true })
    .click();
  await editarAbono
    .getByRole("button", { name: "Confirmar corrección", exact: true })
    .click();
  await expect(editarAbono).not.toBeVisible();
  await expect
    .poll(
      async () => JSON.parse(await readFile(stateFile, "utf8")).ventas[1].saldo,
    )
    .toBe("180");
  expect(JSON.parse(await readFile(stateFile, "utf8")).abonos[0].original).toBe(
    "50",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await panelAbonos
      .getByRole("button", { name: "Editar abono", exact: true })
      .click();
    if ((await editarAbono.locator("details").getAttribute("open")) === null)
      await editarAbono.getByText(/Historial de correcciones/).click();
    await expect(
      editarAbono.getByText("Se cargó un importe incorrecto de prueba", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: "/tmp/alexmar-abonos-" + width + ".png",
      fullPage: true,
    });
    await editarAbono
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/clientes/" + cuentaActual);

  await page
    .getByRole("button", { name: "Generar factura", exact: true })
    .click();
  const pdfDialogo = page.getByRole("dialog", {
    name: "Generar PDF del cliente",
    exact: true,
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (d) => Boolean(d.files?.[0]),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d) => {
        window.archivoCompartido = {
          tipo: d.files[0].type,
          nombre: d.files[0].name,
          tamano: d.files[0].size,
        };
      },
    });
  });
  await pdfDialogo
    .getByRole("button", { name: "Generar PDF", exact: true })
    .click();
  const ver = pdfDialogo.getByRole("link", { name: "Ver PDF", exact: true });
  await expect(ver).toBeVisible();
  const pdfRuta = await ver.getAttribute("href");
  expect(pdfRuta).toMatch(/^\/compartir\/pdf\/[a-f0-9]{64}$/);
  const pdfReal = await page.request.get(base + pdfRuta);
  expect(pdfReal.headers()["content-type"]).toBe("application/pdf");
  expect((await pdfReal.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfReal.headers()["cache-control"]).toContain("no-store");
  await expect(
    pdfDialogo.getByRole("link", { name: "Enviar por WhatsApp", exact: true }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/\?text=/);
  expect(
    decodeURIComponent(
      await pdfDialogo
        .getByRole("link", { name: "Enviar por WhatsApp", exact: true })
        .getAttribute("href"),
    ),
  ).toContain(pdfRuta);
  await pdfDialogo
    .getByRole("button", { name: "Compartir archivo PDF", exact: true })
    .click();
  expect(await page.evaluate(() => window.archivoCompartido.tipo)).toBe(
    "application/pdf",
  );
  await pdfDialogo
    .getByRole("button", { name: "Desactivar enlace", exact: true })
    .click();
  await expect(ver).toHaveCount(0);
  expect((await page.request.get(base + pdfRuta)).status()).toBe(404);
  const ajena = await page.request.post(
    base + "/api/clientes/" + cuentaActual + "/documento",
    { headers: { origin: base }, data: { factura: cash } },
  );
  expect(ajena.status()).toBe(404);
  await pdfDialogo.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.goto(base + "/clientes/" + clienteId);
  await page.getByRole("button", { name: "Editar datos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Cliente editado de prueba");
  await page.getByLabel("Teléfono", { exact: true }).fill("000-DEMO");
  await page
    .getByRole("button", { name: "Guardar datos", exact: true })
    .click();
  await expect(page.locator("main h1")).toHaveText("Cliente editado de prueba");
  await expect(
    page.locator(".franja").getByRole("link", { name: /factura|venta/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Historial de facturas del cliente", { exact: true }),
  ).toBeVisible();
  await page.goto(base + "/clientes");
  const buscar = page.getByLabel("Buscar cliente", { exact: true });
  await buscar.pressSequentially("editado", { delay: 35 });
  await expect(page).toHaveURL(/q=editado/);
  await expect(page.locator("a.producto")).toHaveCount(1);
  await expect(buscar).toBeFocused();
  await expect(buscar).toHaveValue("editado");
  await page.getByRole("link", { name: /Cliente editado de prueba/ }).click();
  await page
    .getByRole("button", { name: "Eliminar cliente", exact: true })
    .click();
  const retiro = page.getByRole("dialog", {
    name: "Eliminar cliente",
    exact: true,
  });
  await retiro.getByRole("checkbox").check();
  await retiro
    .getByRole("button", { name: "Confirmar eliminación", exact: true })
    .click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(
    page.getByRole("link", { name: /Cliente editado de prueba/ }),
  ).toHaveCount(0);
  await page.goto(base + "/inventario/22222222-2222-4222-8222-222222222222");
  await page
    .getByRole("button", { name: "Agregar unidades", exact: true })
    .click();
  const movimiento = page.getByRole("dialog", {
    name: "Agregar unidades",
    exact: true,
  });
  await movimiento.getByLabel("Cantidad", { exact: true }).fill("5");
  await movimiento
    .getByLabel("Motivo", { exact: true })
    .fill("Ingreso de prueba");
  await movimiento
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(movimiento).not.toBeVisible();
  await expect(
    page.getByText("Ingreso de prueba", { exact: true }),
  ).toBeVisible();
  expect(
    JSON.parse(await readFile(stateFile, "utf8")).productos[0].disponible,
  ).toBe("15");
  await page
    .getByRole("link", { name: "Registrar venta", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", {
      name: "Producto o servicio fila 1",
      exact: true,
    }),
  ).toHaveValue("Faro Toyota de muestra");
  await page
    .getByRole("button", { name: "Revisar venta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar venta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/facturacion\?guardado=1/);
  expect(JSON.parse(await readFile(stateFile, "utf8")).ventas).toHaveLength(3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/facturacion/nueva");
    await expect(
      page.getByLabel("Cantidad fila 1", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: "/tmp/alexmar-rapida-" + width + ".png",
      fullPage: true,
      caret: "initial",
    });
    await page.evaluate(
      () => (document.documentElement.dataset.tema = "oscuro"),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await writeFile(rolFile, JSON.stringify("lectura"));
  const denegado = await page.request.post(base + "/api/facturacion/rapida", {
    headers: { origin: base },
    data: {},
  });
  expect(denegado.status()).toBe(403);
  expect(
    (
      await page.request.post(base + "/api/clientes/abonos/corregir", {
        headers: { origin: base },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(
        base + "/api/clientes/abonos/historial?tipo=cuenta&id=" + clienteId,
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(base + "/api/gestion", {
        headers: { origin: base },
        data: { accion: "retirar_cliente", datos: { id: clienteId } },
      })
    ).status(),
  ).toBe(403);
  await page.goto(base + "/inventario/pendientes");
  await expect(
    page.getByRole("heading", { name: "Productos sin cargar", exact: true }),
  ).toHaveCount(0);
  expect(errores).toEqual([]);
  console.log(
    "Facturación rápida: 15/20 filas, teclado, catálogo/precio editable, productos pendientes con alta directa y stock real, servicio, búsqueda viva, editar/retirar cliente, entrada de existencias, venta desde inventario, contado sin cuenta, crédito con alta, abono/corrección con original intacto, error sin perder campos, historial, PDF real compartido/WhatsApp, revocación, factura ajena denegada, permisos y 1440/390. Backend simulado.",
  );
} catch (e) {
  console.error(logs.slice(-3500));
  if (browser?.contexts()[0]?.pages()[0])
    console.error(
      (
        await browser.contexts()[0].pages()[0].locator("body").innerText()
      ).slice(0, 2500),
    );
  throw e;
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((r) => child.once("exit", r));
  await rm(dir, { recursive: true, force: true });
}
