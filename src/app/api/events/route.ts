import { NextResponse } from "next/server";

import { isValidDateString, isValidTimeString, toMinutes } from "@/lib/time";
import { createEvent } from "@/lib/repository";
import type { SlotMinutes } from "@/lib/types";

type CreateEventBody = {
  name?: string;
  start_date?: string;
  end_date?: string;
  day_start_time?: string;
  day_end_time?: string;
  slot_minutes?: number;
};

function isSlotMinutes(value: number): value is SlotMinutes {
  return value === 15 || value === 30;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateEventBody | null;

  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const startDate = body.start_date ?? "";
  const endDate = body.end_date ?? "";
  const dayStartTime = body.day_start_time ?? "";
  const dayEndTime = body.day_end_time ?? "";
  const slotMinutes = body.slot_minutes ?? 0;

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  if (!isValidDateString(startDate) || !isValidDateString(endDate) || endDate < startDate) {
    return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });
  }

  if (!isValidTimeString(dayStartTime) || !isValidTimeString(dayEndTime)) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }

  if (toMinutes(dayEndTime) <= toMinutes(dayStartTime)) {
    return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
  }

  if (!isSlotMinutes(slotMinutes)) {
    return NextResponse.json({ error: "invalid_slot_minutes" }, { status: 400 });
  }

  const event = await createEvent({
    name,
    startDate,
    endDate,
    dayStartTime,
    dayEndTime,
    slotMinutes,
  });

  return NextResponse.json({
    event_id: event.id,
    event_url: `/events/${event.id}`,
  });
}
