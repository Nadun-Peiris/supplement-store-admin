import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function GET(req: Request) {
  const guard = await verifyAdmin(req);

  if ("error" in guard) {
    return guard.error;
  }

  return NextResponse.json({ ok: true, role: guard.user.role });
}
