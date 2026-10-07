# SMS WebService API — V3

> Markdown reference for the V3 API exposed by the SMS WebService / Payam Resan service.
>
> Original Swagger UI: https://api.sms-webservice.com/swagger/ui/index#/V3  
> Production base URL: `https://api.sms-webservice.com/api/V3`  
> Sandbox base URL: `https://api.sms-webservice.com/api/V3SandBox`

## Important behavior

- Every API request requires an `ApiKey`.
- For `GET` endpoints, `ApiKey` is a query parameter.
- For `POST` endpoints, `ApiKey` is included in the JSON body.
- Existing API methods normally return HTTP `200` even when the operation fails.
- Treat the response field `Success` as the authoritative success indicator.
- `ErrorCode` and `Error` are meaningful when `Success` is `false`.
- Recipient numbers should be supplied without a leading `0`, e.g. `9121112222` or `989121112222`.
- A request supports up to **99 recipients**.
- Prefer POST-based methods in production so secrets and OTP values do not appear in URLs/logs.
- The sandbox behaves like production without sending SMS or consuming credit. `TokenList` is not implemented on the sandbox.

## Common response envelope

```json
{
  "Success": true,
  "ErrorCode": null,
  "Error": null,
  "Result": {}
}
```

On failure:

```json
{
  "Success": false,
  "ErrorCode": 9,
  "Error": "مقادیر ورودی نادرست است",
  "Result": null
}
```

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/Send` | Send one text to one or more recipients |
| `POST` | `/SendBulk` | Send one text to multiple recipients with trace IDs |
| `POST` | `/SendMultiple` | Send different texts/senders to different recipients |
| `GET` | `/SendTokenSingle` | Send a template to one recipient |
| `POST` | `/SendTokenSingle` | Send a template to one recipient using JSON |
| `POST` | `/SendTokenMulti` | Send one template to multiple recipients |
| `POST` | `/TokenList` | List message templates |
| `POST` | `/StatusById` | Query SMS status by service IDs |
| `POST` | `/StatusByUserTraceId` | Query SMS status by your trace IDs |
| `POST` | `/AccountInfo` | Get credit and available sender lines |
| `POST` | `/GetInbox` | Get incoming messages |

---

## `GET /Send`

Send the same SMS text to up to 99 recipients.

### Query parameters

| Parameter | Required | Type | Description |
|---|---:|---|---|
| `ApiKey` | Yes | string | Account API key |
| `Text` | Yes | string | SMS text |
| `Sender` | Yes | int64 | Active sender line |
| `Recipients` | Yes | string | Comma-separated recipient numbers |

Example:

```http
GET /api/V3/Send?ApiKey=123456-XXXXXXXXXXXXXXX&Text=Hello&Sender=30004040&Recipients=9121112222,9121113333
```

Do not URL-encode the message twice. Standard HTTP libraries normally encode query parameters for you.

### Response

```json
{
  "Success": true,
  "ErrorCode": null,
  "Error": null,
  "Result": [
    {
      "Id": 9903211,
      "UserTraceId": 9903211
    }
  ]
}
```

For production workloads, `SendBulk` is preferred because the API key stays out of the URL and each recipient can have a `UserTraceId`.

---

## `POST /SendBulk`

Send the same text to multiple recipients and assign your own tracking ID to each recipient.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "Text": "Your verification code is 123456",
  "Sender": 30004040,
  "Recipients": [
    {
      "Destination": 9121112222,
      "UserTraceId": 45001
    },
    {
      "Destination": 9121113333,
      "UserTraceId": 45002
    }
  ]
}
```

### Fields

| Field | Required | Type | Description |
|---|---:|---|---|
| `ApiKey` | Yes | string | Account API key |
| `Text` | Yes | string | Shared SMS text |
| `Sender` | Yes | int64 | Active sender line |
| `Recipients` | Yes | array | Max 99 recipients |
| `Recipients[].Destination` | Yes | int64 | Recipient number without leading zero |
| `Recipients[].UserTraceId` | No | int64 | Your tracking ID |

Use a unique `UserTraceId` per recipient. It is the safest way to determine whether an SMS was registered after a timeout or server-side error.

### Response

```json
{
  "Success": true,
  "ErrorCode": null,
  "Error": null,
  "Result": [
    {
      "Id": 9903211,
      "UserTraceId": 45001
    }
  ]
}
```

