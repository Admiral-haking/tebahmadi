import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import { ErrorLogModel } from './models/ErrorLog';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'publish' | 'other';
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditActor = {
  id?: string;
  name?: string;
  phone?: string;
  roles?: string[];
};

export type AuditChange = {
  field: string;
  before?: unknown;
  after?: unknown;
};

export type AuditLogInput = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  entityLabel?: string;
  summary?: string;
  actor?: AuditActor;
  changes?: AuditChange[];
  route?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
  severity?: AuditSeverity;
  suspicious?: boolean;
};

type ActorLike = {
  _id?: unknown;
  id?: unknown;
  fname?: string;
  lname?: string;
  phone?: string;
  roles?: string[];
};

export function actorFromUser(user: ActorLike | null | undefined): AuditActor {
  if (!user) return {};
  const name = [user.fname, user.lname].filter(Boolean).join(' ').trim();
  const id = user._id ?? user.id;
  return {
    id: id ? String(id) : undefined,
    name: name || undefined,
    phone: user.phone,
    roles: user.roles ?? [],
  };
}

export function requestContext(
  request: NextRequest,
): Pick<AuditLogInput, 'route' | 'method' | 'ip' | 'userAgent' | 'requestId' | 'sessionId'> {
  return {
    route: request.nextUrl.pathname,
    method: request.method,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
    requestId: request.headers.get('x-request-id') ?? request.headers.get('x-correlation-id') ?? undefined,
    sessionId: request.headers.get('x-session-id') ?? undefined,
  };
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(normalize);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await connectMongoose();
    const actorId =
      input.actor?.id && Types.ObjectId.isValid(input.actor.id)
        ? new Types.ObjectId(input.actor.id)
        : undefined;
    await ErrorLogModel.create({
      level: input.severity === 'critical' || input.severity === 'high' ? 'warning' : 'info',
      category: 'system',
      source: `audit:${input.entity}`,
      message: input.summary ?? input.action,
      route: input.route,
      method: input.method,
      userId: actorId,
      metadata: normalize({
        action: input.action,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        actor: input.actor,
        changes: input.changes,
        requestId: input.requestId,
        sessionId: input.sessionId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: input.metadata,
        suspicious: input.suspicious,
      }),
    });
  } catch (error) {
    console.error('[audit-log] failed to persist audit log', error);
  }
}

export function logAuditLater(input: AuditLogInput): void {
  void logAudit(input);
}
