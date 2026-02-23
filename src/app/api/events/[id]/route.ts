import { NextResponse } from "next/server";

import { getAvailabilities, getEvent, getParticipants } from "@/lib/repository";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const event = await getEvent(params.id);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const participants = await getParticipants(params.id);
  const availabilities = await getAvailabilities(params.id);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      timezone: event.timezone,
      start_date: event.startDate,
      end_date: event.endDate,
      day_start_time: event.dayStartTime,
      day_end_time: event.dayEndTime,
      slot_minutes: event.slotMinutes,
    },
    participants: participants.map((participant) => ({
      id: participant.id,
      display_name: participant.displayName,
      created_at: participant.createdAt,
    })),
    availabilities: availabilities.map((item) => ({
      participant_id: item.participantId,
      date: item.date,
      bitset: item.bitset,
      updated_at: item.updatedAt,
    })),
  });
}
