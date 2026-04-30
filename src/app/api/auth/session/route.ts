import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  setAdminSessionCookie,
} from "@/lib/server/adminSession";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function POST(req: Request) {
  try {
    const guard = await verifyAdmin(req);

    if ("error" in guard) {
      return guard.error;
    }

    const sessionCookie = await createAdminSessionCookie(guard.token);
    const response = NextResponse.json({
      success: true,
      role: guard.user.role,
    });

    setAdminSessionCookie(response, sessionCookie);

    return response;
  } catch (error) {
    console.error("CREATE ADMIN SESSION ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create admin session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  clearAdminSessionCookie(response);

  return response;
}
