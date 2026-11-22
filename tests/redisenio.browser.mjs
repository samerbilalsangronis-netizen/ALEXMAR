// Pantallas reales con datos sintéticos. No usa Supabase ni operaciones reales.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile, rm, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/redisenio-"));
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
const paginas = {
  "layout.tsx": "layout.tsx",
  "page.tsx": "page.tsx",
  "globals.css": "globals.css",
  "(privado)/layout.tsx": "(privado)/layout.tsx",
  "(privado)/panel/page.tsx": "(privado)/panel/page.tsx",
  "(privado)/inventario/page.tsx": "(privado)/inventario/page.tsx",
  "(privado)/inventario/imagenes/page.tsx":
    "(privado)/inventario/imagenes/page.tsx",
  "(privado)/facturacion/nueva/page.tsx":
    "(privado)/facturacion/nueva/page.tsx",
  "(privado)/reportes/page.tsx": "(privado)/reportes/page.tsx",
};
for (const [dest, src] of Object.entries(paginas)) {
  const p = join(dir, "app", dest);
  await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  await writeFile(
    p,
    (dest.endsWith(".tsx") ? "// @ts-nocheck -- fixture sintética\n" : "") +
      (await readFile(join(repo, "src/app", src), "utf8")),
  );
}
await mkdir(join(dir, "public"), { recursive: true });
await cp(join(repo, "public/vehiculos"), join(dir, "public/vehiculos"), {
  recursive: true,
});
await writeFile(
  join(dir, "public/logo-alexmar-sin-telefono.png"),
  await readFile(join(repo, "public/logo-alexmar-sin-telefono.png")),
);
await writeFile(
  join(dir, "acciones.ts"),
  '"use server";export async function entrar(){};export async function salir(){};export async function guardarProducto(){};export async function guardarConsulta(){};',
);
await writeFile(
  join(dir, "datos.ts"),
  `// @ts-nocheck
import {readFile,writeFile} from 'node:fs/promises';
const fotoArchivo=${JSON.stringify(join(dir, "foto.json"))};
const perfilArchivo=${JSON.stringify(join(dir, "perfil.json"))};
const fotoPublica=${JSON.stringify(join(dir, "public/foto-prueba.png"))};
const filas=[{id:'p1',nombre:'Faro Fiesta de muestra',categoria:'Iluminación',categoria_origen:'FORD',vehiculos:['Fiesta'],precio:'25',costo:'10',fisico:'3',reservado:'0',disponible:'3',minimo:'1',marca:'',referencia:'MUESTRA',ubicacion:'A1',activo:true},{id:'p2',nombre:'Espejo NPR de muestra',categoria:'Carrocería',vehiculos:['NPR'],precio:'40',fisico:'2',reservado:'0',disponible:'2',minimo:'1',marca:'',referencia:'',ubicacion:'B2',activo:true}];
function filtrar(p){return filas.filter(a=>(!p.marca_vehiculo||(p.marca_vehiculo==='Ford'?a.id==='p1':a.id==='p2'))&&(!p.modelo||a.vehiculos.includes(p.modelo)));}
const categorias=[{nombre:'Iluminación',productos:12,costo:'800',venta:'1400',margen:'600',porcentaje:'42.857'},{nombre:'Carrocería',productos:7,costo:'320',venta:'500',margen:'180',porcentaje:'36'},{nombre:'Audio',productos:8,costo:'600',venta:'480',margen:'-120',porcentaje:'-25'}];
async function rpc(n,{p={}}={}){if(n==='rendimiento_ventas')return {data:{ahora:'2026-11-17T18:00:00Z',hoy:'2026-11-17',lunes:'2026-11-16',moneda:'USD',semana_actual:'300',semana_anterior_comparable:'200',diferencia:'100',variacion_pct:'50',facturas_semana:6,ventas_hoy:'175',dias:Array.from({length:14},(_,i)=>({fecha:new Date(Date.UTC(2026,10,4+i)).toISOString().slice(0,10),total:String(i===3?0:25+i*12.5),facturas:i===3?0:i+1})),semanas:Array.from({length:8},(_,i)=>({fecha:new Date(Date.UTC(2026,8,28+i*7)).toISOString().slice(0,10),total:String(200+i*50),facturas:i+2}))},error:null};if(n==='configuracion_facturacion')return {data:{version:11,moneda:'USD'},error:null};if(n==='buscar_clientes')return {data:{filas:[{id:'c1',nombre:'Cliente de muestra',documento:'PRUEBA'}],total:1,pagina:1,paginas:1},error:null};if(n==='buscar_productos')return {data:{filas:[{id:'p1',variante_id:'v1',nombre:'Faro de muestra',precio:'25',disponible:'3'}],total:1,pagina:1,paginas:1},error:null};if(n==='mi_perfil')return {data:JSON.parse(await readFile(perfilArchivo,'utf8')),error:null};if(n==='guardar_foto_vehiculo'){await writeFile(fotoArchivo,JSON.stringify([{nombre:arguments[1].p_nombre,archivo:arguments[1].p_archivo}]));return {data:null,error:null};}if(n==='fotos_vehiculos')return {data:JSON.parse(await readFile(fotoArchivo,'utf8')),error:null};if(n==='analitica_comercial')return {data:{desde:'2026-06-01',hasta:'2026-11-17',inventario:{costo:'1720',venta:'2380',margen:'660',porcentaje:'27.73',completos:27,total:40,sin_costo:10,sin_precio:5,costo_cero:2,stock_negativo:0,categorias},ventas:{total:'4250',facturas:28,ticket:'151.785',serie:[{mes:'2026-06',total:'200',facturas:2},{mes:'2026-07',total:'650',facturas:5},{mes:'2026-08',total:'350',facturas:3},{mes:'2026-09',total:'1100',facturas:7},{mes:'2026-10',total:'700',facturas:4},{mes:'2026-11',total:'1250',facturas:7}],clientes:[{id:'c1',nombre:'Cliente de ejemplo',total:'750',facturas:6}]},historial_clientes:[{id:'c2',nombre:'Histórico de ejemplo',cargos:'1800',abonos:'900'}]},error:null};if(n==='grupos_inventario')return {data:{total:filtrar(p).length,categorias:[{nombre:'Iluminación',total:1}],vehiculos:filtrar(p).flatMap(a=>a.vehiculos).map(nombre=>({nombre,total:1})),marcas_vehiculo:[{nombre:'Ford',total:1},{nombre:'Isuzu / Chevrolet',total:1}]},error:null};throw new Error('RPC no simulada '+n);}
const db = {
 rpc,
 auth: {getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})},
 storage: {from:()=>({
  upload:async(path,bytes)=>{await writeFile(fotoPublica,bytes);return {error:null};},
  remove:async()=>({error:null}),
  createSignedUrls:async(paths)=>({data:paths.map(()=>({signedUrl:'/foto-prueba.png'})),error:null})
 })}
};
export async function conexion(){return db;}
export function configurado(){return true;}
export async function sesion(){return {perfil:{rol:'administrador',nombre:'Usuario de prueba'},db};}
export async function consultar(n,{p={}}={}){if(n==='resumen')return {productos:'40',sin_precio:'5',clientes:'32',deuda_usd:'1750'};if(n==='metricas_generales')return {productos_activos:40,sin_precio:5,agotadas:8,bajo_minimo:3};if(n==='opciones_catalogo')return {categorias:['Iluminación','Carrocería'],vehiculos:['Fiesta','NPR'],categorias_origen:['FORD'],marcas:[],consultas:[]};return {filas:filtrar(p),total:filtrar(p).length,pagina:1,paginas:1};}
`,
);
await writeFile(join(dir, "foto.json"), "[]");
await writeFile(
  join(dir, "perfil.json"),
  JSON.stringify({ rol: "administrador" }),
);
await writeFile(
  join(dir, "public/foto-prueba.png"),
  await readFile(join(repo, "public/logo-alexmar-sin-telefono.png")),
);
await writeFile(
  join(dir, "app/actions.ts"),
  '"use server";export async function entrar(){};',
);
await mkdir(join(dir, "app/api/vehiculos/foto"), { recursive: true });
await writeFile(
  join(dir, "app/api/vehiculos/foto/route.ts"),
  "// @ts-nocheck -- fixture\n" +
    (await readFile(join(repo, "src/app/api/vehiculos/foto/route.ts"), "utf8")),
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
  const limite = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base + "/panel")).ok) break;
    } catch {}
    if (Date.now() > limite) throw new Error(logs.slice(-3500));
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errores = [];
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /hydration|did not match|cannot be a descendant|Each child/.test(m.text())
    )
      errores.push(m.text());
  });
  page.on("pageerror", (e) => errores.push(e.message));
  await page.route("**/api/facturacion/buscar?*", async (route) => {
    const tipo = new URL(route.request().url()).searchParams.get("tipo");
    await route.fulfill({
      json: {
        filas:
          tipo === "clientes"
            ? [{ id: "c1", nombre: "Cliente de muestra", documento: "PRUEBA" }]
            : [
                {
                  id: "p1",
                  variante_id: "v1",
                  nombre: "Faro de muestra",
                  precio: "25",
                  disponible: "3",
                },
              ],
        paginas: 1,
      },
    });
  });
  const endpointFoto = base + "/api/vehiculos/foto";
  const archivoFalso = {
    name: "falsa.png",
    mimeType: "image/png",
    buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
  };
  const ajeno = await page.request.post(endpointFoto, {
    headers: { origin: "https://otro.example" },
    multipart: { nombre: "Ford", foto: archivoFalso },
  });
  expect(ajeno.status()).toBe(403);
  const falso = await page.request.post(endpointFoto, {
    headers: { origin: base },
    multipart: { nombre: "Ford", foto: archivoFalso },
  });
  expect(falso.status()).toBe(400);
  await writeFile(join(dir, "perfil.json"), JSON.stringify({ rol: "ventas" }));
  const sinPermiso = await page.request.post(endpointFoto, {
    headers: { origin: base },
    multipart: { nombre: "Ford", foto: archivoFalso },
  });
  expect(sinPermiso.status()).toBe(403);
  expect(JSON.parse(await readFile(join(dir, "foto.json"), "utf8"))).toEqual(
    [],
  );
  await writeFile(
    join(dir, "perfil.json"),
    JSON.stringify({ rol: "administrador" }),
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/panel");
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");
    await page.screenshot({
      path: join(repo, "test-results/panel-inicial.png"),
      fullPage: true,
      caret: "initial",
    });
    await page.getByLabel("Comparar").selectOption("costo");
    await expect(page.locator(".fila-barra").first()).toContainText("800");
    await page
      .locator("summary")
      .filter({ hasText: "Actividad del sistema anterior" })
      .click();
    await expect(page.getByText("Histórico de ejemplo")).toBeVisible();
    await page.screenshot({
      path: join(repo, "test-results", `panel-oscuro-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.getByRole("button", { name: "Activar tema claro" }).click();
    await page.screenshot({
      path: join(repo, "test-results", `panel-claro-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
    for (const ruta of [
      "/panel",
      "/inventario",
      "/reportes",
      "/facturacion/nueva",
    ]) {
      await page.goto(base + ruta);
      await expect(page.locator("main h1")).toBeVisible();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("Desbordamiento " + ruta + " " + width);
    }
    await page.goto(base + "/inventario");
    if (width === 1440) {
      const generada = page.getByRole("img", {
        name: "Vehículo de referencia · Fiesta · ejemplo de Ford",
        exact: true,
      });
      await expect(generada).toBeVisible();
      await expect(generada).toHaveAttribute("src", /fiesta/);
    }
    await expect(page.locator(".filtros-visuales select")).toHaveCount(0);
    await page
      .locator(".filtro-stock label")
      .filter({ hasText: "Disponible" })
      .click();
    await expect(page).toHaveURL(/stock=disponible/);
    await expect(
      page.getByLabel("Foto real de Ford", { exact: true }),
    ).toBeEnabled();
    const subida = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/vehiculos/foto") &&
        r.request().method() === "POST",
    );
    await page.getByLabel("Foto real de Ford", { exact: true }).setInputFiles({
      name: "foto-real.png",
      mimeType: "image/png",
      buffer: await readFile(
        join(repo, "public/logo-alexmar-sin-telefono.png"),
      ),
    });
    const respuestaSubida = await subida;
    if (!respuestaSubida.ok()) throw new Error(await respuestaSubida.text());
    await expect(
      page.getByRole("img", {
        name: "Fotografía de referencia · Ford",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Vehículo de referencia · Fiesta · ejemplo de Ford",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: /^Ford.*Ver productos/ }).click();
    await expect(page).toHaveURL(/marca_vehiculo=Ford/);
    await expect(
      page.getByRole("link", { name: /^Fiesta.*Ver productos/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: /^Fiesta.*Ver productos/ }).click();
    await expect(page.locator(".producto")).toHaveCount(1);
    await expect(page.locator('input[name="marca_vehiculo"]')).toHaveValue(
      "Ford",
    );
    await page.screenshot({
      path: join(repo, "test-results", `inventario-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.goto(base + "/facturacion/nueva");
    await page.getByRole("combobox", { name: "Buscar cliente" }).focus();
    await page.getByRole("option", { name: /Cliente de muestra/ }).click();
    await page.getByRole("combobox", { name: "Añadir producto" }).focus();
    await page.getByRole("option", { name: /Faro de muestra/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Cantidad Faro de muestra" }),
    ).toHaveValue("1");
    await expect(
      page.getByRole("radio", { name: "Contado", exact: true }),
    ).toBeChecked();
    await expect(page.locator(".factura-barra")).toContainText("25,00");
    await page.getByRole("radio", { name: "Crédito", exact: true }).check();
    await expect(page.getByLabel("Abono inicial USD")).toHaveValue("0");
    await page.screenshot({
      path: join(repo, "test-results", `factura-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/inventario/imagenes");
  await expect(page.locator(".imagen-coleccion")).toHaveCount(20);
  await expect(page.getByText("REFERENCIA IA", { exact: true })).toHaveCount(0);
  await expect(page.locator(".origen-imagen")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Descargar PNG", exact: true }),
  ).toHaveCount(20);
  await page
    .locator(".imagen-coleccion img")
    .evaluateAll((xs) => xs.forEach((x) => (x.loading = "eager")));
  await expect
    .poll(() =>
      page
        .locator(".imagen-coleccion img")
        .evaluateAll((xs) => xs.every((x) => x.complete && x.naturalWidth > 0)),
    )
    .toBeTruthy();
  await page.screenshot({
    path: join(repo, "test-results/coleccion-vehiculos.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.goto(base + "/");
  await expect(page.locator(".marca-acceso .marca-imagen")).toHaveAttribute(
    "src",
    /sin-telefono/,
  );
  await page.screenshot({
    path: join(repo, "test-results/acceso-centrado.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/panel");
  await expect(page.locator(".hero-negocio")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ventas diarias", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ventas por semana", exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /logo-alexmar-sin-telefono/,
  );
  const grafico = page.getByLabel("Ventas por día", { exact: true });
  await grafico.getByRole("button").first().focus();
  await expect(page.locator(".grafico-ventas-lectura").first()).toContainText(
    "25,00",
  );
  if (errores.length) throw new Error(errores.join("\n"));
  console.log(
    "Rediseño: filtros visuales de un clic, subida real de formulario/API con Storage simulado, foto persistente, logo sin teléfono, acceso centrado, movimiento reducido, claro/oscuro, gráficos y facturación a 1440/390 sin desbordamiento. Datos simulados.",
  );
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((r) => child.once("exit", r));
  await rm(dir, { recursive: true, force: true });
}
