// Código real de acceso, proxy y rutas. Auth/DB de prueba, sin servicios remotos.
import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile, rm, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const repo = resolve(import.meta.dirname, "..");
await mkdir(join(repo, "test-results"), { recursive: true });
const dir = await mkdtemp(join(repo, "test-results/accesos-"));
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
        "@/lib/crear-identidad": ["./identidades.ts"],
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
  `export default {turbopack:{root:${JSON.stringify(repo)}}};`,
);
const estadoArchivo = join(dir, "estado.json");
await writeFile(
  estadoArchivo,
  JSON.stringify({
    bloqueado: false,
    version: 1,
    logs: [],
    creados: [],
    revertidos: [],
    fallarPerfil: false,
    identidades: true,
    desactivado: false,
  }),
);
async function copiar(src, dest) {
  const p = join(dir, dest);
  await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  await writeFile(
    p,
    (dest.endsWith(".ts") || dest.endsWith(".tsx")
      ? "// @ts-nocheck -- sesión simulada\n"
      : "") + (await readFile(join(repo, src), "utf8")),
  );
}
for (const r of [
  "layout.tsx",
  "globals.css",
  "page.tsx",
  "manifest.ts",
  "bloqueado/page.tsx",
  "(privado)/layout.tsx",
  "(privado)/consulta/page.tsx",
  "(privado)/configuracion/page.tsx",
  "api/acceso/estado/route.ts",
  "api/acceso/crear/route.ts",
  "icons/[size]/route.tsx",
])
  await copiar("src/app/" + r, "app/" + r);
await copiar("src/app/actions.ts", "acciones.ts");
await writeFile(
  join(dir, "app/actions.ts"),
  'export {entrar} from "../acciones";',
);
await mkdir(join(dir, "app/(privado)/panel"), { recursive: true });
await writeFile(
  join(dir, "app/(privado)/panel/page.tsx"),
  `import {sesion} from '@/lib/supabase';export default async function Panel(){await sesion();return <h1>Panel administrativo privado</h1>}`,
);
await mkdir(join(dir, "public"), { recursive: true });
await cp(
  join(repo, "public/logo-alexmar-sin-telefono.png"),
  join(dir, "public/logo-alexmar-sin-telefono.png"),
);
let sesion = await readFile(join(repo, "src/lib/supabase.ts"), "utf8");
const a = sesion.indexOf("export function configurado()"),
  b = sesion.indexOf("export async function sesion()", a);
sesion =
  sesion.slice(0, a) +
  `import {conexion,configurado} from './backend';export {conexion,configurado};\n` +
  sesion.slice(b);
