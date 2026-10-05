/*
=====================================================
MARKSTREET — SIGNAL DESK GUIDED INTAKE DOMAIN
=====================================================
*/

(() => {
  const INDUSTRY_OPTIONS = Object.freeze([
    { value: 'consumer-brands', label: 'Consumer Brands' },
    { value: 'technology', label: 'Technology' },
    { value: 'retail', label: 'Retail' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'finance', label: 'Finance' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'startups-scaleups', label: 'Startups & Scaleups' },
    { value: 'other', label: 'Other' },
  ].map(Object.freeze));

  const QUESTIONS = Object.freeze([
    {
      id: 'first-name',
      answerKey: 'firstName',
      targetGroup: 'identity',
      targetKey: 'firstName',
      prompt: "Before we open the line, what's your first name?",
      answerType: 'text',
      required: true,
      maxLength: 120,
      autocomplete: 'given-name',
      inputMode: 'text',
    },
    {
      id: 'last-name',
      answerKey: 'lastName',
      targetGroup: 'identity',
      targetKey: 'lastName',
      prompt: 'And your last name?',
      answerType: 'text',
      required: true,
      maxLength: 120,
      autocomplete: 'family-name',
      inputMode: 'text',
    },
    {
      id: 'email',
      answerKey: 'email',
      targetGroup: 'identity',
      targetKey: 'email',
      prompt: "What's the best work email to reach you?",
      answerType: 'email',
      required: true,
      maxLength: 255,
      autocomplete: 'email',
      inputMode: 'email',
    },
    {
      id: 'phone',
      answerKey: 'phone',
      targetGroup: 'identity',
      targetKey: 'phone',
      prompt: "What's the best phone number to reach you?",
      answerType: 'phone',
      required: true,
      minLength: 5,
      maxLength: 64,
      autocomplete: 'tel',
      inputMode: 'tel',
    },
    {
      id: 'industry',
      answerKey: 'industry',
      targetGroup: 'intake',
      targetKey: 'industry',
      prompt: 'Where does your business operate?',
      answerType: 'choice',
      required: true,
      options: INDUSTRY_OPTIONS,
    },
    {
      id: 'request',
      answerKey: 'request',
      targetGroup: 'intake',
      targetKey: 'request',
      prompt: 'What would you like us to help you with?',
      support: 'Tell us about the challenge, direction, or opportunity you want to work on.',
      answerType: 'multiline',
      required: true,
      minLength: 10,
      maxLength: 800,
    },
    {
      id: 'business-summary',
      answerKey: 'businessSummary',
      targetGroup: 'intake',
      targetKey: 'businessSummary',
      prompt: 'Describe your business in one line.',
      support: 'Tell us what you do and who you do it for.',
      answerType: 'multiline',
      required: true,
      maxLength: 220,
    },
  ].map(Object.freeze));

  const getQuestion = (indexOrId) => (
    typeof indexOrId === 'number'
      ? QUESTIONS[indexOrId] || null
      : QUESTIONS.find((question) => question.id === indexOrId) || null
  );

  function normalizeAnswer(questionOrId, answer) {
    const question = typeof questionOrId === 'string' ? getQuestion(questionOrId) : questionOrId;
    if (!question) return '';
    const normalized = typeof answer === 'string' ? answer.trim() : '';
    return question.answerType === 'choice' ? normalized.toLowerCase() : normalized;
  }

  function validateAnswer(questionOrId, answer) {
    const question = typeof questionOrId === 'string' ? getQuestion(questionOrId) : questionOrId;
    if (!question) return Object.freeze({ valid: false, value: '', error: 'This question is unavailable.' });

    const value = normalizeAnswer(question, answer);
    let error = '';

    if (question.required && !value) {
      error = 'Please enter an answer to continue.';
    } else if (question.minLength && value.length < question.minLength) {
      error = question.answerType === 'phone'
        ? `Enter a phone number with at least ${question.minLength} characters.`
        : `Please enter at least ${question.minLength} characters.`;
    } else if (question.maxLength && value.length > question.maxLength) {
      error = `Keep your answer under ${question.maxLength} characters.`;
    } else if (question.answerType === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      error = 'Enter a valid email address.';
    } else if (question.answerType === 'choice' && !question.options.some((option) => option.value === value)) {
      error = 'Choose one business field to continue.';
    } else if (question.id === 'request' && value.replace(/\s/g, '').length < question.minLength) {
      error = 'Please share at least 10 meaningful characters.';
    }

    return Object.freeze({ valid: !error, value, error });
  }

  function applyAnswer(session, questionOrId, answer) {
    const question = typeof questionOrId === 'string' ? getQuestion(questionOrId) : questionOrId;
    const result = validateAnswer(question, answer);
    if (!result.valid || !session?.[question.targetGroup]) return result;
    session[question.targetGroup][question.targetKey] = result.value;
    return result;
  }

  function getDisplayAnswer(questionOrId, answer) {
    const question = typeof questionOrId === 'string' ? getQuestion(questionOrId) : questionOrId;
    const value = normalizeAnswer(question, answer);
    if (!value && question?.allowSkip) return 'Skip for now';
    if (question?.answerType === 'choice') {
      return question.options.find((option) => option.value === value)?.label || value;
    }
    return value;
  }

  function getProgress(currentQuestionIndex, completedQuestionIds = []) {
    return Object.freeze({
      current: Math.min(completedQuestionIds.length, QUESTIONS.length),
      total: QUESTIONS.length,
      percentage: Math.round((Math.min(completedQuestionIds.length, QUESTIONS.length) / QUESTIONS.length) * 100),
      currentQuestionIndex,
    });
  }

  function validateSession(session) {
    const invalidQuestionIds = QUESTIONS.reduce((invalidIds, question) => {
      const answer = session?.[question.targetGroup]?.[question.targetKey];
      if (!validateAnswer(question, answer).valid) invalidIds.push(question.id);
      return invalidIds;
    }, []);
    return Object.freeze({
      valid: invalidQuestionIds.length === 0,
      invalidQuestionIds: Object.freeze(invalidQuestionIds),
    });
  }

  function normalizeSignalDeskIdentity(identity) {
    return Object.freeze({
      firstName: typeof identity?.firstName === 'string' ? identity.firstName.trim() : '',
      lastName: typeof identity?.lastName === 'string' ? identity.lastName.trim() : '',
      email: typeof identity?.email === 'string' ? identity.email.trim() : '',
      phone: typeof identity?.phone === 'string' ? identity.phone.trim() : '',
    });
  }

  function buildBriefSummary(identity, intake) {
    const industryValue = typeof intake?.industry === 'string' ? intake.industry.trim() : '';
    const industry = INDUSTRY_OPTIONS.find((option) => option.value === industryValue);
    return Object.freeze({
      industry: Object.freeze({
        value: industry?.value || industryValue,
        label: industry?.label || 'Other',
      }),
      request: typeof intake?.request === 'string' ? intake.request.trim() : '',
      businessSummary: typeof intake?.businessSummary === 'string'
        ? intake.businessSummary.trim()
        : '',
    });
  }

  function buildStructuredMessage(session) {
    const industry = INDUSTRY_OPTIONS.find((option) => option.value === session?.intake?.industry);
    return [
      'New MarkStreet Signal Desk Inquiry',
      '',
      'Industry:',
      industry?.label || 'Other',
      '',
      'What they need help with:',
      session?.intake?.request || '',
      '',
      'Business in one line:',
      session?.intake?.businessSummary || '',
    ].join('\n');
  }

  window.MarkStreetSignalDeskIntake = Object.freeze({
    QUESTIONS,
    INDUSTRY_OPTIONS,
    getQuestion,
    validateAnswer,
    normalizeAnswer,
    applyAnswer,
    getDisplayAnswer,
    getProgress,
    validateSession,
    normalizeSignalDeskIdentity,
    buildBriefSummary,
    buildStructuredMessage,
  });
})();
