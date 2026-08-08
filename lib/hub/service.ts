import { createEmptyHubContext, parseHubContext, serializeHubContext } from '@/lib/hub/context';
import { runHubTurn } from '@/lib/hub/engine';
import type { HubFeedbackTone, HubSuggestion } from '@/lib/hub/types';
import { supabase } from '@/lib/supabase';
import {
  createMedication,
  getAnalytics,
  getDashboard,
  getHistory,
  listMedications,
  recordDose,
} from '@/lib/vitalis-data';
import type { Json, Tables } from '@/types/database';

export type ChatMessage = Tables<'chat_messages'>;

function requireUserId(userId: string | undefined) {
  if (!userId) throw new Error('Sessão expirada. Entre novamente.');
  return userId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getMessageSuggestions(message: ChatMessage): HubSuggestion[] {
  if (!isRecord(message.metadata) || !Array.isArray(message.metadata.suggestions)) return [];
  return message.metadata.suggestions.filter((item): item is HubSuggestion => (
    isRecord(item) && typeof item.label === 'string' && typeof item.prompt === 'string'
  ));
}

export function getMessageFeedbackTone(message: ChatMessage): HubFeedbackTone {
  if (!isRecord(message.metadata)) return 'default';
  const tone = message.metadata.feedbackTone;
  return tone === 'success' || tone === 'warning' || tone === 'danger' ? tone : 'default';
}

export async function getOrCreateChatSession(userId: string | undefined) {
  const id = requireUserId(userId);
  const { data: existing, error: readError } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: id, title: 'Conversa com a Vitalis' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getChatMessages(userId: string | undefined, sessionId: string) {
  requireUserId(userId);
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

async function getLatestContext(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('metadata')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseHubContext(data.metadata) : createEmptyHubContext();
}

export async function sendHubMessage(
  userId: string | undefined,
  sessionId: string,
  message: string,
) {
  const id = requireUserId(userId);
  const cleanMessage = message.trim();
  if (!cleanMessage) throw new Error('empty_chat_message');

  const previousContext = await getLatestContext(sessionId);
  const { data: userMessage, error: userError } = await supabase
    .from('chat_messages')
    .insert({
      user_id: id,
      session_id: sessionId,
      role: 'user',
      content: cleanMessage,
      intent: null,
      metadata: { engine: 'vitalis-rules-v2' },
    })
    .select('*')
    .single();
  if (userError) throw userError;

  const hubResponse = await runHubTurn({
    userId: id,
    message: cleanMessage,
    previousContext,
    data: {
      createMedication,
      getAnalytics,
      getDashboard,
      getHistory,
      listMedications,
      recordDose,
    },
  });

  const metadata: Json = {
    engine: 'vitalis-rules-v2',
    context: serializeHubContext(hubResponse.context),
    suggestions: (hubResponse.suggestions ?? []) as unknown as Json,
    feedbackTone: hubResponse.feedbackTone ?? 'default',
  };
  const { data: assistantMessage, error } = await supabase
    .from('chat_messages')
    .insert({
      user_id: id,
      session_id: sessionId,
      role: 'assistant',
      content: hubResponse.content,
      intent: hubResponse.intent,
      metadata,
    })
    .select('*')
    .single();
  if (error) throw error;

  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (sessionError) throw sessionError;

  return { userMessage, assistantMessage };
}
