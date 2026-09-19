# Sync Decision Table

When to sync, what direction, and under what conditions.

## Order to CRM
| Trigger | Direction | Condition | Debounce | Blocking |
|---------|-----------|-----------|----------|----------|
| Order placed | Site → CRM | Always (user-facing) | 500ms (debounce by orderCode) | No (fire-and-forget) |
| Order status updated locally | Site → CRM | Manual sync endpoint | N/A | No |
| Payment processed | CRM → Site | Webhook, HMAC valid | N/A | No |
| Order status changed in CRM | CRM → Site | Webhook, HMAC valid, eventId not replayed | N/A | No |

## Customer/Person to CRM
| Trigger | Direction | Condition | Blocking |
|---------|-----------|-----------|----------|
| User registers (OTP verified) | Site → CRM | Always | No |
| Profile updated | Site → CRM | `CRM_SYNC_ENABLED=true` and fields changed | No |
| Identity verified (national code + DOB) | Site → CRM | Always | No |
| Customer updated in CRM | CRM → Site | Webhook, HMAC valid | No |

## Product to CRM
| Trigger | Direction | Condition | Blocking |
|---------|-----------|-----------|----------|
| Product created | Site → CRM | `CRM_SYNC_ENABLED=true` | No |
| Product updated | Site → CRM | `CRM_SYNC_ENABLED=true` and fields changed | No |
| Stock level changed | Site → CRM | Manual sync endpoint or webhook from CRM | No |
| Inventory update from CRM | CRM → Site | Webhook, HMAC valid | No |

## Chat/Messages
| Trigger | Direction | Condition | Blocking |
|---------|-----------|-----------|----------|
| Visitor message on site | Site → CRM | `sendChatMessage()` called | No |
| CRM agent message | CRM → Site | Webhook, HMAC valid | No |
| Chat status updated | CRM → Site | Webhook, HMAC valid | No |

## Sync Behavior Rules
1. **Debounce**: When triggered by user action (order placed), debounce by entity ID to avoid duplicate pushes within the configured delay.
2. **Toggling**: All sync types check `CRM_SYNC_ENABLED === 'true'` (env var, not admin setting). Default to disabled for safety.
3. **Failure handling**: All outbound sync failures are logged but never thrown. User operations complete successfully regardless of CRM status.
4. **Inbound validation**: Webhooks MUST have valid HMAC signature; otherwise reject with 401 and log the attempt.
5. **Idempotency**: Process each eventId once per 24-hour window. Replayed events return 200 OK without side effects.