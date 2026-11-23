import { NextResponse } from "next/server";
import { conexionPublicaPdf } from "@/lib/pdf-publico";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const { token } = await params;
    if (!/^[0-9a-f]{64}$/.test(token))
      return new NextResponse("Enlace no disponible o caducado.", {
        status: 404,
        headers,
      });
    const db = conexionPublicaPdf();
    const { data, error } = await db.rpc("leer_pdf_compartido", {
      p_token: token,
    });
    if (error)
      return new NextResponse(
        "No se pudo abrir el documento. Intenta de nuevo.",
        { status: 503, headers },
      );
    if (!data)
      return new NextResponse("Enlace no disponible o caducado.", {
        status: 404,
        headers,
      });
    return new NextResponse(
      new Uint8Array(Buffer.from(data.base64, "base64")),
      {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${data.nombre}"`,
        },
      },
    );
  } catch {
    return new NextResponse("No se pudo abrir el documento.", {
      status: 503,
      headers,
    });
  }
}
