import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  FileClock,
  Home,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldX,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ActivityView, CasesView, PoliciesView, SettingsView } from "@/components/pam/desk-views";
import { formatTime, StatusPill, typeGlyph } from "@/components/pam/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelCase,
  decideManagerRequest,
  evaluatePolicy,
  loadCases,
  NO_ACCESS_RESOLUTION_REASONS,
  recordHostResponse,
  requestHostConfirmation,
  requestManagerApproval,
  resetCases,
  resolveCase,
  SIMULATED_HOST,
  SIMULATED_MANAGER,
  STORAGE_KEY,
  type ArrivalType,
  type PamCase,
} from "@/lib/pam-workflow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "pam. — Arrival exception desk" },
      { name: "description", content: "Pam's simulated arrival and exception-management desk." },
      { property: "og:title", content: "pam. — Arrival exception desk" },
      { property: "og:description", content: "A clear, auditable demo workflow for arrival exceptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PamDesk,
});

type View = "desk" | "cases" | "case" | "policies" | "activity" | "settings";

type ConfirmAction =
  | { type: "manager"; decision: "APPROVED" | "REJECTED"; requestId: string }
  | { type: "host"; response: "CONFIRMED" | "DECLINED"; requestId: string }
  | { type: "resolve"; reason: string }
  | { type: "cancel" }
  | { type: "reset" };

const NAV: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "desk", label: "Live Desk", icon: Home },
  { view: "cases", label: "Cases", icon: ClipboardList },
  { view: "policies", label: "Policies", icon: ShieldCheck },
  { view: "activity", label: "Activity", icon: FileClock },
  { view: "settings", label: "Settings", icon: SettingsIcon },
];

const ARRIVAL_TYPES: ArrivalType[] = ["Delivery", "Contractor", "Visitor"];

const GUIDE_STEPS = [
  {
    id: "DL-204",
    title: "Early delivery · Jordan Lee",
    steps: [
      "Select the arrival on the Live Desk or in Cases.",
      "Request manager approval, then review the request as the simulated manager.",
      "Approve or reject the exception, watch the timeline update, then close the case with a reason.",
    ],
  },
  {
    id: "MT-118",
    title: "Contractor · Morgan Torres",
    steps: [
      "Select the case to see the missing site-access approval.",
      "Request approval and act as the simulated manager.",
      "Approve to authorize, or reject and close the case without access.",
    ],
  },
  {
    id: "VIS-082",
    title: "Visitor · Riley Chen",
    steps: [
      "Select the case to see the host-confirmation requirement.",
      "Request host confirmation, then simulate the host response as confirmed or declined.",
      "Resolve the case once the workflow permits it.",
    ],
  },
];

