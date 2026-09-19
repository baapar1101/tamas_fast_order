/*
=====================================================
MARKSTREET — SIGNAL DESK SESSION PERSISTENCE
SAFE SAME-TAB METADATA ONLY
=====================================================
*/

(() => {
  const STORAGE_KEY = 'markstreet.signalDesk.session.v1';
  const RUNTIME_CREDENTIALS_STORAGE_KEY = 'markstreet.signalDesk.runtimeCredentials.v1';
  const SCHEMA_VERSION = 1;
  const EXPIRY_MS = 12 * 60 * 60 * 1000;
  const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
  const MAX_UNREAD_COUNT = 999;
  const MAX_IDENTIFIER_LENGTH = 128;
  const MAX_DRAFT_LENGTH = 2000;
  const MAX_VISITOR_TOKEN_LENGTH = 4096;

  const SUPPORTED_PHASES = Object.freeze([
    'intake',
    'review',
    'edit-select',
    'edit-answer',
    'submitting',
    'bootstrap-error',
    'live',
  ]);
  const SUPPORTED_INTAKE_STATUSES = Object.freeze([
    'idle',
    'active',
    'review',
    'submitting',
    'error',
    'complete',
  ]);
  const SUPPORTED_QUESTION_IDS = Object.freeze([
    'first-name',
    'last-name',
    'email',
    'phone',
    'industry',
    'request',
    'business-summary',
  ]);
  const DRAFT_LIMITS = Object.freeze({
    request: 800,
    'business-summary': 220,
    'live-message': MAX_DRAFT_LENGTH,
  });
  const ROOT_KEYS = Object.freeze([
    'version',
    'savedAt',
    'expiresAt',
    'conversation',
    'guidedIntake',
    'presentation',
    'drafts',
  ]);
  const CONVERSATION_KEYS = Object.freeze([
    'hasExistingLine',
    'conversationId',
    'phase',
    'lastActivityAt',
    'lastSeenMessageId',
  ]);
  const GUIDED_INTAKE_KEYS = Object.freeze([
    'status',
    'currentQuestionId',
    'completedQuestionIds',
  ]);
  const PRESENTATION_KEYS = Object.freeze([
    'panelWasOpen',
    'unreadCount',
  ]);
  const DRAFT_KEYS = Object.freeze([
    'activeComposer',
    'activeQuestionId',
  ]);
  const RUNTIME_CREDENTIAL_KEYS = Object.freeze([
    'version',
    'savedAt',
    'lastValidatedAt',
    'conversationId',
    'widgetId',
    'visitorToken',
  ]);

  const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );

  const hasOnlyKeys = (value, allowedKeys) => (
    isPlainObject(value)
    && Object.keys(value).every((key) => allowedKeys.includes(key))
    && allowedKeys.every((key) => Object.hasOwn(value, key))
  );

  const isValidIsoTimestamp = (value) => (
    typeof value === 'string'
    && value.length <= 40
    && Number.isFinite(Date.parse(value))
  );

  const normalizeIdentifier = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (Number.isSafeInteger(value) && value > 0) return value;
    if (
      typeof value === 'string'
      && value.length <= MAX_IDENTIFIER_LENGTH
      && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    ) return value;
    return null;
  };

  const canPersistDraftForQuestion = (questionId) => (
    typeof questionId === 'string'
    && Object.hasOwn(DRAFT_LIMITS, questionId)
  );

  const normalizeDraft = (value, questionId) => {
    if (!canPersistDraftForQuestion(questionId) || typeof value !== 'string') return '';
    return value.slice(0, DRAFT_LIMITS[questionId]);
  };

  function createSnapshot(signalDeskSession, uiState = {}) {
    const phase = SUPPORTED_PHASES.includes(uiState.phase)
      ? uiState.phase
      : null;
    const intakeStatus = SUPPORTED_INTAKE_STATUSES.includes(
      signalDeskSession?.guidedIntake?.status
    )
      ? signalDeskSession.guidedIntake.status
      : null;
    if (!phase || !intakeStatus) return null;

    const now = Date.now();
    const currentQuestionId = SUPPORTED_QUESTION_IDS.includes(uiState.currentQuestionId)
      ? uiState.currentQuestionId
      : null;
    const completedQuestionIds = Array.isArray(
      signalDeskSession?.guidedIntake?.completedQuestionIds
    )
      ? [...new Set(signalDeskSession.guidedIntake.completedQuestionIds)].filter(
        (questionId) => SUPPORTED_QUESTION_IDS.includes(questionId)
      )
      : [];
    const activeQuestionId = canPersistDraftForQuestion(uiState.activeQuestionId)
      ? uiState.activeQuestionId
      : null;
    const conversationId = normalizeIdentifier(
      signalDeskSession?.conversation?.conversationId
    );
    const lastSeenMessageId = normalizeIdentifier(
      signalDeskSession?.conversation?.lastSeenMessageId
    );
    const lastActivityAt = isValidIsoTimestamp(
      signalDeskSession?.conversation?.lastActivityAt
    )
      ? new Date(signalDeskSession.conversation.lastActivityAt).toISOString()
      : null;
    const unreadCount = Number.isInteger(uiState.unreadCount)
      ? Math.min(Math.max(uiState.unreadCount, 0), MAX_UNREAD_COUNT)
      : 0;

    return {
      version: SCHEMA_VERSION,
      savedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + EXPIRY_MS).toISOString(),
      conversation: {
        hasExistingLine: Boolean(
          signalDeskSession?.conversation?.hasExistingLine
          || conversationId
        ),
        conversationId,
        phase,
        lastActivityAt,
        lastSeenMessageId,
      },
      guidedIntake: {
        status: intakeStatus,
        currentQuestionId,
        completedQuestionIds,
      },
      presentation: {
        panelWasOpen: uiState.panelWasOpen === true,
        unreadCount,
      },
      drafts: {
        activeComposer: normalizeDraft(uiState.activeComposer, activeQuestionId),
        activeQuestionId,
      },
    };
  }

  function validateSnapshot(value) {
    if (
      !hasOnlyKeys(value, ROOT_KEYS)
      || value.version !== SCHEMA_VERSION
      || !hasOnlyKeys(value.conversation, CONVERSATION_KEYS)
      || !hasOnlyKeys(value.guidedIntake, GUIDED_INTAKE_KEYS)
      || !hasOnlyKeys(value.presentation, PRESENTATION_KEYS)
      || !hasOnlyKeys(value.drafts, DRAFT_KEYS)
    ) return null;

    if (!isValidIsoTimestamp(value.savedAt) || !isValidIsoTimestamp(value.expiresAt)) {
      return null;
    }
    const now = Date.now();
    const savedAt = Date.parse(value.savedAt);
    const expiresAt = Date.parse(value.expiresAt);
    if (
      savedAt > now + MAX_CLOCK_SKEW_MS
      || expiresAt <= now
      || expiresAt <= savedAt
      || expiresAt - savedAt > EXPIRY_MS + MAX_CLOCK_SKEW_MS
    ) return null;

    if (
      typeof value.conversation.hasExistingLine !== 'boolean'
      || !SUPPORTED_PHASES.includes(value.conversation.phase)
      || normalizeIdentifier(value.conversation.conversationId)
        !== value.conversation.conversationId
      || (
        value.conversation.lastActivityAt !== null
        && !isValidIsoTimestamp(value.conversation.lastActivityAt)
      )
      || normalizeIdentifier(value.conversation.lastSeenMessageId)
        !== value.conversation.lastSeenMessageId
    ) return null;

    if (
      !SUPPORTED_INTAKE_STATUSES.includes(value.guidedIntake.status)
      || (
        value.guidedIntake.currentQuestionId !== null
        && !SUPPORTED_QUESTION_IDS.includes(value.guidedIntake.currentQuestionId)
      )
      || !Array.isArray(value.guidedIntake.completedQuestionIds)
      || value.guidedIntake.completedQuestionIds.length > SUPPORTED_QUESTION_IDS.length
      || value.guidedIntake.completedQuestionIds.some(
        (questionId) => !SUPPORTED_QUESTION_IDS.includes(questionId)
      )
      || new Set(value.guidedIntake.completedQuestionIds).size
        !== value.guidedIntake.completedQuestionIds.length
    ) return null;

    if (
      typeof value.presentation.panelWasOpen !== 'boolean'
      || !Number.isInteger(value.presentation.unreadCount)
      || value.presentation.unreadCount < 0
      || value.presentation.unreadCount > MAX_UNREAD_COUNT
    ) return null;

    if (
      typeof value.drafts.activeComposer !== 'string'
      || value.drafts.activeComposer.length > MAX_DRAFT_LENGTH
      || (
        value.drafts.activeQuestionId !== null
        && !canPersistDraftForQuestion(value.drafts.activeQuestionId)
      )
      || (
        value.drafts.activeComposer
        && !canPersistDraftForQuestion(value.drafts.activeQuestionId)
      )
      || (
        canPersistDraftForQuestion(value.drafts.activeQuestionId)
        && value.drafts.activeComposer.length > DRAFT_LIMITS[value.drafts.activeQuestionId]
      )
    ) return null;

    const sanitized = createSnapshot(
      {
        conversation: {
          hasExistingLine: value.conversation.hasExistingLine,
          conversationId: value.conversation.conversationId,
          lastActivityAt: value.conversation.lastActivityAt,
          lastSeenMessageId: value.conversation.lastSeenMessageId,
        },
        guidedIntake: {
          status: value.guidedIntake.status,
          completedQuestionIds: value.guidedIntake.completedQuestionIds,
        },
      },
      {
        phase: value.conversation.phase,
        currentQuestionId: value.guidedIntake.currentQuestionId,
        panelWasOpen: value.presentation.panelWasOpen,
        unreadCount: value.presentation.unreadCount,
        activeComposer: value.drafts.activeComposer,
        activeQuestionId: value.drafts.activeQuestionId,
      }
    );
    if (!sanitized) return null;
    sanitized.savedAt = new Date(savedAt).toISOString();
    sanitized.expiresAt = new Date(expiresAt).toISOString();
    return sanitized;
  }

  function validateRuntimeCredentials(value, expectedConversationId = null) {
    const normalizedWidgetId = normalizeIdentifier(value?.widgetId);
    if (
      !hasOnlyKeys(value, RUNTIME_CREDENTIAL_KEYS)
      || value.version !== SCHEMA_VERSION
      || !isValidIsoTimestamp(value.savedAt)
      || !isValidIsoTimestamp(value.lastValidatedAt)
      || !Number.isSafeInteger(value.conversationId)
      || value.conversationId <= 0
      || (value.widgetId !== null && normalizedWidgetId === null)
      || typeof value.visitorToken !== 'string'
      || !value.visitorToken.trim()
      || value.visitorToken.length > MAX_VISITOR_TOKEN_LENGTH
    ) return null;

    const savedAt = Date.parse(value.savedAt);
    const lastValidatedAt = Date.parse(value.lastValidatedAt);
    if (
      savedAt > Date.now() + MAX_CLOCK_SKEW_MS
      || lastValidatedAt > Date.now() + MAX_CLOCK_SKEW_MS
      || lastValidatedAt < savedAt
      || (
        expectedConversationId !== null
        && Number(expectedConversationId) !== value.conversationId
      )
    ) return null;

    return {
      version: SCHEMA_VERSION,
      savedAt: new Date(savedAt).toISOString(),
      lastValidatedAt: new Date(lastValidatedAt).toISOString(),
      conversationId: value.conversationId,
      widgetId: normalizedWidgetId,
      visitorToken: value.visitorToken,
    };
  }

  function clear() {
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return false;
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function load() {
    let serialized = null;
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return null;
      serialized = storage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
    if (!serialized) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      clear();
      return null;
    }
    const snapshot = validateSnapshot(parsed);
    if (!snapshot) clear();
    return snapshot;
  }

  function save(signalDeskSession, uiState = {}) {
    const snapshot = createSnapshot(signalDeskSession, uiState);
    if (!snapshot) return false;
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  function clearRuntimeCredentials() {
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return false;
      storage.removeItem(RUNTIME_CREDENTIALS_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function loadRuntimeCredentials(expectedConversationId = null) {
    let serialized = null;
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return null;
      serialized = storage.getItem(RUNTIME_CREDENTIALS_STORAGE_KEY) || null;
    } catch {
      return null;
    }
    if (!serialized) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      clearRuntimeCredentials();
      return null;
    }
    const credentials = validateRuntimeCredentials(parsed, expectedConversationId);
    if (!credentials) clearRuntimeCredentials();
    return credentials;
  }

  function saveRuntimeCredentials({
    conversationId,
    widgetId = null,
    visitorToken,
    savedAt = null,
    lastValidatedAt = null,
  } = {}) {
    const now = new Date().toISOString();
    const credentials = validateRuntimeCredentials({
      version: SCHEMA_VERSION,
      savedAt: isValidIsoTimestamp(savedAt) ? savedAt : now,
      lastValidatedAt: isValidIsoTimestamp(lastValidatedAt) ? lastValidatedAt : now,
      conversationId,
      widgetId,
      visitorToken,
    });
    if (!credentials) return false;
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return false;
      storage.setItem(
        RUNTIME_CREDENTIALS_STORAGE_KEY,
        JSON.stringify(credentials)
      );
      return true;
    } catch {
      return false;
    }
  }

  window.MarkStreetSignalDeskPersistence = Object.freeze({
    load,
    save,
    clear,
    createSnapshot,
    validateSnapshot,
    getStorageKey: () => STORAGE_KEY,
    loadRuntimeCredentials,
    saveRuntimeCredentials,
    clearRuntimeCredentials,
    validateRuntimeCredentials,
    getRuntimeCredentialsStorageKey: () => RUNTIME_CREDENTIALS_STORAGE_KEY,
  });
})();
