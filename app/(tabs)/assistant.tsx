import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { FocusPressable as FocusablePressable, MotionReveal, ScreenContainer } from '@/components/vitalis-ui';
import {
  VitalisColors,
  VitalisElevation,
  VitalisFonts,
  VitalisRadius,
} from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  type ChatMessage,
  getChatMessages,
  getMessageFeedbackTone,
  getMessageSuggestions,
  getOrCreateChatSession,
  sendHubMessage,
} from '@/lib/hub/service';

const quickPrompts = [
  'Qual é minha próxima dose?',
  'Quais medicamentos eu tomo hoje?',
  'Quero registrar uma toma.',
  'Quero cadastrar um medicamento.',
  'Como está minha adesão esta semana?',
];

const quickPromptOptions = [
  { compactLabel: 'Próxima', icon: 'schedule' as const, label: 'Próxima dose', prompt: 'Qual é minha próxima dose?' },
  { compactLabel: 'Hoje', icon: 'today' as const, label: 'Medicamentos de hoje', prompt: 'Quais medicamentos eu tomo hoje?' },
  { compactLabel: 'Registrar', icon: 'check-circle' as const, label: 'Registrar toma', prompt: 'Quero registrar uma toma.' },
  { compactLabel: 'Cadastrar', icon: 'add-circle' as const, label: 'Cadastrar medicamento', prompt: 'Quero cadastrar um medicamento.' },
  { compactLabel: 'Adesão', icon: 'insights' as const, label: 'Ver adesão', prompt: 'Como está minha adesão esta semana?' },
].map((option, index) => ({ ...option, prompt: quickPrompts[index] }));

const INPUT_MIN_HEIGHT = 46;
const INPUT_MAX_HEIGHT = 112;
const MAX_MESSAGE_LENGTH = 4000;
const NEAR_BOTTOM_THRESHOLD = 96;
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
});
const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
});

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
}

function messageDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateKey(value) === dateKey(today.toISOString())) return 'Hoje';
  if (dateKey(value) === dateKey(yesterday.toISOString())) return 'Ontem';

  return dayFormatter.format(date);
}

function HubAvatar({ small = false }: { small?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, small && styles.avatarSmall]}>
      <MaterialIcons color="#A9D3FA" name="auto-awesome" size={small ? 15 : 18} />
    </View>
  );
}

function AssistantWelcome() {
  return (
    <MotionReveal
      accessibilityLabel="Vitalis HUB. Posso consultar sua próxima dose, sua rotina de hoje, seus medicamentos ativos e seu progresso. Minhas respostas usam somente os dados cadastrados."
      accessibilityRole="text"
      delay={80}
      style={styles.assistantMessageRow}>
      <HubAvatar />
      <View style={[styles.bubble, styles.assistantBubble]}>
        <View style={styles.assistantMetaRow}>
          <Text style={styles.assistantName}>Vitalis HUB</Text>
          <Text style={styles.assistantTime}>Agora</Text>
        </View>
        <Text selectable style={styles.assistantText}>
          Posso consultar sua próxima dose, sua rotina de hoje, seus medicamentos ativos e seu progresso.
        </Text>
        <Text style={styles.welcomeFootnote}>Sempre com base no que você cadastrou.</Text>
      </View>
    </MotionReveal>
  );
}