function PamDesk() {
  const [cases, setCases] = useState<PamCase[] | null>(null);
  const [selectedId, setSelectedId] = useState("DL-204");
  const [view, setView] = useState<View>("desk");
  const [query, setQuery] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalType | "all">("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [demoInfoOpen, setDemoInfoOpen] = useState(false);

  useEffect(() => {
    setCases(loadCases(window.localStorage));
  }, []);

  const selectedCase = cases?.find((caseRecord) => caseRecord.id === selectedId) ?? cases?.[0];
  const filteredCases = useMemo(() => {
    if (!cases) return [];
    let result = cases;
    if (arrivalFilter !== "all") result = result.filter((caseRecord) => caseRecord.arrivalType === arrivalFilter);
    const normalized = query.trim().toLowerCase();
    if (normalized) {
      result = result.filter((caseRecord) =>
        [caseRecord.id, caseRecord.person, caseRecord.organization, caseRecord.arrivalType, caseRecord.status]
          .some((value) => value.toLowerCase().includes(normalized)),
      );
    }
    return result;
  }, [cases, query, arrivalFilter]);

  function openCase(id: string) {
    setSelectedId(id);
    setView("case");
    setError("");
    setNotice("");
  }

  function saveCase(updated: PamCase, message: string) {
    setCases((current) => {
      if (!current) return current;
      const next = current.map((item) => item.id === updated.id ? updated : item);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        setError("Your browser could not save this demo action. It will remain visible until you refresh.");
      }
      return next;
    });
    setError("");
    setNotice(message);
  }

  function runAction(action: () => PamCase, message: string) {
    try {
      saveCase(action(), message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This action could not be completed.");
    }
  }

  function runConfirmedAction() {
    if (!selectedCase || !confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    setRejectionReason("");
    if (action.type === "reset") {
      const initial = resetCases(window.localStorage);
      setCases(initial);
      setSelectedId("DL-204");
      setResolutionReason("");
      setError("");
      setNotice("The demo has been reset to its original three arrival scenarios.");
      return;
    }
    if (action.type === "manager") {
      const reason = rejectionReason.trim() || "Manager declined this exception.";
      runAction(
        () => decideManagerRequest(selectedCase, action.requestId, action.decision, reason),
        action.decision === "APPROVED"
          ? "Manager approval recorded in the demo. Policy re-evaluated; the case remains open."
          : "Manager rejection recorded in the demo. Access remains unauthorized.",
      );
      return;
    }
    if (action.type === "host") {
      runAction(
        () => recordHostResponse(selectedCase, action.requestId, action.response),
        action.response === "CONFIRMED"
          ? "Host confirmation recorded in the demo. Policy re-evaluated."
          : "Host declined in the demo. Access remains unauthorized.",
      );
      return;
    }
    if (action.type === "resolve") {
      runAction(() => resolveCase(selectedCase, action.reason, true), "Resolution recorded. The case is closed; closure does not itself grant access.");
      setResolutionReason("");
      return;
    }
    runAction(() => cancelCase(selectedCase), "Arrival cancelled in the demo. Access is not authorized.");
  }

  if (!cases || !selectedCase) {
    return (
      <div className="pam-loading" aria-label="Loading Pam">
        <div className="pam-loading-card">
          <span className="pam-loading-kicker">PAM · APPROVAL DESK</span>
          <div className="pam-loading-word">pam<span>.</span></div>
          <div className="pam-loading-track" aria-hidden="true"><div className="pam-loading-fill" /></div>
          <p className="pam-loading-note">Setting up the live desk, cases and policies…</p>
          <div className="pam-loading-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  const activeCount = cases.filter((item) => !["RESOLVED", "CANCELLED"].includes(item.status)).length;
  const awaitingCount = cases.filter((item) => ["AWAITING_APPROVAL", "AWAITING_CONFIRMATION"].includes(item.status)).length;
  const approvedCount = cases.filter((item) => evaluatePolicy(item).authorized).length;
  const resolvedCount = cases.filter((item) => item.status === "RESOLVED" || item.status === "CANCELLED").length;

  const notifications = cases.flatMap((caseRecord) => [
    ...caseRecord.approvals.filter((item) => item.status === "PENDING").map((item) => ({
      id: item.id,
      caseId: caseRecord.id,
      title: "Manager approval pending",
      detail: `${caseRecord.person} · ${caseRecord.policyName}`,
    })),
    ...caseRecord.hostRequests.filter((item) => item.status === "PENDING").map((item) => ({
      id: item.id,
      caseId: caseRecord.id,
      title: "Host confirmation pending",
      detail: `${caseRecord.person} · ${caseRecord.policyName}`,
    })),
  ]);

  const requestApproval = () => runAction(
    () => requestManagerApproval(selectedCase),
    "Manager approval request created in the demo only. No external message was sent.",
  );
  const requestHost = () => runAction(
    () => requestHostConfirmation(selectedCase),
    "Host-confirmation request created in the demo only. No external message was sent.",
  );

  function reviewAsManager() {
    setError("");
    setNotice("");
    document.getElementById("pam-manager-review")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function requestResolution() {
    if (!resolutionReason) {
      setError("Choose how this case is being resolved before closing it.");
      return;
    }
    setConfirmAction({ type: "resolve", reason: resolutionReason });
    setError("");
  }

  const panelProps = {
    caseRecord: selectedCase,
    onRequestApproval: requestApproval,
    onReviewAsManager: reviewAsManager,
    onRequestHost: requestHost,
    onManagerDecision: (decision: "APPROVED" | "REJECTED", requestId: string) => setConfirmAction({ type: "manager", decision, requestId }),
    onHostResponse: (response: "CONFIRMED" | "DECLINED", requestId: string) => setConfirmAction({ type: "host", response, requestId }),
    onCancelArrival: () => setConfirmAction({ type: "cancel" }),
    resolutionReason,
    onResolutionReasonChange: setResolutionReason,
    onRequestResolution: requestResolution,
  };

  const isCaseView = view === "case";
  const heading = isCaseView
    ? { eyebrow: "WORKSPACE · CASES", title: `Case ${selectedCase.id}`, subtitle: `${selectedCase.person} · ${selectedCase.organization}` }
    : view === "desk"
      ? { eyebrow: "FRONT DESK · LIVE VIEW", title: "Arrival desk", subtitle: "Every arrival, one clear next step." }
      : view === "cases"
        ? { eyebrow: "WORKSPACE · CASES", title: "Cases", subtitle: "The three demo arrivals and their current state." }
        : view === "policies"
          ? { eyebrow: "WORKSPACE · POLICIES", title: "Policies", subtitle: "The authorization rules configured in this demo." }
          : view === "activity"
            ? { eyebrow: "WORKSPACE · ACTIVITY", title: "Activity", subtitle: "Every recorded demo event, newest first." }
            : { eyebrow: "WORKSPACE · SETTINGS", title: "Settings", subtitle: "Demo environment and controls." };

  const breadcrumbLabel = isCaseView ? `Case ${selectedCase.id}` : NAV.find((item) => item.view === view)?.label ?? "Arrival desk";

  return (
    <div className="pam-shell">
      <aside className="pam-sidebar">
        <div className="pam-brand"><span className="pam-brand-mark">p</span><span>pam<span className="pam-brand-dot">.</span></span></div>
        <div className="pam-sidebar-caption">WORKSPACE</div>
        <nav className="pam-nav" aria-label="Main navigation">
          {NAV.map((item) => {
            const active = view === item.view || (isCaseView && item.view === "cases");
            return (
              <button
                key={item.view}
                type="button"
                className={`pam-nav-item ${active ? "pam-nav-item-active" : ""}`}
                onClick={() => setView(item.view)}
                title={item.label}
                aria-current={active ? "page" : undefined}
              >
                <item.icon size={17} /><span>{item.label}</span>{active && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <div className="pam-sidebar-bottom">
          <div className="pam-demo-indicator"><span className="pam-pulse-dot" />DEMO WORKSPACE</div>
          <div className="pam-profile">
            <div className="pam-avatar">JD</div>
            <div className="pam-profile-copy"><strong>Jamie Davis</strong><span>Front desk operator</span></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="pam-profile-menu" aria-label="Operator menu" title="Operator menu">•••</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onSelect={() => setGuideOpen(true)}>Demo guide</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setView("settings")}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirmAction({ type: "reset" })}>Reset demo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <main className="pam-main">
        <header className="pam-topbar">
          <div className="pam-breadcrumb"><span>Operations</span><ChevronRight size={14} /><strong>{breadcrumbLabel}</strong></div>
          <div className="pam-top-actions">
            <span className="pam-clock"><Clock3 size={15} />{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="pam-demo-pill"><span /> SIMULATED</span>
            <Button variant="ghost" size="icon" aria-label="Demo guide" title="Demo guide" onClick={() => setGuideOpen(true)}>
              <BookOpen size={16} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Reset demo" title="Reset demo" onClick={() => setConfirmAction({ type: "reset" })}>
              <RotateCcw size={16} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Notifications · ${notifications.length} pending`} title="Notifications" className={notifications.length ? "pam-icon-active" : ""}>
                  <Bell size={17} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="pam-notif-menu">
                <DropdownMenuLabel>Pending demo requests</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 && <div className="pam-notif-empty">No pending requests.</div>}
                {notifications.map((item) => (
                  <DropdownMenuItem key={item.id} className="pam-notif-item" onSelect={() => openCase(item.caseId)}>
                    <span className="pam-notif-title">{item.title}</span>
                    <span className="pam-notif-detail">{item.caseId} · {item.detail}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="pam-avatar-button" aria-label="Open settings" title="Open settings" onClick={() => setView("settings")}>
              <span className="pam-avatar pam-avatar-small">JD</span>
            </Button>
          </div>
        </header>

        <div className="pam-content">
          <section className="pam-page-heading">
            <div>
              <div className="pam-eyebrow"><span className="pam-eyebrow-line" />{heading.eyebrow}</div>
              <h1>{heading.title}</h1>
              <p>{heading.subtitle}</p>
            </div>
            {view === "desk" && <div className="pam-live-label"><span /> Demo activity is stored in this browser</div>}
          </section>

          {(notice || error) && (
            <div className={`pam-notice ${error ? "pam-notice-error" : "pam-notice-success"}`} role={error ? "alert" : "status"}>
              {error ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
              <span>{error || notice}</span>
              <Button variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></Button>
            </div>
          )}

          {view === "desk" && (
            <>
              <section className="pam-metrics" aria-label="Case summary">
                <Metric icon={<UsersRound size={17} />} label="Open cases" value={activeCount} accent="neutral" detail="Awaiting a next step" />
                <Metric icon={<Clock3 size={17} />} label="Awaiting action" value={awaitingCount} accent="pending" detail="Approval or confirmation" />
                <Metric icon={<ShieldCheck size={17} />} label="Policy allows access" value={approvedCount} accent="success" detail="Recorded requirements met" />
                <Metric icon={<CheckCircle2 size={17} />} label="Closed" value={resolvedCount} accent="neutral" detail="Resolved or cancelled" />
              </section>

              <div className="pam-workspace">
                <section className="pam-arrivals" aria-label="Arrivals">
                  <div className="pam-section-header">
                    <div><h2>Today’s arrivals</h2><span className="pam-count-badge">{filteredCases.length}</span></div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={arrivalFilter === "all" ? "Filter arrivals" : `Filtering ${arrivalFilter}s`}
                          title={arrivalFilter === "all" ? "Filter arrivals" : `Showing ${arrivalFilter}s — open to change`}
                          className={arrivalFilter !== "all" ? "pam-icon-active" : ""}
                        >
                          <ArrowDownLeft size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filter by arrival type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setArrivalFilter("all")}>All arrivals ({cases.length})</DropdownMenuItem>
                        {ARRIVAL_TYPES.map((type) => (
                          <DropdownMenuItem key={type} onSelect={() => setArrivalFilter(type)}>
                            {type}s ({cases.filter((caseRecord) => caseRecord.arrivalType === type).length})
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <label className="pam-search"><Search size={15} /><Input aria-label="Search arrivals" placeholder="Search name, company, or case…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                  <div className="pam-list-columns"><span>ARRIVAL</span><span>STATUS</span></div>
                  <div className="pam-arrival-list">
                    {filteredCases.map((caseRecord) => (
                      <ArrivalRow
                        key={caseRecord.id}
                        caseRecord={caseRecord}
                        selected={caseRecord.id === selectedCase.id}
                        onSelect={() => { setSelectedId(caseRecord.id); setError(""); setNotice(""); }}
                      />
                    ))}
                    {filteredCases.length === 0 && (
                      <div className="pam-empty-search">
                        No arrivals match {arrivalFilter !== "all" ? `${arrivalFilter.toLowerCase()}s ` : ""}
                        {query ? `matching “${query}”` : ""}.
                      </div>
                    )}
                  </div>
                  <div className="pam-list-foot"><span><span className="pam-pulse-dot" /> All arrivals up to date</span><span>Updated just now</span></div>
                </section>

                <CasePanel {...panelProps} />
              </div>
            </>
          )}

          {isCaseView && (
            <div className="pam-panel-page">
              <div className="pam-panel-top">
                <Button variant="ghost" size="sm" className="pam-back-button" onClick={() => setView("cases")}>
                  <ChevronLeft size={15} /> Back to cases
                </Button>
              </div>
              <CasePanel {...panelProps} />
            </div>
          )}

          {view === "cases" && <CasesView cases={cases} onOpenCase={openCase} />}
          {view === "policies" && <PoliciesView cases={cases} onOpenCase={openCase} />}
          {view === "activity" && <ActivityView cases={cases} onOpenCase={openCase} />}
          {view === "settings" && <SettingsView cases={cases} onOpenGuide={() => setGuideOpen(true)} onResetDemo={() => setConfirmAction({ type: "reset" })} />}

          <footer className="pam-footer">
            <span>pam<span>.</span> arrival desk</span>
            <span>All decisions, messages, and responses shown are simulated.</span>
            <button type="button" className="pam-footer-link" onClick={() => setDemoInfoOpen(true)}>Privacy &amp; demo information</button>
          </footer>
        </div>
      </main>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="pam-confirm-dialog">
          <DialogHeader>
            <div className="pam-confirm-icon">{confirmAction?.type === "manager" ? confirmAction.decision === "APPROVED" ? <ShieldCheck size={20} /> : <ShieldX size={20} /> : confirmAction?.type === "resolve" ? <CheckCircle2 size={20} /> : confirmAction?.type === "reset" ? <RotateCcw size={20} /> : confirmAction?.type === "host" ? <UsersRound size={20} /> : <X size={20} />}</div>
            <DialogTitle>{confirmationTitle(confirmAction)}</DialogTitle>
            <DialogDescription>{confirmationDescription(confirmAction, selectedCase.id)}</DialogDescription>
          </DialogHeader>
          {confirmAction?.type === "manager" && confirmAction.decision === "REJECTED" && (
            <label className="pam-reason-label">Reason for rejection <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Manager declined this exception." maxLength={240} /></label>
          )}
          {confirmAction?.type === "resolve" && <div className="pam-confirm-detail"><strong>{confirmAction.reason}</strong><span>{evaluatePolicy(selectedCase).authorized ? "Access remains authorized under the recorded policy decision; case closure is separate." : "This resolution closes the case without authorizing access."}</span></div>}
          {confirmAction?.type === "reset" && <div className="pam-confirm-detail"><strong>Return to the original scenarios</strong><span>Saved requests, decisions, and timeline activity will be cleared from this browser.</span></div>}
          <DialogFooter className="pam-confirm-footer">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Go back</Button>
            <Button variant={confirmAction?.type === "manager" && confirmAction.decision === "REJECTED" || confirmAction?.type === "host" && confirmAction.response === "DECLINED" || confirmAction?.type === "cancel" ? "destructive" : "default"} onClick={runConfirmedAction}>{confirmationButton(confirmAction)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="pam-confirm-dialog">
          <DialogHeader>
            <div className="pam-confirm-icon"><BookOpen size={20} /></div>
            <DialogTitle>Demo guide</DialogTitle>
            <DialogDescription>Three arrival scenarios, one workflow each. Everything is simulated and saved in this browser.</DialogDescription>
          </DialogHeader>
          <div className="pam-guide-steps">
            {GUIDE_STEPS.map((scenario) => (
              <div key={scenario.id} className="pam-guide-step">
                <strong>{scenario.id} · {scenario.title}</strong>
                <ol>
                  {scenario.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
            ))}
          </div>
          <DialogFooter className="pam-confirm-footer">
            <Button variant="outline" onClick={() => setGuideOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={demoInfoOpen} onOpenChange={setDemoInfoOpen}>
        <DialogContent className="pam-confirm-dialog">
          <DialogHeader>
            <div className="pam-confirm-icon"><ShieldCheck size={20} /></div>
            <DialogTitle>Privacy &amp; demo information</DialogTitle>
            <DialogDescription>What this workspace does and does not do.</DialogDescription>
          </DialogHeader>
          <div className="pam-confirm-detail">
            <strong>Everything here is simulated</strong>
            <span>No notifications, emails, or physical access actions occur. Manager decisions, host responses, and activity records are demo inputs only.</span>
          </div>
          <div className="pam-confirm-detail">
            <strong>Saved in this browser</strong>
            <span>Cases, decisions, and activity are stored only in this browser and restored on refresh. Reset demo (top bar or Settings) returns the three original scenarios and clears saved decisions and activity.</span>
          </div>
          <DialogFooter className="pam-confirm-footer">
            <Button variant="outline" onClick={() => setDemoInfoOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CasePanelProps = {
  caseRecord: PamCase;
  onRequestApproval: () => void;
  onReviewAsManager: () => void;
  onRequestHost: () => void;
  onManagerDecision: (decision: "APPROVED" | "REJECTED", requestId: string) => void;
  onHostResponse: (response: "CONFIRMED" | "DECLINED", requestId: string) => void;
  onCancelArrival: () => void;
  resolutionReason: string;
  onResolutionReasonChange: (reason: string) => void;
  onRequestResolution: () => void;
};

function CasePanel({
  caseRecord,
  onRequestApproval,
  onReviewAsManager,
  onRequestHost,
  onManagerDecision,
  onHostResponse,
  onCancelArrival,
  resolutionReason,
  onResolutionReasonChange,
  onRequestResolution,
}: CasePanelProps) {
  const evaluation = evaluatePolicy(caseRecord);
  const pendingApproval = [...caseRecord.approvals].reverse().find((item) => item.status === "PENDING");
  const pendingHost = [...caseRecord.hostRequests].reverse().find((item) => item.status === "PENDING");
  const isClosed = ["RESOLVED", "CANCELLED"].includes(caseRecord.status);

  return (
    <section className="pam-case-panel" aria-label={`Case ${caseRecord.id}`}>
      <div className="pam-case-topline">
        <div className="pam-case-id"><span className="pam-case-id-mark">↗</span> CASE <strong>{caseRecord.id}</strong></div>
        <StatusPill status={caseRecord.status} />
      </div>
      <div className="pam-person-heading">
        <div className={`pam-person-symbol pam-person-${caseRecord.arrivalType.toLowerCase()}`}>
          {typeGlyph(caseRecord.arrivalType, 19)}
        </div>
        <div className="pam-person-copy"><div className="pam-person-name-line"><h2>{caseRecord.person}</h2><span className="pam-arrival-type">{caseRecord.arrivalType}</span></div><p>{caseRecord.organization}</p></div>
        <Button variant="outline" size="sm" className="pam-more-button" onClick={onCancelArrival} disabled={isClosed}><X size={14} /> Cancel arrival</Button>
      </div>

      <div className="pam-case-facts">
        <div className="pam-fact"><span>ARRIVAL</span><strong>{caseRecord.appointment}</strong></div>
        <div className="pam-fact"><span>CHECKED IN</span><strong>{formatTime(caseRecord.arrivalAt)}</strong></div>
        <div className="pam-fact"><span>RESPONSIBLE</span><strong>{caseRecord.requirementType === "manager_approval" ? "Simulated manager" : "Visit host · Avery Patel"}</strong></div>
      </div>

      <section className={`pam-policy-outcome ${evaluation.authorized ? "is-authorized" : "is-blocked"}`}>
        <div className="pam-policy-icon">{evaluation.authorized ? <ShieldCheck size={19} /> : <ShieldX size={19} />}</div>
        <div className="pam-policy-copy">
          <div className="pam-policy-title">{evaluation.authorized ? "Policy requirement satisfied" : "Access not authorized"}<span className={`pam-auth-label ${evaluation.authorized ? "auth-yes" : "auth-no"}`}>{evaluation.authorized ? "AUTHORIZED BY POLICY" : "NOT AUTHORIZED"}</span></div>
          <p>{evaluation.outstanding}</p>
        </div>
      </section>

      <section className="pam-next-step">
        <div className="pam-section-kicker"><span className="pam-kicker-line" /> NEXT STEP</div>
        <div className="pam-next-copy">
          <h3>{nextAction(caseRecord, evaluation.authorized)}</h3>
          <p>{nextDescription(caseRecord, evaluation.authorized)}</p>
        </div>
        <div className="pam-action-area">
          {caseRecord.status === "NEEDS_REVIEW" && caseRecord.requirementType === "manager_approval" && !caseRecord.approvals.some((item) => item.status === "REJECTED") && (
            <Button onClick={onRequestApproval}><ArrowUpRight size={16} /> Request manager approval</Button>
          )}
          {caseRecord.status === "AWAITING_APPROVAL" && pendingApproval && (
            <div className="pam-request-preview">
              <span className="pam-request-indicator"><Clock3 size={14} /> Request pending</span>
              <Button variant="outline" onClick={onReviewAsManager}>Review as simulated manager <ChevronRight size={15} /></Button>
            </div>
          )}
          {caseRecord.status === "NEEDS_REVIEW" && caseRecord.requirementType === "host_confirmation" && !caseRecord.hostRequests.some((item) => item.status === "CONFIRMED") && (
            <Button onClick={onRequestHost}><ArrowUpRight size={16} /> Request host confirmation</Button>
          )}
          {caseRecord.status === "AWAITING_CONFIRMATION" && pendingHost && (
            <div className="pam-host-actions">
              <span className="pam-request-indicator"><Clock3 size={14} /> Host response pending</span>
              <div><Button variant="outline" onClick={() => onHostResponse("CONFIRMED", pendingHost.id)}><Check size={15} /> Confirm in demo</Button><Button variant="outline" className="pam-reject-outline" onClick={() => onHostResponse("DECLINED", pendingHost.id)}><X size={15} /> Decline in demo</Button></div>
              <span className="pam-simulated-note">Simulated host interaction · no message sent</span>
            </div>
          )}
          {caseRecord.status === "APPROVED" && <div className="pam-approved-next"><CheckCircle2 size={16} /> Approval recorded. Review the policy outcome, then close the case with a reason.</div>}
          {caseRecord.status === "REJECTED" && <div className="pam-rejected-next"><ShieldX size={16} /><span><strong>Rejected · access stays unauthorized.</strong> Reschedule or close without access.</span></div>}
          {caseRecord.status === "NEEDS_REVIEW" && caseRecord.requirementType === "host_confirmation" && caseRecord.hostRequests.some((item) => item.status === "DECLINED") && <div className="pam-rejected-next"><ShieldX size={16} /><span><strong>Host declined · access stays unauthorized.</strong> Reschedule or close without access.</span></div>}
          {caseRecord.status === "NEEDS_REVIEW" && caseRecord.requirementType === "manager_approval" && caseRecord.approvals.some((item) => item.status === "REJECTED") && <div className="pam-rejected-next"><ShieldX size={16} /><span><strong>Manager rejected · access stays unauthorized.</strong> Reschedule or close without access.</span></div>}
          {caseRecord.status === "RESOLVED" && <div className="pam-closed-callout"><CheckCircle2 size={16} /> Case closed · {evaluation.authorized ? "exception approved; access permitted by policy." : "without access authorization."}</div>}
          {caseRecord.status === "CANCELLED" && <div className="pam-closed-callout"><X size={16} /> Arrival cancelled · access is not authorized.</div>}
          {!isClosed && (
            <div className="pam-resolution-row">
              <Select value={resolutionReason} onValueChange={onResolutionReasonChange}>
                <SelectTrigger aria-label="Resolution reason" className="pam-resolution-select"><SelectValue placeholder="Choose resolution reason" /></SelectTrigger>
                <SelectContent>
                  {evaluation.authorized && <SelectItem value="Approved exception handled">Approved exception handled</SelectItem>}
                  {!evaluation.authorized && NO_ACCESS_RESOLUTION_REASONS.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={onRequestResolution}><CheckCircle2 size={15} /> Close case</Button>
            </div>
          )}
        </div>
      </section>

      {caseRecord.status === "AWAITING_APPROVAL" && pendingApproval && (
        <section className="pam-manager-review" id="pam-manager-review">
          <div className="pam-manager-header"><div className="pam-manager-icon"><ShieldCheck size={16} /></div><div><h3>Manager review</h3><p>Acting as {SIMULATED_MANAGER}</p></div><Badge variant="outline" className="pam-pending-tag">PENDING</Badge></div>
          <div className="pam-review-id"><span>REQUEST {pendingApproval.id}</span><span>CREATED {formatTime(pendingApproval.createdAt)}</span></div>
          <div className="pam-review-grid"><div><span>POLICY &amp; REQUIREMENT</span><strong>{caseRecord.policyId} · {caseRecord.policyName}</strong><p>{caseRecord.requirement}</p></div><div><span>FACTS FOR REVIEW</span>{caseRecord.facts.map((fact) => <p className="pam-fact-line" key={fact}><CircleDot size={12} />{fact}</p>)}</div></div>
          <div className="pam-requested-action"><span>REQUESTED ACTION</span><strong>{pendingApproval.action}</strong></div>
          <div className="pam-manager-actions"><span>Decision recorded as <strong>{SIMULATED_MANAGER}</strong></span><div><Button variant="outline" className="pam-reject-outline" onClick={() => onManagerDecision("REJECTED", pendingApproval.id)}><X size={15} /> Reject</Button><Button onClick={() => onManagerDecision("APPROVED", pendingApproval.id)}><Check size={15} /> Approve request</Button></div></div>
        </section>
      )}

      <section className="pam-policy-reference">
        <div className="pam-policy-ref-header"><div><div className="pam-section-kicker"><span className="pam-kicker-line" /> APPLIED POLICY</div><h3>{caseRecord.policyName}</h3></div><span className="pam-policy-number">{caseRecord.policyId}</span></div>
        <p>{caseRecord.requirement}</p>
        <div className="pam-policy-result"><span className={evaluation.authorized ? "pam-result-dot result-ok" : "pam-result-dot result-wait"} /> {evaluation.summary}<span>{evaluation.authorized ? "PASS" : "ACTION REQUIRED"}</span></div>
      </section>

      <section className="pam-timeline">
        <div className="pam-timeline-heading"><div><div className="pam-section-kicker"><span className="pam-kicker-line" /> CASE HISTORY</div><h3>Activity timeline</h3></div><span className="pam-timeline-count">{caseRecord.activity.length} events</span></div>
        <div className="pam-timeline-list">
          {[...caseRecord.activity].reverse().map((entry, index) => (
            <div className={`pam-timeline-event ${index === 0 ? "event-latest" : ""}`} key={entry.id}>
              <div className="pam-timeline-rail"><span className={eventDotClassFor(entry.label)} />{index < caseRecord.activity.length - 1 && <i />}</div>
              <div className="pam-event-body"><div className="pam-event-title-line"><strong>{entry.label}</strong><time>{formatTime(entry.at)}</time></div><p>{entry.detail}</p>{entry.actor && <span className="pam-event-actor"><UserRound size={11} />{entry.actor}</span>}</div>
            </div>
          ))}
        </div>
        <div className="pam-history-foot"><FileClock size={14} /> Events are saved in this browser for the demo.</div>
      </section>
    </section>
  );
}

function eventDotClassFor(label: string) {
  if (label.includes("rejected") || label.includes("declined")) return "event-dot-danger";
  if (label.includes("approved") || label.includes("received") || label.includes("closed")) return "event-dot-success";
  if (label.includes("requested")) return "event-dot-pending";
  return "event-dot-neutral";
}

function Metric({ icon, label, value, accent, detail }: { icon: React.ReactNode; label: string; value: number; accent: string; detail: string }) {
  return <div className="pam-metric"><div className={`pam-metric-icon metric-${accent}`}>{icon}</div><div className="pam-metric-label">{label}</div><div className="pam-metric-bottom"><strong>{value.toString().padStart(2, "0")}</strong><span>{detail}</span></div></div>;
}

function ArrivalRow({ caseRecord, selected, onSelect }: { caseRecord: PamCase; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`pam-arrival-row ${selected ? "is-selected" : ""}`} onClick={onSelect} aria-current={selected ? "true" : undefined}>
      <span className={`pam-list-avatar avatar-${caseRecord.arrivalType.toLowerCase()}`}>{typeGlyph(caseRecord.arrivalType)}</span>
      <span className="pam-arrival-copy"><span className="pam-arrival-title"><strong>{caseRecord.person}</strong><span>{caseRecord.id}</span></span><span className="pam-arrival-subtitle">{caseRecord.arrivalType} · {caseRecord.organization}</span></span>
      <StatusPill status={caseRecord.status} compact />
    </button>
  );
}

function nextAction(caseRecord: PamCase, authorized: boolean) {
  if (caseRecord.status === "AWAITING_APPROVAL") return "A manager decision is needed";
  if (caseRecord.status === "AWAITING_CONFIRMATION") return "Waiting for the named host";
  if (caseRecord.status === "APPROVED") return "Close the exception when handled";
  if (caseRecord.status === "REJECTED") return "Choose a safe, non-access resolution";
  if (caseRecord.status === "RESOLVED") return "This case is closed";
  if (caseRecord.status === "CANCELLED") return "This arrival was cancelled";
  if (authorized) return "Review the recorded decision";
  return caseRecord.requirementType === "manager_approval" ? "Manager approval is required" : "Host confirmation is required";
}

function nextDescription(caseRecord: PamCase, authorized: boolean) {
  if (caseRecord.status === "AWAITING_APPROVAL") return "Review the policy facts below. Approval records the specific exception, not case closure.";
  if (caseRecord.status === "AWAITING_CONFIRMATION") return "A host must explicitly respond. A pending request does not authorize entry.";
  if (caseRecord.status === "APPROVED") return "The decision is recorded and policy re-evaluated. Close separately with a reason.";
  if (caseRecord.status === "REJECTED") return "Access stays unauthorized. You can reschedule or close the case without access.";
  if (caseRecord.status === "RESOLVED") return caseRecord.resolution?.reason ?? "Resolution recorded.";
  if (caseRecord.status === "CANCELLED") return caseRecord.cancellation?.reason ?? "Arrival cancelled.";
  if (authorized) return "No mandatory policy requirement remains outstanding.";
  return caseRecord.requirementType === "manager_approval"
    ? "Only an authorized simulated manager can approve this specific exception."
    : "Only an explicit confirmation by the simulated visit host satisfies this policy.";
}

function confirmationTitle(action: ConfirmAction | null) {
  if (!action) return "Confirm action";
  if (action.type === "manager") return action.decision === "APPROVED" ? "Approve this exception?" : "Reject this exception?";
  if (action.type === "host") return action.response === "CONFIRMED" ? "Record host confirmation?" : "Record host decline?";
  if (action.type === "resolve") return "Close this case?";
  if (action.type === "cancel") return "Cancel this arrival?";
  return "Reset the demo?";
}

function confirmationDescription(action: ConfirmAction | null, caseId: string) {
  if (!action) return "Review the action before it is recorded.";
  if (action.type === "manager") return `Case ${caseId} · ${action.decision === "APPROVED" ? "Approval authorizes only the requirement named in this request. The case will remain open." : "Rejection keeps access unauthorized. The case will remain open for a safe resolution."} Decision recorded as ${SIMULATED_MANAGER}.`;
  if (action.type === "host") return `Case ${caseId} · ${action.response === "CONFIRMED" ? "This explicit host confirmation will satisfy the visitor policy requirement." : "This explicit decline keeps access unauthorized."} Response recorded as ${SIMULATED_HOST}.`;
  if (action.type === "resolve") return `Case ${caseId} · Confirm the selected resolution and close this case.`;
  if (action.type === "cancel") return `Case ${caseId} · This records a cancellation; it does not authorize access.`;
  return "This removes saved demo decisions and activity from this browser.";
}

function confirmationButton(action: ConfirmAction | null) {
  if (!action) return "Confirm";
  if (action.type === "manager") return action.decision === "APPROVED" ? "Confirm approval" : "Confirm rejection";
  if (action.type === "host") return action.response === "CONFIRMED" ? "Record confirmation" : "Record decline";
  if (action.type === "resolve") return "Close case";
  if (action.type === "cancel") return "Cancel arrival";
  return "Reset demo";
}
