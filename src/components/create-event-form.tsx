"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type CreateEventFormState = {
  name: string;
  startDate: string;
  endDate: string;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes: "15" | "30";
};

function todayJst(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function CreateEventForm() {
  const router = useRouter();
  const today = useMemo(() => todayJst(), []);
  const [form, setForm] = useState<CreateEventFormState>({
    name: "",
    startDate: today,
    endDate: today,
    dayStartTime: "09:00",
    dayEndTime: "23:00",
    slotMinutes: "30",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          start_date: form.startDate,
          end_date: form.endDate,
          day_start_time: form.dayStartTime,
          day_end_time: form.dayEndTime,
          slot_minutes: Number(form.slotMinutes),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "イベント作成に失敗しました。");
        return;
      }

      const body: { event_url: string } = await response.json();
      router.push(body.event_url);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        イベント名
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="例: 来週の打ち合わせ"
        />
      </label>

      <div className="row two">
        <label>
          開始日
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </label>

        <label>
          終了日
          <input
            type="date"
            required
            value={form.endDate}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </label>
      </div>

      <div className="row two">
        <label>
          表示開始
          <input
            type="time"
            required
            value={form.dayStartTime}
            onChange={(e) => setForm((prev) => ({ ...prev, dayStartTime: e.target.value }))}
          />
        </label>

        <label>
          表示終了
          <input
            type="time"
            required
            value={form.dayEndTime}
            onChange={(e) => setForm((prev) => ({ ...prev, dayEndTime: e.target.value }))}
          />
        </label>
      </div>

      <label>
        スロット粒度
        <select
          value={form.slotMinutes}
          onChange={(e) => setForm((prev) => ({ ...prev, slotMinutes: e.target.value as "15" | "30" }))}
        >
          <option value="15">15分</option>
          <option value="30">30分</option>
        </select>
      </label>

      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "作成中..." : "イベントを作成"}
      </button>
    </form>
  );
}
