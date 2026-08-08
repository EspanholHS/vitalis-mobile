import type { Json } from '@/types/database';
import { EMPTY_HUB_CONTEXT, type HubConversationState } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createEmptyHubContext(): HubConversationState {
  return {
    ...EMPTY_HUB_CONTEXT,
    flow: null,
    lastMedication: null,
    lastDose: null,
    pendingAction: null,
  };
}

export function parseHubContext(metadata: Json | null | undefined): HubConversationState {
  if (!isRecord(metadata) || !isRecord(metadata.context) || metadata.context.version !== 2) {
    return createEmptyHubContext();
  }

  const context = metadata.context as unknown as HubConversationState;
  return {
    ...createEmptyHubContext(),
    ...context,
    version: 2,
    fallbackCount: Number.isFinite(context.fallbackCount) ? Math.max(0, context.fallbackCount) : 0,
  };
}

export function serializeHubContext(context: HubConversationState): Json {
  return context as unknown as Json;
}
