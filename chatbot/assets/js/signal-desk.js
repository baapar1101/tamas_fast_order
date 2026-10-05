/*
=====================================================
MARKSTREET — SIGNAL DESK
CONVERSATIONAL INTAKE + CRM MESSAGING
=====================================================
*/

(() => {
  const body = document.body;
  const layer = document.querySelector('#signal-desk-layer');
  const desk = document.querySelector('#signal-desk');
  const trigger = document.querySelector('[data-signal-desk-open]');
  const start = document.querySelector('[data-signal-desk-start]');
  const messageList = document.querySelector('[data-signal-desk-messages]');
  const composer = document.querySelector('[data-signal-desk-composer]');
  const composerLabel = document.querySelector('[data-signal-desk-composer-label]');
  const shortAnswer = document.querySelector('[data-signal-desk-short-answer]');
  const messageInput = document.querySelector('[data-signal-desk-message-input]');
  const choices = document.querySelector('[data-signal-desk-intake-choices]');
  const skipButton = document.querySelector('[data-signal-desk-skip]');
  const sendButton = document.querySelector('[data-signal-desk-send]');
  const composerStatus = document.querySelector('[data-signal-desk-composer-status]');
  const bootstrapRetry = document.querySelector('[data-signal-desk-bootstrap-retry]');
  const realtimeStatus = document.querySelector('.signal-desk-conversation__status');
  const statePanels = Array.from(document.querySelectorAll('[data-signal-desk-state-panel]'));
  const intakeDomain = window.MarkStreetSignalDeskIntake;
  const persistence = window.MarkStreetSignalDeskPersistence || null;

  if (
    !layer || !desk || !trigger || !start || !messageList || !composer
    || !composerLabel || !shortAnswer || !messageInput || !choices || !skipButton
    || !sendButton || !composerStatus || !bootstrapRetry || !realtimeStatus
    || !intakeDomain
  ) return;

  const SIGNAL_DESK_STATES = Object.freeze({
    INTRO: 'intro',
    CONVERSATION: 'conversation',
  });

  const SIGNAL_DESK_CONVERSATION_PHASES = Object.freeze({
    INTAKE: 'intake',
    REVIEW: 'review',
    EDIT_SELECT: 'edit-select',
    EDIT_ANSWER: 'edit-answer',
    SUBMITTING: 'submitting',
    BOOTSTRAP_ERROR: 'bootstrap-error',
    LIVE: 'live',
  });

  const SIGNAL_DESK_HEADER_STATUS = Object.freeze({
    PRIVATE_LINE: Object.freeze({
      key: 'private-line',
      label: 'PRIVATE LINE',
      tone: 'neutral',
      dotMode: 'idle',
      accessibleLabel: 'Private Signal Desk line.',
    }),
    BUILDING_CONTEXT: Object.freeze({
      key: 'building-context',
      label: 'BUILDING CONTEXT',
      tone: 'active',
      dotMode: 'breathing',
      accessibleLabel: 'Signal Desk is building your context.',
    }),
    SECURING_CONTEXT: Object.freeze({
      key: 'securing-context',
      label: 'SECURING CONTEXT',
      tone: 'processing',
      dotMode: 'processing',
      accessibleLabel: 'Signal Desk is securing your context.',
    }),
    LINE_OPEN: Object.freeze({
      key: 'line-open',
      label: 'LINE OPEN',
      tone: 'connected',
      dotMode: 'steady',
      accessibleLabel: 'Your Signal Desk line is open.',
    }),
    RESTORING_LINE: Object.freeze({
      key: 'restoring-line',
      label: 'RESTORING LINE',
      tone: 'recovering',
      dotMode: 'recovering',
      accessibleLabel: 'Signal Desk is restoring the connection.',
    }),
    LINE_INTERRUPTED: Object.freeze({
      key: 'line-interrupted',
      label: 'LINE INTERRUPTED',
      tone: 'interrupted',
      dotMode: 'interrupted',
      accessibleLabel: 'The Signal Desk line is temporarily interrupted.',
    }),
  });

  const SIGNAL_DESK_EDIT_OPTIONS = Object.freeze([
    { id: 'industry', label: 'Industry', questionId: 'industry' },
    { id: 'request', label: 'Primary Challenge', questionId: 'request' },
    { id: 'business-summary', label: 'Business in One Line', questionId: 'business-summary' },
    { id: 'contact-details', label: 'Contact Details', questionId: null },
  ].map(Object.freeze));

  const SIGNAL_DESK_CONTACT_EDIT_OPTIONS = Object.freeze([
    { id: 'first-name', label: 'First Name', questionId: 'first-name' },
    { id: 'last-name', label: 'Last Name', questionId: 'last-name' },
    { id: 'email', label: 'Work Email', questionId: 'email' },
    { id: 'phone', label: 'Phone', questionId: 'phone' },
  ].map(Object.freeze));

  const SIGNAL_DESK_VALIDATION_FIELD_MAP = Object.freeze({
    first_name: Object.freeze(['first-name']),
    firstName: Object.freeze(['first-name']),
    last_name: Object.freeze(['last-name']),
    lastName: Object.freeze(['last-name']),
    email: Object.freeze(['email']),
    phone: Object.freeze(['phone']),
    industry: Object.freeze(['industry']),
    request: Object.freeze(['request']),
    business_summary: Object.freeze(['business-summary']),
    businessSummary: Object.freeze(['business-summary']),
  });

  const signalDeskSession = {
    identity: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
    intake: {
      industry: '',
      request: '',
      businessSummary: '',
    },
    guidedIntake: {
      status: 'idle',
      currentQuestionIndex: 0,
      completedQuestionIds: [],
      startedAt: null,
      completedAt: null,
      review: {
        presentedAt: null,
        confirmationRequestedAt: null,
        confirmedAt: null,
        correctionQuestionIds: [],
      },
      edit: {
        active: false,
        target: null,
        startedAt: null,
        previousValue: null,
      },
    },
    conversation: {
      hasExistingLine: false,
      conversationId: null,
      visitorToken: '',
      widgetId: null,
      intakeMessageSent: false,
      intakeMessageServerId: null,
      isBootstrapping: false,
      isLoadingHistory: false,
      historySyncQueued: false,
      hasSyncedHistory: false,
      liveWelcomeInitialized: false,
      lastError: null,
      historyError: null,
      realtimeError: null,
      lastActivityAt: null,
      lastSeenMessageId: null,
      messages: [],
    },
    presentation: {
      realtimeStatus: 'idle',
      pollingFallbackActive: false,
      pollingFallbackHealth: 'idle',
      hasReachedOpenLine: false,
      unreadCount: 0,
      isRestoringSession: false,
      runtimeReady: false,
      restoreState: 'idle',
    },
    bootstrapProgress: {
      contextValidated: false,
      collapsed: false,
      errorStep: null,
    },
  };

  let currentSignalDeskState = SIGNAL_DESK_STATES.INTRO;
  let currentConversationPhase = SIGNAL_DESK_CONVERSATION_PHASES.INTAKE;
  const signalDeskMessageSends = new Map();
  const SIGNAL_DESK_POLLING_INTERVAL_MS = 25000;
  let signalDeskPollingTimer = null;
  let signalDeskFocusFrame = null;
  let signalDeskViewportResizeFrame = null;
  let signalDeskIntakeTransitionController = null;
  let signalDeskIntakeTransitionContinuation = null;
  let signalDeskTypingRemovalTimer = null;
  let signalDeskBriefFocusTimer = null;
  let signalDeskBriefUpdatedTimer = null;
  let signalDeskBootstrapCollapseTimer = null;
  let signalDeskHeaderTransitionTimer = null;
  let signalDeskHeaderAnnouncementTimer = null;
  let signalDeskPersistenceDraftTimer = null;
  let signalDeskHeaderTransitionToken = 0;
  let signalDeskRenderedHeaderStatusKey = null;
  let signalDeskHydratedDraft = null;
  let signalDeskRestoredPanelWasOpen = false;
  let signalDeskIsHydrating = false;
  let signalDeskComposerDraftDirty = false;
  let signalDeskConversationRestorePromise = null;
  let signalDeskPendingRuntimeCredentials = null;
  let signalDeskLastVisibilityRecoveryAt = 0;
  let signalDeskRuntimePersistenceWarningShown = false;
  let signalDeskEditQuestionId = null;
  let signalDeskBriefJustUpdated = false;
  const signalDeskMessageUiKeys = new WeakMap();
  const signalDeskPresentedMessageKeys = new Set();
  const SIGNAL_DESK_MESSAGE_ENTRANCE_MS = 600;
  const SIGNAL_DESK_TYPING_DELAYS = Object.freeze({
    firstQuestion: 420,
    answerPause: 240,
    nextQuestion: 620,
    reducedMotion: 110,
  });
  const SIGNAL_DESK_BRIEF_MESSAGE_ID = 'local:brief-summary';
  const SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID = 'local:bootstrap-context-signal';
  const SIGNAL_DESK_BOOTSTRAP_COLLAPSE_HOLD_MS = 720;
  const closeControls = layer.querySelectorAll('[data-signal-desk-close]');
  const signalDeskTypingIndicator = document.createElement('div');
  const signalDeskTypingDots = document.createElement('span');
  const signalDeskTypingLabel = document.createElement('span');
  const signalDeskStatusDot = realtimeStatus.querySelector(
    '.signal-desk-conversation__status-dot'
  ) || document.createElement('span');
  const signalDeskStatusLabelViewport = document.createElement('span');
  const signalDeskStatusCurrentLabel = document.createElement('span');
  const signalDeskStatusNextLabel = document.createElement('span');
  const signalDeskStatusAnnouncement = document.createElement('span');

  signalDeskStatusDot.className = 'signal-desk-conversation__status-dot';
  signalDeskStatusDot.setAttribute('aria-hidden', 'true');
  signalDeskStatusLabelViewport.className = 'signal-desk-conversation__status-label-viewport';
  signalDeskStatusLabelViewport.setAttribute('aria-hidden', 'true');
  signalDeskStatusCurrentLabel.className = [
    'signal-desk-conversation__status-label',
    'signal-desk-conversation__status-label--current',
  ].join(' ');
  signalDeskStatusCurrentLabel.dataset.signalDeskStatusCurrent = '';
  signalDeskStatusNextLabel.className = [
    'signal-desk-conversation__status-label',
    'signal-desk-conversation__status-label--next',
  ].join(' ');
  signalDeskStatusNextLabel.dataset.signalDeskStatusNext = '';
  signalDeskStatusAnnouncement.className = 'signal-desk__sr-only';
  signalDeskStatusAnnouncement.dataset.signalDeskStatusAnnouncement = '';
  signalDeskStatusLabelViewport.append(
    signalDeskStatusCurrentLabel,
    signalDeskStatusNextLabel
  );
  realtimeStatus.replaceChildren(
    signalDeskStatusDot,
    signalDeskStatusLabelViewport,
    signalDeskStatusAnnouncement
  );
  realtimeStatus.dataset.signalDeskAdaptiveStatus = '';
  realtimeStatus.setAttribute('role', 'status');
  realtimeStatus.setAttribute('aria-live', 'polite');
  realtimeStatus.setAttribute('aria-atomic', 'true');
  realtimeStatus.removeAttribute('aria-label');

  signalDeskTypingIndicator.className = 'signal-desk-typing';
  signalDeskTypingIndicator.setAttribute('role', 'status');
  signalDeskTypingIndicator.setAttribute('aria-live', 'polite');
  signalDeskTypingIndicator.setAttribute('aria-atomic', 'true');
  signalDeskTypingDots.className = 'signal-desk-typing__dots';
  signalDeskTypingDots.setAttribute('aria-hidden', 'true');
  signalDeskTypingDots.append(
    ...Array.from({ length: 3 }, () => document.createElement('i'))
  );
  signalDeskTypingLabel.className = 'signal-desk-typing__label';
  signalDeskTypingIndicator.append(signalDeskTypingDots, signalDeskTypingLabel);

  const getFocusableControls = () => Array.from(
    desk.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
  ).filter((control) => !control.hidden && !control.closest('[aria-hidden="true"]'));

  function queueSignalDeskFocus(getControl) {
    if (signalDeskFocusFrame !== null) cancelAnimationFrame(signalDeskFocusFrame);
    signalDeskFocusFrame = requestAnimationFrame(() => {
      signalDeskFocusFrame = null;
      if (!layer.classList.contains('is-open')) return;
      const control = typeof getControl === 'function' ? getControl() : getControl;
      control?.focus();
    });
  }

  function getCurrentSignalDeskQuestion() {
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      return intakeDomain.getQuestion(signalDeskEditQuestionId);
    }
    return intakeDomain.getQuestion(signalDeskSession.guidedIntake.currentQuestionIndex);
  }

  function getActiveComposerControl() {
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT) {
      return choices.querySelector('button');
    }
    if (
      currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.INTAKE
      && currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER
    ) {
      return currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.LIVE
        ? messageInput
        : currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
          ? messageList.querySelector(
            '[data-signal-desk-edit-answers]:not([hidden]), [data-signal-desk-confirm-brief]:not([hidden])'
          )
          : currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR
            ? bootstrapRetry
            : null;
    }
    const question = getCurrentSignalDeskQuestion();
    if (question?.answerType === 'choice') return choices.querySelector('button');
    return question?.answerType === 'multiline' ? messageInput : shortAnswer;
  }

  function getStateFocusTarget() {
    return currentSignalDeskState === SIGNAL_DESK_STATES.CONVERSATION
      ? getActiveComposerControl()
      : start;
  }

  function getSignalDeskQuestionIndex(questionId) {
    if (!questionId) return 0;
    for (let index = 0; ; index += 1) {
      const question = intakeDomain.getQuestion(index);
      if (!question) return 0;
      if (question.id === questionId) return index;
    }
  }

  function getSignalDeskPersistenceQuestionId() {
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.LIVE) {
      return 'live-message';
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      return signalDeskEditQuestionId;
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.INTAKE) {
      return getCurrentSignalDeskQuestion()?.id || null;
    }
    return null;
  }

  function getSignalDeskPersistenceUiState() {
    const activeQuestionId = getSignalDeskPersistenceQuestionId()
      || signalDeskHydratedDraft?.questionId
      || null;
    const activeControl = getActiveComposerControl();
    const activeComposer = signalDeskComposerDraftDirty
      && activeControl
      && 'value' in activeControl
      ? activeControl.value
      : signalDeskHydratedDraft?.questionId === activeQuestionId
        ? signalDeskHydratedDraft.value
        : '';
    return {
      phase: currentConversationPhase,
      currentQuestionId: getCurrentSignalDeskQuestion()?.id || null,
      panelWasOpen: layer.classList.contains('is-open'),
      unreadCount: signalDeskSession.presentation.unreadCount,
      activeComposer,
      activeQuestionId,
    };
  }

  function saveSignalDeskPersistence({ debounce = false } = {}) {
    if (!persistence || signalDeskIsHydrating) return;
    if (signalDeskPersistenceDraftTimer !== null) {
      window.clearTimeout(signalDeskPersistenceDraftTimer);
      signalDeskPersistenceDraftTimer = null;
    }
    const persist = () => {
      signalDeskPersistenceDraftTimer = null;
      persistence.save(signalDeskSession, getSignalDeskPersistenceUiState());
    };
    if (debounce) {
      signalDeskPersistenceDraftTimer = window.setTimeout(persist, 300);
      return;
    }
    persist();
  }

  function hydrateSignalDeskFromPersistence(snapshot, {
    hasRuntimeCredentials = false,
    credentialConflict = false,
  } = {}) {
    if (!snapshot) return false;
    const conversation = signalDeskSession.conversation;
    const guidedIntake = signalDeskSession.guidedIntake;
    const persistedPhase = snapshot.conversation.phase;

    conversation.hasExistingLine = snapshot.conversation.hasExistingLine;
    conversation.conversationId = snapshot.conversation.conversationId;
    conversation.lastActivityAt = snapshot.conversation.lastActivityAt;
    conversation.lastSeenMessageId = snapshot.conversation.lastSeenMessageId;
    guidedIntake.status = snapshot.guidedIntake.status;
    guidedIntake.currentQuestionIndex = getSignalDeskQuestionIndex(
      snapshot.guidedIntake.currentQuestionId
    );
    guidedIntake.completedQuestionIds = [
      ...snapshot.guidedIntake.completedQuestionIds,
    ];
    signalDeskSession.presentation.unreadCount = snapshot.presentation.unreadCount;
    signalDeskRestoredPanelWasOpen = snapshot.presentation.panelWasOpen;
    signalDeskHydratedDraft = snapshot.drafts.activeQuestionId
      ? {
        questionId: snapshot.drafts.activeQuestionId,
        value: snapshot.drafts.activeComposer,
      }
      : null;

    currentConversationPhase = persistedPhase;
    if (persistedPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT) {
      guidedIntake.edit.active = true;
    } else if (persistedPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      const editQuestion = intakeDomain.getQuestion(
        snapshot.guidedIntake.currentQuestionId
      );
      if (editQuestion) {
        guidedIntake.edit.active = true;
        signalDeskEditQuestionId = editQuestion.id;
      } else {
        currentConversationPhase = SIGNAL_DESK_CONVERSATION_PHASES.REVIEW;
        guidedIntake.status = 'review';
      }
    }

    if (
      hasRuntimeCredentials
      && [
        SIGNAL_DESK_CONVERSATION_PHASES.LIVE,
        SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING,
        SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR,
      ].includes(persistedPhase)
    ) {
      currentConversationPhase = SIGNAL_DESK_CONVERSATION_PHASES.LIVE;
      guidedIntake.status = 'complete';
      conversation.intakeMessageSent = true;
      signalDeskSession.presentation.isRestoringSession = true;
      signalDeskSession.presentation.runtimeReady = false;
      signalDeskSession.presentation.restoreState = 'credentials-loaded';
    } else if ([
      SIGNAL_DESK_CONVERSATION_PHASES.LIVE,
      SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING,
    ].includes(persistedPhase)) {
      currentConversationPhase = SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR;
      guidedIntake.status = 'error';
      conversation.lastError = {
        code: 'SECURE_RESUME_REQUIRED',
        status: null,
        classification: 'authentication',
        stage: 'resume',
        fieldErrors: {},
        retryable: false,
        recoveryAction: 'start-new-line',
        userMessage: 'This line needs secure authentication before messaging can continue.',
      };
    } else if (persistedPhase === SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR) {
      conversation.lastError = {
        code: 'RESTORED_SESSION_INTERRUPTED',
        status: null,
        classification: 'unknown',
        stage: 'resume',
        fieldErrors: {},
        retryable: false,
        recoveryAction: 'start-new-line',
        userMessage: 'This saved Signal Desk flow needs to be restarted securely.',
      };
    }

    if (credentialConflict) {
      conversation.hasExistingLine = false;
      conversation.conversationId = null;
      currentConversationPhase = SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR;
      guidedIntake.status = 'error';
      conversation.lastError = {
        code: 'SESSION_CREDENTIAL_MISMATCH',
        status: null,
        classification: 'authentication',
        stage: 'restore',
        fieldErrors: {},
        retryable: false,
        recoveryAction: 'start-new-line',
        userMessage: 'Your previous line could not be restored.',
      };
    }

    return true;
  }

  function restoreSignalDeskComposerDraft() {
    if (!signalDeskHydratedDraft?.value) return;
    const activeQuestionId = getSignalDeskPersistenceQuestionId();
    const activeControl = getActiveComposerControl();
    if (
      activeQuestionId !== signalDeskHydratedDraft.questionId
      || !activeControl
      || !('value' in activeControl)
    ) return;
    activeControl.value = signalDeskHydratedDraft.value;
    signalDeskComposerDraftDirty = true;
    if (activeControl === messageInput) autoResizeSignalDeskComposer();
    updateSignalDeskSendState();
  }

  function getSignalDeskHeaderLifecycleState() {
    return {
      session: signalDeskSession,
      shellState: currentSignalDeskState,
      conversationPhase: currentConversationPhase,
      browserOnline: navigator.onLine !== false,
    };
  }

  function resolveSignalDeskHeaderStatus({
    session,
    shellState,
    conversationPhase,
    browserOnline,
  }) {
    if (shellState === SIGNAL_DESK_STATES.INTRO) {
      return SIGNAL_DESK_HEADER_STATUS.PRIVATE_LINE;
    }

    if (conversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR) {
      return session.conversation.lastError?.classification === 'validation'
        ? SIGNAL_DESK_HEADER_STATUS.BUILDING_CONTEXT
        : SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
    }

    if (conversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING) {
      return browserOnline
        ? SIGNAL_DESK_HEADER_STATUS.SECURING_CONTEXT
        : SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
    }

    if ([
      SIGNAL_DESK_CONVERSATION_PHASES.INTAKE,
      SIGNAL_DESK_CONVERSATION_PHASES.REVIEW,
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT,
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER,
    ].includes(conversationPhase)) {
      return SIGNAL_DESK_HEADER_STATUS.BUILDING_CONTEXT;
    }

    if (conversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.LIVE) {
      return SIGNAL_DESK_HEADER_STATUS.PRIVATE_LINE;
    }

    const presentation = session.presentation;
    const pollingIsUsable = presentation.pollingFallbackActive
      && ['pending', 'healthy'].includes(presentation.pollingFallbackHealth);

    if (!browserOnline) {
      return SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
    }

    if (presentation.isRestoringSession) {
      return SIGNAL_DESK_HEADER_STATUS.RESTORING_LINE;
    }

    if (presentation.realtimeStatus === 'connected') {
      return SIGNAL_DESK_HEADER_STATUS.LINE_OPEN;
    }

    if (
      presentation.pollingFallbackActive
      && presentation.pollingFallbackHealth === 'failed'
    ) {
      return SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
    }

    if (!presentation.hasReachedOpenLine) {
      if (
        ['offline', 'closed'].includes(presentation.realtimeStatus)
        && !pollingIsUsable
      ) {
        return SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
      }
      return SIGNAL_DESK_HEADER_STATUS.SECURING_CONTEXT;
    }

    if (
      ['connecting', 'authenticating', 'reconnecting', 'idle'].includes(
        presentation.realtimeStatus
      )
      || pollingIsUsable
    ) {
      return SIGNAL_DESK_HEADER_STATUS.RESTORING_LINE;
    }

    return SIGNAL_DESK_HEADER_STATUS.LINE_INTERRUPTED;
  }

  function resolveSignalDeskMaterialPhase(
    { shellState, conversationPhase },
    headerStatus
  ) {
    if (shellState === SIGNAL_DESK_STATES.INTRO) return 'intro';
    if (headerStatus.key === SIGNAL_DESK_HEADER_STATUS.RESTORING_LINE.key) {
      return 'restoring';
    }
    if ([
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT,
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER,
    ].includes(conversationPhase)) {
      return 'edit';
    }
    return conversationPhase;
  }

  function updateSignalDeskMaterialState(lifecycleState, headerStatus) {
    const nextPhase = resolveSignalDeskMaterialPhase(lifecycleState, headerStatus);
    const nextLineState = headerStatus.key;

    if (
      desk.dataset.signalDeskPhase === nextPhase
      && desk.dataset.signalDeskLineState === nextLineState
    ) return false;

    desk.dataset.signalDeskPhase = nextPhase;
    desk.dataset.signalDeskLineState = nextLineState;
    return true;
  }

  function finalizeSignalDeskHeaderTransition(status, transitionToken) {
    if (transitionToken !== signalDeskHeaderTransitionToken) return;
    signalDeskStatusCurrentLabel.textContent = status.label;
    signalDeskStatusNextLabel.textContent = '';
    signalDeskStatusCurrentLabel.classList.remove('is-leaving');
    signalDeskStatusNextLabel.classList.remove('is-entering');
    realtimeStatus.classList.remove('is-changing');
    signalDeskHeaderTransitionTimer = null;
  }

  function updateSignalDeskAdaptiveHeader({ connectionChange = false } = {}) {
    const lifecycleState = getSignalDeskHeaderLifecycleState();
    const nextStatus = resolveSignalDeskHeaderStatus(lifecycleState);
    updateSignalDeskMaterialState(lifecycleState, nextStatus);
    if (nextStatus.key === signalDeskRenderedHeaderStatusKey) return;

    const previousStatus = Object.values(SIGNAL_DESK_HEADER_STATUS).find(
      (status) => status.key === signalDeskRenderedHeaderStatusKey
    );
    const transitionToken = ++signalDeskHeaderTransitionToken;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (signalDeskHeaderTransitionTimer !== null) {
      window.clearTimeout(signalDeskHeaderTransitionTimer);
      signalDeskHeaderTransitionTimer = null;
    }
    if (signalDeskHeaderAnnouncementTimer !== null) {
      window.clearTimeout(signalDeskHeaderAnnouncementTimer);
      signalDeskHeaderAnnouncementTimer = null;
    }

    signalDeskStatusCurrentLabel.classList.remove('is-leaving');
    signalDeskStatusNextLabel.classList.remove('is-entering');
    realtimeStatus.classList.remove('is-changing');
    if (previousStatus) signalDeskStatusCurrentLabel.textContent = previousStatus.label;

    realtimeStatus.dataset.statusKey = nextStatus.key;
    realtimeStatus.dataset.statusTone = nextStatus.tone;
    realtimeStatus.dataset.dotMode = nextStatus.dotMode;
    signalDeskRenderedHeaderStatusKey = nextStatus.key;

    if (!previousStatus) {
      signalDeskStatusCurrentLabel.textContent = nextStatus.label;
      signalDeskStatusNextLabel.textContent = '';
      signalDeskStatusAnnouncement.textContent = nextStatus.accessibleLabel;
      return;
    }

    signalDeskStatusNextLabel.textContent = nextStatus.label;
    realtimeStatus.classList.add('is-changing');
    signalDeskStatusCurrentLabel.classList.add('is-leaving');
    signalDeskStatusNextLabel.classList.add('is-entering');

    signalDeskHeaderTransitionTimer = window.setTimeout(
      () => finalizeSignalDeskHeaderTransition(nextStatus, transitionToken),
      reducedMotion ? 90 : 360
    );

    const announceStatus = () => {
      if (
        transitionToken !== signalDeskHeaderTransitionToken
        || signalDeskRenderedHeaderStatusKey !== nextStatus.key
      ) return;
      signalDeskStatusAnnouncement.textContent = nextStatus.accessibleLabel;
      signalDeskHeaderAnnouncementTimer = null;
    };

    if (connectionChange) {
      signalDeskHeaderAnnouncementTimer = window.setTimeout(announceStatus, 280);
    } else {
      announceStatus();
    }
  }

  function setSignalDeskState(nextState, { moveFocus = true } = {}) {
    if (!Object.values(SIGNAL_DESK_STATES).includes(nextState)) return;
    currentSignalDeskState = nextState;
    desk.dataset.signalDeskState = nextState;
    statePanels.forEach((panel) => {
      panel.setAttribute('aria-hidden', String(panel.dataset.signalDeskStatePanel !== nextState));
    });
    if (nextState === SIGNAL_DESK_STATES.CONVERSATION) {
      renderSignalDeskMessages({ forceScroll: true });
    }
    updateSignalDeskAdaptiveHeader();
    if (moveFocus && layer.classList.contains('is-open')) {
      queueSignalDeskFocus(getStateFocusTarget);
    }
    saveSignalDeskPersistence();
  }

  function setSignalDeskConversationPhase(nextPhase) {
    if (!Object.values(SIGNAL_DESK_CONVERSATION_PHASES).includes(nextPhase)) return;
    if (nextPhase !== SIGNAL_DESK_CONVERSATION_PHASES.INTAKE) {
      cancelSignalDeskIntakeTransition();
    }
    currentConversationPhase = nextPhase;
    desk.dataset.signalDeskConversationPhase = nextPhase;
    composer.dataset.signalDeskComposerPhase = nextPhase;
    updateSignalDeskAdaptiveHeader();
    configureSignalDeskComposer();
    if (nextPhase !== SIGNAL_DESK_CONVERSATION_PHASES.INTAKE) {
      hideSignalDeskTypingIndicator();
    }
    saveSignalDeskPersistence();
  }

  function openSignalDesk() {
    if (layer.classList.contains('is-open')) return;
    document.dispatchEvent(new CustomEvent('signal-desk:opening'));
    body.classList.add('signal-desk-open');
    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    signalDeskSession.presentation.unreadCount = 0;
    const latestServerMessage = [...signalDeskSession.conversation.messages]
      .reverse()
      .find((message) => message.serverId);
    if (latestServerMessage) {
      signalDeskSession.conversation.lastSeenMessageId = String(latestServerMessage.serverId);
    }
    saveSignalDeskPersistence();
    queueSignalDeskFocus(getStateFocusTarget);
  }

  function closeSignalDesk({ restoreFocus = true } = {}) {
    if (!layer.classList.contains('is-open')) return;
    body.classList.remove('signal-desk-open');
    if (signalDeskFocusFrame !== null) {
      cancelAnimationFrame(signalDeskFocusFrame);
      signalDeskFocusFrame = null;
    }
    cancelSignalDeskIntakeTransition({ advance: true });
    if (signalDeskBriefFocusTimer !== null) {
      window.clearTimeout(signalDeskBriefFocusTimer);
      signalDeskBriefFocusTimer = null;
    }
    if (signalDeskBriefUpdatedTimer !== null) {
      window.clearTimeout(signalDeskBriefUpdatedTimer);
      signalDeskBriefUpdatedTimer = null;
    }
    signalDeskBriefJustUpdated = false;
    messageList.querySelector('[data-signal-desk-brief]')?.classList.remove(
      'signal-desk-brief--just-updated'
    );
    hideSignalDeskTypingIndicator({ immediate: true });
    settleSignalDeskMessageEntrances();
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    saveSignalDeskPersistence();
    if (restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', openSignalDesk);
  closeControls.forEach((control) => control.addEventListener('click', () => closeSignalDesk()));
  document.addEventListener('markstreet:menu-opening', () => closeSignalDesk({ restoreFocus: false }));

  document.addEventListener('keydown', (event) => {
    if (!layer.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSignalDesk();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusableControls();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  start.addEventListener('click', () => {
    if (
      signalDeskSession.guidedIntake.status === 'idle'
      && !signalDeskSession.conversation.hasExistingLine
    ) {
      persistence?.clear();
      persistence?.clearRuntimeCredentials();
      signalDeskHydratedDraft = null;
    }
    setSignalDeskState(SIGNAL_DESK_STATES.CONVERSATION, { moveFocus: false });
    initializeSignalDeskGuidedIntake();
    document.dispatchEvent(new CustomEvent('signal-desk:start'));
  });

  function createSignalDeskClientId() {
    const fallbackId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return globalThis.crypto?.randomUUID?.() || fallbackId;
  }

  function createSignalDeskMessage(senderRole, body, {
    deliveryStatus = 'sent',
    isLocalOnly = false,
    messageKind = 'chat',
    questionId = null,
  } = {}) {
    const clientId = createSignalDeskClientId();
    return {
      id: clientId,
      serverId: null,
      clientId,
      conversationId: signalDeskSession.conversation.conversationId,
      senderRole,
      senderName: null,
      body,
      createdAt: new Date().toISOString(),
      displayTime: null,
      deliveryStatus,
      errorCode: null,
      file: null,
      isLocalOnly,
      messageKind,
      questionId,
    };
  }

  function appendSignalDeskIntakeQuestion(question, { animate = true } = {}) {
    const duplicate = signalDeskSession.conversation.messages.some(
      (message) => message.messageKind === 'intake-question' && message.questionId === question.id
    );
    if (duplicate) return;
    const bodyText = question.support ? `${question.prompt}\n\n${question.support}` : question.prompt;
    const message = createSignalDeskMessage('agent', bodyText, {
      isLocalOnly: true,
      messageKind: 'intake-question',
      questionId: question.id,
    });
    signalDeskSession.conversation.messages.push(message);
    renderSignalDeskMessages({
      smooth: animate,
      forceScroll: true,
      animateMessages: animate ? [message] : [],
    });
  }

  function initializeSignalDeskGuidedIntake() {
    const guidedIntake = signalDeskSession.guidedIntake;
    if (guidedIntake.status !== 'idle') {
      const resumedPhase = guidedIntake.status === 'review'
        ? SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
        : guidedIntake.status === 'submitting'
          ? SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING
          : guidedIntake.status === 'error'
            ? SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR
            : guidedIntake.status === 'complete' && signalDeskSession.conversation.intakeMessageSent
              ? SIGNAL_DESK_CONVERSATION_PHASES.LIVE
              : currentConversationPhase;
      setSignalDeskConversationPhase(resumedPhase);
      if (resumedPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW) {
        ensureSignalDeskBriefSummaryMessage({ animate: false });
      }
      return;
    }
    guidedIntake.status = 'active';
    guidedIntake.currentQuestionIndex = 0;
    guidedIntake.startedAt = new Date().toISOString();
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.INTAKE);
    resetSignalDeskComposerControls();
    composerLabel.textContent = 'Preparing the first question';
    if (
      currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.INTAKE
      && signalDeskSession.guidedIntake.status === 'active'
    ) {
      presentInitialSignalDeskIntakeQuestion(getCurrentSignalDeskQuestion());
    }
  }

  function resetSignalDeskComposerControls() {
    signalDeskComposerDraftDirty = false;
    shortAnswer.hidden = true;
    shortAnswer.disabled = true;
    shortAnswer.value = '';
    shortAnswer.removeAttribute('maxlength');
    shortAnswer.removeAttribute('autocomplete');
    shortAnswer.removeAttribute('inputmode');
    shortAnswer.type = 'text';
    shortAnswer.placeholder = '';
    shortAnswer.setAttribute('aria-invalid', 'false');
    messageInput.hidden = true;
    messageInput.disabled = true;
    messageInput.value = '';
    messageInput.removeAttribute('maxlength');
    messageInput.removeAttribute('autocomplete');
    messageInput.removeAttribute('inputmode');
    messageInput.placeholder = '';
    messageInput.style.height = '';
    messageInput.setAttribute('aria-invalid', 'false');
    choices.hidden = true;
    choices.replaceChildren();
    skipButton.hidden = true;
    skipButton.disabled = true;
    skipButton.textContent = 'Skip';
    sendButton.hidden = false;
    sendButton.disabled = true;
    bootstrapRetry.hidden = true;
    bootstrapRetry.disabled = true;
  }

  function setSignalDeskComposerStatus(message = '', { alert = false } = {}) {
    composerStatus.textContent = message;
    composerStatus.classList.toggle('is-visible', Boolean(message));
    composerStatus.setAttribute('role', alert ? 'alert' : 'status');
  }

  function configureSignalDeskComposerForQuestion(question) {
    resetSignalDeskComposerControls();
    setSignalDeskComposerStatus('');
    if (!question) return;
    composerLabel.textContent = question.prompt;
    sendButton.setAttribute('aria-label', 'Submit answer');

    if (question.answerType === 'choice') {
      composerLabel.removeAttribute('for');
      choices.hidden = false;
      choices.setAttribute('aria-label', question.prompt);
      question.options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'signal-desk-composer__choice';
        button.dataset.signalDeskIntakeChoice = option.value;
        button.textContent = option.label;
        const currentValue = signalDeskSession[question.targetGroup]?.[question.targetKey];
        button.setAttribute('aria-pressed', String(currentValue === option.value));
        choices.append(button);
      });
      sendButton.hidden = true;
      if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
        skipButton.textContent = 'Cancel Edit';
        skipButton.hidden = false;
        skipButton.disabled = false;
      }
      return;
    }

    const control = question.answerType === 'multiline' ? messageInput : shortAnswer;
    composerLabel.htmlFor = control.id;
    control.hidden = false;
    control.disabled = false;
    control.placeholder = question.answerType === 'multiline' ? 'Write your answer...' : 'Your answer';
    if (question.maxLength) control.maxLength = question.maxLength;
    if (question.autocomplete) control.autocomplete = question.autocomplete;
    if (question.inputMode) control.inputMode = question.inputMode;
    if (control === shortAnswer) {
      shortAnswer.type = question.answerType === 'email'
        ? 'email'
        : question.answerType === 'phone' ? 'tel' : 'text';
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      control.value = signalDeskSession[question.targetGroup]?.[question.targetKey] || '';
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      skipButton.textContent = 'Cancel Edit';
      skipButton.hidden = false;
      skipButton.disabled = false;
    } else {
      skipButton.hidden = !question.allowSkip;
      skipButton.disabled = !question.allowSkip;
    }
    updateSignalDeskSendState();
  }

  function configureSignalDeskComposer() {
    composer.hidden = currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW;
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.INTAKE) {
      configureSignalDeskComposerForQuestion(getCurrentSignalDeskQuestion());
      return;
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT) {
      configureSignalDeskEditSelection();
      return;
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      configureSignalDeskComposerForQuestion(getCurrentSignalDeskQuestion());
      return;
    }
    resetSignalDeskComposerControls();
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW) {
      composerLabel.textContent = 'Review your strategic context';
      setSignalDeskComposerStatus('');
      return;
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING) {
      composerLabel.textContent = 'Securing your context';
      setSignalDeskComposerStatus('');
      return;
    }
    if (
      currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.LIVE
      && signalDeskSession.presentation.isRestoringSession
    ) {
      composerLabel.textContent = 'Restoring your Signal Desk line';
      setSignalDeskComposerStatus('Restoring your conversation securely...');
      return;
    }
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR) {
      const lastError = signalDeskSession.conversation.lastError;
      const recoveryAction = lastError?.recoveryAction;
      const retryable = lastError?.retryable !== false;
      const hasRecoveryAction = ['retry-restore', 'start-new-line'].includes(
        recoveryAction
      );
      composerLabel.textContent = recoveryAction === 'start-new-line'
        ? 'Your previous line could not be restored'
        : recoveryAction === 'retry-restore'
          ? 'Restore your Signal Desk line'
          : retryable
            ? 'Retry opening your Signal Desk line'
            : 'Signal Desk connection needs attention';
      bootstrapRetry.textContent = recoveryAction === 'start-new-line'
        ? 'Start a New Line'
        : recoveryAction === 'retry-restore'
          ? 'Retry Restore'
          : 'Retry';
      bootstrapRetry.hidden = !(retryable || hasRecoveryAction);
      bootstrapRetry.disabled = !(retryable || hasRecoveryAction);
      setSignalDeskComposerStatus(
        lastError?.userMessage || "We couldn't open the line. Please try again.",
        { alert: true }
      );
      if (retryable || hasRecoveryAction) queueSignalDeskFocus(bootstrapRetry);
      return;
    }
    composerLabel.textContent = 'Write a message';
    composerLabel.htmlFor = messageInput.id;
    sendButton.setAttribute('aria-label', 'Send message');
    messageInput.hidden = false;
    messageInput.disabled = false;
    messageInput.maxLength = 2000;
    messageInput.placeholder = 'Write a message...';
    sendButton.hidden = false;
    setSignalDeskComposerStatus('');
    autoResizeSignalDeskComposer();
    updateSignalDeskSendState();
  }

  function handleSignalDeskIntakeAnswerSubmission(rawAnswer) {
    const question = getCurrentSignalDeskQuestion();
    if (!question || signalDeskSession.guidedIntake.status !== 'active') return;
    const result = intakeDomain.applyAnswer(signalDeskSession, question, rawAnswer);
    if (!result.valid) {
      getActiveComposerControl()?.setAttribute('aria-invalid', 'true');
      setSignalDeskComposerStatus(result.error);
      return;
    }

    const guidedIntake = signalDeskSession.guidedIntake;
    const displayAnswer = intakeDomain.getDisplayAnswer(question, result.value);
    signalDeskSession.conversation.messages.push(createSignalDeskMessage('visitor', displayAnswer, {
      isLocalOnly: true,
      messageKind: 'intake-answer',
      questionId: question.id,
    }));
    const answerMessage = signalDeskSession.conversation.messages.at(-1);
    if (!guidedIntake.completedQuestionIds.includes(question.id)) {
      guidedIntake.completedQuestionIds.push(question.id);
    }
    renderSignalDeskMessages({
      smooth: true,
      forceScroll: true,
      animateMessages: [answerMessage],
    });
    resetSignalDeskComposerControls();
    signalDeskHydratedDraft = null;
    saveSignalDeskPersistence();
    composerLabel.textContent = 'Preparing the next question';
    sequenceSignalDeskIntakeAdvance(question);
  }

  function advanceSignalDeskIntake({ animate = true } = {}) {
    signalDeskSession.guidedIntake.currentQuestionIndex += 1;
    saveSignalDeskPersistence();
    const nextQuestion = getCurrentSignalDeskQuestion();
    if (!nextQuestion) {
      completeSignalDeskGuidedIntake();
      return;
    }
    appendSignalDeskIntakeQuestion(nextQuestion, { animate });
    configureSignalDeskComposerForQuestion(nextQuestion);
    queueSignalDeskFocus(getActiveComposerControl);
  }

  function getSignalDeskTransitionDelay(normalDelay, { skipForReducedMotion = false } = {}) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) return normalDelay;
    return skipForReducedMotion ? 0 : SIGNAL_DESK_TYPING_DELAYS.reducedMotion;
  }

  function waitForSignalDeskTransition(delay, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        const abortError = new Error('Signal Desk transition cancelled.');
        abortError.name = 'AbortError';
        reject(abortError);
        return;
      }
      const handleAbort = () => {
        window.clearTimeout(timer);
        const abortError = new Error('Signal Desk transition cancelled.');
        abortError.name = 'AbortError';
        reject(abortError);
      };
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', handleAbort);
        resolve();
      }, delay);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function cancelSignalDeskIntakeTransition({ advance = false } = {}) {
    const controller = signalDeskIntakeTransitionController;
    if (!controller) return;
    const continuation = signalDeskIntakeTransitionContinuation;
    signalDeskIntakeTransitionController = null;
    signalDeskIntakeTransitionContinuation = null;
    controller.abort();
    hideSignalDeskTypingIndicator({ immediate: true });
    if (advance && signalDeskSession.guidedIntake.status === 'active') {
      continuation?.({ animate: false });
    }
  }

  async function presentInitialSignalDeskIntakeQuestion(question) {
    cancelSignalDeskIntakeTransition();
    const controller = new AbortController();
    const presentQuestion = ({ animate = true } = {}) => {
      if (getCurrentSignalDeskQuestion()?.id !== question.id) return;
      appendSignalDeskIntakeQuestion(question, { animate });
      configureSignalDeskComposerForQuestion(question);
      queueSignalDeskFocus(getActiveComposerControl);
    };
    signalDeskIntakeTransitionController = controller;
    signalDeskIntakeTransitionContinuation = presentQuestion;
    showSignalDeskTypingIndicator('MarkStreet is preparing the first question');
    try {
      await waitForSignalDeskTransition(
        getSignalDeskTransitionDelay(SIGNAL_DESK_TYPING_DELAYS.firstQuestion),
        controller.signal
      );
      if (signalDeskIntakeTransitionController !== controller) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      hideSignalDeskTypingIndicator({ immediate: reducedMotion });
      if (!reducedMotion) await waitForSignalDeskTransition(180, controller.signal);
      if (signalDeskIntakeTransitionController !== controller) return;
      signalDeskIntakeTransitionController = null;
      signalDeskIntakeTransitionContinuation = null;
      presentQuestion();
    } catch (error) {
      if (error?.name !== 'AbortError') throw error;
    }
  }

  async function sequenceSignalDeskIntakeAdvance(question) {
    cancelSignalDeskIntakeTransition();
    const controller = new AbortController();
    const presentQuestion = ({ animate = true } = {}) => {
      if (getCurrentSignalDeskQuestion()?.id === question.id) {
        advanceSignalDeskIntake({ animate });
      }
    };
    signalDeskIntakeTransitionController = controller;
    signalDeskIntakeTransitionContinuation = presentQuestion;
    try {
      await waitForSignalDeskTransition(
        getSignalDeskTransitionDelay(
          SIGNAL_DESK_TYPING_DELAYS.answerPause,
          { skipForReducedMotion: true }
        ),
        controller.signal
      );
      if (signalDeskIntakeTransitionController !== controller) return;
      showSignalDeskTypingIndicator('MarkStreet is preparing the next question');
      await waitForSignalDeskTransition(
        getSignalDeskTransitionDelay(SIGNAL_DESK_TYPING_DELAYS.nextQuestion),
        controller.signal
      );
      if (signalDeskIntakeTransitionController !== controller) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      hideSignalDeskTypingIndicator({ immediate: reducedMotion });
      if (!reducedMotion) await waitForSignalDeskTransition(180, controller.signal);
      if (signalDeskIntakeTransitionController !== controller) return;
      signalDeskIntakeTransitionController = null;
      signalDeskIntakeTransitionContinuation = null;
      presentQuestion();
    } catch (error) {
      if (error?.name !== 'AbortError') throw error;
    }
  }

  function createSignalDeskBriefSummaryMessage() {
    return {
      id: SIGNAL_DESK_BRIEF_MESSAGE_ID,
      serverId: null,
      clientId: SIGNAL_DESK_BRIEF_MESSAGE_ID,
      conversationId: null,
      senderRole: 'system',
      senderName: null,
      body: '',
      createdAt: new Date().toISOString(),
      displayTime: '',
      deliveryStatus: null,
      errorCode: null,
      file: null,
      isLocalOnly: true,
      messageKind: 'brief-summary',
      questionId: null,
    };
  }

  function ensureSignalDeskBriefSummaryMessage({ animate = true } = {}) {
    const conversation = signalDeskSession.conversation;
    let message = conversation.messages.find(
      (candidate) => candidate.messageKind === 'brief-summary'
        || candidate.id === SIGNAL_DESK_BRIEF_MESSAGE_ID
    );
    const isNew = !message;
    if (!message) {
      message = createSignalDeskBriefSummaryMessage();
      conversation.messages.push(message);
    }
    renderSignalDeskMessages({
      smooth: animate,
      forceScroll: true,
      animateMessages: isNew && animate ? [message] : [],
    });
    return { message, isNew };
  }

  function createSignalDeskBootstrapSignalMessage() {
    return {
      id: SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID,
      serverId: null,
      clientId: SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID,
      conversationId: null,
      senderRole: 'system',
      senderName: null,
      body: '',
      createdAt: new Date().toISOString(),
      displayTime: '',
      deliveryStatus: null,
      errorCode: null,
      file: null,
      isLocalOnly: true,
      messageKind: 'bootstrap-context-signal',
      questionId: null,
    };
  }

  function resolveSignalDeskBootstrapProgress(session) {
    const progress = session.bootstrapProgress;
    const conversation = session.conversation;
    const presentation = session.presentation;
    const completedSteps = new Set();

    if (progress.contextValidated) completedSteps.add('context-secured');
    if (conversation.conversationId && conversation.visitorToken) {
      completedSteps.add('private-channel-created');
    }
    if (conversation.intakeMessageSent === true) completedSteps.add('brief-transmitted');
    if (
      presentation.realtimeStatus === 'connected'
      && presentation.runtimeReady === true
    ) {
      completedSteps.add('private-line-open');
    }

    const definitions = [
      ['context-secured', 'Context secured'],
      ['private-channel-created', 'Private channel created'],
      ['brief-transmitted', 'Brief transmitted'],
      ['private-line-open', 'Private line open'],
    ];
    const allComplete = definitions.every(([id]) => completedSteps.has(id));
    let activeStepAssigned = false;
    const steps = definitions.map(([id, label]) => {
      let state = 'pending';
      if (completedSteps.has(id)) {
        state = 'complete';
      } else if (progress.errorStep === id) {
        state = 'error';
      } else if (!progress.errorStep && !activeStepAssigned) {
        state = 'active';
        activeStepAssigned = true;
      }
      return { id, label, state };
    });

    return {
      steps,
      overallState: progress.collapsed && allComplete
        ? 'collapsed'
        : allComplete
          ? 'complete'
          : progress.errorStep
            ? 'error'
            : 'active',
    };
  }

  function clearSignalDeskBootstrapCollapse() {
    if (signalDeskBootstrapCollapseTimer === null) return;
    window.clearTimeout(signalDeskBootstrapCollapseTimer);
    signalDeskBootstrapCollapseTimer = null;
  }

  function renderSignalDeskBootstrapProgress({
    smooth = true,
    forceScroll = true,
    animateMessages = [],
  } = {}) {
    const hasSignal = signalDeskSession.conversation.messages.some(
      (message) => message.messageKind === 'bootstrap-context-signal'
    );
    if (!hasSignal) return;

    const progress = resolveSignalDeskBootstrapProgress(signalDeskSession);
    if (progress.overallState !== 'complete') {
      clearSignalDeskBootstrapCollapse();
    } else if (signalDeskBootstrapCollapseTimer === null) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      signalDeskBootstrapCollapseTimer = window.setTimeout(() => {
        signalDeskBootstrapCollapseTimer = null;
        const latestProgress = resolveSignalDeskBootstrapProgress(signalDeskSession);
        if (latestProgress.overallState !== 'complete') return;
        signalDeskSession.bootstrapProgress.collapsed = true;
        renderSignalDeskMessages({ scrollIfNearBottom: true });
      }, reducedMotion ? 0 : SIGNAL_DESK_BOOTSTRAP_COLLAPSE_HOLD_MS);
    }
    renderSignalDeskMessages({ smooth, forceScroll, animateMessages });
  }

  function ensureSignalDeskBootstrapSignalMessage({ animate = true } = {}) {
    const conversation = signalDeskSession.conversation;
    let message = conversation.messages.find(
      (candidate) => candidate.messageKind === 'bootstrap-context-signal'
        || candidate.id === SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID
    );
    const isNew = !message;
    if (!message) {
      message = createSignalDeskBootstrapSignalMessage();
      conversation.messages.push(message);
    }
    renderSignalDeskBootstrapProgress({
      smooth: animate,
      forceScroll: true,
      animateMessages: isNew && animate ? [message] : [],
    });
    return { message, isNew };
  }

  function removeSignalDeskBootstrapSignalMessage() {
    clearSignalDeskBootstrapCollapse();
    signalDeskSession.conversation.messages = signalDeskSession.conversation.messages.filter(
      (message) => message.messageKind !== 'bootstrap-context-signal'
        && message.id !== SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID
    );
  }

  function setSignalDeskBootstrapErrorStep(stepId) {
    signalDeskSession.bootstrapProgress.errorStep = stepId;
    signalDeskSession.bootstrapProgress.collapsed = false;
    renderSignalDeskBootstrapProgress();
  }

  function queueSignalDeskBriefConfirmationFocus() {
    if (signalDeskBriefFocusTimer !== null) {
      window.clearTimeout(signalDeskBriefFocusTimer);
    }
    const initialFocus = document.activeElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    signalDeskBriefFocusTimer = window.setTimeout(() => {
      signalDeskBriefFocusTimer = null;
      if (
        currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
        || !layer.classList.contains('is-open')
      ) return;
      const activeFocus = document.activeElement;
      if (
        activeFocus !== initialFocus
        && activeFocus !== body
        && activeFocus !== document.documentElement
      ) return;
      messageList.querySelector('[data-signal-desk-confirm-brief]')?.focus({
        preventScroll: true,
      });
    }, reducedMotion ? 0 : 560);
  }

  function classifySignalDeskBootstrapError(error) {
    const status = Number.isInteger(error?.status) ? error.status : null;
    const hasFieldErrors = Boolean(
      error?.fieldErrors
      && typeof error.fieldErrors === 'object'
      && Object.keys(error.fieldErrors).length
    );
    if (status === 422 || (status === 400 && hasFieldErrors) || error?.code === 'INVALID_ARGUMENT') {
      return 'validation';
    }
    if (status === 401 || status === 403) return 'authentication';
    if (status === 429) return 'rate-limit';
    if (
      error?.code === 'NETWORK_ERROR'
      || error?.code === 'REQUEST_TIMEOUT'
      || error?.name === 'TypeError'
    ) return 'network';
    if (status >= 500 && status <= 599) return 'server';
    return 'unknown';
  }

  function getSafeSignalDeskFieldErrors(error) {
    if (!error?.fieldErrors || typeof error.fieldErrors !== 'object') return {};
    return Object.keys(error.fieldErrors).reduce((safeErrors, field) => {
      if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(field)) safeErrors[field] = true;
      return safeErrors;
    }, {});
  }

  function getSignalDeskCorrectionQuestionIds(error, stage) {
    return Object.keys(getSafeSignalDeskFieldErrors(error)).reduce((questionIds, field) => {
      const mappedQuestions = field === 'body' && stage === 'intake-message'
        ? ['request', 'business-summary']
        : SIGNAL_DESK_VALIDATION_FIELD_MAP[field] || [];
      mappedQuestions.forEach((questionId) => {
        if (!questionIds.includes(questionId)) questionIds.push(questionId);
      });
      return questionIds;
    }, []);
  }

  function removeSignalDeskConnectionMessage() {
    signalDeskSession.conversation.messages = signalDeskSession.conversation.messages.filter(
      (message) => message.messageKind !== 'connection-status'
    );
  }

  function recoverSignalDeskValidationError(error, stage, explicitQuestionIds = null) {
    const questionIds = explicitQuestionIds || getSignalDeskCorrectionQuestionIds(error, stage);
    if (questionIds.length === 0) return false;
    const guidedIntake = signalDeskSession.guidedIntake;
    const conversation = signalDeskSession.conversation;
    guidedIntake.review.confirmationRequestedAt = null;
    guidedIntake.review.confirmedAt = null;
    guidedIntake.review.correctionQuestionIds = [...questionIds];
    guidedIntake.status = 'review';
    conversation.lastError = {
      code: typeof error?.code === 'string' ? error.code : 'VALIDATION_ERROR',
      status: Number.isInteger(error?.status) ? error.status : null,
      classification: 'validation',
      stage,
      fieldErrors: getSafeSignalDeskFieldErrors(error),
      userMessage: questionIds.length === 1 && questionIds[0] === 'email'
        ? 'Please check your work email.'
        : 'Some information needs to be corrected before we can open your private line.',
    };
    signalDeskSession.bootstrapProgress.contextValidated = false;
    signalDeskSession.bootstrapProgress.collapsed = false;
    signalDeskSession.bootstrapProgress.errorStep = 'context-secured';
    removeSignalDeskBootstrapSignalMessage();
    removeSignalDeskConnectionMessage();
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.REVIEW);
    renderSignalDeskMessages();
    queueSignalDeskFocus(() => messageList.querySelector('[data-signal-desk-edit-answers]'));
    return true;
  }

  function canEditSignalDeskBrief() {
    return (
      currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
      && !signalDeskSession.conversation.intakeMessageSent
      && !signalDeskSession.conversation.isBootstrapping
    );
  }

  function appendSignalDeskEditMessage(senderRole, bodyText, messageKind, questionId = null) {
    const message = createSignalDeskMessage(senderRole, bodyText, {
      isLocalOnly: true,
      messageKind,
      questionId,
    });
    signalDeskSession.conversation.messages.push(message);
    renderSignalDeskMessages({
      smooth: true,
      forceScroll: true,
      animateMessages: [message],
    });
    return message;
  }

  function getSignalDeskEditTargetForQuestion(questionId) {
    if (SIGNAL_DESK_CONTACT_EDIT_OPTIONS.some((option) => option.questionId === questionId)) {
      return 'contact-details';
    }
    return SIGNAL_DESK_EDIT_OPTIONS.find((option) => option.questionId === questionId)?.id || null;
  }

  function getSignalDeskEditLabel(questionId) {
    return [...SIGNAL_DESK_EDIT_OPTIONS, ...SIGNAL_DESK_CONTACT_EDIT_OPTIONS].find(
      (option) => option.questionId === questionId
    )?.label || 'Answer';
  }

  function getSignalDeskEditCompletionMessage(questionId) {
    const messages = {
      industry: 'Your industry has been updated.',
      request: 'Your primary challenge has been updated.',
      'business-summary': 'Your business summary has been updated.',
      'first-name': 'Your first name has been updated.',
      'last-name': 'Your last name has been updated.',
      email: 'Your work email has been updated.',
      phone: 'Your phone number has been updated.',
    };
    return messages[questionId] || 'Your answer has been updated.';
  }

  function clearSignalDeskEditState() {
    const edit = signalDeskSession.guidedIntake.edit;
    edit.active = false;
    edit.target = null;
    edit.startedAt = null;
    edit.previousValue = null;
    signalDeskEditQuestionId = null;
  }

  function configureSignalDeskEditSelection() {
    resetSignalDeskComposerControls();
    setSignalDeskComposerStatus('');
    const edit = signalDeskSession.guidedIntake.edit;
    const contactSelection = edit.target === 'contact-details';
    const options = contactSelection
      ? SIGNAL_DESK_CONTACT_EDIT_OPTIONS
      : SIGNAL_DESK_EDIT_OPTIONS;
    composerLabel.removeAttribute('for');
    composerLabel.textContent = contactSelection
      ? 'Which contact detail would you like to update?'
      : 'What would you like to update?';
    choices.hidden = false;
    choices.setAttribute('aria-label', composerLabel.textContent);
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'signal-desk-composer__choice signal-desk-composer__choice--edit';
      button.dataset.signalDeskEditChoice = option.id;
      button.textContent = option.label;
      choices.append(button);
    });
    const navigation = contactSelection
      ? [
        { id: 'back', label: 'Back' },
        { id: 'cancel', label: 'Cancel' },
      ]
      : [{ id: 'cancel', label: 'Cancel' }];
    navigation.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'signal-desk-composer__choice signal-desk-composer__choice--quiet';
      button.dataset.signalDeskEditChoice = option.id;
      button.textContent = option.label;
      choices.append(button);
    });
    sendButton.hidden = true;
  }

  function beginSignalDeskEditAnswer(questionId, { announceSelection = true } = {}) {
    const question = intakeDomain.getQuestion(questionId);
    const edit = signalDeskSession.guidedIntake.edit;
    if (!edit.active || !question) return;
    if (announceSelection) {
      appendSignalDeskEditMessage(
        'visitor',
        getSignalDeskEditLabel(questionId),
        'edit-selection',
        questionId
      );
    }
    edit.target = getSignalDeskEditTargetForQuestion(questionId);
    edit.previousValue = signalDeskSession[question.targetGroup]?.[question.targetKey] ?? '';
    signalDeskEditQuestionId = questionId;
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER);
    const questionBody = question.support
      ? `${question.prompt}\n\n${question.support}`
      : question.prompt;
    appendSignalDeskEditMessage('agent', questionBody, 'edit-prompt', questionId);
    queueSignalDeskFocus(getActiveComposerControl);
  }

  function beginSignalDeskBriefEdit() {
    const guidedIntake = signalDeskSession.guidedIntake;
    if (!canEditSignalDeskBrief()) return;
    const mappedQuestionIds = guidedIntake.review.correctionQuestionIds.filter(
      (questionId) => intakeDomain.getQuestion(questionId)
    );
    guidedIntake.edit.active = true;
    guidedIntake.edit.target = null;
    guidedIntake.edit.startedAt = new Date().toISOString();
    guidedIntake.edit.previousValue = null;
    signalDeskEditQuestionId = null;
    if (mappedQuestionIds.length === 1) {
      beginSignalDeskEditAnswer(mappedQuestionIds[0], { announceSelection: false });
      return;
    }
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT);
    appendSignalDeskEditMessage(
      'agent',
      'What would you like to update?',
      'edit-prompt'
    );
    renderSignalDeskMessages();
    queueSignalDeskFocus(getActiveComposerControl);
  }

  function cancelSignalDeskBriefEdit() {
    if (!signalDeskSession.guidedIntake.edit.active) return;
    clearSignalDeskEditState();
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.REVIEW);
    renderSignalDeskMessages();
    queueSignalDeskFocus(() => messageList.querySelector(
      '[data-signal-desk-edit-answers]:not([hidden]), [data-signal-desk-confirm-brief]:not([hidden])'
    ));
  }

  function handleSignalDeskEditChoice(choiceId) {
    const edit = signalDeskSession.guidedIntake.edit;
    if (
      currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.EDIT_SELECT
      || !edit.active
    ) return;
    if (choiceId === 'cancel') {
      cancelSignalDeskBriefEdit();
      return;
    }
    if (choiceId === 'back' && edit.target === 'contact-details') {
      edit.target = null;
      configureSignalDeskEditSelection();
      queueSignalDeskFocus(getActiveComposerControl);
      return;
    }
    if (edit.target === 'contact-details') {
      const option = SIGNAL_DESK_CONTACT_EDIT_OPTIONS.find(
        (candidate) => candidate.id === choiceId
      );
      if (option) beginSignalDeskEditAnswer(option.questionId);
      return;
    }
    const option = SIGNAL_DESK_EDIT_OPTIONS.find((candidate) => candidate.id === choiceId);
    if (!option) return;
    if (option.id === 'contact-details') {
      appendSignalDeskEditMessage('visitor', option.label, 'edit-selection');
      edit.target = option.id;
      appendSignalDeskEditMessage(
        'agent',
        'Which contact detail would you like to update?',
        'edit-prompt'
      );
      configureSignalDeskEditSelection();
      queueSignalDeskFocus(getActiveComposerControl);
      return;
    }
    beginSignalDeskEditAnswer(option.questionId);
  }

  function startSignalDeskBriefUpdatedPresentation() {
    signalDeskBriefJustUpdated = true;
    if (signalDeskBriefUpdatedTimer !== null) {
      window.clearTimeout(signalDeskBriefUpdatedTimer);
    }
    renderSignalDeskMessages();
    const article = messageList.querySelector('[data-signal-desk-brief]');
    const clearUpdate = (event) => {
      if (event && event.animationName !== 'signal-desk-brief-updated') return;
      article?.removeEventListener('animationend', clearUpdate);
      if (!signalDeskBriefJustUpdated) return;
      signalDeskBriefJustUpdated = false;
      article?.classList.remove('signal-desk-brief--just-updated');
      renderSignalDeskMessages();
    };
    article?.classList.add('signal-desk-brief--just-updated');
    article?.addEventListener('animationend', clearUpdate);
    signalDeskBriefUpdatedTimer = window.setTimeout(() => {
      signalDeskBriefUpdatedTimer = null;
      clearUpdate();
    }, 780);
  }

  function handleSignalDeskEditAnswerSubmission(rawAnswer) {
    const edit = signalDeskSession.guidedIntake.edit;
    const question = intakeDomain.getQuestion(signalDeskEditQuestionId);
    if (
      currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER
      || !edit.active
      || !question
    ) return;
    const validation = intakeDomain.validateAnswer(question, rawAnswer);
    if (!validation.valid) {
      getActiveComposerControl()?.setAttribute('aria-invalid', 'true');
      setSignalDeskComposerStatus(validation.error);
      return;
    }
    const result = intakeDomain.applyAnswer(signalDeskSession, question, validation.value);
    if (!result.valid) return;
    const answerMessage = appendSignalDeskEditMessage(
      'visitor',
      intakeDomain.getDisplayAnswer(question, result.value),
      'edit-answer',
      question.id
    );
    const resolvedQuestionId = question.id;
    const guidedIntake = signalDeskSession.guidedIntake;
    guidedIntake.review.confirmationRequestedAt = null;
    guidedIntake.review.confirmedAt = null;
    guidedIntake.review.correctionQuestionIds = guidedIntake.review.correctionQuestionIds.filter(
      (questionId) => questionId !== resolvedQuestionId
    );
    if (guidedIntake.review.correctionQuestionIds.length === 0) {
      signalDeskSession.conversation.lastError = null;
    }
    clearSignalDeskEditState();
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.REVIEW);
    appendSignalDeskEditMessage(
      'agent',
      getSignalDeskEditCompletionMessage(resolvedQuestionId),
      'edit-status',
      resolvedQuestionId
    );
    startSignalDeskBriefUpdatedPresentation();
    renderSignalDeskMessages({ animateMessages: [answerMessage] });
    queueSignalDeskFocus(() => messageList.querySelector(
      '[data-signal-desk-edit-answers]:not([hidden]), [data-signal-desk-confirm-brief]:not([hidden])'
    ));
  }

  function completeSignalDeskGuidedIntake() {
    const guidedIntake = signalDeskSession.guidedIntake;
    if (!intakeDomain.validateSession(signalDeskSession).valid) return;
    guidedIntake.status = 'review';
    guidedIntake.completedAt = new Date().toISOString();
    guidedIntake.review.presentedAt ||= new Date().toISOString();
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.REVIEW);
    ensureSignalDeskBriefSummaryMessage();
    queueSignalDeskBriefConfirmationFocus();
  }

  function confirmSignalDeskBrief() {
    const guidedIntake = signalDeskSession.guidedIntake;
    const conversation = signalDeskSession.conversation;
    if (
      currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
      || conversation.isBootstrapping
      || guidedIntake.review.confirmedAt
    ) return;

    const sessionValidation = intakeDomain.validateSession(signalDeskSession);
    if (!sessionValidation.valid) {
      const fieldErrors = sessionValidation.invalidQuestionIds.reduce((errors, questionId) => {
        const question = intakeDomain.getQuestion(questionId);
        if (question) errors[question.targetKey] = [{ code: 'invalid', message: 'Invalid value.' }];
        return errors;
      }, {});
      recoverSignalDeskValidationError(
        { code: 'INVALID_ARGUMENT', fieldErrors },
        'start',
        sessionValidation.invalidQuestionIds
      );
      return;
    }

    guidedIntake.review.confirmationRequestedAt = new Date().toISOString();
    guidedIntake.review.confirmedAt = null;
    guidedIntake.review.correctionQuestionIds = [];
    conversation.lastError = null;
    guidedIntake.status = 'submitting';
    signalDeskSession.bootstrapProgress.contextValidated = true;
    signalDeskSession.bootstrapProgress.collapsed = false;
    signalDeskSession.bootstrapProgress.errorStep = null;
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING);
    ensureSignalDeskBootstrapSignalMessage();
    queueSignalDeskFocus(() => messageList.querySelector('.signal-desk-bootstrap-signal'));
    bootstrapSignalDeskConversation();
  }

  async function bootstrapSignalDeskConversation() {
    const conversation = signalDeskSession.conversation;
    if (conversation.isBootstrapping) return;
    if (
      conversation.hasExistingLine
      && conversation.conversationId
      && !conversation.visitorToken
    ) {
      const runtimeCredentials = persistence?.loadRuntimeCredentials(
        conversation.conversationId
      );
      if (runtimeCredentials) {
        restoreSignalDeskConversationFromSession(runtimeCredentials);
        return;
      }
    }

    const sessionValidation = intakeDomain.validateSession(signalDeskSession);
    if (!sessionValidation.valid) {
      const fieldErrors = sessionValidation.invalidQuestionIds.reduce((errors, questionId) => {
        const question = intakeDomain.getQuestion(questionId);
        if (question) errors[question.targetKey] = [{ code: 'invalid', message: 'Invalid value.' }];
        return errors;
      }, {});
      recoverSignalDeskValidationError(
        { code: 'INVALID_ARGUMENT', fieldErrors },
        'start',
        sessionValidation.invalidQuestionIds
      );
      return;
    }

    let bootstrapStage = conversation.conversationId ? 'intake-message' : 'start';
    signalDeskSession.bootstrapProgress.contextValidated = true;
    signalDeskSession.bootstrapProgress.collapsed = false;
    signalDeskSession.bootstrapProgress.errorStep = null;
    conversation.isBootstrapping = true;
    signalDeskSession.guidedIntake.status = 'submitting';
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING);
    ensureSignalDeskBootstrapSignalMessage({ animate: false });

    try {
      const crmApi = window.MarkStreetCRMChatAPI;
      if (!crmApi) {
        const unavailableError = new Error('CRM chat client is unavailable.');
        unavailableError.code = 'CRM_CLIENT_UNAVAILABLE';
        unavailableError.userMessage = "We couldn't open the line. Please try again.";
        throw unavailableError;
      }
      if (!conversation.conversationId) {
        const normalizedIdentity = intakeDomain.normalizeSignalDeskIdentity(
          signalDeskSession.identity
        );
        const crmSession = await crmApi.startConversation({
          firstName: normalizedIdentity.firstName,
          lastName: normalizedIdentity.lastName,
          email: normalizedIdentity.email,
          phone: normalizedIdentity.phone,
          pageUrl: window.location.href,
          deviceType: crmApi.getDeviceType(),
        });
        conversation.conversationId = crmSession.conversationId;
        conversation.visitorToken = crmSession.visitorToken;
        conversation.widgetId = crmSession.widgetId;
        conversation.hasExistingLine = true;
        persistSignalDeskRuntimeCredentials();
        saveSignalDeskPersistence();
        renderSignalDeskBootstrapProgress();
      }
      signalDeskSession.guidedIntake.review.confirmedAt ||= new Date().toISOString();
      bootstrapStage = 'intake-message';
      renderSignalDeskBootstrapProgress();
      if (!conversation.intakeMessageSent) {
        const intakeMessage = await crmApi.sendMessage({
          visitorToken: conversation.visitorToken,
          conversationId: conversation.conversationId,
          body: intakeDomain.buildStructuredMessage(signalDeskSession),
        });
        conversation.intakeMessageServerId = intakeMessage?.id ? String(intakeMessage.id) : null;
        conversation.intakeMessageSent = true;
        renderSignalDeskBootstrapProgress();
      }

      signalDeskSession.guidedIntake.status = 'complete';
      conversation.lastError = null;
      conversation.liveWelcomeInitialized = true;
      setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.LIVE);
      renderSignalDeskBootstrapProgress();
      await syncSignalDeskMessageHistory();
      updateSignalDeskCurrentPage();
      connectSignalDeskRealtime();
      queueSignalDeskFocus(messageInput);
      document.dispatchEvent(new CustomEvent('signal-desk:conversation'));
    } catch (error) {
      const classification = classifySignalDeskBootstrapError(error);
      const safeFieldErrors = getSafeSignalDeskFieldErrors(error);
      const identity = intakeDomain.normalizeSignalDeskIdentity(signalDeskSession.identity);
      console.error('[Signal Desk] Conversation bootstrap failed', {
        status: Number.isInteger(error?.status) ? error.status : null,
        endpoint: typeof error?.endpoint === 'string' ? error.endpoint : null,
        code: typeof error?.code === 'string' ? error.code : 'UNKNOWN_ERROR',
        classification,
        invalidFields: Object.keys(safeFieldErrors),
        hasFirstName: Boolean(identity.firstName),
        hasLastName: Boolean(identity.lastName),
        hasEmail: Boolean(identity.email),
        hasPhone: Boolean(identity.phone),
        firstNameLength: identity.firstName.length,
        lastNameLength: identity.lastName.length,
        emailLength: identity.email.length,
        phoneLength: identity.phone.length,
      });
      if (
        classification === 'validation'
        && recoverSignalDeskValidationError(error, bootstrapStage)
      ) return;
      const userMessage = typeof error?.userMessage === 'string' && error.userMessage.trim()
        ? error.userMessage.trim().slice(0, 240)
        : "We couldn't open the line. Please try again.";
      const retryable = ['network', 'rate-limit', 'server', 'unknown'].includes(classification);
      conversation.lastError = {
        code: typeof error?.code === 'string' ? error.code : 'UNKNOWN_ERROR',
        status: Number.isInteger(error?.status) ? error.status : null,
        classification,
        stage: bootstrapStage,
        fieldErrors: safeFieldErrors,
        retryable,
        userMessage: classification === 'validation'
          ? 'The conversation service could not validate this request.'
          : userMessage,
      };
      setSignalDeskBootstrapErrorStep(
        bootstrapStage === 'intake-message'
          ? 'brief-transmitted'
          : 'private-channel-created'
      );
      signalDeskSession.guidedIntake.status = 'error';
      setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR);
      renderSignalDeskMessages();
    } finally {
      conversation.isBootstrapping = false;
      if (
        currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW
        && conversation.lastError?.classification === 'validation'
      ) {
        renderSignalDeskMessages();
      }
    }
  }

  bootstrapRetry.addEventListener('click', () => {
    const recoveryAction = signalDeskSession.conversation.lastError?.recoveryAction;
    if (recoveryAction === 'start-new-line') {
      resetSignalDeskForNewLine();
      return;
    }
    if (recoveryAction === 'retry-restore') {
      restoreSignalDeskConversationFromSession();
      return;
    }
    bootstrapSignalDeskConversation();
  });
  skipButton.addEventListener('click', () => {
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      cancelSignalDeskBriefEdit();
      return;
    }
    handleSignalDeskIntakeAnswerSubmission('');
  });
  choices.addEventListener('click', (event) => {
    const editChoice = event.target.closest('[data-signal-desk-edit-choice]');
    if (editChoice) {
      handleSignalDeskEditChoice(editChoice.dataset.signalDeskEditChoice);
      return;
    }
    const choice = event.target.closest('[data-signal-desk-intake-choice]');
    if (!choice) return;
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      handleSignalDeskEditAnswerSubmission(choice.dataset.signalDeskIntakeChoice);
      return;
    }
    handleSignalDeskIntakeAnswerSubmission(choice.dataset.signalDeskIntakeChoice);
  });

  const signalDeskTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  function getSignalDeskMessageTimestamp(message) {
    const createdAt = message?.createdAt;
    if (typeof createdAt !== 'string' || !createdAt.trim()) return null;
    if (/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.test(createdAt.trim())) return null;
    const timestamp = Date.parse(createdAt);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function formatSignalDeskTime(message) {
    if (typeof message?.displayTime === 'string' && message.displayTime.trim()) {
      return message.displayTime.trim().slice(0, 5);
    }
    const timestamp = getSignalDeskMessageTimestamp(message);
    return timestamp === null ? '' : signalDeskTimeFormatter.format(new Date(timestamp));
  }

  function getSignalDeskMessageKey(message) {
    if (message.messageKind === 'brief-summary') return SIGNAL_DESK_BRIEF_MESSAGE_ID;
    if (message.messageKind === 'bootstrap-context-signal') {
      return SIGNAL_DESK_BOOTSTRAP_SIGNAL_ID;
    }
    if (signalDeskMessageUiKeys.has(message)) return signalDeskMessageUiKeys.get(message);
    const key = message.serverId
      ? `server-${message.serverId}`
      : message.id
        ? `id-${message.id}`
        : message.clientId
          ? `client-${message.clientId}`
          : `local-${createSignalDeskClientId()}`;
    signalDeskMessageUiKeys.set(message, key);
    return key;
  }

  function createSignalDeskBriefSummaryElement() {
    const article = document.createElement('article');
    const header = document.createElement('header');
    const eyebrow = document.createElement('span');
    const status = document.createElement('span');
    const statusDot = document.createElement('i');
    const signal = document.createElement('div');
    const signalFill = document.createElement('span');
    const title = document.createElement('h3');
    const details = document.createElement('dl');
    const actionMessage = document.createElement('p');
    const actions = document.createElement('footer');
    const edit = document.createElement('button');
    const confirm = document.createElement('button');
    const confirmArrow = document.createElement('span');
    const confirmed = document.createElement('span');
    const confirmedDot = document.createElement('i');
    const announcement = document.createElement('span');

    article.className = 'signal-desk-brief';
    article.dataset.signalDeskBrief = '';
    article.setAttribute('aria-labelledby', 'signal-desk-brief-title');
    header.className = 'signal-desk-brief__header';
    eyebrow.className = 'signal-desk-brief__eyebrow';
    eyebrow.textContent = 'Your brief';
    status.className = 'signal-desk-brief__status';
    status.dataset.signalDeskBriefStatus = '';
    statusDot.setAttribute('aria-hidden', 'true');
    status.append(statusDot, document.createTextNode('Ready to review'));
    signal.className = 'signal-desk-brief__signal';
    signal.setAttribute('aria-hidden', 'true');
    signalFill.className = 'signal-desk-brief__signal-fill';
    signal.append(signalFill);
    title.className = 'signal-desk-brief__title';
    title.id = 'signal-desk-brief-title';
    title.textContent = 'Strategic Context';
    details.className = 'signal-desk-brief__details';
    actionMessage.className = 'signal-desk-brief__action-message';
    actionMessage.dataset.signalDeskBriefActionMessage = '';
    actionMessage.hidden = true;

    [
      ['industry', 'Industry'],
      ['request', 'Primary Challenge'],
      ['businessSummary', 'Business in One Line'],
    ].forEach(([fieldName, fieldLabel]) => {
      const field = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      field.className = 'signal-desk-brief__field';
      term.textContent = fieldLabel;
      description.dataset.signalDeskBriefField = fieldName;
      field.append(term, description);
      details.append(field);
    });

    actions.className = 'signal-desk-brief__actions';
    edit.type = 'button';
    edit.className = 'signal-desk-brief__edit';
    edit.dataset.signalDeskEditAnswers = '';
    edit.textContent = 'Edit Answers';
    edit.hidden = true;
    confirm.type = 'button';
    confirm.className = 'signal-desk-brief__confirm';
    confirm.dataset.signalDeskConfirmBrief = '';
    confirm.append(document.createTextNode('Confirm Brief'));
    confirmArrow.setAttribute('aria-hidden', 'true');
    confirmArrow.textContent = '↗';
    confirm.append(confirmArrow);
    confirmed.className = 'signal-desk-brief__confirmed';
    confirmed.setAttribute('role', 'status');
    confirmed.setAttribute('aria-live', 'polite');
    confirmed.hidden = true;
    confirmedDot.setAttribute('aria-hidden', 'true');
    confirmed.append(confirmedDot, document.createTextNode('Brief confirmed'));
    actions.append(edit, confirm, confirmed);

    announcement.className = 'signal-desk__sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = 'Your brief is ready to review.';
    header.append(eyebrow, status);
    article.append(header, signal, title, details, actionMessage, actions, announcement);
    return article;
  }

  function createSignalDeskBootstrapSignalElement(message) {
    const section = document.createElement('section');
    const header = document.createElement('header');
    const eyebrow = document.createElement('span');
    const stepsWrap = document.createElement('div');
    const steps = document.createElement('ol');
    const error = document.createElement('p');
    const summary = document.createElement('p');
    const summaryText = document.createElement('span');
    const announcement = document.createElement('span');

    section.className = 'signal-desk-bootstrap-signal';
    section.setAttribute('aria-labelledby', 'signal-desk-bootstrap-title');
    header.className = 'signal-desk-bootstrap-signal__header';
    eyebrow.className = 'signal-desk-bootstrap-signal__eyebrow';
    eyebrow.id = 'signal-desk-bootstrap-title';
    eyebrow.textContent = 'Securing your context';
    header.append(eyebrow);
    stepsWrap.className = 'signal-desk-bootstrap-signal__steps-wrap';
    steps.className = 'signal-desk-bootstrap-signal__steps';

    [
      ['context-secured', 'Context secured'],
      ['private-channel-created', 'Private channel created'],
      ['brief-transmitted', 'Brief transmitted'],
      ['private-line-open', 'Private line open'],
    ].forEach(([stepId, labelText]) => {
      const step = document.createElement('li');
      const indicator = document.createElement('span');
      const label = document.createElement('span');
      step.className = 'signal-desk-bootstrap-signal__step';
      step.dataset.stepId = stepId;
      step.dataset.stepState = 'pending';
      indicator.className = 'signal-desk-bootstrap-signal__indicator';
      indicator.setAttribute('aria-hidden', 'true');
      label.className = 'signal-desk-bootstrap-signal__label';
      label.textContent = labelText;
      step.append(indicator, label);
      steps.append(step);
    });

    error.className = 'signal-desk-bootstrap-signal__error';
    error.hidden = true;
    stepsWrap.append(steps, error);
    summary.className = 'signal-desk-bootstrap-signal__summary';
    summaryText.textContent = 'Your context has been securely shared.';
    summary.append(summaryText);
    summary.setAttribute('aria-hidden', 'true');
    announcement.className = 'signal-desk__sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    section.append(header, stepsWrap, summary, announcement);
    return section;
  }

  function createSignalDeskMessageElement(message) {
    if (message.messageKind === 'brief-summary') {
      return createSignalDeskBriefSummaryElement();
    }
    if (message.messageKind === 'bootstrap-context-signal') {
      return createSignalDeskBootstrapSignalElement(message);
    }
    const article = document.createElement('article');
    const meta = document.createElement('div');
    const sender = document.createElement('span');
    const time = document.createElement('time');
    const messageBody = document.createElement('div');
    const delivery = document.createElement('div');
    meta.className = 'signal-desk-message__meta';
    sender.className = 'signal-desk-message__sender';
    time.className = 'signal-desk-message__time';
    messageBody.className = 'signal-desk-message__body';
    delivery.className = 'signal-desk-message__delivery';
    delivery.setAttribute('aria-live', 'polite');
    meta.append(sender, time);
    article.append(meta, messageBody, delivery);
    return article;
  }

  function updateSignalDeskBriefSummaryElement(article, message) {
    const reviewModel = intakeDomain.buildBriefSummary(
      signalDeskSession.identity,
      signalDeskSession.intake
    );
    const confirmed = Boolean(signalDeskSession.guidedIntake.review.confirmedAt);
    const actionRequired = Boolean(
      signalDeskSession.conversation.lastError?.classification === 'validation'
      && signalDeskSession.guidedIntake.review.correctionQuestionIds.length
    );
    const editActive = signalDeskSession.guidedIntake.edit.active;
    const reviewPhase = currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.REVIEW;
    const editAllowed = reviewPhase
      && !signalDeskSession.conversation.intakeMessageSent
      && !signalDeskSession.conversation.isBootstrapping;
    const opening = currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING
      && !confirmed;
    const previousState = article.dataset.briefState;
    const nextState = actionRequired
      ? 'action-required'
      : opening ? 'opening' : confirmed ? 'confirmed' : 'ready';
    article.dataset.messageId = getSignalDeskMessageKey(message);
    article.dataset.messageKind = 'brief-summary';
    article.dataset.messageRole = 'system';
    article.dataset.messageGroupPosition = 'single';
    article.dataset.briefState = nextState;
    article.setAttribute(
      'aria-busy',
      String(currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.SUBMITTING)
    );
    article.querySelector('[data-signal-desk-brief-status]').lastChild.textContent =
      actionRequired
        ? 'Action required'
        : opening
          ? 'Opening line'
          : confirmed
            ? 'Brief confirmed'
            : signalDeskBriefJustUpdated ? 'Brief updated' : 'Ready to review';
    article.querySelector('[data-signal-desk-brief-field="industry"]').textContent =
      reviewModel.industry.label;
    article.querySelector('[data-signal-desk-brief-field="request"]').textContent =
      reviewModel.request;
    article.querySelector('[data-signal-desk-brief-field="businessSummary"]').textContent =
      reviewModel.businessSummary;

    const confirmButton = article.querySelector('[data-signal-desk-confirm-brief]');
    const editButton = article.querySelector('[data-signal-desk-edit-answers]');
    const confirmedStatus = article.querySelector('.signal-desk-brief__confirmed');
    const actionMessage = article.querySelector('[data-signal-desk-brief-action-message]');
    actionMessage.hidden = !actionRequired;
    actionMessage.textContent = actionRequired
      ? signalDeskSession.conversation.lastError.userMessage
      : '';
    editButton.textContent = actionRequired ? 'Fix Details' : 'Edit Answers';
    editButton.hidden = !editAllowed || editActive;
    editButton.disabled = !editAllowed || editActive;
    confirmButton.hidden = !reviewPhase || actionRequired || opening || confirmed || editActive;
    confirmButton.disabled = !reviewPhase || actionRequired || opening || confirmed || editActive;
    confirmedStatus.hidden = !confirmed || actionRequired;
    article.querySelector('.signal-desk__sr-only').textContent = actionRequired
      ? `${actionMessage.textContent} Edit your answers to continue.`
      : opening
        ? 'Opening your private line.'
        : confirmed
          ? 'Your brief is confirmed.'
          : signalDeskBriefJustUpdated
            ? 'Your brief has been updated and is ready to review.'
            : 'Your brief is ready to review.';

    if ((previousState === 'ready' || previousState === 'opening') && confirmed) {
      const clearConfirmation = (event) => {
        if (event && event.animationName !== 'signal-desk-brief-confirmed') return;
        article.removeEventListener('animationend', clearConfirmation);
        article.classList.remove('signal-desk-brief--just-confirmed');
      };
      article.classList.add('signal-desk-brief--just-confirmed');
      article.addEventListener('animationend', clearConfirmation);
      window.setTimeout(clearConfirmation, 800);
    }
  }

  function updateSignalDeskBootstrapSignalElement(section, message) {
    const progress = resolveSignalDeskBootstrapProgress(signalDeskSession);
    const previousStates = new Map(
      (section.dataset.stepSignature || '').split(',').filter(Boolean).map((entry) => {
        const [id, state] = entry.split(':');
        return [id, state];
      })
    );
    const errorMessages = {
      'context-secured': 'Review the highlighted brief details.',
      'private-channel-created': 'The private channel could not be created.',
      'brief-transmitted': 'The brief could not be transmitted.',
      'private-line-open': 'The private line could not be opened.',
    };
    const collapsed = progress.overallState === 'collapsed';
    const stepsWrap = section.querySelector('.signal-desk-bootstrap-signal__steps-wrap');
    const summary = section.querySelector('.signal-desk-bootstrap-signal__summary');
    const error = section.querySelector('.signal-desk-bootstrap-signal__error');
    const announcement = section.querySelector('.signal-desk__sr-only');
    const eyebrow = section.querySelector('.signal-desk-bootstrap-signal__eyebrow');

    section.dataset.messageId = getSignalDeskMessageKey(message);
    section.dataset.messageKind = 'bootstrap-context-signal';
    section.dataset.messageRole = 'system';
    section.dataset.messageGroupPosition = 'single';
    section.dataset.progressState = progress.overallState;
    section.setAttribute('aria-busy', String(progress.overallState === 'active'));
    stepsWrap.setAttribute('aria-hidden', String(collapsed));
    summary.setAttribute('aria-hidden', String(!collapsed));
    eyebrow.textContent = collapsed ? 'Secure handoff' : 'Securing your context';

    progress.steps.forEach((step) => {
      const item = section.querySelector(`[data-step-id="${step.id}"]`);
      if (item) item.dataset.stepState = step.state;
    });

    const errorStep = progress.steps.find((step) => step.state === 'error');
    error.hidden = !errorStep;
    error.textContent = errorStep ? errorMessages[errorStep.id] : '';

    const newlyCompleted = progress.steps.filter(
      (step) => step.state === 'complete' && previousStates.get(step.id) !== 'complete'
    );
    if (errorStep && previousStates.get(errorStep.id) !== 'error') {
      announcement.textContent = `${errorStep.label}. ${errorMessages[errorStep.id]}`;
    } else if (newlyCompleted.length) {
      announcement.textContent = `${newlyCompleted.at(-1).label}.`;
    }

    section.dataset.stepSignature = progress.steps
      .map((step) => `${step.id}:${step.state}`)
      .join(',');
  }

  function updateSignalDeskMessageElement(article, message) {
    if (message.messageKind === 'brief-summary') {
      updateSignalDeskBriefSummaryElement(article, message);
      return;
    }
    if (message.messageKind === 'bootstrap-context-signal') {
      updateSignalDeskBootstrapSignalElement(article, message);
      return;
    }
    const senderRole = ['agent', 'visitor', 'system'].includes(message.senderRole)
      ? message.senderRole
      : 'system';
    const messageKind = [
      'intake-question',
      'intake-answer',
      'edit-prompt',
      'edit-selection',
      'edit-answer',
      'edit-status',
      'connection-status',
      'chat',
    ]
      .includes(message.messageKind)
      ? message.messageKind
      : 'chat';
    const entranceClasses = Array.from(article.classList).filter(
      (className) => className === 'is-entering' || className.startsWith('signal-desk-message--enter-')
    );
    article.className = [
      'signal-desk-message',
      `signal-desk-message--${senderRole}`,
      `signal-desk-message--${messageKind}`,
      ...entranceClasses,
    ].join(' ');
    article.dataset.messageId = getSignalDeskMessageKey(message);
    article.dataset.messageKind = messageKind;
    article.dataset.messageRole = senderRole;
    article.classList.toggle('is-pending', message.deliveryStatus === 'pending');
    article.classList.toggle('is-failed', message.deliveryStatus === 'failed');
    article.classList.toggle('is-connection-status', message.messageKind === 'connection-status');
    if (message.messageKind === 'connection-status') article.tabIndex = -1;
    else article.removeAttribute('tabindex');
    const sender = article.querySelector('.signal-desk-message__sender');
    const time = article.querySelector('.signal-desk-message__time');
    const messageBody = article.querySelector('.signal-desk-message__body');
    const delivery = article.querySelector('.signal-desk-message__delivery');
    sender.textContent = senderRole === 'agent' ? 'MarkStreet' : senderRole === 'visitor' ? 'You' : 'System';
    const safeTimestamp = getSignalDeskMessageTimestamp(message);
    time.dateTime = safeTimestamp === null ? '' : message.createdAt;
    time.textContent = formatSignalDeskTime(message);
    messageBody.textContent = message.body;
    delivery.replaceChildren();
    if (senderRole === 'visitor' && message.deliveryStatus === 'pending') {
      delivery.textContent = 'Sending';
    } else if (senderRole === 'visitor' && message.deliveryStatus === 'failed') {
      const label = document.createElement('span');
      const retry = document.createElement('button');
      label.textContent = 'Not sent · ';
      retry.type = 'button';
      retry.className = 'signal-desk-message__retry';
      retry.dataset.signalDeskRetryMessage = message.clientId;
      retry.textContent = 'Retry';
      delivery.append(label, retry);
    }
  }

  function scrollSignalDeskToLatest({ smooth = false } = {}) {
    requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
      });
    });
  }

  function isSignalDeskNearBottom(threshold = 100) {
    return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <= threshold;
  }

  function updateSignalDeskMessageGrouping() {
    const renderedMessages = Array.from(messageList.querySelectorAll('[data-message-id]'));
    renderedMessages.forEach((article, index) => {
      const role = article.dataset.messageRole || 'system';
      const groupable = article.classList.contains('signal-desk-message')
        && ['agent', 'visitor'].includes(role);
      const previous = renderedMessages[index - 1];
      const next = renderedMessages[index + 1];
      const followsSameRole = groupable
        && previous?.classList.contains('signal-desk-message')
        && previous.dataset.messageRole === role;
      const precedesSameRole = groupable
        && next?.classList.contains('signal-desk-message')
        && next.dataset.messageRole === role;
      article.dataset.messageGroupPosition = followsSameRole
        ? precedesSameRole ? 'middle' : 'last'
        : precedesSameRole ? 'first' : 'single';
    });
  }

  function getSignalDeskMessageEntrance(message) {
    if (message.messageKind === 'brief-summary') return 'brief';
    if (message.messageKind === 'bootstrap-context-signal') return 'bootstrap';
    if (message.messageKind === 'connection-status' || message.senderRole === 'system') return 'system';
    if (message.messageKind === 'intake-question' || message.senderRole === 'agent') return 'agent';
    return 'visitor';
  }

  function startSignalDeskMessageEntrance(article, message) {
    const entrance = getSignalDeskMessageEntrance(message);
    const entranceClass = `signal-desk-message--enter-${entrance}`;
    const clearEntrance = (event) => {
      if (event && !String(event.animationName).startsWith('signal-desk-message-enter-')) return;
      article.removeEventListener('animationend', clearEntrance);
      article.classList.remove('is-entering', entranceClass);
    };
    article.classList.add('is-entering', entranceClass);
    article.addEventListener('animationend', clearEntrance);
    window.setTimeout(clearEntrance, SIGNAL_DESK_MESSAGE_ENTRANCE_MS);
  }

  function settleSignalDeskMessageEntrances() {
    messageList.querySelectorAll(
      [
        '.signal-desk-message.is-entering',
        '.signal-desk-brief.is-entering',
        '.signal-desk-bootstrap-signal.is-entering',
      ].join(', ')
    ).forEach((message) => {
      message.classList.remove(
        'is-entering',
        'signal-desk-message--enter-visitor',
        'signal-desk-message--enter-agent',
        'signal-desk-message--enter-system',
        'signal-desk-message--enter-brief',
        'signal-desk-message--enter-bootstrap'
      );
    });
  }

  function showSignalDeskTypingIndicator(label) {
    // A future documented realtime typing callback may use these show/hide helpers.
    // Do not wire agent presence here until the CRM publishes a verified event.
    const wasNearBottom = isSignalDeskNearBottom();
    if (signalDeskTypingRemovalTimer !== null) {
      window.clearTimeout(signalDeskTypingRemovalTimer);
      signalDeskTypingRemovalTimer = null;
    }
    signalDeskTypingIndicator.removeAttribute('style');
    signalDeskTypingIndicator.classList.remove('is-leaving');
    signalDeskTypingLabel.textContent = label;
    if (!signalDeskTypingIndicator.isConnected) messageList.append(signalDeskTypingIndicator);
    requestAnimationFrame(() => {
      if (signalDeskTypingIndicator.isConnected) {
        signalDeskTypingIndicator.classList.add('is-visible');
      }
    });
    if (wasNearBottom) scrollSignalDeskToLatest({ smooth: true });
  }

  function isSignalDeskTypingIndicatorVisible() {
    return signalDeskTypingIndicator.isConnected
      && signalDeskTypingIndicator.classList.contains('is-visible');
  }

  function hideSignalDeskTypingIndicator({ immediate = false } = {}) {
    if (signalDeskTypingRemovalTimer !== null) {
      window.clearTimeout(signalDeskTypingRemovalTimer);
      signalDeskTypingRemovalTimer = null;
    }
    if (!isSignalDeskTypingIndicatorVisible() && !signalDeskTypingIndicator.isConnected) return;
    signalDeskTypingIndicator.classList.remove('is-visible');
    if (immediate) {
      signalDeskTypingIndicator.removeAttribute('style');
      signalDeskTypingIndicator.classList.remove('is-leaving');
      signalDeskTypingIndicator.remove();
      return;
    }
    const indicatorBounds = signalDeskTypingIndicator.getBoundingClientRect();
    const transcriptBounds = messageList.getBoundingClientRect();
    signalDeskTypingIndicator.style.position = 'absolute';
    signalDeskTypingIndicator.style.top = `${
      indicatorBounds.top - transcriptBounds.top + messageList.scrollTop
    }px`;
    signalDeskTypingIndicator.style.right = `${transcriptBounds.right - indicatorBounds.right}px`;
    signalDeskTypingIndicator.style.width = `${indicatorBounds.width}px`;
    signalDeskTypingIndicator.classList.add('is-leaving');
    signalDeskTypingRemovalTimer = window.setTimeout(() => {
      signalDeskTypingRemovalTimer = null;
      signalDeskTypingIndicator.removeAttribute('style');
      signalDeskTypingIndicator.classList.remove('is-leaving');
      signalDeskTypingIndicator.remove();
    }, 180);
  }

  function renderSignalDeskMessages({
    smooth = false,
    forceScroll = false,
    scrollIfNearBottom = false,
    animateMessages = [],
  } = {}) {
    const shouldScroll = forceScroll || (scrollIfNearBottom && isSignalDeskNearBottom());
    const entranceKeys = new Set(animateMessages.map(getSignalDeskMessageKey));
    const existingMessages = new Map(
      Array.from(
        messageList.querySelectorAll('[data-message-id]'),
        (message) => [message.dataset.messageId, message]
      )
    );
    const activeKeys = new Set();
    signalDeskSession.conversation.messages.forEach((message, index) => {
      const key = getSignalDeskMessageKey(message);
      const article = existingMessages.get(key) || createSignalDeskMessageElement(message);
      const isFirstPresentation = !signalDeskPresentedMessageKeys.has(key);
      activeKeys.add(key);
      signalDeskPresentedMessageKeys.add(key);
      updateSignalDeskMessageElement(article, message);
      const renderedMessages = messageList.querySelectorAll('[data-message-id]');
      if (renderedMessages[index] !== article) {
        messageList.insertBefore(
          article,
          renderedMessages[index] || (signalDeskTypingIndicator.isConnected ? signalDeskTypingIndicator : null)
        );
      }
      if (isFirstPresentation && entranceKeys.has(key)) startSignalDeskMessageEntrance(article, message);
    });
    existingMessages.forEach((message, key) => {
      if (!activeKeys.has(key)) message.remove();
    });
    updateSignalDeskMessageGrouping();
    if (shouldScroll) scrollSignalDeskToLatest({ smooth });
  }

  function hasSignalDeskConversationCredentials() {
    const conversation = signalDeskSession.conversation;
    return Boolean(
      window.MarkStreetCRMChatAPI
      && conversation.conversationId
      && typeof conversation.visitorToken === 'string'
      && conversation.visitorToken.trim()
    );
  }

  function persistSignalDeskRuntimeCredentials({ validated = false } = {}) {
    const conversation = signalDeskSession.conversation;
    if (
      !persistence
      || !conversation.conversationId
      || typeof conversation.visitorToken !== 'string'
      || !conversation.visitorToken.trim()
    ) return false;
    const existingCredentials = persistence.loadRuntimeCredentials(
      conversation.conversationId
    );
    const persisted = persistence.saveRuntimeCredentials({
      conversationId: conversation.conversationId,
      visitorToken: conversation.visitorToken,
      widgetId: conversation.widgetId,
      savedAt: existingCredentials?.savedAt || null,
      lastValidatedAt: validated
        ? new Date().toISOString()
        : existingCredentials?.lastValidatedAt || null,
    });
    if (!persisted && !signalDeskRuntimePersistenceWarningShown) {
      signalDeskRuntimePersistenceWarningShown = true;
      console.warn('[Signal Desk] Same-tab conversation continuity is unavailable.', {
        hasRuntimeCredentials: true,
        conversationIdPresent: Boolean(conversation.conversationId),
        widgetIdPresent: Boolean(conversation.widgetId),
      });
    }
    return persisted;
  }

  function resetSignalDeskForNewLine() {
    stopSignalDeskPollingFallback();
    window.MarkStreetCRMChatRealtime?.disconnect();
    persistence?.clearRuntimeCredentials();
    persistence?.clear();

    Object.assign(signalDeskSession.identity, {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    Object.assign(signalDeskSession.intake, {
      industry: '',
      request: '',
      businessSummary: '',
    });
    Object.assign(signalDeskSession.guidedIntake, {
      status: 'idle',
      currentQuestionIndex: 0,
      completedQuestionIds: [],
      startedAt: null,
      completedAt: null,
      review: {
        presentedAt: null,
        confirmationRequestedAt: null,
        confirmedAt: null,
        correctionQuestionIds: [],
      },
      edit: {
        active: false,
        target: null,
        startedAt: null,
        previousValue: null,
      },
    });
    Object.assign(signalDeskSession.conversation, {
      hasExistingLine: false,
      conversationId: null,
      visitorToken: '',
      widgetId: null,
      intakeMessageSent: false,
      intakeMessageServerId: null,
      isBootstrapping: false,
      isLoadingHistory: false,
      historySyncQueued: false,
      hasSyncedHistory: false,
      liveWelcomeInitialized: false,
      lastError: null,
      historyError: null,
      realtimeError: null,
      lastActivityAt: null,
      lastSeenMessageId: null,
      messages: [],
    });
    Object.assign(signalDeskSession.presentation, {
      realtimeStatus: 'idle',
      pollingFallbackActive: false,
      pollingFallbackHealth: 'idle',
      hasReachedOpenLine: false,
      unreadCount: 0,
      isRestoringSession: false,
      runtimeReady: false,
      restoreState: 'idle',
    });
    Object.assign(signalDeskSession.bootstrapProgress, {
      contextValidated: false,
      collapsed: false,
      errorStep: null,
    });
    clearSignalDeskBootstrapCollapse();
    signalDeskPendingRuntimeCredentials = null;
    signalDeskHydratedDraft = null;
    signalDeskComposerDraftDirty = false;
    signalDeskEditQuestionId = null;
    signalDeskMessageSends.clear();
    signalDeskPresentedMessageKeys.clear();
    messageList.replaceChildren();

    signalDeskIsHydrating = true;
    setSignalDeskRealtimeStatus('idle', { connectionChange: false });
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.INTAKE);
    setSignalDeskState(SIGNAL_DESK_STATES.INTRO, { moveFocus: false });
    signalDeskIsHydrating = false;
    queueSignalDeskFocus(start);
  }

  function setSignalDeskRestoreFailure(error) {
    const conversation = signalDeskSession.conversation;
    const classification = classifySignalDeskBootstrapError(error);
    const status = Number.isInteger(error?.status) ? error.status : null;
    const isNotFound = status === 404 || error?.code === 'CONVERSATION_NOT_FOUND';
    const isAuthenticationFailure = ['authentication'].includes(classification)
      || ['INVALID_VISITOR_TOKEN', 'CONVERSATION_ACCESS_DENIED'].includes(error?.code);

    signalDeskSession.presentation.isRestoringSession = false;
    signalDeskSession.presentation.runtimeReady = false;
    signalDeskSession.presentation.restoreState = 'failed';

    if (isNotFound) {
      resetSignalDeskForNewLine();
      return;
    }

    if (isAuthenticationFailure) {
      persistence?.clearRuntimeCredentials();
      conversation.hasExistingLine = false;
      conversation.conversationId = null;
      conversation.visitorToken = '';
      conversation.widgetId = null;
    }

    conversation.lastError = {
      code: typeof error?.code === 'string'
        ? error.code.slice(0, 80)
        : 'SESSION_RESTORE_FAILED',
      status,
      classification,
      stage: 'restore',
      fieldErrors: {},
      retryable: !isAuthenticationFailure,
      recoveryAction: isAuthenticationFailure ? 'start-new-line' : 'retry-restore',
      userMessage: isAuthenticationFailure
        ? 'Your previous line could not be restored.'
        : 'Your line could not be restored right now. Please try again.',
    };
    setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR);
    renderSignalDeskMessages();
  }

  async function updateSignalDeskCurrentPage() {
    const crmApi = window.MarkStreetCRMChatAPI;
    if (
      typeof crmApi?.updateCurrentPage !== 'function'
      || !hasSignalDeskConversationCredentials()
    ) return false;
    try {
      await crmApi.updateCurrentPage({
        visitorToken: signalDeskSession.conversation.visitorToken,
        conversationId: signalDeskSession.conversation.conversationId,
        pageUrl: window.location.href,
      });
      return true;
    } catch {
      return false;
    }
  }

  function restoreSignalDeskConversationFromSession(credentials = null) {
    if (signalDeskConversationRestorePromise) return signalDeskConversationRestorePromise;

    signalDeskConversationRestorePromise = (async () => {
      const conversation = signalDeskSession.conversation;
      const runtimeCredentials = credentials || persistence?.loadRuntimeCredentials(
        conversation.conversationId
      );
      if (
        !runtimeCredentials
        || !conversation.conversationId
        || Number(runtimeCredentials.conversationId) !== Number(conversation.conversationId)
      ) {
        const restoreError = new Error('Stored Signal Desk credentials are unavailable.');
        restoreError.code = 'SECURE_RESUME_REQUIRED';
        restoreError.status = 401;
        setSignalDeskRestoreFailure(restoreError);
        return false;
      }

      conversation.conversationId = runtimeCredentials.conversationId;
      conversation.visitorToken = runtimeCredentials.visitorToken;
      conversation.widgetId = runtimeCredentials.widgetId;
      conversation.hasExistingLine = true;
      conversation.intakeMessageSent = true;
      conversation.lastError = null;
      signalDeskPendingRuntimeCredentials = null;
      signalDeskSession.guidedIntake.status = 'complete';
      signalDeskSession.presentation.isRestoringSession = true;
      signalDeskSession.presentation.runtimeReady = false;
      signalDeskSession.presentation.restoreState = 'history-loading';
      window.MarkStreetCRMChatRealtime?.disconnect();
      setSignalDeskRealtimeStatus('reconnecting');
      setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.LIVE);

      try {
        await syncSignalDeskMessageHistory({
          silent: true,
          throwOnError: true,
        });
        updateSignalDeskCurrentPage();
        persistSignalDeskRuntimeCredentials({ validated: true });
        signalDeskSession.presentation.isRestoringSession = false;
        signalDeskSession.presentation.runtimeReady = true;
        signalDeskSession.presentation.restoreState = 'realtime-connecting';
        signalDeskSession.presentation.hasReachedOpenLine = true;
        configureSignalDeskComposer();
        restoreSignalDeskComposerDraft();
        connectSignalDeskRealtime();
        saveSignalDeskPersistence();
        if (layer.classList.contains('is-open')) queueSignalDeskFocus(messageInput);
        return true;
      } catch (error) {
        setSignalDeskRestoreFailure(error);
        return false;
      }
    })().finally(() => {
      signalDeskConversationRestorePromise = null;
    });

    return signalDeskConversationRestorePromise;
  }

  function getSafeSignalDeskError(error, fallbackCode = 'MESSAGE_SEND_FAILED') {
    return {
      code: typeof error?.code === 'string' ? error.code.slice(0, 80) : fallbackCode,
      status: Number.isInteger(error?.status) ? error.status : null,
    };
  }

  function reconcileSignalDeskOptimisticMessage(message, serverMessage) {
    if (!serverMessage) {
      message.deliveryStatus = 'sent';
      message.errorCode = null;
      return;
    }
    message.serverId = serverMessage.id ? String(serverMessage.id) : message.serverId;
    message.conversationId = serverMessage.conversationId ?? message.conversationId;
    message.senderRole = serverMessage.senderRole || message.senderRole;
    message.senderName = serverMessage.senderName ?? message.senderName ?? null;
    message.body = typeof serverMessage.body === 'string' && serverMessage.body ? serverMessage.body : message.body;
    message.createdAt = serverMessage.createdAt || message.createdAt;
    message.displayTime = serverMessage.displayTime ?? message.displayTime ?? null;
    message.file = serverMessage.file ?? message.file;
    message.deliveryStatus = 'sent';
    message.errorCode = null;
    message.isLocalOnly = false;
    message.messageKind = 'chat';
  }

  async function sendSignalDeskMessage(message) {
    if (!message?.clientId || signalDeskMessageSends.has(message.clientId)) {
      return signalDeskMessageSends.get(message?.clientId);
    }
    if (!hasSignalDeskConversationCredentials()) {
      message.deliveryStatus = 'failed';
      message.errorCode = 'CONVERSATION_UNAVAILABLE';
      renderSignalDeskMessages();
      setSignalDeskComposerStatus('The line is unavailable right now. Please retry in a moment.');
      return null;
    }
    message.deliveryStatus = 'pending';
    message.errorCode = null;
    renderSignalDeskMessages();
    setSignalDeskComposerStatus('');
    const conversation = signalDeskSession.conversation;
    const sendPromise = (async () => {
      try {
        const serverMessage = await window.MarkStreetCRMChatAPI.sendMessage({
          visitorToken: conversation.visitorToken,
          conversationId: conversation.conversationId,
          body: message.body,
        });
        reconcileSignalDeskOptimisticMessage(message, serverMessage);
      } catch (error) {
        const safeError = getSafeSignalDeskError(error);
        message.deliveryStatus = 'failed';
        message.errorCode = safeError.code;
      } finally {
        signalDeskMessageSends.delete(message.clientId);
        renderSignalDeskMessages();
      }
    })();
    signalDeskMessageSends.set(message.clientId, sendPromise);
    return sendPromise;
  }

  function autoResizeSignalDeskComposer() {
    if (messageInput.hidden) return;
    const wasNearBottom = isSignalDeskNearBottom();
    const computedMaximumHeight = Number.parseFloat(
      window.getComputedStyle(messageInput).maxHeight
    );
    const maximumHeight = Number.isFinite(computedMaximumHeight)
      ? computedMaximumHeight
      : 140;
    messageInput.style.height = 'auto';
    const nextHeight = Math.min(messageInput.scrollHeight, maximumHeight);
    messageInput.style.height = `${nextHeight}px`;
    messageInput.style.overflowY = messageInput.scrollHeight > maximumHeight ? 'auto' : 'hidden';
    if (wasNearBottom) scrollSignalDeskToLatest();
  }

  function handleSignalDeskViewportResize() {
    if (!layer.classList.contains('is-open')) return;
    if (signalDeskViewportResizeFrame !== null) {
      cancelAnimationFrame(signalDeskViewportResizeFrame);
    }
    signalDeskViewportResizeFrame = requestAnimationFrame(() => {
      signalDeskViewportResizeFrame = null;
      autoResizeSignalDeskComposer();
    });
  }

  function updateSignalDeskSendState() {
    if (sendButton.hidden) return;
    const activeControl = [
      SIGNAL_DESK_CONVERSATION_PHASES.INTAKE,
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER,
    ].includes(currentConversationPhase)
      ? getActiveComposerControl()
      : messageInput;
    sendButton.disabled = !activeControl || activeControl.disabled || activeControl.value.trim().length === 0;
  }

  function normalizeSignalDeskMessageForMatch(messageBody) {
    return typeof messageBody === 'string' ? messageBody.trim() : '';
  }

  function createSignalDeskServerMessage(serverMessage) {
    const serverId = serverMessage.id === null || serverMessage.id === undefined
      ? null
      : String(serverMessage.id);
    return {
      id: serverId ? `server-${serverId}` : createSignalDeskClientId(),
      serverId,
      clientId: null,
      conversationId: serverMessage.conversationId ?? signalDeskSession.conversation.conversationId,
      senderRole: serverMessage.senderRole,
      senderName: serverMessage.senderName ?? null,
      body: typeof serverMessage.body === 'string' ? serverMessage.body : '',
      createdAt: serverMessage.createdAt || null,
      displayTime: serverMessage.displayTime ?? null,
      deliveryStatus: 'sent',
      errorCode: null,
      file: serverMessage.file ?? null,
      isLocalOnly: false,
      messageKind: 'chat',
      questionId: null,
    };
  }

  function isSignalDeskIntakeMessage(message) {
    const conversation = signalDeskSession.conversation;
    const serverId = message.id === null || message.id === undefined ? null : String(message.id);
    if (conversation.intakeMessageServerId) return serverId === conversation.intakeMessageServerId;
    if (message.senderRole !== 'visitor') return false;
    const normalizedBody = normalizeSignalDeskMessageForMatch(message.body);
    const currentStructuredMessage = normalizeSignalDeskMessageForMatch(
      intakeDomain.buildStructuredMessage(signalDeskSession)
    );
    return normalizedBody === currentStructuredMessage
      || (
        normalizedBody.startsWith('New MarkStreet Signal Desk Inquiry\n\nIndustry:')
        && normalizedBody.includes('\n\nWhat they need help with:\n')
        && normalizedBody.includes('\n\nBusiness in one line:\n')
      );
  }

  function mergeSignalDeskMessageHistory(serverMessages) {
    const conversation = signalDeskSession.conversation;
    const mergedMessages = [...conversation.messages];
    const addedMessages = [];
    const seenServerIds = new Set(
      mergedMessages.map((message) => message.serverId).filter(Boolean).map(String)
    );
    const matchedClientIds = new Set();

    serverMessages.forEach((serverMessage) => {
      if (isSignalDeskIntakeMessage(serverMessage)) return;
      const serverId = serverMessage.id === null || serverMessage.id === undefined
        ? null
        : String(serverMessage.id);
      if (serverId && seenServerIds.has(serverId)) {
        const existingMessage = mergedMessages.find((message) => String(message.serverId) === serverId);
        if (existingMessage) reconcileSignalDeskOptimisticMessage(existingMessage, serverMessage);
        return;
      }

      const serverTimestamp = getSignalDeskMessageTimestamp(serverMessage);
      let optimisticMatch = null;
      if (serverMessage.senderRole === 'visitor' && serverTimestamp !== null) {
        optimisticMatch = mergedMessages.filter((message) => {
          if (
            message.senderRole !== 'visitor' || message.isLocalOnly
            || !['pending', 'sent'].includes(message.deliveryStatus)
            || !message.clientId || message.serverId || matchedClientIds.has(message.clientId)
            || normalizeSignalDeskMessageForMatch(message.body)
              !== normalizeSignalDeskMessageForMatch(serverMessage.body)
          ) return false;
          const localTimestamp = getSignalDeskMessageTimestamp(message);
          return localTimestamp !== null && Math.abs(localTimestamp - serverTimestamp) <= 30000;
        }).sort((first, second) => (
          Math.abs(getSignalDeskMessageTimestamp(first) - serverTimestamp)
          - Math.abs(getSignalDeskMessageTimestamp(second) - serverTimestamp)
        ))[0] || null;
      }
      if (optimisticMatch) {
        reconcileSignalDeskOptimisticMessage(optimisticMatch, serverMessage);
        matchedClientIds.add(optimisticMatch.clientId);
      } else {
        const addedMessage = createSignalDeskServerMessage(serverMessage);
        mergedMessages.push(addedMessage);
        addedMessages.push(addedMessage);
      }
      if (serverId) seenServerIds.add(serverId);
    });

    const seenKeys = new Set();
    conversation.messages = mergedMessages.filter((message) => {
      const key = message.serverId
        ? `server-${message.serverId}`
        : message.clientId ? `client-${message.clientId}` : `message-${message.id}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    }).map((message, index) => ({ message, index, timestamp: getSignalDeskMessageTimestamp(message) }))
      .sort((first, second) => {
        if (first.timestamp === null || second.timestamp === null) return first.index - second.index;
        return first.timestamp - second.timestamp || first.index - second.index;
      })
      .map(({ message }) => message);
    return addedMessages;
  }

  function recordSignalDeskMessageActivity(messages = []) {
    if (!messages.length) return;
    const conversation = signalDeskSession.conversation;
    const latestMessage = messages.at(-1);
    conversation.lastActivityAt = typeof latestMessage?.createdAt === 'string'
      && Number.isFinite(Date.parse(latestMessage.createdAt))
      ? new Date(latestMessage.createdAt).toISOString()
      : new Date().toISOString();
    const latestServerMessage = [...messages].reverse().find((message) => message.serverId);
    if (layer.classList.contains('is-open')) {
      signalDeskSession.presentation.unreadCount = 0;
      if (latestServerMessage) {
        conversation.lastSeenMessageId = String(latestServerMessage.serverId);
      }
    } else {
      const unreadMessages = messages.filter(
        (message) => message.senderRole !== 'visitor'
      ).length;
      signalDeskSession.presentation.unreadCount = Math.min(
        signalDeskSession.presentation.unreadCount + unreadMessages,
        999
      );
    }
    saveSignalDeskPersistence();
  }

  async function syncSignalDeskMessageHistory({
    silent = false,
    throwOnError = false,
  } = {}) {
    const conversation = signalDeskSession.conversation;
    if (!hasSignalDeskConversationCredentials()) return false;
    if (conversation.isLoadingHistory) {
      conversation.historySyncQueued = true;
      return false;
    }
    conversation.isLoadingHistory = true;
    conversation.historySyncQueued = false;
    const wasNearBottom = isSignalDeskNearBottom();
    const hadSyncedHistory = conversation.hasSyncedHistory;
    try {
      const messages = await window.MarkStreetCRMChatAPI.getMessages({
        visitorToken: conversation.visitorToken,
        conversationId: conversation.conversationId,
      });
      const addedMessages = mergeSignalDeskMessageHistory(messages);
      recordSignalDeskMessageActivity(addedMessages);
      conversation.hasSyncedHistory = true;
      conversation.historyError = null;
      if (signalDeskSession.presentation.pollingFallbackActive) {
        signalDeskSession.presentation.pollingFallbackHealth = 'healthy';
        if (hasActiveSignalDeskBootstrapSignal()) {
          signalDeskSession.bootstrapProgress.errorStep = null;
          renderSignalDeskBootstrapProgress({ forceScroll: false });
        }
        updateSignalDeskAdaptiveHeader({ connectionChange: true });
      }
      renderSignalDeskMessages({
        scrollIfNearBottom: wasNearBottom,
        animateMessages: hadSyncedHistory ? addedMessages : [],
      });
      return true;
    } catch (error) {
      conversation.historyError = getSafeSignalDeskError(error, 'HISTORY_LOAD_FAILED');
      if (signalDeskSession.presentation.pollingFallbackActive) {
        signalDeskSession.presentation.pollingFallbackHealth = 'failed';
        updateSignalDeskAdaptiveHeader({ connectionChange: true });
        if (
          hasActiveSignalDeskBootstrapSignal()
          && conversation.intakeMessageSent
        ) {
          conversation.lastError = {
            ...getSafeSignalDeskError(error, 'REALTIME_TRANSPORT_UNAVAILABLE'),
            classification: classifySignalDeskBootstrapError(error),
            stage: 'realtime',
            retryable: true,
            userMessage: 'The private line could not be opened. Please try again.',
          };
          signalDeskSession.guidedIntake.status = 'error';
          setSignalDeskBootstrapErrorStep('private-line-open');
          setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR);
        }
      }
      if (!silent) setSignalDeskComposerStatus('Message history could not be refreshed. You can still send messages.');
      if (throwOnError) throw error;
      return false;
    } finally {
      conversation.isLoadingHistory = false;
      if (conversation.historySyncQueued) syncSignalDeskMessageHistory({ silent: true });
    }
  }

  function stopSignalDeskPollingFallback() {
    if (signalDeskPollingTimer !== null) {
      clearInterval(signalDeskPollingTimer);
      signalDeskPollingTimer = null;
    }
    if (!signalDeskSession.presentation.pollingFallbackActive) return;
    signalDeskSession.presentation.pollingFallbackActive = false;
    signalDeskSession.presentation.pollingFallbackHealth = 'idle';
    updateSignalDeskAdaptiveHeader({ connectionChange: true });
  }

  function startSignalDeskPollingFallback() {
    if (signalDeskPollingTimer !== null || !hasSignalDeskConversationCredentials()) return;
    signalDeskSession.presentation.pollingFallbackActive = true;
    signalDeskSession.presentation.pollingFallbackHealth = 'pending';
    updateSignalDeskAdaptiveHeader({ connectionChange: true });
    syncSignalDeskMessageHistory({ silent: true });
    signalDeskPollingTimer = setInterval(() => {
      if (navigator.onLine) syncSignalDeskMessageHistory({ silent: true });
    }, SIGNAL_DESK_POLLING_INTERVAL_MS);
  }

  function setSignalDeskRealtimeStatus(nextStatus, { connectionChange = true } = {}) {
    signalDeskSession.presentation.realtimeStatus = nextStatus;
    if (nextStatus === 'connected') {
      signalDeskSession.presentation.hasReachedOpenLine = true;
    }
    realtimeStatus.dataset.realtimeStatus = nextStatus;
    updateSignalDeskAdaptiveHeader({ connectionChange });
  }

  function hasActiveSignalDeskBootstrapSignal() {
    return signalDeskSession.conversation.messages.some(
      (message) => message.messageKind === 'bootstrap-context-signal'
    ) && !signalDeskSession.bootstrapProgress.collapsed;
  }

  function handleSignalDeskRealtimeMessage(message) {
    const conversation = signalDeskSession.conversation;
    if (Number(message?.conversationId) !== Number(conversation.conversationId)) return;
    if (isSignalDeskIntakeMessage(message)) return;
    const wasNearBottom = isSignalDeskNearBottom();
    const addedMessages = mergeSignalDeskMessageHistory([message]);
    recordSignalDeskMessageActivity(addedMessages);
    renderSignalDeskMessages({
      scrollIfNearBottom: wasNearBottom,
      animateMessages: addedMessages,
    });
  }

  function handleSignalDeskRealtimeStatus(nextStatus, metadata = {}) {
    if (
      hasActiveSignalDeskBootstrapSignal()
      && ['connecting', 'authenticating', 'reconnecting'].includes(nextStatus)
    ) {
      signalDeskSession.bootstrapProgress.errorStep = null;
      renderSignalDeskBootstrapProgress({ forceScroll: false });
    }
    if (nextStatus === 'connected') {
      setSignalDeskRealtimeStatus(nextStatus);
      stopSignalDeskPollingFallback();
      signalDeskSession.conversation.realtimeError = null;
      signalDeskSession.presentation.isRestoringSession = false;
      signalDeskSession.presentation.runtimeReady = true;
      signalDeskSession.presentation.restoreState = 'connected';
      if (hasActiveSignalDeskBootstrapSignal()) {
        signalDeskSession.bootstrapProgress.errorStep = null;
        signalDeskSession.guidedIntake.status = 'complete';
        if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.BOOTSTRAP_ERROR) {
          setSignalDeskConversationPhase(SIGNAL_DESK_CONVERSATION_PHASES.LIVE);
        }
        renderSignalDeskBootstrapProgress();
      }
      updateSignalDeskAdaptiveHeader({ connectionChange: true });
      persistSignalDeskRuntimeCredentials({ validated: true });
      configureSignalDeskComposer();
      restoreSignalDeskComposerDraft();
      syncSignalDeskMessageHistory({ silent: true });
    } else if (nextStatus === 'reconnecting' && Number(metadata.attempt) >= 3) {
      startSignalDeskPollingFallback();
      setSignalDeskRealtimeStatus(nextStatus);
    } else if (nextStatus === 'closed') {
      startSignalDeskPollingFallback();
      setSignalDeskRealtimeStatus(nextStatus);
    } else {
      setSignalDeskRealtimeStatus(nextStatus);
    }
  }

  function handleSignalDeskRealtimeError(error) {
    signalDeskSession.conversation.realtimeError = {
      code: typeof error?.code === 'string' ? error.code.slice(0, 80) : 'REALTIME_ERROR',
      conversationId: Number.isSafeInteger(Number(error?.conversationId))
        ? Number(error.conversationId)
        : null,
      status: typeof error?.status === 'string' ? error.status : 'unknown',
    };
    if (
      hasActiveSignalDeskBootstrapSignal()
      && signalDeskSession.conversation.intakeMessageSent
    ) {
      setSignalDeskBootstrapErrorStep('private-line-open');
    }
    if (error?.code === 'AUTHENTICATION_FAILED') {
      const authenticationError = new Error('Signal Desk realtime authentication failed.');
      authenticationError.code = 'INVALID_VISITOR_TOKEN';
      authenticationError.status = 401;
      setSignalDeskRestoreFailure(authenticationError);
    }
  }

  function connectSignalDeskRealtime() {
    const realtime = window.MarkStreetCRMChatRealtime;
    const conversation = signalDeskSession.conversation;
    if (!realtime || !hasSignalDeskConversationCredentials()) {
      startSignalDeskPollingFallback();
      setSignalDeskRealtimeStatus('offline');
      return;
    }
    try {
      realtime.connect({
        visitorToken: conversation.visitorToken,
        conversationId: conversation.conversationId,
        onMessage: handleSignalDeskRealtimeMessage,
        onStatusChange: handleSignalDeskRealtimeStatus,
        onError: handleSignalDeskRealtimeError,
      });
    } catch (error) {
      handleSignalDeskRealtimeError({
        code: 'REALTIME_CONNECT_FAILED',
        conversationId: conversation.conversationId,
        status: 'closed',
      });
      startSignalDeskPollingFallback();
      setSignalDeskRealtimeStatus('closed');
    }
  }

  function handleSignalDeskLiveMessageSubmission() {
    const messageBody = messageInput.value.trim();
    if (!messageBody) {
      updateSignalDeskSendState();
      return;
    }
    if (!hasSignalDeskConversationCredentials()) {
      setSignalDeskComposerStatus('The line is unavailable right now. Please retry in a moment.');
      return;
    }
    const message = createSignalDeskMessage('visitor', messageBody, { deliveryStatus: 'pending' });
    signalDeskSession.conversation.messages.push(message);
    signalDeskSession.conversation.lastActivityAt = message.createdAt;
    renderSignalDeskMessages({
      smooth: true,
      forceScroll: true,
      animateMessages: [message],
    });
    messageInput.value = '';
    signalDeskComposerDraftDirty = false;
    signalDeskHydratedDraft = null;
    saveSignalDeskPersistence();
    autoResizeSignalDeskComposer();
    updateSignalDeskSendState();
    sendSignalDeskMessage(message);
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) messageInput.focus();
  }

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.INTAKE) {
      const question = getCurrentSignalDeskQuestion();
      const control = question?.answerType === 'multiline' ? messageInput : shortAnswer;
      handleSignalDeskIntakeAnswerSubmission(control.value);
    } else if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER) {
      const question = getCurrentSignalDeskQuestion();
      const control = question?.answerType === 'multiline' ? messageInput : shortAnswer;
      handleSignalDeskEditAnswerSubmission(control.value);
    } else if (currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.LIVE) {
      handleSignalDeskLiveMessageSubmission();
    }
  });

  messageList.addEventListener('click', (event) => {
    const editAnswersButton = event.target.closest('[data-signal-desk-edit-answers]');
    if (editAnswersButton) {
      beginSignalDeskBriefEdit();
      return;
    }
    const confirmBriefButton = event.target.closest('[data-signal-desk-confirm-brief]');
    if (confirmBriefButton) {
      confirmSignalDeskBrief();
      return;
    }
    const retryButton = event.target.closest('[data-signal-desk-retry-message]');
    if (!retryButton || currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.LIVE) return;
    const message = signalDeskSession.conversation.messages.find(
      (candidate) => candidate.clientId === retryButton.dataset.signalDeskRetryMessage
    );
    if (message?.deliveryStatus === 'failed') sendSignalDeskMessage(message);
  });

  [shortAnswer, messageInput].forEach((control) => {
    control.addEventListener('input', () => {
      control.setAttribute('aria-invalid', 'false');
      setSignalDeskComposerStatus('');
      if (control === messageInput) autoResizeSignalDeskComposer();
      updateSignalDeskSendState();
      signalDeskComposerDraftDirty = true;
      signalDeskHydratedDraft = null;
      saveSignalDeskPersistence({ debounce: true });
    });
  });

  shortAnswer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  messageInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    if ([
      SIGNAL_DESK_CONVERSATION_PHASES.INTAKE,
      SIGNAL_DESK_CONVERSATION_PHASES.EDIT_ANSWER,
    ].includes(currentConversationPhase)) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      composer.requestSubmit();
      return;
    }
    const usesTouchInput = navigator.maxTouchPoints > 0
      || window.matchMedia('(pointer: coarse)').matches;
    if (currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.LIVE || event.shiftKey || usesTouchInput) return;
    event.preventDefault();
    composer.requestSubmit();
  });

  function recoverSignalDeskAfterVisibility({ force = false } = {}) {
    if (
      document.visibilityState !== 'visible'
      || navigator.onLine === false
      || currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.LIVE
      || !hasSignalDeskConversationCredentials()
    ) return;
    const now = Date.now();
    if (!force && now - signalDeskLastVisibilityRecoveryAt < 60000) return;
    signalDeskLastVisibilityRecoveryAt = now;
    const realtime = window.MarkStreetCRMChatRealtime;
    const realtimeState = realtime?.getStatus?.() || 'closed';
    if (realtimeState !== 'connected') {
      setSignalDeskRealtimeStatus('reconnecting');
      syncSignalDeskMessageHistory({ silent: true }).finally(() => {
        connectSignalDeskRealtime();
      });
      return;
    }
    syncSignalDeskMessageHistory({ silent: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recoverSignalDeskAfterVisibility();
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    window.addEventListener('resize', handleSignalDeskViewportResize, { passive: true });
    window.visualViewport?.addEventListener('resize', handleSignalDeskViewportResize, { passive: true });
    updateSignalDeskCurrentPage();
    if (hasActiveSignalDeskBootstrapSignal()) {
      renderSignalDeskBootstrapProgress({ forceScroll: false });
    }
    recoverSignalDeskAfterVisibility({ force: true });
  });
  window.addEventListener('resize', handleSignalDeskViewportResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleSignalDeskViewportResize, { passive: true });

  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', handleSignalDeskViewportResize);
    window.visualViewport?.removeEventListener('resize', handleSignalDeskViewportResize);
    cancelSignalDeskIntakeTransition({ advance: true });
    saveSignalDeskPersistence();
    hideSignalDeskTypingIndicator({ immediate: true });
    settleSignalDeskMessageEntrances();
    if (signalDeskViewportResizeFrame !== null) {
      cancelAnimationFrame(signalDeskViewportResizeFrame);
      signalDeskViewportResizeFrame = null;
    }
    if (signalDeskFocusFrame !== null) {
      cancelAnimationFrame(signalDeskFocusFrame);
      signalDeskFocusFrame = null;
    }
    if (signalDeskBriefFocusTimer !== null) {
      window.clearTimeout(signalDeskBriefFocusTimer);
      signalDeskBriefFocusTimer = null;
    }
    clearSignalDeskBootstrapCollapse();
    if (signalDeskHeaderTransitionTimer !== null) {
      window.clearTimeout(signalDeskHeaderTransitionTimer);
      signalDeskHeaderTransitionTimer = null;
    }
    if (signalDeskHeaderAnnouncementTimer !== null) {
      window.clearTimeout(signalDeskHeaderAnnouncementTimer);
      signalDeskHeaderAnnouncementTimer = null;
    }
    if (signalDeskPersistenceDraftTimer !== null) {
      window.clearTimeout(signalDeskPersistenceDraftTimer);
      signalDeskPersistenceDraftTimer = null;
    }
    stopSignalDeskPollingFallback();
    window.MarkStreetCRMChatRealtime?.disconnect();
  });

  signalDeskIsHydrating = true;
  const persistedSignalDeskSnapshot = persistence?.load() || null;
  const persistedRuntimeCredentials = persistence?.loadRuntimeCredentials() || null;
  const persistedConversationId = persistedSignalDeskSnapshot?.conversation?.conversationId;
  const hasCredentialConflict = Boolean(
    persistedRuntimeCredentials
    && (
      !persistedConversationId
      || Number(persistedRuntimeCredentials.conversationId)
        !== Number(persistedConversationId)
    )
  );
  if (hasCredentialConflict) persistence?.clearRuntimeCredentials();
  signalDeskPendingRuntimeCredentials = hasCredentialConflict
    ? null
    : persistedRuntimeCredentials;
  const didHydrateSignalDesk = hydrateSignalDeskFromPersistence(
    persistedSignalDeskSnapshot,
    {
      hasRuntimeCredentials: Boolean(signalDeskPendingRuntimeCredentials),
      credentialConflict: hasCredentialConflict,
    }
  );
  setSignalDeskRealtimeStatus('idle', { connectionChange: false });
  if (didHydrateSignalDesk) {
    const restoredState = (
      signalDeskSession.guidedIntake.status !== 'idle'
      || currentConversationPhase !== SIGNAL_DESK_CONVERSATION_PHASES.INTAKE
    )
      ? SIGNAL_DESK_STATES.CONVERSATION
      : SIGNAL_DESK_STATES.INTRO;
    setSignalDeskConversationPhase(currentConversationPhase);
    setSignalDeskState(restoredState, { moveFocus: false });
    if (
      restoredState === SIGNAL_DESK_STATES.CONVERSATION
      && currentConversationPhase === SIGNAL_DESK_CONVERSATION_PHASES.INTAKE
      && signalDeskSession.guidedIntake.status === 'active'
    ) {
      appendSignalDeskIntakeQuestion(getCurrentSignalDeskQuestion(), { animate: false });
    }
    if (!signalDeskSession.presentation.isRestoringSession) {
      restoreSignalDeskComposerDraft();
    }
    renderSignalDeskMessages({ forceScroll: true });
  } else {
    setSignalDeskState(SIGNAL_DESK_STATES.INTRO, { moveFocus: false });
  }
  signalDeskIsHydrating = false;
  if (signalDeskRestoredPanelWasOpen) openSignalDesk();
  if (signalDeskPendingRuntimeCredentials) {
    restoreSignalDeskConversationFromSession(signalDeskPendingRuntimeCredentials);
  }
})();
