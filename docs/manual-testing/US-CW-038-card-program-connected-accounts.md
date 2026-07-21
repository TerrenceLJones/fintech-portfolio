# Manual Testing — US-CW-038 Card Program Defaults & Connected Bank Accounts

## Setup

1. From the repo root: `pnpm --filter @clearline/clearline-web dev` (or `cd apps/clearline-web && pnpm dev`) and open the printed local URL.
2. The app runs entirely on the MSW mock backend — no real API.
3. Demo password for every seeded account: `Correct-Horse-Battery-1`
4. Accounts you'll use:
   - `controller@clearline.dev` — Controller + Admin (holds `card-program:manage` and `bank-accounts:manage`)
   - `owner@clearline.dev` — Owner (also holds both)
   - `employee@clearline.dev` — Employee (holds neither; used for the access-denied checks)

> A reload may return you to the login screen and a session modal may appear — this is expected MSW/cookie demo behavior, not a bug. Open the on-page demo guide (the beacon) on any Settings page for inline hints.

---

## 1. Card Program — default limits (AC-01)

1. Sign in as `controller@clearline.dev` and go to **Settings → Card Program** (`/settings/card-program`).
2. Confirm the form is prefilled: **Default monthly limit** `2000`, **Default per-transaction limit** `500`, and the note **"Existing cards are not affected. You can customize limits per card after issuance."** is shown.
3. Change **Default monthly limit** to `3000`. The unsaved-changes footer appears.
4. Click **Save changes** → a toast **"Card program updated"** appears and the footer disappears.
5. Reload the page → the monthly limit persists as `3000`.
6. Now go to **Cards** and click **Issue card** (still as the Controller). Confirm the issuance form's **Monthly limit** is prefilled with `3,000.00` and the default MCC chips (Software, Office Supplies) are pre-selected — i.e. new cards start with the org defaults.
7. Return to **Settings → Card Program**, set the monthly limit back to `2000`, and **Save**.

## 2. Card Program — searchable MCC restrictions (AC-02)

1. On **Settings → Card Program**, in **Default merchant-category restrictions**, type `office` in the search box → only **Office Supplies** remains.
2. Clear it and type `4722` (a numeric MCC) → only **Travel & Airlines** remains. (Both a name and a numeric code resolve.)
3. Click a category chip to toggle it on/off; the helper text updates between "No restrictions…" and "New cards are restricted to N categories." **Save changes** and confirm the toast.

## 3. Card Program — issuance policy & "Request a card" (AC-03)

1. On **Settings → Card Program**, set **Who can request a new card** to **Finance Managers and above** and **Save**.
2. Sign out, sign in as `employee@clearline.dev`, go to **Cards**. Confirm there is **no "Request a card"** button (and no "Issue card").
3. Sign back in as the Controller, set the policy back to **Everyone**, **Save**.
4. Sign in as `employee@clearline.dev` again, go to **Cards** → a **"Request a card"** button now appears. Click it → a toast **"Request sent — a Finance Manager or Controller will review it"** appears.

## 4. Connected Accounts — listing & Plaid connect (AC-04)

1. Sign in as the Controller and go to **Settings → Connected Accounts** (`/settings/connected-accounts`).
2. Confirm the seeded rows: **Chase Business Complete ••••8291 · Connected via Plaid** (status **Connected**), **Silicon Valley Bank ••••3355 · Manually connected** (Connected), and **Novo Business ••••6120** showing **Reconnect needed**.
3. Click **Connect account → Connect via Plaid**. A new account appears in the list with a **Connected** status and a masked number.

## 5. Connected Accounts — manual connection + micro-deposit verification (AC-05 / AC-06)

1. Click **Connect account → Enter account details manually**.
2. Enter routing number `123` and any account number, click **Send micro-deposits** → inline error **"Routing number must be 9 digits."**
3. Fix routing to `021000021`, account number `1234567890`, click **Send micro-deposits** → the dialog closes, a toast about micro-deposits appears, and a new **Verification pending** row (••••7890) is added.
4. On that row click **Verify**. In the dialog enter **First amount** `0.10` and **Second amount** `0.20` → **Verify account** shows **"Those amounts don't match…"** with **2 attempts left**.
5. Enter two more wrong pairs (e.g. `0.11`/`0.21`, then `0.12`/`0.22`). After the third wrong attempt the account status becomes **Verification locked**.
6. Add another manual account (repeat step 3) and this time verify with the correct demo amounts **$0.18** and **$0.42** → toast **"Account verified"** and the row flips to **Connected**. (The demo guide on this page lists the correct amounts.)

## 6. Connected Accounts — reconnect (AC-08)

1. On the **Novo Business** row (status **Reconnect needed**), click **Reconnect** → toast **"Reconnected Novo Business"** and the status becomes **Connected**.

## 7. Connected Accounts — remove names the account (AC-07)

1. On any account row, click **Remove**. The confirmation dialog reads **"Remove {Institution} ••••{last4}?"** and states **"This account will no longer be available for ACH transfers. In-flight payments are not affected — only future transfers are blocked."**
2. Confirm **Remove account** → toast confirming removal, and the row disappears from the list.

## 8. Server decides — Employee has no access (AC-09)

1. Sign in as `employee@clearline.dev`.
2. Confirm **Card Program** and **Connected Accounts** do **not** appear in the Settings nav (the whole Organization group is hidden for an Employee).
3. Manually navigate to `/settings/card-program` → an **Access denied** panel with **"403 Forbidden · GET /api/settings/sections/card-program"**.
4. Manually navigate to `/settings/connected-accounts` → an **Access denied** panel with **"403 Forbidden · GET /api/connected-accounts"**.

## 9. Audit trail (AC-10)

1. As the Controller, make one change on each page (e.g. save a card-program edit, remove/reconnect an account).
2. Open the **Audit** log and confirm each change recorded an event with the actor and action — card-program edits show a before → after diff, and connected-account events name the masked account (never the full number).
