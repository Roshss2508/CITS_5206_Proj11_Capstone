import type { AuditEvent } from "@/src/modules/types";

export function AuditHistoryList({ events }: { events: AuditEvent[] }) {
  return (
    <section className="audit-section" id="audit">
      <div className="subsection-heading"><div><h3>Audit history</h3><p>Newest event first.</p></div></div>
      <div className="audit-list">
        {events.map((event) => (
          <div key={event.id}>
            <span className="audit-dot" />
            <div><strong>{event.action.replaceAll("_", " ")}</strong><p>{event.details}</p></div>
            <time>{new Date(event.createdAt).toLocaleString("en-AU")}</time>
          </div>
        ))}
      </div>
    </section>
  );
}
