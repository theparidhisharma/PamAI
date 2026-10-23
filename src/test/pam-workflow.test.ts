import { describe, expect, it } from "vitest";
import { createInitialCases, decideManagerRequest, evaluatePolicy, recordHostResponse, requestHostConfirmation, requestManagerApproval, resolveCase } from "@/lib/pam-workflow";

const get = (id: string) => {
  const caseRecord = createInitialCases().find((item) => item.id === id);
  if (!caseRecord) throw new Error(`Missing demo case ${id}`);
  return caseRecord;
};

const approvalId = (caseRecord: ReturnType<typeof get>) => {
  const request = caseRecord.approvals[0];
  if (!request) throw new Error("Expected an approval request");
  return request.id;
};

const hostRequestId = (caseRecord: ReturnType<typeof get>) => {
  const request = caseRecord.hostRequests[0];
  if (!request) throw new Error("Expected a host-confirmation request");
  return request.id;
};

describe("Pam lifecycle", () => {
  it("Flow A: approval re-evaluates but does not close", () => {
    let c = requestManagerApproval(get("DL-204"));
    expect(c.status).toBe("AWAITING_APPROVAL");
    expect(evaluatePolicy(c).authorized).toBe(false);
    expect(() => requestManagerApproval(c)).toThrow();
    c = decideManagerRequest(c, approvalId(c), "APPROVED");
    expect(c.status).toBe("APPROVED");
    expect(evaluatePolicy(c).authorized).toBe(true);
    expect(() => decideManagerRequest(c, approvalId(c), "REJECTED")).toThrow();
    c = resolveCase(c, "Approved exception handled", true);
    expect(c.status).toBe("RESOLVED");
  });
  it("Flow B: rejection stays unauthorized and closes only without access", () => {
    let c = requestManagerApproval(get("MT-118"));
    c = decideManagerRequest(c, approvalId(c), "REJECTED", "No permit");
    expect(evaluatePolicy(c).authorized).toBe(false);
    expect(() => resolveCase(c, "Approved exception handled", true)).toThrow();
    c = resolveCase(c, "Contractor asked to reschedule", true);
    expect(c.activity.map((a) => a.label)).toContain("Approval rejected");
  });
  it("Flow C: pending or declined host confirmation never authorizes", () => {
    let c = requestHostConfirmation(get("VIS-082"));
    expect(evaluatePolicy(c).authorized).toBe(false);
    expect(() => resolveCase(c, "Visitor notified in demo", true)).toThrow();
    c = recordHostResponse(c, hostRequestId(c), "DECLINED");
    expect(evaluatePolicy(c).authorized).toBe(false);
  });
  it("cannot close a case with no recorded decision", () => {
    expect(() => resolveCase(get("DL-204"), "Delivery rescheduled", true)).toThrow();
  });
});