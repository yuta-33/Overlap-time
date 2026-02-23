import { CreateEventForm } from "@/components/create-event-form";

export default function HomePage() {
  return (
    <main className="page">
      <section className="panel">
        <h1>overlap-time</h1>
        <p className="muted">ログイン不要で、空き時間を重ねて候補を見つけます。</p>
        <CreateEventForm />
      </section>
    </main>
  );
}