---

## `POST /SendMultiple`

Send different text and/or sender values to different recipients.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "Recipients": [
    {
      "Sender": 30004040,
      "Text": "Order A has shipped",
      "Destination": 9121112222,
      "UserTraceId": 45001
    },
    {
      "Sender": 30004040,
      "Text": "Order B has shipped",
      "Destination": 9121113333,
      "UserTraceId": 45002
    }
  ]
}
```

### Recipient fields

| Field | Required | Type |
|---|---:|---|
| `Sender` | Yes | int64 |
| `Text` | Yes | string |
| `Destination` | Yes | int64 |
| `UserTraceId` | No | int64 |

---

## `GET /SendTokenSingle`

Send an approved template to one recipient.

Template placeholders `{1}` through `{10}` map to query parameters `p1` through `p10`.

### Query parameters

| Parameter | Required | Type |
|---|---:|---|
| `ApiKey` | Yes | string |
| `TemplateKey` | Yes | string |
| `Destination` | Yes | int64 |
| `p1` ... `p10` | No | string |

Example:

```http
GET /api/V3/SendTokenSingle?ApiKey=123456-XXXXXXXXXXXXXXX&TemplateKey=verifycode&Destination=9121112222&p1=123456
```

The sender line is selected by the template; there is no `Sender` input.

For OTPs, prefer the POST variant because it keeps both the API key and OTP values out of URLs and web-server logs.

---

## `POST /SendTokenSingle`

JSON equivalent of `GET /SendTokenSingle`.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "TemplateKey": "verifycode",
  "Destination": 9121112222,
  "p1": "123456"
}
```

Optional fields `p2` through `p10` correspond to template placeholders `{2}` through `{10}`.

### Response result item

```json
{
  "UserTraceId": null,
  "Id": 9903211,
  "Sender": 30004040,
  "FinalText": "Your verification code is 123456"
}
```

`UserTraceId` is normally `null` for `SendTokenSingle` because the method does not accept one.

---

## `POST /SendTokenMulti`

Send one approved template to several recipients, with different parameter values for each.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "TemplateKey": "postcode",
  "Recipients": [
    {
      "Destination": 9121112222,
      "UserTraceId": 45001,
      "Parameters": [
        "BARCODE-AAA",
        "Shiraz"
      ]
    }
  ]
}
```

`Parameters[0]` fills `{1}`, `Parameters[1]` fills `{2}`, etc.

Maximum recipients: **99**.

---

## `POST /TokenList`

Return templates defined for the account.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX"
}
```

### Response item

```json
{
  "Key": "verifycode",
  "TextTemplate": "Verification code: {1}",
  "VoiceTemplate": null,
  "Status": 2
}
```

### Template status

| Code | Meaning | Sendable |
|---:|---|---:|
| `1` | Pending review | No |
| `2` | Approved | Yes |
| `3` | Rejected | No |

The user panel distinguishes two rejection states, but the API returns `3` for both.

`TokenList` is not implemented on the sandbox server.

---

## `POST /StatusById`

Query message state using service-generated message IDs.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "Ids": [
    9903211,
    9903212
  ]
}
```

### Response item

```json
{
  "Id": 9903211,
  "UserTraceId": 45001,
  "StatusCode": 4,
  "Status": "تحویل به گوشی"
}
```

---

## `POST /StatusByUserTraceId`

Query message state using IDs assigned by your application.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX",
  "UserTraceIds": [
    45001,
    45002
  ]
}
```

This is especially useful after a timeout: check whether the message was registered before attempting to resend it.

---

## SMS status codes

| Code | Status | Disposition |
|---:|---|---|
| `0` | In system queue | Pending |
| `1` | Sent, no delivery status | Pending |
| `2` | Sent, queued | Pending |
| `3` | Waiting for handset delivery | Pending |
| `4` | Delivered to handset | Final |
| `5` | Not delivered to handset | Final |
| `6` | Send error | Final |
| `7` | Recipient blocked | Final |
| `8` | ID not found | Not found |
| `9` | Expired | Final |
| `10` | Unknown | Pending |
| `11` | Invalid/inactive recipient | Final |
| `12` | Recipient is in your account blacklist | Final |
| `13` | Invalid recipient | Final |
| `14` | Message text blocked | Final |
| `15` | Recipient opted out | Final |
| `16` | Blocked | Final |
| `17` | Daily send limit reached | Not sent |
| `18` | API send limit reached | Not sent |
| `19` | Nightly send limit reached | Not sent |
| `20` | Shared-line limit reached | Not sent |
| `21` | Account not authenticated | Not sent |

