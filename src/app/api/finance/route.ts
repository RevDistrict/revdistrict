import { NextResponse } from "next/server";

// Old clients must not submit financial information to the retired native flow.
export async function POST() {
  return NextResponse.json(
    { message: "Please use the credit application at /financing/apply." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
