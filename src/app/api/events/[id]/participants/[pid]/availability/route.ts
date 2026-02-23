import { NextResponse } from "next/server";

import { getEvent, updateAvailability } from "@/lib/repository";
import { getDateRange } from "@/lib/time";

type AvailabilityBody = {
  date?: string;
  bitset?: string;
  edit_token?: string;
};

export async function PUT(
  request: Request,
  { params }: { params: { id: string; pid: string } },
) {
  const body = (await request.json().catch(() => null)) as AvailabilityBody | null;

  const date = body?.date ?? "";
  const bitset = body?.bitset ?? "";
  const editToken = body?.edit_token ?? "";

  if (!date || !bitset || !editToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const event = await getEvent(params.id);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const validDates = getDateRange(event.startDate, event.endDate);
  if (!validDates.includes(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const result = await updateAvailability({
    eventId: params.id,
    participantId: params.pid,
    date,
    bitset,
    editToken,
  });

  if (!result.ok) {
    if (result.reason === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (result.reason === "invalid_date") {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, updated_at: new Date().toISOString() });
}
