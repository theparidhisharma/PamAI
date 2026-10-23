import { BookOpen, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { eventDotClass, formatTime, StatusPill, typeGlyph } from "@/components/pam/shared";
import { evaluatePolicy, type PamCase } from "@/lib/pam-workflow";

export function CasesView({ cases, onOpenCase }: { cases: PamCase[]; onOpenCase: (id: string) => void }) {
  return (
    <section className="pam-view-card" aria-label="All cases">
      <div className="pam-section-header">
        <div><h2>All cases</h2><span className="pam-count-badge">{cases.length}</span></div>
      </div>
      <div className="pam-case-list">
        {cases.map((caseRecord) => (
          <button key={caseRecord.id} type="button" className="pam-case-row" onClick={() => onOpenCase(caseRecord.id)}>
            <span className={`pam-list-avatar avatar-${caseRecord.arrivalType.toLowerCase()}`}>{typeGlyph(caseRecord.arrivalType)}</span>
            <span className="pam-case-row-copy">
              <span className="pam-case-row-top">
                <strong>{caseRecord.person}</strong>
                <span className="pam-case-row-id">{caseRecord.id}</span>
                <StatusPill status={caseRecord.status} compact />
              </span>
              <span className="pam-case-row-sub">{caseRecord.arrivalType} · {caseRecord.organization} · {caseRecord.appointment}</span>
              <span className="pam-case-row-note">{caseNote(caseRecord)}</span>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      <div className="pam-list-foot"><span>Select a case to open its details.</span><span>Live demo state</span></div>
    </section>
  );
}

function caseNote(caseRecord: PamCase) {
  if (caseRecord.approvals.some((item) => item.status === "PENDING")) return "Manager approval request pending";
  if (caseRecord.hostRequests.some((item) => item.status === "PENDING")) return "Host confirmation request pending";
  if (caseRecord.status === "NEEDS_REVIEW") return caseRecord.requirementType === "manager_approval" ? "Needs manager approval" : "Needs host confirmation";
  if (caseRecord.status === "APPROVED") return "Approved · ready to close with a reason";
  if (caseRecord.status === "REJECTED") return "Rejected · close without access";
  if (caseRecord.status === "RESOLVED") return caseRecord.resolution ? `Resolved · ${caseRecord.resolution.reason}` : "Resolved";
  if (caseRecord.status === "CANCELLED") return "Arrival cancelled";
  return "Awaiting its next step";
}

export function PoliciesView({ cases, onOpenCase }: { cases: PamCase[]; onOpenCase: (id: string) => void }) {
  return (
    <section className="pam-policy-grid" aria-label="Configured policies">
      <p className="pam-view-intro">The authorization rules configured in this demo workspace, with their current outcome for each arrival.</p>
      {cases.map((caseRecord) => {
        const evaluation = evaluatePolicy(caseRecord);
        return (
          <article key={caseRecord.id} className="pam-view-card pam-policy-card">
            <div className="pam-policy-card-head">
              <div>
                <div className="pam-section-kicker"><span className="pam-kicker-line" />CONFIGURED RULE</div>
                <h3>{caseRecord.policyName}</h3>
              </div>
              <span className="pam-policy-number">{caseRecord.policyId}</span>
            </div>
            <p className="pam-policy-requirement">{caseRecord.requirement}</p>
            <div className="pam-policy-block">
              <span>WHY ACCESS CAN BE BLOCKED</span>
              <p>{caseRecord.requirementType === "manager_approval"
                ? "No access until an authorized manager explicitly approves this specific exception."
                : "No access until the named host explicitly confirms the visit."}</p>
            </div>
            <div className={`pam-policy-block ${evaluation.authorized ? "is-clear" : ""}`}>
              <span>CURRENT OUTCOME · CASE {caseRecord.id}</span>
              <p>{evaluation.summary} {evaluation.outstanding}</p>
            </div>
            <div className="pam-policy-card-foot">
              <StatusPill status={caseRecord.status} compact />
              <Button variant="outline" onClick={() => onOpenCase(caseRecord.id)}>Open case {caseRecord.id}<ChevronRight size={14} /></Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function ActivityView({ cases, onOpenCase }: { cases: PamCase[]; onOpenCase: (id: string) => void }) {
  const events = cases
    .flatMap((caseRecord) => caseRecord.activity.map((entry, index) => ({ ...entry, caseId: caseRecord.id, index })))
    .sort((a, b) => b.at.localeCompare(a.at) || b.index - a.index);

  return (
    <section className="pam-view-card" aria-label="Recorded activity">
      <div className="pam-section-header">
        <div><h2>Recorded events</h2><span className="pam-count-badge">{events.length}</span></div>
      </div>
      <div className="pam-activity-list">
        {events.map((entry) => (
          <button key={entry.id} type="button" className="pam-activity-row" onClick={() => onOpenCase(entry.caseId)}>
            <span className={`pam-activity-dot ${eventDotClass(entry.label)}`} />
            <span className="pam-activity-main">
              <span className="pam-activity-top"><strong>{entry.label}</strong><time>{formatTime(entry.at)}</time></span>
              <p>{entry.detail}</p>
              {entry.actor && <span className="pam-activity-actor">{entry.actor}</span>}
            </span>
            <span className="pam-activity-case">{entry.caseId}<ChevronRight size={12} /></span>
          </button>
        ))}
      </div>
      <div className="pam-list-foot"><span>Only events recorded in this demo · newest first.</span><span>Select an event to open its case.</span></div>
    </section>
  );
}

export function SettingsView({ cases, onOpenGuide, onResetDemo }: { cases: PamCase[]; onOpenGuide: () => void; onResetDemo: () => void }) {
  const eventCount = cases.reduce((count, caseRecord) => count + caseRecord.activity.length, 0);
  const decisionCount = cases.reduce(
    (count, caseRecord) =>
      count + caseRecord.approvals.filter((item) => item.status !== "PENDING").length +
      caseRecord.hostRequests.filter((item) => item.status !== "PENDING").length,
    0,
  );
  const closedCount = cases.filter((caseRecord) => ["RESOLVED", "CANCELLED"].includes(caseRecord.status)).length;

  return (
    <section className="pam-settings" aria-label="Demo settings">
      <div className="pam-view-card pam-settings-card">
        <div className="pam-section-kicker"><span className="pam-kicker-line" />DEMO ENVIRONMENT</div>
        <div className="pam-settings-row">
          <div>
            <h3>Demo workspace</h3>
            <p>This workspace is fully simulated: no notifications are sent and no physical access is granted. Cases, decisions, and activity are saved in this browser and restored when you refresh.</p>
          </div>
          <span className="pam-demo-pill"><span /> SIMULATED</span>
        </div>
        <dl className="pam-settings-facts">
          <div><dt>CASES</dt><dd>{cases.length}</dd></div>
          <div><dt>RECORDED EVENTS</dt><dd>{eventCount}</dd></div>
          <div><dt>RECORDED DECISIONS</dt><dd>{decisionCount}</dd></div>
          <div><dt>CLOSED CASES</dt><dd>{closedCount}</dd></div>
        </dl>
        <div className="pam-settings-actions">
          <Button onClick={onOpenGuide}><BookOpen size={15} /> Demo guide</Button>
          <Button variant="outline" onClick={onResetDemo}><RotateCcw size={15} /> Reset demo</Button>
        </div>
      </div>
      <div className="pam-view-card pam-settings-card">
        <div className="pam-section-kicker"><span className="pam-kicker-line" />OPERATOR</div>
        <div className="pam-settings-row">
          <div>
            <h3>Jamie Davis</h3>
            <p>Front desk operator in this demo workspace. The operator identity is part of the demo; no account is connected.</p>
          </div>
          <div className="pam-avatar">JD</div>
        </div>
      </div>
    </section>
  );
}
