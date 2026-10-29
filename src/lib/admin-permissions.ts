export type AdminRole = "super_admin" | "admin" | "support" | "finance" | "moderator";

const moderationActions = new Set(["suspend-user", "restore-user", "suspend-event", "restore-event", "approve-local", "reject-local", "hide-report", "dismiss-report", "hide-review-report", "dismiss-review-report"]);
const financeActions = new Set(["approve-refund", "reject-refund", "needs-info-refund", "resolve-payment", "ignore-payment"]);

export function canPerformAdminAction(role: string, action: string) {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "moderator") return moderationActions.has(action);
  if (role === "finance") return financeActions.has(action);
  return false;
}

export function canManageAdminTeam(role: string) { return role === "super_admin"; }
