import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout route error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