await writeFile(join(dir, "datos.ts"), "// @ts-nocheck\n" + sesion);
await writeFile(
  join(dir, "backend.ts"),
  `// @ts-nocheck
import {cookies} from 'next/headers';import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const ruta=${JSON.stringify(estadoArchivo)};const ids={admin:'11111111-1111-4111-8111-111111111111',general:'22222222-2222-4222-8222-222222222222'};
const leer=async()=>JSON.parse(await readFile(ruta,'utf8'));const guardar=async d=>writeFile(ruta,JSON.stringify(d));
export function configurado(){return true;}
export async function perfilDe(rol){const d=await leer();if(!ids[rol]||(rol==='general'&&d.desactivado))return null;return {id:ids[rol],nombre:rol==='admin'?'Administración de prueba':'Empleado de prueba',rol:rol==='admin'?'administrador':'lectura',version_accesos:13,bloqueado:rol==='general'&&d.bloqueado};}
export async function conexion(){const c=await cookies();async function rpc(n,args={}){const rol=c.get('fixture-role')?.value;const p=await perfilDe(rol),d=await leer();
 if(n==='mi_perfil')return {data:p,error:null};
 if(n==='registrar_ingreso'){const acceso=p?.rol==='administrador'?'administrativo':'general';const motivo=!p?'inactivo':p.bloqueado?'bloqueado':args.p_portal!==acceso?'portal_incorrecto':'permitido';const sid=c.get('fixture-session')?.value||'sin-id';if(!d.logs.some(l=>l.sid===sid&&l.resultado===motivo)){d.logs.push({id:randomUUID(),sid,nombre:p?.nombre||'Inactivo',acceso,portal:args.p_portal,resultado:motivo,creado:new Date().toISOString()});await guardar(d);}return {data:{permitido:motivo==='permitido',motivo,acceso},error:null};}
 if(n==='catalogo_general'){if(!p||p.bloqueado)return {data:null,error:{code:'42501',message:'Acceso bloqueado'}};return {data:{filas:[{id:'p1',variante_id:'v1',nombre:'Filtro Toyota de prueba',descripcion:'',categoria:'Filtros',marca:'Toyota',referencia:'DEMO',compatibilidad:'Toyota',variante:'Principal',precio:'25.50'}],total:1,pagina:1,paginas:1},error:null};}
 if(!p||p.rol!=='administrador')return {data:null,error:{code:'42501',message:'No tienes permiso'}};
 if(n==='configuracion_facturacion')return {data:{version:11,descontar_stock:false,version_stock:1},error:null};
 if(n==='listar_perfiles')return {data:[{id:ids.admin,nombre:'Administración de prueba',rol:'administrador',activo:true},{id:ids.general,nombre:'Empleado de prueba',rol:'lectura',activo:!d.desactivado}],error:null};
 if(n==='estado_control_acceso')return {data:{generales_bloqueados:d.bloqueado,version:d.version},error:null};
 if(n==='historial_accesos')return {data:{filas:d.logs,total:d.logs.length,pagina:1,paginas:1},error:null};
 if(n==='bloquear_acceso_general'){d.bloqueado=args.p_bloquear;d.version++;await guardar(d);return {data:null,error:null};}
 if(n==='asignar_perfil'){if(d.fallarPerfil)return {data:null,error:{message:'Error simulado de asignación'}};if(args.p_id===ids.general)d.desactivado=!args.p_activo;await guardar(d);return {data:null,error:null};}
 throw new Error('RPC no simulada '+n);}
 return {rpc,auth:{getUser:async()=>({data:{user:ids[c.get('fixture-role')?.value]?{id:ids[c.get('fixture-role')?.value]}:null},error:null}),signInWithPassword:async({email,password})=>{const rol=email==='admin@example.com'?'admin':email==='empleado.demo@accesos.alexmar.invalid'?'general':null;if(!rol||password!=='Clave-Demo-423!')return {error:{message:'Credenciales'}};c.set('fixture-role',rol,{httpOnly:true,path:'/'});c.set('fixture-session',randomUUID(),{httpOnly:true,path:'/'});return {error:null};},signOut:async()=>{c.delete('fixture-role');c.delete('fixture-session');return {error:null};}}};}
`,
);
await writeFile(
  join(dir, "identidades.ts"),
  `// @ts-nocheck
import {readFile,writeFile}from'node:fs/promises';import{randomUUID}from'node:crypto';const ruta=${JSON.stringify(estadoArchivo)};export function gestionIdentidadesDisponible(){return true;}export function gestionIdentidades(){return {createUser:async(p)=>{const d=JSON.parse(await readFile(ruta,'utf8'));const id=randomUUID();d.creados.push({id,email:p.email});await writeFile(ruta,JSON.stringify(d));return {data:{user:{id}},error:null};},deleteUser:async(id)=>{const d=JSON.parse(await readFile(ruta,'utf8'));d.revertidos.push(id);await writeFile(ruta,JSON.stringify(d));return {error:null};}};}
`,
);
let proxy = await readFile(join(repo, "src/proxy.ts"), "utf8");
proxy = proxy
  .replace('from "@supabase/ssr"', 'from "./proxy-datos"')
  .replace("process.env.NEXT_PUBLIC_SUPABASE_URL", '"https://fixture.invalid"')
  .replace(
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    '"clave-ficticia"',
  );
