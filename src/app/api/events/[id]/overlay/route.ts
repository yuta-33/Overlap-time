import { NextResponse } from "next/server";

import { getOverlay } from "@/lib/repository";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const overlay = await getOverlay(params.id);

  if (!overlay) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ overlay });
}
