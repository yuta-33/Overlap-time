export type SlotMinutes = 15 | 30;

export type EventRecord = {
  id: string;
  name: string;
  timezone: "Asia/Tokyo";
  startDate: string;
  endDate: string;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes: SlotMinutes;
  createdAt: string;
};

export type ParticipantRecord = {
  id: string;
  eventId: string;
  displayName: string;
  editTokenHash: string;
  createdAt: string;
};

export type AvailabilityRecord = {
  eventId: string;
  participantId: string;
  date: string;
  bitset: string;
  updatedAt: string;
};

export type CreateEventInput = {
  name: string;
  startDate: string;
  endDate: string;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes: SlotMinutes;
};

export type OverlayResult = Record<string, number[]>;
