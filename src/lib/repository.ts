import crypto from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createEvent as createEventInMemory,
  createParticipant as createParticipantInMemory,
  getAvailabilities as getAvailabilitiesInMemory,
  getEvent as getEventInMemory,
  getOverlay as getOverlayInMemory,
  getParticipants as getParticipantsInMemory,
  updateAvailability as updateAvailabilityInMemory,
} from "@/lib/store";
import { getDateRange, getSlotCount } from "@/lib/time";
import {
  type AvailabilityRecord,
  type CreateEventInput,
  type EventRecord,
  type OverlayResult,
  type ParticipantRecord,
} from "@/lib/types";

type DbEvent = {
  id: string;
  name: string;
  timezone: string;
  start_date: string;
  end_date: string;
  day_start_time: string;
  day_end_time: string;
  slot_minutes: number;
  created_at: string;
};

type DbParticipant = {
  id: string;
  event_id: string;
  display_name: string;
  edit_token_hash: string;
  created_at: string;
};

type DbAvailability = {
  event_id: string;
  participant_id: string;
  date: string;
  bitset: string;
  updated_at: string;
};

type GlobalWithSupabase = typeof globalThis & { __overlapTimeSupabaseAdmin?: SupabaseClient };

const globalWithSupabase = globalThis as GlobalWithSupabase;

function createId(size = 10): string {
  return crypto.randomBytes(16).toString("base64url").slice(0, size);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
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

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function mapEvent(row: DbEvent): EventRecord {
  return {
    id: row.id,
    name: row.name,
    timezone: "Asia/Tokyo",
    startDate: row.start_date,
    endDate: row.end_date,
    dayStartTime: formatTime(row.day_start_time),
    dayEndTime: formatTime(row.day_end_time),
    slotMinutes: row.slot_minutes === 15 ? 15 : 30,
    createdAt: row.created_at,
  };
}

function mapParticipant(row: DbParticipant): ParticipantRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    editTokenHash: row.edit_token_hash,
    createdAt: row.created_at,
  };
}

function mapAvailability(row: DbAvailability): AvailabilityRecord {
  return {
    eventId: row.event_id,
    participantId: row.participant_id,
    date: row.date,
    bitset: row.bitset,
    updatedAt: row.updated_at,
  };
}

function computeOverlay(event: EventRecord, availabilities: AvailabilityRecord[]): OverlayResult {
  const dates = getDateRange(event.startDate, event.endDate);
  const slotCount = getSlotCount(event.dayStartTime, event.dayEndTime, event.slotMinutes);
  const overlay: OverlayResult = {};

  for (const date of dates) {
    overlay[date] = new Array(slotCount).fill(0);
  }

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

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdminClient(): SupabaseClient {
  if (globalWithSupabase.__overlapTimeSupabaseAdmin) {
    return globalWithSupabase.__overlapTimeSupabaseAdmin;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env is missing");
  }

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  globalWithSupabase.__overlapTimeSupabaseAdmin = client;
  return client;
}

export async function createEvent(input: CreateEventInput): Promise<EventRecord> {
  if (!hasSupabaseConfig()) {
    return createEventInMemory(input);
  }

  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const eventId = createId(12);

  const { data, error } = await client
    .from("events")
    .insert({
      id: eventId,
      name: input.name,
      timezone: "Asia/Tokyo",
      start_date: input.startDate,
      end_date: input.endDate,
      day_start_time: input.dayStartTime,
      day_end_time: input.dayEndTime,
      slot_minutes: input.slotMinutes,
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createEvent failed: ${error?.message ?? "unknown"}`);
  }

  return mapEvent(data as DbEvent);
}

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  if (!hasSupabaseConfig()) {
    return getEventInMemory(eventId);
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("events").select("*").eq("id", eventId).maybeSingle();

  if (error) {
    throw new Error(`getEvent failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapEvent(data as DbEvent);
}

export async function createParticipant(
  eventId: string,
  displayName: string,
): Promise<{ participant: ParticipantRecord; editToken: string } | null> {
  if (!hasSupabaseConfig()) {
    return createParticipantInMemory(eventId, displayName);
  }

  const event = await getEvent(eventId);
  if (!event) {
    return null;
  }

  const client = getSupabaseAdminClient();
  const participantId = createId(10);
  const editToken = createId(24);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("participants")
    .insert({
      id: participantId,
      event_id: eventId,
      display_name: displayName,
      edit_token_hash: hashToken(editToken),
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createParticipant failed: ${error?.message ?? "unknown"}`);
  }

  return {
    participant: mapParticipant(data as DbParticipant),
    editToken,
  };
}

export async function getParticipants(eventId: string): Promise<ParticipantRecord[]> {
  if (!hasSupabaseConfig()) {
    return getParticipantsInMemory(eventId);
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getParticipants failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapParticipant(row as DbParticipant));
}

export async function getAvailabilities(eventId: string): Promise<AvailabilityRecord[]> {
  if (!hasSupabaseConfig()) {
    return getAvailabilitiesInMemory(eventId);
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("availabilities")
    .select("*")
    .eq("event_id", eventId)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`getAvailabilities failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapAvailability(row as DbAvailability));
}

export async function updateAvailability(input: {
  eventId: string;
  participantId: string;
  date: string;
  bitset: string;
  editToken: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "forbidden" | "invalid_date" }> {
  if (!hasSupabaseConfig()) {
    return updateAvailabilityInMemory(input);
  }

  const event = await getEvent(input.eventId);
  if (!event) {
    return { ok: false, reason: "not_found" };
  }

  const allowedDates = getDateRange(event.startDate, event.endDate);
  if (!allowedDates.includes(input.date)) {
    return { ok: false, reason: "invalid_date" };
  }

  const client = getSupabaseAdminClient();
  const { data: participant, error: participantError } = await client
    .from("participants")
    .select("*")
    .eq("id", input.participantId)
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (participantError) {
    throw new Error(`updateAvailability participant lookup failed: ${participantError.message}`);
  }

  if (!participant) {
    return { ok: false, reason: "not_found" };
  }

  if ((participant as DbParticipant).edit_token_hash !== hashToken(input.editToken)) {
    return { ok: false, reason: "forbidden" };
  }

  const slotCount = getSlotCount(event.dayStartTime, event.dayEndTime, event.slotMinutes);
  const normalizedBitset = normalizeBitset(input.bitset, slotCount);

  const { error } = await client.from("availabilities").upsert(
    {
      event_id: input.eventId,
      participant_id: input.participantId,
      date: input.date,
      bitset: normalizedBitset,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "event_id,participant_id,date",
    },
  );

  if (error) {
    throw new Error(`updateAvailability failed: ${error.message}`);
  }

  return { ok: true };
}

export async function getOverlay(eventId: string): Promise<OverlayResult | null> {
  if (!hasSupabaseConfig()) {
    return getOverlayInMemory(eventId);
  }

  const event = await getEvent(eventId);
  if (!event) {
    return null;
  }

  const availabilities = await getAvailabilities(eventId);
  return computeOverlay(event, availabilities);
}
