/*
=====================================================
MARKSTREET CONTACT FORM — CRM INTEGRATION
=====================================================

Flow:

1. Validate the visitor form.
2. Start a CRM conversation.
3. Receive conversation_id and visitor_token.
4. Send the visitor's inquiry as the first CRM message.
5. Show success only after both API calls succeed.

CRM API:
https://tamastore.ir

The browser uses a public widget key only.
No private CRM credentials belong in this file.

=====================================================
*/

(() => {
  const CRM_CONTACT_CONFIG = {
    apiBase: "https://tamastore.ir",
    publicKey: "LCO5CXBCf818GWIvsCdvuHmMqQ08EF26",
  };

  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const submitButton = form.querySelector("[data-contact-submit]");
  const status = form.querySelector("[data-contact-status]");
  const requiredTextFields = [
    ["first_name", "firstName", "Please enter your first name."],
    ["last_name", "lastName", "Please enter your last name."],
    ["email", "email", "Please enter your email address."],
    ["message", "message", "Please enter a message."],
  ];
  let isSubmitting = false;

  function getDeviceType() {
    if (window.innerWidth < 768) return "mobile";
    if (window.innerWidth <= 1024) return "tablet";
    return "desktop";
  }

  function getTrimmedFormData() {
    const source = new FormData(form);

    return {
      firstName: String(source.get("first_name") || "").trim(),
      lastName: String(source.get("last_name") || "").trim(),
      email: String(source.get("email") || "").trim(),
      phone: String(source.get("phone") || "").trim(),
      company: String(source.get("company") || "").trim(),
      inquiryType: String(source.get("inquiry_type") || "").trim(),
      message: String(source.get("message") || "").trim(),
    };
  }

  function buildContactMessage(formData) {
    const sections = ["New MarkStreet Website Inquiry"];

    if (formData.company) {
      sections.push(`Company: ${formData.company}`);
    }

    if (formData.inquiryType) {
      sections.push(`Inquiry Type: ${formData.inquiryType}`);
    }

    sections.push(`Message:\n${formData.message}`);
    return sections.join("\n\n");
  }

  function validateRequiredText(formData) {
    requiredTextFields.forEach(([fieldName, dataKey, validationMessage]) => {
      const field = form.elements[fieldName];
      field?.setCustomValidity(formData[dataKey] ? "" : validationMessage);
    });

    return form.checkValidity();
  }

  async function requestJson(path, options) {
    let response;

    try {
      response = await fetch(`${CRM_CONTACT_CONFIG.apiBase}${path}`, options);
    } catch (error) {
      throw new Error("CRM request could not reach the server", { cause: error });
    }

    const responseText = await response.text();
    let responseData = null;

    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`CRM returned invalid JSON (HTTP ${response.status})`, {
          cause: error,
        });
      }
    }

    if (!response.ok) {
      const errorCode = responseData?.error?.code || responseData?.code;
      const detail = errorCode ? `, code ${String(errorCode)}` : "";
      throw new Error(`CRM request failed (HTTP ${response.status}${detail})`);
    }

    return responseData;
  }

  function extractConversationCredentials(response) {
    const data = response?.data || response;
    const conversationId = data?.conversation_id;
    const visitorToken = data?.visitor_token;
    const hasConversationId =
      (typeof conversationId === "number" && Number.isFinite(conversationId)) ||
      (typeof conversationId === "string" && conversationId.trim() !== "");

    if (!hasConversationId || typeof visitorToken !== "string" || !visitorToken.trim()) {
      throw new Error("CRM conversation response is missing required credentials");
    }

    return { conversationId, visitorToken };
  }

  function showStatus(type, primaryText, secondaryText = "") {
    if (!status) return;

    const primary = document.createElement("strong");
    primary.textContent = primaryText;
    status.replaceChildren(primary);

    if (secondaryText) {
      const secondary = document.createElement("span");
      secondary.textContent = secondaryText;
      status.append(secondary);
    }

    status.classList.remove("is-success", "is-error");
    status.classList.add("is-visible", `is-${type}`);
  }

  function clearStatus() {
    if (!status) return;
    status.replaceChildren();
    status.classList.remove("is-visible", "is-success", "is-error");
  }

  function setLoadingState(isLoading) {
    form.setAttribute("aria-busy", String(isLoading));
    if (!submitButton) return;

    if (isLoading) {
      submitButton.style.minWidth = `${submitButton.offsetWidth}px`;
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
      submitButton.textContent = "Sending...";
      return;
    }

    submitButton.disabled = false;
    submitButton.classList.remove("is-loading");
    submitButton.textContent = "Send Inquiry";
  }

  async function handleContactSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    clearStatus();
    const formData = getTrimmedFormData();

    if (!validateRequiredText(formData)) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    setLoadingState(true);

    try {
      const startResponse = await requestJson(
        "/api/v1/public/crm-chat/conversations/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_key: CRM_CONTACT_CONFIG.publicKey,
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            page_url: window.location.href,
            device_type: getDeviceType(),
          }),
        },
      );

      const { conversationId, visitorToken } =
        extractConversationCredentials(startResponse);

      await requestJson("/api/v1/public/crm-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_token: visitorToken,
          conversation_id: conversationId,
          body: buildContactMessage(formData),
        }),
      });

      form.reset();
      showStatus(
        "success",
        "Thank you. Your inquiry has been received.",
        "A member of the MarkStreet team will review your message and follow up where appropriate.",
      );
    } catch (error) {
      console.error("MarkStreet contact form CRM submission failed:", error);
      showStatus(
        "error",
        "We couldn't send your inquiry right now. Please try again in a moment.",
      );
    } finally {
      isSubmitting = false;
      setLoadingState(false);
    }
  }

  requiredTextFields.forEach(([fieldName]) => {
    const field = form.elements[fieldName];
    field?.addEventListener("input", () => {
      if (field.value.trim()) field.setCustomValidity("");
    });
  });

  form.addEventListener("submit", handleContactSubmit);
})();
