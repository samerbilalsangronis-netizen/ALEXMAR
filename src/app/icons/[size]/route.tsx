import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: valor } = await params;
  if (!["180", "192", "512"].includes(valor))
    return new Response("Icono no encontrado", { status: 404 });
  const size = Number(valor);
  const mascara = new URL(req.url).searchParams.get("mask") === "1";
  const proporcion = mascara ? 0.7 : 0.9;
  const logo = await readFile(
    join(process.cwd(), "public", "logo-alexmar-sin-telefono.png"),
  );
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          background: mascara || size === 180 ? "#ffffff" : "transparent",
        }}
      >
        <img
          alt=""
          src={"data:image/png;base64," + logo.toString("base64")}
          width={Math.round(size * proporcion)}
          height={Math.round((size * proporcion * 1191) / 1321)}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
