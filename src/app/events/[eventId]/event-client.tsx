"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { getDateRange, getSlotCount, getSlotLabels } from "@/lib/time";

type EventPayload = {
  event: {
    id: string;
    name: string;
    timezone: string;
    start_date: string;
    end_date: string;
    day_start_time: string;
    day_end_time: string;
    slot_minutes: number;
  };
  participants: Array<{
    id: string;
    display_name: string;
  }>;
  availabilities: Array<{
    participant_id: string;
    date: string;
    bitset: string;
  }>;
};

type OverlayPayload = {
  overlay: Record<string, number[]>;
};

const storageKey = (eventId: string, suffix: string) => `overlap-time:${eventId}:${suffix}`;

function formatDateJp(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(d);
}

function withReplacedChar(base: string, index: number, value: "0" | "1"): string {
  return `${base.slice(0, index)}${value}${base.slice(index + 1)}`;
}

export function EventClient({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [overlay, setOverlay] = useState<Record<string, number[]>>({});
  const [participantId, setParticipantId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [ownAvailability, setOwnAvailability] = useState<Record<string, string>>({});

  const drawState = useRef<{ active: boolean; value: "0" | "1" }>({
    active: false,
    value: "1",
  });
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const realtimeOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slotCount = useMemo(() => {
    if (!payload) {
      return 0;
    }

    return getSlotCount(
      payload.event.day_start_time,
      payload.event.day_end_time,
      payload.event.slot_minutes,
    );
  }, [payload]);

  const dateRange = useMemo(() => {
    if (!payload) {
      return [];
    }

    return getDateRange(payload.event.start_date, payload.event.end_date);
  }, [payload]);

  const slotLabels = useMemo(() => {
    if (!payload) {
      return [];
    }

    return getSlotLabels(
      payload.event.day_start_time,
      payload.event.day_end_time,
      payload.event.slot_minutes,
    );
  }, [payload]);

  const participantCount = payload?.participants.length ?? 0;
  const maxOverlayCount = useMemo(() => {
    const counts = Object.values(overlay).flat();
    return counts.length > 0 ? Math.max(...counts) : 0;
  }, [overlay]);

  const refreshOverlay = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/overlay`);
    if (!response.ok) {
      return;
    }

    const body: OverlayPayload = await response.json();
    setOverlay(body.overlay);
  }, [eventId]);

  useEffect(() => {
    const stopDrawing = () => {
      drawState.current.active = false;
    };

    window.addEventListener("pointerup", stopDrawing);
    return () => {
      window.removeEventListener("pointerup", stopDrawing);
    };
  }, []);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      if (realtimeOverlayTimer.current) {
        clearTimeout(realtimeOverlayTimer.current);
        realtimeOverlayTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (!response.ok) {
          setError(response.status === 404 ? "イベントが見つかりません。" : "読み込みに失敗しました。");
          return;
        }

        const nextPayload: EventPayload = await response.json();
        setPayload(nextPayload);

        await refreshOverlay();

        const storedParticipantId = localStorage.getItem(storageKey(eventId, "participantId")) ?? "";
        const storedEditToken = localStorage.getItem(storageKey(eventId, "editToken")) ?? "";

        const dates = getDateRange(nextPayload.event.start_date, nextPayload.event.end_date);
        const eventSlotCount = getSlotCount(
          nextPayload.event.day_start_time,
          nextPayload.event.day_end_time,
          nextPayload.event.slot_minutes,
        );
        const empty = Object.fromEntries(dates.map((date) => [date, "0".repeat(eventSlotCount)]));

        if (storedParticipantId && storedEditToken) {
          setParticipantId(storedParticipantId);
          setEditToken(storedEditToken);

          const mine = nextPayload.availabilities.filter(
            (item) => item.participant_id === storedParticipantId,
          );
          const mineMap = { ...empty };
          mine.forEach((item) => {
            mineMap[item.date] = item.bitset.padEnd(eventSlotCount, "0").slice(0, eventSlotCount);
          });
          setOwnAvailability(mineMap);
        } else {
          setOwnAvailability(empty);
        }
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [eventId, refreshOverlay]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`event:${eventId}:availabilities`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availabilities",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          if (realtimeOverlayTimer.current) {
            clearTimeout(realtimeOverlayTimer.current);
          }

          realtimeOverlayTimer.current = setTimeout(() => {
            void refreshOverlay();
          }, 120);
        },
      )
      .subscribe();

    return () => {
      if (realtimeOverlayTimer.current) {
        clearTimeout(realtimeOverlayTimer.current);
        realtimeOverlayTimer.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [eventId, refreshOverlay]);

  const scheduleSave = (date: string, bitset: string) => {
    if (!participantId || !editToken) {
      return;
    }

    const current = saveTimers.current.get(date);
    if (current) {
      clearTimeout(current);
    }

    const timer = setTimeout(async () => {
      const response = await fetch(`/api/events/${eventId}/participants/${participantId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          bitset,
          edit_token: editToken,
        }),
      });

      if (response.ok) {
        await refreshOverlay();
      }

      if (response.status === 403) {
        setError("編集トークンが無効です。再参加してください。");
      }
    }, 120);

    saveTimers.current.set(date, timer);
  };

  const applyCell = (date: string, index: number, value: "0" | "1") => {
    if (index < 0 || index >= slotCount) {
      return;
    }

    setOwnAvailability((prev) => {
      const row = prev[date];
      if (!row) {
        return prev;
      }

      const replaced = withReplacedChar(row, index, value);
      scheduleSave(date, replaced);
      return { ...prev, [date]: replaced };
    });
  };

  const onCellPointerDown = (date: string, index: number) => {
    const current = ownAvailability[date]?.[index] === "1" ? "1" : "0";
    const next = current === "1" ? "0" : "1";
    drawState.current.active = true;
    drawState.current.value = next;
    applyCell(date, index, next);
  };

  const onCellPointerEnter = (date: string, index: number) => {
    if (!drawState.current.active) {
      return;
    }

    applyCell(date, index, drawState.current.value);
  };

  const onJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nameInput.trim()) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: nameInput.trim() }),
    });

    if (!response.ok) {
      setError("参加者の作成に失敗しました。");
      return;
    }

    const body: { participant_id: string; edit_token: string } = await response.json();
    localStorage.setItem(storageKey(eventId, "participantId"), body.participant_id);
    localStorage.setItem(storageKey(eventId, "editToken"), body.edit_token);

    setParticipantId(body.participant_id);
    setEditToken(body.edit_token);
    setPayload((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        participants: [
          ...prev.participants,
          {
            id: body.participant_id,
            display_name: nameInput.trim(),
          },
        ],
      };
    });

    await refreshOverlay();
  };

  if (loading) {
    return (
      <main className="page">
        <section className="panel">読み込み中...</section>
      </main>
    );
  }

  if (error && !payload) {
    return (
      <main className="page">
        <section className="panel">
          <p className="error">{error}</p>
          <Link href="/">イベント作成に戻る</Link>
        </section>
      </main>
    );
  }

  if (!payload) {
    return null;
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="event-header">
          <div>
            <h2>{payload.event.name}</h2>
            <p className="muted">
              {formatDateJp(payload.event.start_date)} - {formatDateJp(payload.event.end_date)} / {" "}
              {payload.event.day_start_time}-{payload.event.day_end_time} (JST)
            </p>
          </div>
          <span className="badge">参加者 {participantCount} 人</span>
        </div>

        <div className="legend">
          <span>操作: タップ/ドラッグで空き/不可を切替</span>
          <span>濃さ: 空き人数</span>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="row-label">日付</th>
                {slotLabels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateRange.map((date) => {
                const counts = overlay[date] ?? new Array(slotCount).fill(0);
                const own = ownAvailability[date] ?? "0".repeat(slotCount);

                return (
                  <tr key={date}>
                    <th className="row-label">{formatDateJp(date)}</th>
                    {counts.map((count, index) => {
                      const mine = own[index] === "1";
                      const ratio = maxOverlayCount > 0 ? count / maxOverlayCount : 0;
                      const alpha = 0.06 + ratio * 0.55;
                      const background = mine
                        ? `rgba(19, 103, 209, ${Math.min(alpha + 0.18, 0.88)})`
                        : `rgba(8, 65, 135, ${alpha})`;

                      return (
                        <td key={`${date}:${index}`}>
                          <button
                            type="button"
                            className={`slot-button ${mine ? "mine" : ""}`}
                            onPointerDown={() => onCellPointerDown(date, index)}
                            onPointerEnter={() => onCellPointerEnter(date, index)}
                            onPointerUp={() => {
                              drawState.current.active = false;
                            }}
                            style={{ background }}
                            title={`${date} ${slotLabels[index]} 空き人数: ${count}`}
                            aria-label={`${date} ${slotLabels[index]} 空き人数: ${count}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!participantId && (
        <div className="modal-backdrop">
          <section className="modal">
            <h3>参加者名を入力</h3>
            <p className="muted">このイベントで表示する名前を入力してください。</p>
            <form className="form" onSubmit={onJoin}>
              <label>
                表示名
                <input
                  required
                  maxLength={60}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="例: 田中"
                />
              </label>
              <button type="submit">参加する</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
