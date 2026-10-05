/*
=====================================================
MARKSTREET — CRM CHAT REALTIME TRANSPORT
=====================================================

Owns the authenticated visitor WebSocket connection,
safe event normalization and controlled reconnection.
It does not render UI or persist conversation data.

=====================================================
*/

(() => {
  'use strict';

  const WEBSOCKET_URL = 'wss://tamastore.ir/ws/crm-chat';
  const AUTHENTICATION_TIMEOUT_MS = 10000;
  const MAX_RECONNECT_DELAY_MS = 20000;
  const STATUS = Object.freeze({
    IDLE: 'idle',
    CONNECTING: 'connecting',
    AUTHENTICATING: 'authenticating',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    OFFLINE: 'offline',
    CLOSED: 'closed',
  });
  const VALID_STATUSES = new Set(Object.values(STATUS));

  let status = STATUS.IDLE;
  let socket = null;
  let activeConnection = null;
  let reconnectTimer = null;
  let authenticationTimer = null;
  let reconnectAttempt = 0;
  let intentionalShutdown = false;
  let authBlocked = false;

  function normalizeConversationId(value) {
    const numericValue = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
      throw new TypeError('conversationId must be a positive integer.');
    }
    return numericValue;
  }

  function validateCallback(callback, name) {
    if (callback !== undefined && callback !== null && typeof callback !== 'function') {
      throw new TypeError(`${name} must be a function when provided.`);
    }
    return typeof callback === 'function' ? callback : null;
  }

  function safeInvoke(callback, ...args) {
    if (!callback) return;
    try {
      callback(...args);
    } catch (error) {
      console.error('[CRM Realtime] Consumer callback failed', {
        code: 'CONSUMER_CALLBACK_FAILED',
        conversationId: activeConnection?.conversationId ?? null,
        status,
      });
    }
  }

  function setStatus(nextStatus) {
    if (!VALID_STATUSES.has(nextStatus)) return;
    status = nextStatus;
    safeInvoke(activeConnection?.onStatusChange, status, {
      attempt: reconnectAttempt,
      conversationId: activeConnection?.conversationId ?? null,
    });
  }

  function reportError(code) {
    const safeError = Object.freeze({
      code,
      conversationId: activeConnection?.conversationId ?? null,
      status,
    });
    console.error('[CRM Realtime] Socket error', safeError);
    safeInvoke(activeConnection?.onError, safeError);
  }

  function clearReconnectTimer() {
    if (reconnectTimer === null) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function clearAuthenticationTimer() {
    if (authenticationTimer === null) return;
    clearTimeout(authenticationTimer);
    authenticationTimer = null;
  }

  function closeCurrentSocket(code = 1000, reason = 'Client disconnect') {
    const currentSocket = socket;
    socket = null;
    if (!currentSocket) return;
    currentSocket.onopen = null;
    currentSocket.onmessage = null;
    currentSocket.onerror = null;
    currentSocket.onclose = null;
    if (currentSocket.readyState === WebSocket.CONNECTING || currentSocket.readyState === WebSocket.OPEN) {
      currentSocket.close(code, reason);
    }
  }

  function scheduleReconnect() {
    if (
      intentionalShutdown
      || authBlocked
      || !activeConnection
      || reconnectTimer !== null
      || !navigator.onLine
    ) return;

    reconnectAttempt += 1;
    setStatus(STATUS.RECONNECTING);
    const baseDelay = Math.min(1000 * (2 ** (reconnectAttempt - 1)), MAX_RECONNECT_DELAY_MS);
    const jitteredDelay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      Math.round(baseDelay * (0.85 + (Math.random() * 0.3)))
    );

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket(true);
    }, jitteredDelay);
  }

  function getRawEventMessage(frame) {
    const candidates = [
      frame?.payload?.message,
      frame?.data?.message,
      frame?.message,
      frame?.payload?.data?.message,
      frame?.data?.payload?.message,
      frame?.payload,
      frame?.data,
    ];

    return candidates.find((candidate) => (
      candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      && ('sender_role' in candidate || 'senderRole' in candidate)
      && ('body' in candidate || 'file' in candidate || 'file_storage_id' in candidate)
    )) || null;
  }

  function handleAuthFailure() {
    authBlocked = true;
    clearReconnectTimer();
    clearAuthenticationTimer();
    reportError('AUTHENTICATION_FAILED');
    closeCurrentSocket(1000, 'Authentication failed');
    if (activeConnection) activeConnection.visitorToken = '';
    setStatus(STATUS.CLOSED);
  }

  function handleIncomingFrame(event) {
    if (!activeConnection || typeof event?.data !== 'string') return;

    let frame;
    try {
      frame = JSON.parse(event.data);
    } catch {
      reportError('MALFORMED_FRAME');
      return;
    }

    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return;

    if (frame.type === 'auth_ok') {
      let responseConversationId;
      try {
        responseConversationId = normalizeConversationId(frame.conversation_id ?? frame.conversationId);
      } catch {
        handleAuthFailure();
        return;
      }

      if (frame.role !== 'visitor' || responseConversationId !== activeConnection.conversationId) {
        handleAuthFailure();
        return;
      }

      authBlocked = false;
      clearAuthenticationTimer();
      reconnectAttempt = 0;
      setStatus(STATUS.CONNECTED);
      return;
    }

    if (frame.type === 'auth_error' || frame.type === 'authentication_error') {
      handleAuthFailure();
      return;
    }

    if (frame.type === 'error' && /auth/i.test(String(frame.code ?? frame.error ?? ''))) {
      handleAuthFailure();
      return;
    }

    if (frame.type === 'ping' || frame.type === 'heartbeat') {
      if (status === STATUS.CONNECTED && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
      return;
    }

    if (frame.type !== 'crm_chat.event' || frame.event !== 'message.created') return;

    const rawMessage = getRawEventMessage(frame);
    if (!rawMessage) {
      reportError('INVALID_MESSAGE_EVENT');
      return;
    }

    let normalizedMessage;
    try {
      normalizedMessage = window.MarkStreetCRMChatAPI?.normalizeMessage(rawMessage);
    } catch {
      reportError('MESSAGE_NORMALIZATION_FAILED');
      return;
    }

    let messageConversationId;
    try {
      messageConversationId = normalizeConversationId(normalizedMessage?.conversationId);
    } catch {
      reportError('INVALID_MESSAGE_CONVERSATION');
      return;
    }

    if (messageConversationId !== activeConnection.conversationId) return;
    safeInvoke(activeConnection.onMessage, normalizedMessage);
  }

  function openSocket(isReconnect = false) {
    if (intentionalShutdown || authBlocked || !activeConnection) return;
    if (!navigator.onLine) {
      setStatus(STATUS.OFFLINE);
      return;
    }
    if (socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(socket.readyState)) return;

    clearReconnectTimer();
    setStatus(isReconnect ? STATUS.RECONNECTING : STATUS.CONNECTING);

    let nextSocket;
    try {
      nextSocket = new WebSocket(WEBSOCKET_URL);
    } catch {
      reportError('SOCKET_CREATION_FAILED');
      scheduleReconnect();
      return;
    }
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket || !activeConnection) return;
      setStatus(STATUS.AUTHENTICATING);
      nextSocket.send(JSON.stringify({
        type: 'auth',
        role: 'visitor',
        visitor_token: activeConnection.visitorToken,
        conversation_id: activeConnection.conversationId,
      }));
      clearAuthenticationTimer();
      authenticationTimer = setTimeout(() => {
        if (socket !== nextSocket || status !== STATUS.AUTHENTICATING) return;
        reportError('AUTHENTICATION_TIMEOUT');
        closeCurrentSocket(4000, 'Authentication timeout');
        scheduleReconnect();
      }, AUTHENTICATION_TIMEOUT_MS);
    };

    nextSocket.onmessage = (event) => {
      if (socket === nextSocket) handleIncomingFrame(event);
    };

    nextSocket.onerror = () => {
      if (socket !== nextSocket) return;
      reportError('SOCKET_ERROR');
      clearAuthenticationTimer();
      closeCurrentSocket(1011, 'Socket error');
      scheduleReconnect();
    };

    nextSocket.onclose = () => {
      clearAuthenticationTimer();
      if (socket === nextSocket) socket = null;
      if (intentionalShutdown || authBlocked || !activeConnection) return;
      if (!navigator.onLine) {
        setStatus(STATUS.OFFLINE);
        return;
      }
      scheduleReconnect();
    };
  }

  function disconnect() {
    intentionalShutdown = true;
    authBlocked = false;
    clearReconnectTimer();
    clearAuthenticationTimer();
    closeCurrentSocket();
    if (activeConnection) {
      activeConnection.visitorToken = '';
      activeConnection = null;
    }
    reconnectAttempt = 0;
    setStatus(STATUS.CLOSED);
  }

  function connect({
    visitorToken,
    conversationId,
    onMessage,
    onStatusChange,
    onError,
  } = {}) {
    if (typeof visitorToken !== 'string' || !visitorToken.trim()) {
      throw new TypeError('visitorToken is required.');
    }

    const normalizedConversationId = normalizeConversationId(conversationId);
    const callbacks = {
      onMessage: validateCallback(onMessage, 'onMessage'),
      onStatusChange: validateCallback(onStatusChange, 'onStatusChange'),
      onError: validateCallback(onError, 'onError'),
    };

    if (activeConnection?.conversationId === normalizedConversationId) {
      Object.assign(activeConnection, callbacks);
      activeConnection.visitorToken = visitorToken.trim();
      intentionalShutdown = false;
      if (authBlocked) authBlocked = false;
      safeInvoke(activeConnection.onStatusChange, status, {
        attempt: reconnectAttempt,
        conversationId: normalizedConversationId,
      });
      if (
        !socket
        && reconnectTimer === null
        && !authBlocked
        && !intentionalShutdown
        && status !== STATUS.CONNECTED
      ) openSocket(status === STATUS.RECONNECTING);
      return status;
    }

    if (activeConnection || socket || reconnectTimer !== null) disconnect();

    activeConnection = {
      visitorToken: visitorToken.trim(),
      conversationId: normalizedConversationId,
      ...callbacks,
    };
    intentionalShutdown = false;
    authBlocked = false;
    reconnectAttempt = 0;
    openSocket(false);
    return status;
  }

  window.addEventListener('offline', () => {
    if (!activeConnection || intentionalShutdown) return;
    clearReconnectTimer();
    closeCurrentSocket(1000, 'Browser offline');
    setStatus(STATUS.OFFLINE);
  });

  window.addEventListener('online', () => {
    if (!activeConnection || intentionalShutdown || authBlocked || status === STATUS.CONNECTED) return;
    openSocket(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState !== 'visible'
      || !activeConnection
      || intentionalShutdown
      || authBlocked
      || status === STATUS.CONNECTED
    ) return;
    openSocket(true);
  });

  window.MarkStreetCRMChatRealtime = Object.freeze({
    connect,
    disconnect,
    getStatus: () => status,
  });
})();
