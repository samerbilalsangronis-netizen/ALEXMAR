import { test } from "node:test";
import assert from "node:assert/strict";
import { mismoOrigen } from "../src/lib/origen";
test("facturación valida origen y Host, incluyendo localhost normalizado, sin confiar en dominios reenviados", () => {
  const req = (origin: string, host: string, protocol = "https:") => ({
    headers: new Headers({ origin, host }),
    nextUrl: { protocol },
  });
  assert.equal(
    mismoOrigen(req("https://alexmar.example", "alexmar.example")),
    true,
  );
  assert.equal(
    mismoOrigen(req("http://127.0.0.1:3200", "127.0.0.1:3200", "http:")),
    true,
  );
  assert.equal(
    mismoOrigen(req("https://otro.example", "alexmar.example")),
    false,
  );
  assert.equal(
    mismoOrigen(req("https://alexmar.example.otro.example", "alexmar.example")),
    false,
  );
  assert.equal(
    mismoOrigen(req("https://alexmar.example:444", "alexmar.example")),
    false,
  );
  assert.equal(
    mismoOrigen(req("http://alexmar.example", "alexmar.example")),
    false,
  );
  assert.equal(
    mismoOrigen(req("https://alexmar.example/ruta", "alexmar.example")),
    false,
  );
  assert.equal(mismoOrigen(req("null", "alexmar.example")), false);
  assert.equal(
    mismoOrigen({
      headers: new Headers({ host: "alexmar.example" }),
      nextUrl: { protocol: "https:" },
    }),
    false,
  );
  const ataque = req("https://otro.example", "alexmar.example");
  ataque.headers.set("x-forwarded-host", "otro.example");
  assert.equal(mismoOrigen(ataque), false);
});