function ChatMessageRow({
  message,
  disabled = false,
  onSuggestionPress,
}: {
  message: ChatMessage;
  disabled?: boolean;
  onSuggestionPress: (prompt: string) => void;
}) {
  const fromUser = message.role === 'user';
  const optimistic = message.id.startsWith('optimistic-');
  const time = messageTime(message.created_at);
  const suggestions = getMessageSuggestions(message);
  const feedbackTone = getMessageFeedbackTone(message);
  const accessibilityLabel = fromUser
    ? `Você, ${time}. ${message.content}${optimistic ? '. Enviando.' : ''}`
    : `Vitalis HUB, ${time}. ${message.content}`;

  if (fromUser) {
    return (
      <MotionReveal accessibilityLabel={accessibilityLabel} accessibilityRole="text" distance={6} style={styles.userMessageRow}>
        <View style={[styles.bubble, styles.userBubble]}>
          <Text selectable style={styles.userText}>
            {message.content}
          </Text>
          <View style={styles.userMetaRow}>
            <Text style={styles.userTime}>{optimistic ? 'Enviando…' : time}</Text>
            <MaterialIcons
              color={optimistic ? VitalisColors.mutedSoft : VitalisColors.primaryStrong}
              name={optimistic ? 'schedule' : 'done'}
              size={14}
            />
          </View>
        </View>
      </MotionReveal>
    );
  }

  return (
    <MotionReveal
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={styles.assistantMessageGroup}>
      <View style={styles.assistantMessageRow}>
        <HubAvatar />
        <View style={[
          styles.bubble,
          styles.assistantBubble,
          feedbackTone === 'success' && styles.assistantBubbleSuccess,
          feedbackTone === 'warning' && styles.assistantBubbleWarning,
          feedbackTone === 'danger' && styles.assistantBubbleDanger,
        ]}>
          <View style={styles.assistantMetaRow}>
            <Text style={styles.assistantName}>Vitalis HUB</Text>
            <Text style={styles.assistantTime}>{time}</Text>
          </View>
          {feedbackTone !== 'default' ? (
            <View style={[
              styles.feedbackBadge,
              feedbackTone === 'success' && styles.feedbackBadgeSuccess,
              feedbackTone === 'warning' && styles.feedbackBadgeWarning,
              feedbackTone === 'danger' && styles.feedbackBadgeDanger,
            ]}>
              <MaterialIcons
                color={feedbackTone === 'success' ? '#83DDB2' : feedbackTone === 'warning' ? '#F3C76E' : '#FFAAA3'}
                name={feedbackTone === 'success' ? 'check-circle' : feedbackTone === 'warning' ? 'info' : 'error'}
                size={14}
              />
              <Text style={styles.feedbackBadgeText}>
                {feedbackTone === 'success' ? 'Ação concluída' : feedbackTone === 'warning' ? 'Atenção' : 'Não foi possível concluir'}
              </Text>
            </View>
          ) : null}
          <Text selectable style={styles.assistantText}>
            {message.content}
          </Text>
        </View>
      </View>
      {suggestions.length ? (
        <View accessibilityLabel="Próximas ações sugeridas" style={styles.messageSuggestionRow}>
          {suggestions.map((suggestion) => (
            <FocusablePressable
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              disabled={disabled}
              key={`${message.id}-${suggestion.prompt}`}
              onPress={() => onSuggestionPress(suggestion.prompt)}
              style={({ pressed }) => [
                styles.messageSuggestion,
                pressed && styles.pressed,
                disabled && styles.controlDisabled,
              ]}>
              <MaterialIcons
                color={VitalisColors.primaryStrong}
                name={suggestion.icon ?? 'arrow-forward'}
                size={15}
              />
              <Text style={styles.messageSuggestionText}>{suggestion.label}</Text>
            </FocusablePressable>
          ))}
        </View>
      ) : null}
    </MotionReveal>
  );
}

function ConversationLoading() {
  return (
    <MotionReveal accessibilityLabel="Sincronizando a conversa" accessibilityLiveRegion="polite" style={styles.assistantMessageRow}>
      <HubAvatar />
      <View style={styles.loadingBubble}>
        <View style={styles.loadingTopRow}>
          <ActivityIndicator color={VitalisColors.primary} size="small" />
          <Text style={styles.loadingText}>Sincronizando conversa…</Text>
        </View>
        <View style={styles.skeletonLong} />
        <View style={styles.skeletonShort} />
      </View>
    </MotionReveal>
  );
}

function TypingIndicator() {
  return (
    <MotionReveal
      accessibilityLabel="Vitalis está consultando sua rotina"
      accessibilityLiveRegion="polite"
      style={styles.assistantMessageRow}>
      <HubAvatar />
      <View style={[styles.bubble, styles.typingBubble]}>
        <View style={styles.typingContent}>
          <ActivityIndicator color="#A9D3FA" size="small" />
          <View>
            <Text style={styles.assistantName}>Vitalis HUB</Text>
            <Text style={styles.typingText}>Consultando sua rotina…</Text>
          </View>
        </View>
      </View>
    </MotionReveal>
  );
}

