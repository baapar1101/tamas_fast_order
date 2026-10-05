/*
=====================================================
MARKSTREET — CRM CHAT API CLIENT
=====================================================

Responsibilities:

- public CRM chat REST requests
- request timeout
- backend error normalization
- conversation creation
- message sending
- history loading
- current-page updates
- backend message normalization

This file does NOT:

- render UI
- manage Signal Desk state
- persist sessions
- open WebSocket connections

Public API is exposed through:

window.MarkStreetCRMChatAPI

=====================================================
*/

(() => {
  'use strict';

  const CRM_CHAT_CONFIG = Object.freeze({
    apiBase: 'https://tamastore.ir',
    publicKey: 'LCO5CXBCf818GWIvsCdvuHmMqQ08EF26',
    requestTimeoutMs: 15000,
    defaultMessageLimit: 100,
  });

  const SENSITIVE_KEY_PATTERN = /token|password|secret|authorization|api[_-]?key/i;

  class CRMChatAPIError extends Error {
    constructor({
      message,
      code = 'UNKNOWN_ERROR',
      status = null,
      details = null,
      fieldErrors = null,
      responseBody = null,
      endpoint = null,
      userMessage = 'The conversation service could not complete the request.',
    }) {
      super(message);
      this.name = 'CRMChatAPIError';
      this.code = code;
      this.status = status;
      this.details = details;
      this.fieldErrors = fieldErrors;
      this.responseBody = responseBody;
      this.endpoint = endpoint;
      this.userMessage = userMessage;
    }
  }

  function buildApiUrl(path) {
    if (typeof path !== 'string' || !path.startsWith('/api/v1/')) {
      throw createValidationError('path');
    }

    return new URL(path, `${CRM_CHAT_CONFIG.apiBase}/`).toString();
  }

  function createValidationError(field, message = `${field} is required.`) {
    return new CRMChatAPIError({
      message,
      code: 'INVALID_ARGUMENT',
      details: { field },
      fieldErrors: { [field]: [{ code: 'invalid', message }] },
      endpoint: '/api/v1/public/crm-chat/conversations/start',
      userMessage: 'Some information needs to be corrected before we can open your private line.',
    });
  }

  function requireTrimmedString(value, field) {
    if (typeof value !== 'string' || !value.trim()) {
      throw createValidationError(field);
    }

    return value.trim();
  }

  function normalizeConversationId(value) {
    const numericValue = typeof value === 'number'
      ? value
      : Number(String(value ?? '').trim());

    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
      throw createValidationError(
        'conversationId',
        'conversationId must be a positive integer.'
      );
    }

    return numericValue;
  }

  function normalizePageUrl(value) {
    const pageUrl = requireTrimmedString(value, 'pageUrl');

    try {
      const parsedUrl = new URL(pageUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
      return parsedUrl.toString();
    } catch {
      throw createValidationError('pageUrl', 'pageUrl must be a valid HTTP or HTTPS URL.');
    }
  }

  function redactString(value, sensitiveValues = []) {
    if (typeof value !== 'string') return value;

    return sensitiveValues.reduce((result, sensitiveValue) => {
      if (typeof sensitiveValue !== 'string' || sensitiveValue.length === 0) return result;
      return result.split(sensitiveValue).join('[REDACTED]');
    }, value);
  }

  function sanitizeValue(value, sensitiveValues = [], depth = 0) {
    if (depth > 4) return null;
    if (typeof value === 'string') return redactString(value, sensitiveValues);
    if (value === null || ['number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => sanitizeValue(item, sensitiveValues, depth + 1));
    }
    if (typeof value !== 'object') return null;

    return Object.entries(value).reduce((safeValue, [key, item]) => {
      if (!SENSITIVE_KEY_PATTERN.test(key)) {
        safeValue[key] = sanitizeValue(item, sensitiveValues, depth + 1);
      }
      return safeValue;
    }, {});
  }

  function getBackendErrorParts(payload) {
    const candidates = [
      payload?.error,
      payload?.detail?.error,
      payload?.detail,
      payload,
    ];
    const source = candidates.find((candidate) => (
      candidate && (typeof candidate === 'object' || typeof candidate === 'string')
    ));

    if (typeof source === 'string') {
      return { code: null, message: source, details: null };
    }

    return {
      code: source?.code || payload?.code || null,
      message: source?.message || payload?.message || null,
      details: source?.details || payload?.details || null,
    };
  }

  function normalizeErrorFieldName(value) {
    if (typeof value !== 'string') return null;
    const field = value.trim().split('.').at(-1);
    return field && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(field) ? field : null;
  }

  function extractFieldErrors(payload, sensitiveValues = []) {
    const fieldErrors = {};
    const addFieldError = (fieldValue, messageValue, codeValue = 'invalid') => {
      const field = normalizeErrorFieldName(fieldValue);
      if (!field) return;
      const message = typeof messageValue === 'string' && messageValue.trim()
        ? redactString(messageValue.trim().slice(0, 240), sensitiveValues)
        : 'This value is invalid.';
      const code = typeof codeValue === 'string' && codeValue.trim()
        ? codeValue.trim().slice(0, 80)
        : 'invalid';
      fieldErrors[field] ||= [];
      fieldErrors[field].push({ code, message });
    };
    const visit = (candidate) => {
      if (Array.isArray(candidate)) {
        candidate.forEach((item) => {
          if (!item || typeof item !== 'object') return;
          const location = Array.isArray(item.loc) ? item.loc : [];
          addFieldError(
            item.field ?? item.name ?? location.at(-1),
            item.msg ?? item.message ?? item.detail,
            item.type ?? item.code
          );
        });
        return;
      }
      if (!candidate || typeof candidate !== 'object') return;
      Object.entries(candidate).forEach(([field, errors]) => {
        if (Array.isArray(errors)) {
          errors.forEach((error) => {
            if (typeof error === 'string') addFieldError(field, error);
            else if (error && typeof error === 'object') {
              addFieldError(field, error.msg ?? error.message, error.type ?? error.code);
            }
          });
        } else if (typeof errors === 'string') {
          addFieldError(field, errors);
        }
      });
    };

    [
      payload?.error?.details,
      payload?.error?.errors,
      payload?.errors,
      payload?.data?.errors,
      payload?.detail?.errors,
      Array.isArray(payload?.detail) ? payload.detail : null,
    ].forEach(visit);

    if (payload?.error?.code === 'CRM_CHAT_INVALID_EMAIL' && !fieldErrors.email) {
      addFieldError('email', payload.error.message, payload.error.code);
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
  }

  function getErrorUserMessage(status) {
    if (status === 401 || status === 403) {
      return 'The conversation session could not be authorized. Please start again.';
    }
    if (status === 404) return 'The conversation could not be found.';
    if (status === 429) return 'Too many requests were made. Please try again shortly.';
    return 'The conversation service could not complete the request.';
  }

  function normalizeBackendError(payload, status, sensitiveValues = [], endpoint = null) {
    const backendError = getBackendErrorParts(payload);
    const code = redactString(backendError.code || `HTTP_${status || 'ERROR'}`, sensitiveValues);
    const message = redactString(
      backendError.message || `CRM chat request failed with status ${status || 'unknown'}.`,
      sensitiveValues
    );

    return new CRMChatAPIError({
      message,
      code,
      status: status || null,
      details: sanitizeValue(backendError.details, sensitiveValues),
      fieldErrors: extractFieldErrors(payload, sensitiveValues),
      responseBody: sanitizeValue(payload, sensitiveValues),
      endpoint,
      userMessage: status === 422
        ? 'Some information needs to be corrected before we can open your private line.'
        : getErrorUserMessage(status),
    });
  }

  async function requestJson(url, options = {}) {
    const {
      timeoutMs = CRM_CHAT_CONFIG.requestTimeoutMs,
      sensitiveValues = [],
      ...fetchOptions
    } = options;
    const controller = new AbortController();
    const endpoint = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return null;
      }
    })();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      const responseText = await response.text();
      let payload = null;

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          if (!response.ok) {
            throw normalizeBackendError(null, response.status, sensitiveValues, endpoint);
          }
          throw new CRMChatAPIError({
            message: 'CRM chat returned an invalid JSON response.',
            code: 'INVALID_JSON_RESPONSE',
            status: response.status,
            endpoint,
            userMessage: 'The conversation service returned an unexpected response.',
          });
        }
      }

      if (!response.ok || payload?.success === false) {
        throw normalizeBackendError(payload, response.status, sensitiveValues, endpoint);
      }

      return payload;
    } catch (error) {
      if (error instanceof CRMChatAPIError) throw error;

      if (didTimeout || error?.name === 'AbortError') {
        throw new CRMChatAPIError({
          message: 'CRM chat request timed out.',
          code: 'REQUEST_TIMEOUT',
          endpoint,
          userMessage: 'The request took too long. Please try again.',
        });
      }

      throw new CRMChatAPIError({
        message: 'CRM chat network request failed.',
        code: 'NETWORK_ERROR',
        endpoint,
        userMessage: "We couldn't reach the conversation service. Please try again.",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function extractResponseData(response) {
    if (!response || typeof response !== 'object') return response;
    return response.data !== undefined ? response.data : response;
  }

  function normalizeFile(file, fallbackId = null) {
    if (!file && !fallbackId) return null;
    const source = file && typeof file === 'object' ? file : {};
    const rawFileSize = source.file_size ?? source.fileSize;

    return {
      id: source.id ?? source.file_storage_id ?? fallbackId ?? null,
      originalName: source.original_name ?? source.originalName ?? source.name ?? null,
      fileSize: rawFileSize !== null && rawFileSize !== undefined && Number.isFinite(Number(rawFileSize))
        ? Number(rawFileSize)
        : null,
      mimeType: source.mime_type ?? source.mimeType ?? null,
    };
  }

  function normalizeMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new CRMChatAPIError({
        message: 'CRM chat returned an invalid message object.',
        code: 'INVALID_MESSAGE',
        userMessage: 'A conversation message could not be loaded.',
      });
    }

    const rawRole = message.sender_role ?? message.senderRole;
    const senderRole = ['visitor', 'agent', 'system'].includes(rawRole) ? rawRole : 'system';
    const formattedCreatedAt = message.created_at_formatted ?? message.createdAtFormatted;

    return {
      id: message.id === undefined || message.id === null ? null : String(message.id),
      conversationId: message.conversation_id ?? message.conversationId ?? null,
      senderRole,
      senderName: message.sender_name ?? message.senderName ?? null,
      body: typeof message.body === 'string' ? message.body : '',
      createdAt: message.created_at ?? message.createdAt ?? null,
      displayTime: formattedCreatedAt?.time_only ?? formattedCreatedAt?.timeOnly ?? null,
      file: normalizeFile(message.file, message.file_storage_id ?? null),
    };
  }

  function looksLikeMessage(value) {
    return Boolean(
      value && typeof value === 'object' && !Array.isArray(value)
      && ('sender_role' in value || 'senderRole' in value)
      && 'body' in value
    );
  }

  function getDeviceType() {
    const viewportWidth = window.innerWidth;
    if (viewportWidth < 768) return 'mobile';
    if (viewportWidth <= 1024) return 'tablet';
    return 'desktop';
  }

  function normalizeStartConversationString(value, field, { minLength = 1, maxLength } = {}) {
    const normalized = requireTrimmedString(value, field);
    if (normalized.length < minLength) {
      throw createValidationError(field, `${field} must be at least ${minLength} characters.`);
    }
    if (maxLength && normalized.length > maxLength) {
      throw createValidationError(field, `${field} must be no more than ${maxLength} characters.`);
    }
    return normalized;
  }

  function buildStartConversationPayload({
    firstName,
    lastName,
    email,
    phone,
    pageUrl,
    deviceType,
  }) {
    const normalizedDeviceType = deviceType === undefined
      ? getDeviceType()
      : requireTrimmedString(deviceType, 'deviceType');

    if (!['mobile', 'tablet', 'desktop'].includes(normalizedDeviceType)) {
      throw createValidationError('deviceType', 'deviceType must be mobile, tablet, or desktop.');
    }

    const normalizedEmail = normalizeStartConversationString(email, 'email', { maxLength: 255 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw createValidationError('email', 'email must be a valid email address.');
    }

    const normalizedPageUrl = normalizePageUrl(pageUrl);
    if (normalizedPageUrl.length > 2048) {
      throw createValidationError('pageUrl', 'pageUrl must be no more than 2048 characters.');
    }

    return {
      public_key: CRM_CHAT_CONFIG.publicKey,
      first_name: normalizeStartConversationString(firstName, 'firstName', { maxLength: 120 }),
      last_name: normalizeStartConversationString(lastName, 'lastName', { maxLength: 120 }),
      email: normalizedEmail,
      phone: normalizeStartConversationString(phone, 'phone', { minLength: 5, maxLength: 64 }),
      page_url: normalizedPageUrl,
      device_type: normalizedDeviceType,
    };
  }

  async function startConversation({
    firstName,
    lastName,
    email,
    phone = '',
    pageUrl,
    deviceType,
  } = {}) {
    const payload = buildStartConversationPayload({
      firstName,
      lastName,
      email,
      phone,
      pageUrl,
      deviceType,
    });

    const response = await requestJson(buildApiUrl('/api/v1/public/crm-chat/conversations/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      sensitiveValues: [
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone,
      ],
    });
    const data = extractResponseData(response);
    const rawConversationId = data?.conversation_id ?? data?.conversationId;
    const visitorToken = data?.visitor_token ?? data?.visitorToken;

    let conversationId;
    try {
      conversationId = normalizeConversationId(rawConversationId);
    } catch {
      conversationId = null;
    }

    if (!conversationId || typeof visitorToken !== 'string' || !visitorToken.trim()) {
      throw new CRMChatAPIError({
        message: 'CRM chat start response did not include complete session credentials.',
        code: 'INVALID_START_RESPONSE',
        userMessage: 'The conversation could not be started. Please try again.',
      });
    }

    return {
      conversationId,
      visitorToken: visitorToken.trim(),
      widgetId: data.widget_id ?? data.widgetId ?? null,
    };
  }

  async function sendMessage({ visitorToken, conversationId, body } = {}) {
    const normalizedVisitorToken = requireTrimmedString(visitorToken, 'visitorToken');
    const normalizedConversationId = normalizeConversationId(conversationId);
    const normalizedBody = requireTrimmedString(body, 'body');
    const response = await requestJson(buildApiUrl('/api/v1/public/crm-chat/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_token: normalizedVisitorToken,
        conversation_id: normalizedConversationId,
        body: normalizedBody,
      }),
      sensitiveValues: [normalizedVisitorToken],
    });
    const data = extractResponseData(response);
    const message = data?.message && typeof data.message === 'object' ? data.message : data;

    // A successful acknowledgement without a message body is represented as null.
    return looksLikeMessage(message) ? normalizeMessage(message) : null;
  }

  async function getMessages({
    visitorToken,
    conversationId,
    limit = CRM_CHAT_CONFIG.defaultMessageLimit,
  } = {}) {
    const normalizedVisitorToken = requireTrimmedString(visitorToken, 'visitorToken');
    const normalizedConversationId = normalizeConversationId(conversationId);
    const numericLimit = Number(limit);
    const normalizedLimit = Number.isFinite(numericLimit)
      ? Math.min(100, Math.max(1, Math.trunc(numericLimit)))
      : CRM_CHAT_CONFIG.defaultMessageLimit;
    const path = `/api/v1/public/crm-chat/conversations/${encodeURIComponent(normalizedConversationId)}/messages`;
    const url = new URL(buildApiUrl(path));
    url.searchParams.set('limit', String(normalizedLimit));
    const response = await requestJson(url.toString(), {
      method: 'GET',
      headers: { 'X-Visitor-Token': normalizedVisitorToken },
      sensitiveValues: [normalizedVisitorToken],
    });
    const data = extractResponseData(response);
    const messages = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.messages) ? data.messages : null;

    if (!messages) {
      throw new CRMChatAPIError({
        message: 'CRM chat message history response had an invalid structure.',
        code: 'INVALID_MESSAGES_RESPONSE',
        userMessage: 'The conversation history could not be loaded.',
      });
    }

    const normalizedMessages = messages.map(normalizeMessage);
    console.debug('[Signal Desk] History response parsed', {
      messageCount: normalizedMessages.length,
      agentCount: normalizedMessages.filter((message) => message.senderRole === 'agent').length,
      visitorCount: normalizedMessages.filter((message) => message.senderRole === 'visitor').length,
    });
    return normalizedMessages;
  }

  async function updateCurrentPage({ visitorToken, conversationId, pageUrl } = {}) {
    const normalizedVisitorToken = requireTrimmedString(visitorToken, 'visitorToken');
    const normalizedConversationId = normalizeConversationId(conversationId);
    const path = `/api/v1/public/crm-chat/conversations/${encodeURIComponent(normalizedConversationId)}/current-page`;
    const response = await requestJson(buildApiUrl(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Token': normalizedVisitorToken,
      },
      body: JSON.stringify({ page_url: normalizePageUrl(pageUrl) }),
      sensitiveValues: [normalizedVisitorToken],
    });

    return sanitizeValue(extractResponseData(response), [normalizedVisitorToken]);
  }

  window.MarkStreetCRMChatAPI = Object.freeze({
    startConversation,
    sendMessage,
    getMessages,
    updateCurrentPage,
    normalizeMessage,
    getDeviceType,
  });
})();