await writeFile(join(dir, "proxy.ts"), "// @ts-nocheck\n" + proxy);
await writeFile(
  join(dir, "proxy-datos.ts"),
  `// @ts-nocheck
import {perfilDe}from'./backend';export function createServerClient(u,k,o){const rol=o.cookies.getAll().find(c=>c.name==='fixture-role')?.value;return {auth:{getUser:async()=>({data:{user:rol?{id:rol}:null}})},rpc:async()=>({data:await perfilDe(rol),error:null})};}
`,
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const base = "http://127.0.0.1:" + port;
const child = spawn(
  process.execPath,
  [
    join(repo, "node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: dir, detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
let browser;
try {
  const limite = Date.now() + 60000;
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (Date.now() > limite) throw new Error(logs.slice(-3000));
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const contexto = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    empleado = await contexto.newPage();
  const errores = [];
  empleado.on("pageerror", (e) => errores.push(e.message));
  await empleado.goto(base + "/?acceso=general");
  await empleado.getByLabel("Usuario o correo").fill("Empleado Demo");
  await empleado
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Demo-423!");
  await empleado.getByRole("button", { name: "Entrar al sistema →" }).click();
  await empleado.waitForURL("**/consulta");
  await expect(
    empleado.getByRole("heading", { name: "Consulta de precios", exact: true }),
  ).toBeVisible();
  await expect(empleado.locator(".precio-consulta")).toContainText("25,50");
  for (const nombre of [
    "Facturación",
    "Configuración",
    "Clientes y cuentas",
    "Rendimiento",
    "Reportes",
    "Proveedores",
  ])
    await expect(
      empleado.getByRole("link", { name: nombre, exact: true }),
    ).toHaveCount(0);
  await empleado.goto(base + "/panel");
  await expect(empleado).toHaveURL(/\/consulta$/);
  await expect(empleado.getByText("Panel administrativo privado")).toHaveCount(
    0,
  );
  const estado = await empleado.request.get(base + "/api/acceso/estado");
  expect((await estado.json()).bloqueado).toBe(false);
  const denegado = await empleado.request.post(base + "/api/acceso/crear", {
    headers: { Origin: base },
    data: {
      nombre: "No permitido",
      usuario: "otro.usuario",
      clave: "Clave-Demo-423!",
      acceso: "administrativo",
    },
  });
  expect(denegado.status()).toBe(403);
  await empleado.screenshot({
    path: "/tmp/alexmar-acceso-general.png",
    fullPage: true,
    caret: "initial",
  });
  await empleado.setViewportSize({ width: 390, height: 844 });
  expect(
    await empleado.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await empleado.screenshot({
    path: "/tmp/alexmar-acceso-general-movil.png",
    fullPage: true,
    caret: "initial",
  });
  // Segundo contexto, cuenta administrativa independiente.
  const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (e) => errores.push(e.message));
  await adminPage.goto(base + "/?acceso=administrativo");
  await adminPage.getByLabel("Usuario o correo").fill("admin@example.com");
  await adminPage
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Demo-423!");
  await adminPage.getByRole("button", { name: "Entrar al sistema →" }).click();
  await adminPage.waitForURL("**/panel");
  await adminPage.goto(base + "/configuracion");
  await expect(
    adminPage.getByRole("heading", { name: "Acceso del personal" }),
  ).toBeVisible();
  await adminPage
    .getByRole("button", { name: "Bloquear acceso general", exact: true })
    .click();
  await expect(
    adminPage.getByText("Acceso general bloqueado", { exact: true }),
  ).toBeVisible();
  await empleado.evaluate(() => window.dispatchEvent(new Event("focus")));
  await empleado.waitForURL("**/bloqueado");
  await expect(
    empleado.getByRole("heading", { name: "Acceso general bloqueado" }),
  ).toBeVisible();
  await adminPage.goto(base + "/panel");
  await expect(
    adminPage.getByRole("heading", { name: "Panel administrativo privado" }),
  ).toBeVisible();
  await adminPage.goto(base + "/configuracion");
  await adminPage
    .getByRole("button", { name: "Permitir acceso general", exact: true })
    .click();
  await expect(
    adminPage.getByText("Acceso general habilitado", { exact: true }),
  ).toBeVisible();
  await empleado.getByRole("link", { name: "Comprobar acceso" }).click();
  await empleado.waitForURL("**/consulta");
  // Creación pasa únicamente por administrador, sin devolver contraseña.
  const crear = adminPage.locator("section").filter({
    has: adminPage.getByRole("heading", {
      name: "Crear usuario de personal",
    }),
  });
  await crear
    .getByLabel("Nombre completo", { exact: true })
    .fill("Persona de prueba");
  await crear.getByLabel("Usuario de ingreso").fill("Persona Prueba");
  await crear.getByLabel("Contraseña inicial").fill("Clave-Demo-423!");
  await crear
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(crear.getByRole("status")).toContainText("creado con acceso");
  let d = JSON.parse(await readFile(estadoArchivo, "utf8"));
  expect(d.creados.at(-1).email).toBe("persona.prueba@accesos.alexmar.invalid");
  expect(
    d.logs.some((x) => x.acceso === "general" && x.resultado === "permitido"),
  ).toBe(true);
  d.fallarPerfil = true;
  await writeFile(estadoArchivo, JSON.stringify(d));
  const respuesta = await adminPage.request.post(base + "/api/acceso/crear", {
    headers: { Origin: base },
    data: {
      nombre: "Otra prueba",
      usuario: "otra.prueba",
      clave: "Clave-Demo-423!",
      acceso: "general",
    },
  });
  expect(respuesta.status()).toBe(409);
  expect(await respuesta.text()).not.toContain("Clave-Demo-423!");
  d = JSON.parse(await readFile(estadoArchivo, "utf8"));
  expect(d.revertidos).toEqual([d.creados.at(-1).id]);
  expect(d.revertidos).not.toContain(d.creados[0].id);
  await adminPage.screenshot({
    path: "/tmp/alexmar-panel-personal.png",
    fullPage: true,
    caret: "initial",
  });
  d = JSON.parse(await readFile(estadoArchivo, "utf8"));
  d.fallarPerfil = false;
  await writeFile(estadoArchivo, JSON.stringify(d));
  // Una revocación individual también retira la vista de una sesión abierta.
  const filaEmpleado = adminPage.locator(".personal-fila").filter({
    has: adminPage.locator('input[name="nombre"][value="Empleado de prueba"]'),
  });
  await filaEmpleado
    .getByRole("checkbox", { name: "Activo", exact: true })
    .uncheck();
  await filaEmpleado
    .getByRole("button", { name: "Guardar acceso", exact: true })
    .click();
  await expect
    .poll(
      async () => JSON.parse(await readFile(estadoArchivo, "utf8")).desactivado,
    )
    .toBe(true);
  await empleado.evaluate(() => window.dispatchEvent(new Event("focus")));
  await empleado.waitForURL("**/?error=sin-perfil");
  // Recursos de instalación disponibles sin cuenta, con PNG reales cuadrados.
  const anon = await browser.newContext();
  const pagina = await anon.newPage();
  const manifest = await pagina.request.get(base + "/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).icons[0].src).toContain("/icons/192");
  for (const size of [192, 512]) {
    const icono = await pagina.request.get(base + "/icons/" + size);
    expect(icono.status()).toBe(200);
    expect(icono.headers()["content-type"]).toContain("image/png");
    const bytes = await icono.body();
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  await pagina.goto(base + "/?acceso=general");
  await pagina.getByLabel("Usuario o correo").fill("admin@example.com");
  await pagina
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Demo-423!");
  await pagina.getByRole("button", { name: "Entrar al sistema →" }).click();
  await expect(pagina.locator('.aviso[role="alert"]')).toContainText(
    "no corresponde",
  );
  expect(errores).toEqual([]);
  console.log(
    "Accesos: usuario/correo, portales verificados, precios sin menú privado, proxy, bloqueo de sesión abierta, administración, creación y reversión, log, manifest y PNG 192/512 anónimos; 1440/390. Backend simulado, sin cuentas reales.",
  );
} catch (e) {
  console.error(logs.slice(-7000));
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