For `0`, `1`, `2`, `3`, and `10`, query again later; do **not** resend the SMS merely because the status is pending. Avoid polling more frequently than every few minutes.

---

## `POST /AccountInfo`

Return remaining credit and sender lines.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX"
}
```

### Response

```json
{
  "Success": true,
  "ErrorCode": null,
  "Error": null,
  "Result": {
    "Credit": 125000.0,
    "AvailableSenders": [
      30004040
    ]
  }
}
```

This is a useful low-risk method for verifying connectivity and credentials because it does not send a message.

---

## `POST /GetInbox`

Return incoming SMS messages received by account lines.

### Request body

```json
{
  "ApiKey": "123456-XXXXXXXXXXXXXXX"
}
```

### Response item

```json
{
  "Id": 12345,
  "Text": "Hello",
  "Form": 9121112222,
  "To": 30004040,
  "Time": "..."
}
```

The sender field is intentionally named **`Form`**, not `From`, because that is the actual field returned by the service.

This endpoint is polling-based; it is not a webhook.

---

# Error codes

`ErrorCode` is relevant only when `Success` is `false`.

| Code | Name | Meaning / action | Retry |
|---:|---|---|---|
| `1` | `InvalidApiKey` | API key is invalid or inactive | Never until fixed |
| `2` | `ApiIsNotActive` | API access is disabled for the account | Never until enabled |
| `3` | `UserIsNotActive` | Account is inactive | Never until fixed |
| `4` | `ApiTemproryDeactive` | API temporarily unavailable | Backoff |
| `5` | `MethodIsDeactive` | This method is temporarily disabled | Backoff / use alternative |
| `6` | `NoAuthntication` | Account identity verification incomplete | Never until fixed |
| `8` | `AccountInfoIsIncomplete` | Account profile information incomplete | Never until fixed |
| `9` | `InvalidParameters` | Invalid request data | Never until request is fixed |
| `10` | `IpIsNotValid` | Calling IP is not allowed | Never until allowlist is fixed |
| `11` | `MalformattedApiKey` | API key format is malformed | Never until fixed |
| `12` | `InvalidSender` | Invalid/unavailable sender line | Never until fixed |
| `13` | `InvalidDestination` | Invalid recipient or too many recipients | Never until fixed |
| `14` | `UnauthorizedMethod` | Account is not authorized for the method | Never until enabled |
| `15` | `DailyLimitReached` | Daily limit reached | After limit reset |
| `16` | `ApiLimitReached` | API-specific limit reached | After limit reset |
| `17` | `NightlyLimitReached` | Night-time limit reached | After limit reset |
| `18` | `ShareLineLimitReached` | Shared sender-line limit reached | After limit reset |
| `19` | `CreditIsLow` | Insufficient credit | Never until topped up |
| `20` | `TooManyRequests` | Rate limit exceeded | Exponential backoff |
| `100` | `InternalError` | Internal server error | Check trace status, then backoff |

Unknown error codes should be treated similarly to `100`: do not blindly resend. First query by `UserTraceId` if one was supplied.

---

# Recommended production flow

1. Call `AccountInfo` to verify the API key and identify valid sender lines.
2. For ordinary SMS, prefer `SendBulk` and assign a unique `UserTraceId` per recipient.
3. For OTP/template traffic, prefer `POST /SendTokenSingle` or `SendTokenMulti`.
4. Persist your own `UserTraceId`.
5. After sending, poll `StatusByUserTraceId` after an appropriate delay.
6. Stop polling when the status is final.
7. On timeout or error `100`, query by `UserTraceId` before retrying to prevent duplicate SMS messages.
8. Apply exponential backoff for temporary errors and rate limiting.

---

## Source notes

This Markdown was derived from the current V3 OpenAPI reference maintained for the service. That reference identifies the legacy Swagger V3 document at:

`https://api.sms-webservice.com/swagger/docs/v3`

and is used as the machine-readable source for the maintained V3 documentation and language examples.
