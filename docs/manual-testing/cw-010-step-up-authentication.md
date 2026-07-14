# Manual Testing — US-CW-010: 3DS / Step-Up Authentication

Verifies that vendor payments **above $10,000.00** require an OTP step-up
challenge before they commit, with correct recovery for abandonment, wrong
codes, expiry, resend, and connectivity loss — while a single idempotent
payment attempt is preserved throughout.

## Setup

1. From the repo root, start the app with the mock backend + demo beacon:
   ```sh
   cd apps/clearline-web && npm run dev
   ```
2. Open the app in a browser and go to `/login`.
3. Sign in as the seeded Finance Manager (carries `payments:create`):
   - **Email:** `demo@clearline.dev`
   - **Password:** `Correct-Horse-Battery-1`
4. From the left nav, click **Payments** to open the New Payment form
   (`/payments/new`).

### Demo OTP codes

A real SMS never shows the code; this mock uses fixed codes (also listed in
the on-screen **demo Beacon → "Step-up (3DS) test codes"**):

| Code                               | Result                                           |
| ---------------------------------- | ------------------------------------------------ |
| `424242`                           | Valid — verifies and sends the payment           |
| `000000`                           | Expired — old code invalidated, a new one issued |
| any other 6 digits (e.g. `111111`) | Wrong code — authentication failure              |

---

## 1. A high-value payment triggers step-up (AC-01)

1. Click **Acme Corp** in the recipient list.
2. Enter amount **12000**.
3. Click **Review & send**, wait out the confirm countdown, and click
   **Send payment**.
4. **Expect:** a modal titled **"Verify it's you"** appears with six OTP cells
   and copy reading _"…Required for transfers over $10,000.00."_
5. **Expect:** the page is still `/payments/new` — no navigation, nothing has
   been charged.

## 2. Exactly at the threshold does NOT challenge (boundary)

1. Reload `/payments/new`. Click **Acme Corp**, enter amount **10000**.
2. Review & send → Send payment.
3. **Expect:** no challenge modal — the payment commits straight through and you
   land on the payment status page showing **Pending**.

## 3. Correct code commits the payment, key preserved (AC-02)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. In the modal, type **424242** (it auto-submits on the sixth digit).
3. **Expect:** you navigate to the payment status page in a **Pending**
   ("Processing… We'll update this as it settles") state — never an instant
   success.

## 4. Abandoning the challenge leaves it retryable, no charge (AC-03)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. Close the modal (press **Esc** or click the overlay).
3. **Expect:** back on the payment screen you see a warning banner:
   _"Authentication wasn't completed. Try again to finish your payment."_, a
   summary (Acme Corp · ••4188 · $12,000.00), a **Retry verification** button,
   and a _"same key …… preserved"_ line.
4. Click **Retry verification**.
5. **Expect:** the same challenge reopens with **empty** cells (no stale digits
   or error). Enter **424242** → the payment commits (Pending status page).

## 5. Wrong code is an authentication failure (AC-04)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. Type **111111**.
3. **Expect:** the cells turn red and the message reads _"We couldn't verify
   your identity. Try again or use a different verification method."_ The
   primary button now reads **Try again**, and a **Use a different method** link
   is offered. No navigation occurs.

## 6. Resend and alternative method activate after 30 seconds (AC-05)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. **Expect:** below **Verify** a countdown reads _"Resend in 0:30"_ and ticks
   down.
3. Wait ~30 seconds.
4. **Expect:** the countdown is replaced by an active **"Didn't get the code?
   Resend"** link and a **"Try another method"** link.
5. Click **Try another method**.
6. **Expect:** the destination in the modal copy switches (SMS → email), the
   cells clear, and the timer restarts.

## 7. Expired code is invalidated and reissued (AC-06)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. Type **000000**.
3. **Expect:** a distinct notice _"That code expired. We've sent a new one."_
   appears (styled as a warning, **not** the wrong-code message), and the cells
   clear for the freshly issued code.
4. Type **424242** → the payment commits.

## 8. Connectivity loss during verification is distinct and recoverable (AC-07)

1. Trigger the challenge again (Acme Corp, **12000**, Review & send → Send).
2. Open browser DevTools → Network and set it to **Offline**.
3. Type any complete code (e.g. **424242**).
4. **Expect:** the modal switches to a **"Connection lost"** view: _"We lost
   connection during verification. Try again."_ with **Cancel** and **Try
   again** buttons and a _"payment flow position preserved"_ note — clearly
   different from the wrong-code message.
5. Set the network back to **Online**, then click **Try again**.
6. **Expect:** the request succeeds and the payment commits (Pending status
   page).
