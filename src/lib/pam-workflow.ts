export type CaseStatus =
  | "NEW"
  | "NEEDS_REVIEW"
  | "AWAITING_APPROVAL"
  | "AWAITING_CONFIRMATION"
  | "APPROVED"
  | "REJECTED"
  | "RESOLVED"
  | "CANCELLED";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type HostResponse = "PENDING" | "CONFIRMED" | "DECLINED";
export type ArrivalType = "Delivery" | "Contractor" | "Visitor";

export type Activity = {
  id: string;
  at: string;
  label: string;
  detail: string;
  actor?: string;
};

export type ApprovalRequest = {
  id: string;
  caseId: string;
  policyId: string;
  reason: string;
  action: string;
  createdAt: string;
  status: RequestStatus;
  decisionAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
};

export type HostRequest = {
  id: string;
  caseId: string;
  policyId: string;
  reason: string;
  createdAt: string;
  status: HostResponse;
  responseAt?: string;
  respondedBy?: string;
};

export type PamCase = {
  id: string;
  arrivalType: ArrivalType;
  person: string;
  organization: string;
  arrivalAt: string;
  appointment: string;
  policyId: string;
  policyName: string;
  requirement: string;
  facts: string[];
  requirementType: "manager_approval" | "host_confirmation";
  status: CaseStatus;
  approvals: ApprovalRequest[];
  hostRequests: HostRequest[];
  activity: Activity[];
  resolution?: { reason: string; at: string; actor: string };
  cancellation?: { reason: string; at: string; actor: string };
};

export type PolicyEvaluation = {
  authorized: boolean;
  outstanding: string;
  summary: string;
};

export const STORAGE_KEY = "pam-case-workflow-v1";
export const SIMULATED_MANAGER = "Simulated manager";
export const SIMULATED_HOST = "Simulated host";
export const OPERATOR = "Front desk operator";

export const NO_ACCESS_RESOLUTION_REASONS = [
  "Delivery rescheduled",
  "Contractor asked to reschedule",
  "Visitor notified in demo",
] as const;

export const STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  NEW: ["NEEDS_REVIEW", "CANCELLED"],
  NEEDS_REVIEW: ["AWAITING_APPROVAL", "AWAITING_CONFIRMATION", "APPROVED", "REJECTED", "RESOLVED", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "NEEDS_REVIEW", "CANCELLED"],
  AWAITING_CONFIRMATION: ["APPROVED", "NEEDS_REVIEW", "REJECTED", "CANCELLED"],
  APPROVED: ["RESOLVED", "CANCELLED"],
  REJECTED: ["RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus) {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function transitionCase<T extends PamCase>(caseRecord: T, to: CaseStatus): T {
  if (caseRecord.status === to) return caseRecord;
  if (!canTransition(caseRecord.status, to)) {
    throw new Error(`This case cannot move from ${caseRecord.status.replaceAll("_", " ")} to ${to.replaceAll("_", " ")}.`);
  }
  return { ...caseRecord, status: to };
}