export default function AssistantScreen() {
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const loadRequestRef = useRef(0);
  const sendingRef = useRef(false);
  const nearBottomRef = useRef(true);
  const initialScrollPendingRef = useRef(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const [composerFocused, setComposerFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback((animated = true) => {
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 20);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const requestId = ++loadRequestRef.current;
    setError(null);
    try {
      const session = await getOrCreateChatSession(user.id);
      const syncedMessages = await getChatMessages(user.id, session.id);
      if (requestId !== loadRequestRef.current) return;
      initialScrollPendingRef.current = true;
      setSessionId(session.id);
      setMessages(syncedMessages);
    } catch {
      if (requestId !== loadRequestRef.current) return;
      setError('A conversa não pôde ser sincronizada agora. Seus dados continuam protegidos.');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const canSend = Boolean(input.trim() && sessionId && !sending && !loading);
  const statusLabel = loading ? 'Sincronizando' : error && !sessionId ? 'Indisponível' : 'Conectado';
  const statusTone = error && !sessionId ? styles.statusDotError : loading ? styles.statusDotLoading : styles.statusDotOnline;
  const quickChipLayout = width >= 680 ? styles.quickChipWide : styles.quickChipStandard;
  const remainingCharacters = MAX_MESSAGE_LENGTH - input.length;
  const sendHint = sending
    ? 'Aguarde a resposta atual antes de enviar outra mensagem'
    : loading
      ? 'Aguarde a sincronização da conversa'
      : canSend
        ? 'Envia sua mensagem'
        : 'Digite uma mensagem para habilitar o envio';

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    nearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
  }

  function handleContentSizeChange() {
    if (initialScrollPendingRef.current) {
      initialScrollPendingRef.current = false;
      scrollToBottom(false);
      return;
    }
    if (nearBottomRef.current) scrollToBottom(true);
  }

  async function handleSend(value = input) {
    const content = value.trim();
    if (!content || !sessionId || sendingRef.current || loading) return;

    sendingRef.current = true;
    loadRequestRef.current += 1;
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
    setInput('');
    setInputHeight(INPUT_MIN_HEIGHT);
    setSending(true);
    setError(null);

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      user_id: user!.id,
      session_id: sessionId,
      role: 'user',
      content,
      intent: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimistic]);
    scrollToBottom(true);

    try {
      const { userMessage, assistantMessage } = await sendHubMessage(user?.id, sessionId, content);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      setMessages((current) => {
        const persisted = current.filter((message) => message.id !== optimistic.id);
        const unique = new Map(
          [...persisted, userMessage, assistantMessage].map((message) => [message.id, message]),
        );
        return [...unique.values()].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });
    } catch {
      await load();
      setError('Não consegui concluir a resposta. A conversa foi sincronizada; tente enviar novamente.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <ScreenContainer
      atmosphere="hub"
      keyboard
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]}>
      <View style={styles.hubTopBar}>
        <MotionReveal distance={4}>
          <Text accessibilityRole="header" style={styles.hubTitle}>IA HUB</Text>
        </MotionReveal>
        <MotionReveal
          accessibilityLabel={`Status do IA HUB: ${statusLabel}`}
          accessibilityRole="text"
          distance={4}
          style={styles.connectionPill}>
          <View style={[styles.statusDot, statusTone]} />
          {width >= 360 ? <Text style={styles.connectionText}>{statusLabel}</Text> : null}
        </MotionReveal>
      </View>

      {error ? (
        <MotionReveal accessibilityLiveRegion="assertive" distance={5} style={styles.errorBanner}>
          <View style={styles.errorIcon}>
            <MaterialIcons color={VitalisColors.danger} name="error-outline" size={20} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <FocusablePressable
            accessibilityLabel="Tentar sincronizar a conversa novamente"
            accessibilityRole="button"
            onPress={() => void load()}
            style={({ pressed }) => [
              styles.errorAction,
              pressed && styles.pressed,
            ]}>
            <MaterialIcons color={VitalisColors.danger} name="refresh" size={20} />
          </FocusablePressable>
        </MotionReveal>
      ) : null}

      <View style={styles.chatViewport}>
        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.messageScroll}>
          <View style={styles.messagesInner}>
            <AssistantWelcome />

            {loading ? <ConversationLoading /> : null}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const startsNewDay = !previous || dateKey(previous.created_at) !== dateKey(message.created_at);

              return (
                <View key={message.id} style={styles.messageBlock}>
                  {startsNewDay ? (
                    <View accessibilityRole="text" style={styles.dayDivider}>
                      <View style={styles.dayLine} />
                      <Text style={styles.dayLabel}>{messageDay(message.created_at)}</Text>
                      <View style={styles.dayLine} />
                    </View>
                  ) : null}
                  <ChatMessageRow
                    disabled={sending || loading}
                    message={message}
                    onSuggestionPress={(prompt) => void handleSend(prompt)}
                  />
                </View>
              );
            })}

            {sending ? <TypingIndicator /> : null}
          </View>
        </ScrollView>

        {showScrollToBottom ? (
          <FocusablePressable
            accessibilityHint="Leva até a mensagem mais recente"
            accessibilityLabel="Voltar ao fim da conversa"
            accessibilityRole="button"
            onPress={() => scrollToBottom(true)}
            style={({ pressed }) => [
              styles.scrollToBottomButton,
              pressed && styles.pressed,
            ]}>
            <MaterialIcons color={VitalisColors.onDark} name="keyboard-arrow-down" size={21} />
            <Text style={styles.scrollToBottomText}>Mensagens recentes</Text>
          </FocusablePressable>
        ) : null}
      </View>

      <View style={styles.suggestionsGroup}>
        <View accessibilityLabel="Sugestões de perguntas" style={styles.quickGrid}>
          {quickPromptOptions.map((item) => {
            const disabled = sending || loading || !sessionId;
            return (
              <MotionReveal distance={4} key={item.prompt} style={quickChipLayout}>
              <FocusablePressable
                accessibilityHint={disabled ? 'Aguarde a resposta atual antes de enviar outra pergunta' : 'Envia esta pergunta para o IA HUB'}
                accessibilityLabel={item.prompt}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => void handleSend(item.prompt)}
                style={({ pressed }) => [
                  styles.quickChip,
                  styles.quickChipFill,
                  pressed && styles.pressed,
                  disabled && styles.controlDisabled,
                ]}>
                <View style={styles.quickIcon}>
                  <MaterialIcons color={VitalisColors.primaryStrong} name={item.icon} size={16} />
                </View>
                <Text numberOfLines={width < 500 ? 1 : 2} style={styles.quickText}>
                  {width < 500 ? item.compactLabel : item.label}
                </Text>
              </FocusablePressable>
              </MotionReveal>
            );
          })}
        </View>
      </View>

      <View style={styles.composerGroup}>
        <MotionReveal distance={5} style={[styles.composer, composerFocused && styles.composerFocused]}>
          <TextInput
            accessibilityHint="Digite uma pergunta e use a tecla enviar ou o botão ao lado"
            accessibilityLabel="Mensagem para a IA HUB"
            editable={!sending && Boolean(sessionId)}
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            onBlur={() => setComposerFocused(false)}
            onChangeText={setInput}
            onContentSizeChange={(event) => {
              const nextHeight = Math.max(INPUT_MIN_HEIGHT, Math.min(INPUT_MAX_HEIGHT, event.nativeEvent.contentSize.height));
              setInputHeight(nextHeight);
            }}
            onFocus={() => setComposerFocused(true)}
            onSubmitEditing={() => void handleSend()}
            placeholder={loading ? 'Sincronizando conversa…' : 'Pergunte sobre sua rotina'}
            placeholderTextColor={VitalisColors.mutedSoft}
            returnKeyType="send"
            scrollEnabled={inputHeight >= INPUT_MAX_HEIGHT}
            selectionColor={VitalisColors.primary}
            style={[styles.input, { height: inputHeight }]}
            submitBehavior="submit"
            value={input}
          />
          <FocusablePressable
            accessibilityHint={sendHint}
            accessibilityLabel={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
            accessibilityRole="button"
            accessibilityState={{ busy: sending, disabled: !canSend }}
            disabled={!canSend}
            onPress={() => void handleSend()}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && canSend && styles.sendButtonPressed,
              !canSend && styles.sendButtonDisabled,
            ]}>
            {sending ? <ActivityIndicator color={VitalisColors.onDark} size="small" /> : (
              <MaterialIcons color={canSend ? VitalisColors.onDark : VitalisColors.mutedSoft} name="arrow-upward" size={22} />
            )}
          </FocusablePressable>
        </MotionReveal>

        <MotionReveal distance={4} style={styles.composerMetaRow}>
          <View style={styles.safetyNote}>
            <MaterialIcons color={VitalisColors.mutedSoft} name="verified-user" size={14} />
            <Text style={styles.safetyText}>Dados cadastrados, não substitui orientação médica.</Text>
          </View>
          {input.length >= 3200 ? <Text accessibilityLiveRegion="polite" style={styles.characterCount}>{remainingCharacters}</Text> : null}
        </MotionReveal>
      </View>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8, minHeight: 0, paddingTop: 4 },
  hubTopBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  hubTitle: {
    color: VitalisColors.ink,
    fontFamily: VitalisFonts.display,
    fontSize: 32,
    letterSpacing: -0.45,
    lineHeight: 38,
  },
  connectionPill: {
    alignItems: 'center',
    backgroundColor: VitalisColors.surfaceRaised,
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 11,
  },
  connectionText: {
    color: VitalisColors.bodyStrong,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
  },
  statusDot: { borderRadius: VitalisRadius.pill, height: 8, width: 8 },
  statusDotOnline: { backgroundColor: VitalisColors.success },
  statusDotLoading: { backgroundColor: VitalisColors.warningStrong },
  statusDotError: { backgroundColor: VitalisColors.danger },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: VitalisColors.dangerSoft,
    borderColor: 'rgba(180,35,24,0.20)',
    borderRadius: VitalisRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    padding: 8,
  },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: VitalisColors.surfaceRaised,
    borderRadius: VitalisRadius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  errorText: {
    color: VitalisColors.danger,
    flex: 1,
    fontFamily: VitalisFonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  errorAction: {
    alignItems: 'center',
    borderRadius: VitalisRadius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  chatViewport: {
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.xl,
    borderWidth: 1,
    boxShadow: VitalisElevation.subtle,
    flex: 1,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  messageScroll: { flex: 1 },
  messages: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 14 },
  messagesInner: {
    alignSelf: 'center',
    gap: 14,
    justifyContent: 'flex-end',
    maxWidth: 720,
    minHeight: '100%',
    width: '100%',
  },
  messageBlock: { gap: 14, width: '100%' },
  assistantMessageGroup: {
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '96%',
  },
  assistantMessageRow: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
  },
  userMessageRow: { alignSelf: 'flex-end', maxWidth: '86%' },
  avatar: {
    alignItems: 'center',
    backgroundColor: VitalisColors.surfaceDark,
    borderColor: VitalisColors.borderDark,
    borderRadius: 13,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  avatarSmall: { borderRadius: 10, height: 30, width: 30 },
  bubble: { flexShrink: 1, paddingHorizontal: 15, paddingVertical: 13 },
  assistantBubble: {
    backgroundColor: VitalisColors.surfaceDark,
    borderBottomLeftRadius: VitalisRadius.sm,
    borderColor: VitalisColors.borderDark,
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
  },
  assistantBubbleSuccess: { backgroundColor: '#12221D', borderColor: 'rgba(63, 187, 126, 0.44)' },
  assistantBubbleWarning: { backgroundColor: '#272116', borderColor: 'rgba(219, 159, 55, 0.48)' },
  assistantBubbleDanger: { backgroundColor: '#2A1918', borderColor: 'rgba(218, 91, 80, 0.46)' },
  userBubble: {
    backgroundColor: VitalisColors.primaryMist,
    borderBottomRightRadius: VitalisRadius.sm,
    borderColor: '#C8DDF8',
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
  },
  assistantMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 6 },
  feedbackBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginBottom: 9,
    minHeight: 28,
    paddingHorizontal: 9,
  },
  feedbackBadgeSuccess: { backgroundColor: 'rgba(31, 157, 103, 0.12)', borderColor: 'rgba(83, 197, 139, 0.30)' },
  feedbackBadgeWarning: { backgroundColor: 'rgba(178, 106, 0, 0.14)', borderColor: 'rgba(224, 169, 77, 0.32)' },
  feedbackBadgeDanger: { backgroundColor: 'rgba(180, 35, 24, 0.14)', borderColor: 'rgba(225, 103, 94, 0.30)' },
  feedbackBadgeText: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 11 },
  assistantName: {
    color: '#A9D3FA',
    fontFamily: VitalisFonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  assistantTime: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 11 },
  assistantText: {
    color: VitalisColors.onDark,
    flexShrink: 1,
    fontFamily: VitalisFonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  welcomeFootnote: {
    color: VitalisColors.onDarkMuted,
    fontFamily: VitalisFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
  },
  userText: {
    color: VitalisColors.ink,
    flexShrink: 1,
    fontFamily: VitalisFonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  userMetaRow: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 4, marginTop: 7 },
  userTime: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 11 },
  messageSuggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 46 },
  messageSuggestion: {
    alignItems: 'center',
    backgroundColor: VitalisColors.surfaceRaised,
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 11,
  },
  messageSuggestionText: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  loadingBubble: {
    backgroundColor: VitalisColors.surfaceSoft,
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
    gap: 9,
    minWidth: 210,
    padding: 14,
  },
  loadingTopRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  loadingText: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 13 },
  skeletonLong: { backgroundColor: VitalisColors.surfaceCard, borderRadius: 4, height: 8, width: 172 },
  skeletonShort: { backgroundColor: VitalisColors.surfaceCard, borderRadius: 4, height: 8, width: 118 },
  typingBubble: { backgroundColor: VitalisColors.surfaceDarkElevated, borderRadius: VitalisRadius.lg },
  typingContent: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  typingText: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 12, marginTop: 2 },
  dayDivider: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 2 },
  dayLine: { backgroundColor: VitalisColors.border, flex: 1, height: 1 },
  dayLabel: {
    color: VitalisColors.mutedSoft,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  scrollToBottomButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: VitalisColors.surfaceDark,
    borderColor: VitalisColors.borderDark,
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    bottom: 12,
    boxShadow: VitalisElevation.floating,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    position: 'absolute',
  },
  scrollToBottomText: {
    color: VitalisColors.onDark,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
  },
  suggestionsGroup: { flexShrink: 0, paddingTop: 1 },
  suggestionsLabel: {
    color: VitalisColors.muted,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  quickGrid: { alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,253,248,0.86)',
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 9,
  },
  quickChipFill: { alignSelf: 'stretch', width: '100%' },
  quickChipStandard: { flexBasis: '31%', flexGrow: 1, minHeight: 44 },
  quickChipWide: { flexBasis: '19%', flexGrow: 1, minHeight: 44 },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: VitalisColors.primaryMist,
    borderRadius: VitalisRadius.sm,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  quickText: {
    color: VitalisColors.primaryStrong,
    flexShrink: 1,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  composerGroup: { flexShrink: 0, gap: 6 },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: VitalisColors.surfaceRaised,
    borderColor: VitalisColors.borderStrong,
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
    boxShadow: VitalisElevation.control,
    flexDirection: 'row',
    gap: 8,
    minHeight: 56,
    padding: 6,
  },
  composerFocused: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
  input: {
    color: VitalisColors.ink,
    flex: 1,
    fontFamily: VitalisFonts.body,
    fontSize: 16,
    lineHeight: 22,
    minHeight: INPUT_MIN_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 11,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: VitalisColors.primary,
    borderRadius: VitalisRadius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonPressed: { backgroundColor: VitalisColors.primaryPressed, transform: [{ scale: 0.96 }] },
  sendButtonDisabled: { backgroundColor: VitalisColors.surfaceCard, borderColor: VitalisColors.border, borderWidth: 1 },
  composerMetaRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  safetyNote: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', gap: 5 },
  safetyText: {
    color: VitalisColors.mutedSoft,
    flex: 1,
    fontFamily: VitalisFonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  characterCount: {
    color: VitalisColors.mutedSoft,
    fontFamily: VitalisFonts.bodyMedium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  controlDisabled: { opacity: 0.52 },
  focusVisible: { boxShadow: VitalisElevation.focus },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
