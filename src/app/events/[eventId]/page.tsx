import { EventClient } from "@/app/events/[eventId]/event-client";

export default function EventPage({ params }: { params: { eventId: string } }) {
  return <EventClient eventId={params.eventId} />;
}
