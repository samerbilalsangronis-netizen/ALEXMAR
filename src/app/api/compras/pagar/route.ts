import type { NextRequest } from "next/server";
import { escribirCompra } from "@/lib/compra-api";
export async function POST(req: NextRequest) {
  return escribirCompra(req, "pagar");
}
