import crypto from "node:crypto";

import { getDateRange, getSlotCount } from "@/lib/time";
import {
  AvailabilityRecord,
  CreateEventInput,
  EventRecord,
  OverlayResult,
  ParticipantRecord,
} from "@/lib/types";

type StoreState = {
  events: Map<string, EventRecord>;
  participantsByEvent: Map<string, Map<string, ParticipantRecord>>;
  availabilitiesByEvent: Map<string, Map<string, Map<string, AvailabilityRecord>>>;
};

type GlobalWithStore = typeof globalThis & { __overlapTimeStore?: StoreState };

const globalStore = globalThis as GlobalWithStore;

if (!globalStore.__overlapTimeStore) {
  globalStore.__overlapTimeStore = {
    events: new Map(),
    participantsByEvent: new Map(),
    availabilitiesByEvent: new Map(),
  };
}

const state = globalStore.__overlapTimeStore;

function createId(size = 10): string {
  return crypto.randomBytes(16).toString("base64url").slice(0, size);
}

function getEventSlotCount(event: EventRecord): number {
  return getSlotCount(event.dayStartTime, event.dayEndTime, event.slotMinutes);
}

function normalizeBitset(bitset: string, expectedLength: number): string {
  const clean = bitset
    .split("")
    .map((char) => (char === "1" ? "1" : "0"))
    .join("");

  if (clean.length === expectedLength) {
    return clean;
  }

  if (clean.length > expectedLength) {
    return clean.slice(0, expectedLength);
  }

  return clean.padEnd(expectedLength, "0");
}

export function createEvent(input: CreateEventInput): EventRecord {
  const event: EventRecord = {
    id: createId(12),
    name: input.name,
    timezone: "Asia/Tokyo",
    startDate: input.startDate,
    endDate: input.endDate,
    dayStartTime: input.dayStartTime,
    dayEndTime: input.dayEndTime,
    slotMinutes: input.slotMinutes,
    createdAt: new Date().toISOString(),
  };

  state.events.set(event.id, event);
  state.participantsByEvent.set(event.id, new Map());
  state.availabilitiesByEvent.set(event.id, new Map());

  return event;
}

export function getEvent(eventId: string): EventRecord | null {
  return state.events.get(eventId) ?? null;
}

export function createParticipant(eventId: string, displayName: string): {
  participant: ParticipantRecord;
  editToken: string;
} | null {
  const event = getEvent(eventId);
  if (!event) {
    return null;
  }

  const participants = state.participantsByEvent.get(eventId);
  if (!participants) {
    return null;
  }

  const participantId = createId(10);
  const editToken = createId(24);
  const editTokenHash = crypto.createHash("sha256").update(editToken).digest("hex");

  const participant: ParticipantRecord = {
    id: participantId,
    eventId,
    displayName,
    editTokenHash,
    createdAt: new Date().toISOString(),
  };

  participants.set(participantId, participant);

  return { participant, editToken };
}

export function getParticipants(eventId: string): ParticipantRecord[] {
  const participants = state.participantsByEvent.get(eventId);
  if (!participants) {
    return [];
  }

  return [...participants.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getAvailabilities(eventId: string): AvailabilityRecord[] {
  const byParticipant = state.availabilitiesByEvent.get(eventId);
  if (!byParticipant) {
    return [];
  }

  const items: AvailabilityRecord[] = [];
  byParticipant.forEach((byDate) => {
    byDate.forEach((record) => {
      items.push(record);
    });
  });

  return items;
}

export function updateAvailability(input: {
  eventId: string;
  participantId: string;
  date: string;
  bitset: string;
  editToken: string;
}): { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "invalid_date" } {
  const event = getEvent(input.eventId);
  if (!event) {
    return { ok: false, reason: "not_found" };
  }

  const participants = state.participantsByEvent.get(input.eventId);
  const participant = participants?.get(input.participantId);
  if (!participant) {
    return { ok: false, reason: "not_found" };
  }

  const expectedHash = crypto.createHash("sha256").update(input.editToken).digest("hex");
  if (participant.editTokenHash !== expectedHash) {
    return { ok: false, reason: "forbidden" };
  }

  const allowedDates = getDateRange(event.startDate, event.endDate);
  if (!allowedDates.includes(input.date)) {
    return { ok: false, reason: "invalid_date" };
  }

  const slotCount = getEventSlotCount(event);
  const normalizedBitset = normalizeBitset(input.bitset, slotCount);

  const byParticipant = state.availabilitiesByEvent.get(input.eventId);
  if (!byParticipant) {
    return { ok: false, reason: "not_found" };
  }

  const byDate = byParticipant.get(input.participantId) ?? new Map<string, AvailabilityRecord>();
  const record: AvailabilityRecord = {
    eventId: input.eventId,
    participantId: input.participantId,
    date: input.date,
    bitset: normalizedBitset,
    updatedAt: new Date().toISOString(),
  };

  byDate.set(input.date, record);
  byParticipant.set(input.participantId, byDate);

  return { ok: true };
}

export function getOverlay(eventId: string): OverlayResult | null {
  const event = getEvent(eventId);
  if (!event) {
    return null;
  }

  const dates = getDateRange(event.startDate, event.endDate);
  const slotCount = getEventSlotCount(event);
  const overlay: OverlayResult = {};

  for (const date of dates) {
    overlay[date] = new Array(slotCount).fill(0);
  }

  const availabilities = getAvailabilities(eventId);
  for (const availability of availabilities) {
    const line = overlay[availability.date];
    if (!line) {
      continue;
    }

    for (let i = 0; i < line.length; i += 1) {
      if (availability.bitset[i] === "1") {
        line[i] += 1;
      }
    }
  }

  return overlay;
}
