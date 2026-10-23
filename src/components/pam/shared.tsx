import { ArrowDownLeft, UserRound, UsersRound } from "lucide-react";

import type { ArrivalType, CaseStatus } from "@/lib/pam-workflow";

export function typeGlyph(arrivalType: ArrivalType, size = 16) {
  if (arrivalType === "Delivery") return <ArrowDownLeft size={size} />;
  if (arrivalType === "Contractor") return <UserRound size={size} />;
  return <UsersRound size={size} />;
}

export function StatusPill({ status, compact = false }: { status: CaseStatus; compact?: boolean }) {
  return (
    <span className={`pam-status-pill status-${status.toLowerCase().replaceAll("_", "-")} ${compact ? "is-compact" : ""}`}>
      <span />{statusLabel(status)}
    </span>
  );
}

export function statusLabel(status: CaseStatus) {
  const labels: Record<CaseStatus, string> = {
    NEW: "New", NEEDS_REVIEW: "Needs review", AWAITING_APPROVAL: "Awaiting approval",
    AWAITING_CONFIRMATION: "Awaiting confirmation", APPROVED: "Approved", REJECTED: "Rejected",
    RESOLVED: "Resolved", CANCELLED: "Cancelled",
  };
  return labels[status];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function eventDotClass(label: string) {
  if (label.includes("rejected") || label.includes("declined")) return "event-dot-danger";
  if (label.includes("approved") || label.includes("received") || label.includes("closed")) return "event-dot-success";
  if (label.includes("requested")) return "event-dot-pending";
  return "event-dot-neutral";
}
