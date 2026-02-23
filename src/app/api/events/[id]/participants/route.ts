import { NextResponse } from "next/server";

import { createParticipant, getEvent } from "@/lib/repository";

type ParticipantBody = {
  display_name?: string;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json().catch(() => null)) as ParticipantBody | null;
  const displayName = body?.display_name?.trim() ?? "";

  if (!displayName || displayName.length > 60) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }

  const event = await getEvent(params.id);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await createParticipant(params.id, displayName);
  if (!result) {
    return NextResponse.json({ error: "participant_creation_failed" }, { status: 500 });
  }

  return NextResponse.json({
    participant_id: result.participant.id,
    edit_token: result.editToken,
  });
}