function makeId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${randomId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function activity(label: string, detail: string, at: string, actor?: string): Activity {
  return { id: makeId("ACT"), at, label, detail, ...(actor ? { actor } : {}) };
}

function addActivity(caseRecord: PamCase, entry: Activity): PamCase {
  return { ...caseRecord, activity: [...caseRecord.activity, entry] };
}

export function createInitialCases(now = new Date().toISOString()): PamCase[] {
  const scenarios: Omit<PamCase, "arrivalAt" | "status" | "approvals" | "hostRequests" | "activity">[] = [
    {
      id: "DL-204",
      arrivalType: "Delivery",
      person: "Jordan Lee",
      organization: "Northstar Courier",
      appointment: "Scheduled delivery · 9:30 AM",
      policyId: "POL-07.4",
      policyName: "Early delivery window",
      requirement: "Deliveries arriving more than 30 minutes before their booked window need an authorized manager’s explicit exception approval.",
      facts: ["Arrived at 8:40 AM for a 9:30 AM delivery window.", "Arrival is 50 minutes early; no exception decision is recorded."],
      requirementType: "manager_approval",
    },
    {
      id: "MT-118",
      arrivalType: "Contractor",
      person: "Morgan Torres",
      organization: "Meridian Facilities",
      appointment: "Maintenance visit · 10:00 AM",
      policyId: "POL-12.2",
      policyName: "Contractor site authorization",
      requirement: "An authorized manager must explicitly approve a one-time site-access exception before an unlisted contractor may proceed.",
      facts: ["Contractor arrived for a scheduled maintenance visit.", "No site-access authorization is listed for this arrival."],
      requirementType: "manager_approval",
    },
    {
      id: "VIS-082",
      arrivalType: "Visitor",
      person: "Riley Chen",
      organization: "Guest · Product walkthrough",
      appointment: "Host: Avery Patel · 11:00 AM",
      policyId: "POL-03.1",
      policyName: "Visitor host verification",
      requirement: "The named host must explicitly confirm the visit before visitor access is authorized.",
      facts: ["Visitor arrived for a product walkthrough.", "Host confirmation has not yet been recorded."],
      requirementType: "host_confirmation",
    },
  ];

  return scenarios.map((scenario) => ({
    ...scenario,
    arrivalAt: now,
    status: "NEEDS_REVIEW",
    approvals: [],
    hostRequests: [],
    activity: [
      activity("Arrival recorded", `${scenario.arrivalType} arrival recorded for ${scenario.person}.`, now),
      activity("Policy evaluated", `${scenario.policyId} · ${scenario.policyName}. Access is not authorized.`, now),
    ],
  }));
}

export function evaluatePolicy(caseRecord: PamCase): PolicyEvaluation {
  if (caseRecord.status === "CANCELLED") {
    return { authorized: false, outstanding: "Arrival cancelled; access is not authorized.", summary: "Arrival cancelled without access." };
  }

  if (caseRecord.status === "REJECTED") {
    const rejected = [...caseRecord.approvals].reverse().find((request) => request.status === "REJECTED");
    return {
      authorized: false,
      outstanding: rejected?.rejectionReason || "Manager approval was rejected. Reschedule or close without access.",
      summary: "Manager rejected the exception. Access remains unauthorized.",
    };
  }

  if (caseRecord.requirementType === "manager_approval") {
    const latest = caseRecord.approvals.at(-1);
    if (latest?.status !== "APPROVED") {
      return {
        authorized: false,
        outstanding: latest?.status === "PENDING"
          ? "Explicit manager approval is still pending."
          : "An authorized manager must approve this exception before access can be authorized.",
        summary: latest?.status === "PENDING" ? "Awaiting a manager decision." : "Required manager decision not recorded.",
      };
    }
  }

  if (caseRecord.requirementType === "host_confirmation") {
    const latest = caseRecord.hostRequests.at(-1);
    if (latest?.status !== "CONFIRMED") {
      return {
        authorized: false,
        outstanding: latest?.status === "PENDING"
          ? "Explicit host confirmation is still pending."
          : latest?.status === "DECLINED"
            ? "Host declined. Reschedule or close without access."
            : "The named host must explicitly confirm the visit.",
        summary: latest?.status === "PENDING" ? "Awaiting host confirmation." : "Required host confirmation not recorded.",
      };
    }
  }

  return { authorized: true, outstanding: "No outstanding policy requirement.", summary: "Required decision recorded; policy permits access." };
}

export function requestManagerApproval(caseRecord: PamCase, now = new Date().toISOString()): PamCase {
  if (caseRecord.requirementType !== "manager_approval") throw new Error("This case does not require manager approval.");
  if (["REJECTED", "RESOLVED", "CANCELLED"].includes(caseRecord.status)) throw new Error("This case is closed to new approval requests.");
  if (caseRecord.approvals.some((request) => request.status === "PENDING")) throw new Error("An approval request is already pending for this requirement.");
  if (caseRecord.approvals.some((request) => request.status === "REJECTED")) throw new Error("This request was rejected. Close the case without access or cancel the arrival.");
  if (evaluatePolicy(caseRecord).authorized) throw new Error("The policy requirement is already satisfied.");
  const request: ApprovalRequest = {
    id: makeId("APR"), caseId: caseRecord.id, policyId: caseRecord.policyId,
    reason: caseRecord.facts.join(" "), action: "Approve or reject this specific exception; approval does not close the case.",
    createdAt: now, status: "PENDING",
  };
  const transitioned = transitionCase(caseRecord, "AWAITING_APPROVAL");
  return addActivity({ ...transitioned, approvals: [...transitioned.approvals, request] }, activity(
    "Approval requested", `Request ${request.id} created in the demo for ${caseRecord.policyId}. No external message was sent.`, now, OPERATOR,
  ));
}

export function decideManagerRequest(
  caseRecord: PamCase,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReason = "Manager declined this exception.",
  now = new Date().toISOString(),
  decidedBy = SIMULATED_MANAGER,
): PamCase {
  const requestIndex = caseRecord.approvals.findIndex((request) => request.id === requestId);
  const request = caseRecord.approvals[requestIndex];
  if (!request || request.status !== "PENDING") throw new Error("This approval request is no longer pending and cannot be decided again.");
  if (caseRecord.status !== "AWAITING_APPROVAL") throw new Error("The case is not awaiting manager approval.");
  const updated: ApprovalRequest = {
    ...request, status: decision, decisionAt: now, decidedBy,
    ...(decision === "REJECTED" ? { rejectionReason: rejectionReason.trim() || "Manager declined this exception." } : {}),
  };
  const approvals = [...caseRecord.approvals];
  approvals[requestIndex] = updated;
  const decided = { ...caseRecord, approvals };
  const nextStatus: CaseStatus = decision === "REJECTED"
    ? "REJECTED"
    : evaluatePolicy(decided).authorized ? "APPROVED" : "NEEDS_REVIEW";
  const transitioned = transitionCase(decided, nextStatus);
  const decisionText = decision === "APPROVED"
    ? `Manager approved ${request.policyId}; this records a decision, not case closure.`
    : `Manager rejected ${request.policyId}: ${updated.rejectionReason}`;
  return addActivity(
    addActivity(transitioned, activity(decision === "APPROVED" ? "Approval recorded" : "Approval rejected", decisionText, now, decidedBy)),
    activity("Policy re-evaluated", evaluatePolicy(transitioned).summary, now),
  );
}

export function requestHostConfirmation(caseRecord: PamCase, now = new Date().toISOString()): PamCase {
  if (caseRecord.requirementType !== "host_confirmation") throw new Error("This case does not require host confirmation.");
  if (["REJECTED", "RESOLVED", "CANCELLED"].includes(caseRecord.status)) throw new Error("This case is closed to new requests.");
  if (caseRecord.hostRequests.some((request) => request.status === "PENDING")) throw new Error("A host-confirmation request is already pending.");
  if (caseRecord.hostRequests.some((request) => request.status === "CONFIRMED")) throw new Error("Host confirmation is already recorded.");
  const request: HostRequest = {
    id: makeId("HST"), caseId: caseRecord.id, policyId: caseRecord.policyId,
    reason: caseRecord.requirement, createdAt: now, status: "PENDING",
  };
  const transitioned = transitionCase(caseRecord, "AWAITING_CONFIRMATION");
  return addActivity({ ...transitioned, hostRequests: [...transitioned.hostRequests, request] }, activity(
    "Host confirmation requested", `Request ${request.id} is pending in the demo. No external message was sent.`, now, OPERATOR,
  ));
}

export function recordHostResponse(
  caseRecord: PamCase,
  requestId: string,
  response: "CONFIRMED" | "DECLINED",
  now = new Date().toISOString(),
  respondedBy = SIMULATED_HOST,
): PamCase {
  const requestIndex = caseRecord.hostRequests.findIndex((request) => request.id === requestId);
  const request = caseRecord.hostRequests[requestIndex];
  if (!request || request.status !== "PENDING") throw new Error("This host request is no longer pending.");
  if (caseRecord.status !== "AWAITING_CONFIRMATION") throw new Error("The case is not awaiting host confirmation.");
  const hostRequests = [...caseRecord.hostRequests];
  hostRequests[requestIndex] = { ...request, status: response, responseAt: now, respondedBy };
  const responded = { ...caseRecord, hostRequests };
  const nextStatus: CaseStatus = response === "CONFIRMED"
    ? evaluatePolicy(responded).authorized ? "APPROVED" : "NEEDS_REVIEW"
    : "NEEDS_REVIEW";
  const transitioned = transitionCase(responded, nextStatus);
  const detail = response === "CONFIRMED"
    ? "Host explicitly confirmed the visit in the demo."
    : "Host declined in the demo. Access remains unauthorized; reschedule or close without access.";
  return addActivity(
    addActivity(transitioned, activity(response === "CONFIRMED" ? "Host confirmation received" : "Host confirmation declined", detail, now, respondedBy)),
    activity("Policy re-evaluated", evaluatePolicy(transitioned).summary, now),
  );
}

export function resolveCase(caseRecord: PamCase, reason: string, confirmed: boolean, now = new Date().toISOString()): PamCase {
  if (!confirmed) throw new Error("Confirm closure before resolving this case.");
  if (!reason.trim()) throw new Error("Choose a resolution reason before closing the case.");
  if (["RESOLVED", "CANCELLED"].includes(caseRecord.status)) throw new Error("This case is already closed.");
  const evaluation = evaluatePolicy(caseRecord);
  if (caseRecord.approvals.some((request) => request.status === "PENDING") ||
    caseRecord.hostRequests.some((request) => request.status === "PENDING")) {
    throw new Error("A required decision is still pending. Record the response before closing this case.");
  }
  const hasRecordedDecline = caseRecord.status === "REJECTED" ||
    caseRecord.approvals.some((request) => request.status === "REJECTED") ||
    caseRecord.hostRequests.some((request) => request.status === "DECLINED");
  if (!evaluation.authorized && !hasRecordedDecline) {
    throw new Error("A required approval or confirmation has not been recorded. Do not close the case while the requirement is outstanding.");
  }
  if (evaluation.authorized && caseRecord.status !== "APPROVED") {
    throw new Error("Re-evaluate the policy before resolving an authorized case.");
  }
  if (!evaluation.authorized && !NO_ACCESS_RESOLUTION_REASONS.some((option) => option === reason)) {
    throw new Error("When access is unauthorized, choose a non-access resolution such as rescheduling or notifying the visitor in the demo.");
  }
  const transitioned = transitionCase(caseRecord, "RESOLVED");
  const resolution = { reason: reason.trim(), at: now, actor: OPERATOR };
  return addActivity(
    addActivity({ ...transitioned, resolution }, activity("Resolution recorded", reason.trim(), now, OPERATOR)),
    activity("Case closed", evaluation.authorized ? "Case closed after approved exception; access is authorized by policy." : "Case closed without access authorization.", now, OPERATOR),
  );
}

export function cancelCase(caseRecord: PamCase, reason = "Arrival cancelled by operator.", now = new Date().toISOString()): PamCase {
  if (["RESOLVED", "CANCELLED"].includes(caseRecord.status)) throw new Error("This case is already closed.");
  const transitioned = transitionCase(caseRecord, "CANCELLED");
  const cancellation = { reason, at: now, actor: OPERATOR };
  return addActivity({ ...transitioned, cancellation }, activity("Arrival cancelled", reason, now, OPERATOR));
}

export function loadCases(storage: Pick<Storage, "getItem" | "setItem"> | undefined): PamCase[] {
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isPamCaseList(parsed)) return parsed;
      }
    } catch {
      // An unavailable or malformed demo snapshot is safely replaced by fresh scenarios.
    }
  }
  const initial = createInitialCases();
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // The app remains usable for this session if browser storage is unavailable.
  }
  return initial;
}

export function resetCases(storage: Pick<Storage, "setItem"> | undefined, now = new Date().toISOString()) {
  const initial = createInitialCases(now);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // Reset the in-memory experience even when browser storage is disabled.
  }
  return initial;
}

function isPamCaseList(value: unknown): value is PamCase[] {
  return Array.isArray(value) && value.length === 3 && value.every((item) =>
    typeof item === "object" && item !== null &&
    ["DL-204", "MT-118", "VIS-082"].includes((item as { id?: string }).id ?? "") &&
    typeof (item as { status?: unknown }).status === "string" &&
    Array.isArray((item as { approvals?: unknown }).approvals) &&
    Array.isArray((item as { hostRequests?: unknown }).hostRequests) &&
    Array.isArray((item as { activity?: unknown }).activity),
  );
}