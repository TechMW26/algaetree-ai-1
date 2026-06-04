import { type Types } from "mongoose";
import { AuditLog } from "@/lib/models/AuditLog";

export async function recordAudit(
  userId: Types.ObjectId | string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await AuditLog.create({ userId: userId ?? null, action, metadata });
  } catch {
    // Audit logging must never break the main request flow.
  }
}
