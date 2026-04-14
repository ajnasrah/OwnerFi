# TCPA Consent Revocation Runbook

**Owner:** support@ownerfi.ai + engineering on-call
**Source of truth:** this file
**Why it exists:** Our signup forms (`/auth`, `/auth/setup`) capture express written consent for autodialed/pre-recorded calls and SMS from Ownerfi *and* from Partner Agents we share buyer info with. Our Terms (§3) commit to honoring revocation through any of: STOP reply to SMS, telling the agent verbally/in writing, or emailing `support@ownerfi.ai` with subject `REVOKE CONSENT`.

**TCPA damages are statutory: $500 per call/SMS, $1,500 if willful.** A single buyer who revokes via email and continues to receive Partner Agent calls for a month can sustain a $30K+ claim. This runbook describes how revocations propagate.

---

## 1. Channels where revocation can arrive

| Channel | What happens automatically | What requires manual action |
| --- | --- | --- |
| Reply `STOP` to a Twilio SMS we sent | Twilio adds the number to its STOP list — **future SMS from us via that Twilio number are blocked at the carrier level** | We must mirror the STOP into GHL and our own DB so we don't try other channels |
| Reply `STOP` to a GHL/agent SMS | GHL adds the number to its global STOP list per messaging service | Same — mirror to our DB |
| Email to `support@ownerfi.ai` with subject `REVOKE CONSENT` | Nothing | **Full manual scrub — see §3** |
| Verbal/written request to a Partner Agent | Nothing on our side until the agent reports it | Agent has a contractual duty to honor (Realtor Terms §9) and to inform us; if the buyer escalates we treat their report as the revocation event |
| GHL inbound `unsubscribe` event (email) | Email opt-out flag set in GHL | Mirror to our DB; this is email-only revocation, **not** a TCPA SMS/call revocation |

**Critical:** TCPA covers calls and texts. CAN-SPAM covers email. They are separate revocations. If a buyer says "stop calling me" they have not opted out of email, and vice versa.

---

## 2. SLA

- Acknowledge revocation email **within 24 hours**.
- Complete scrub **within 48 hours**.
- Confirm completion to the buyer **within 5 business days**.

The 24-hour SLA is faster than the FCC's 10-business-day rule for DNC compliance, but slower-than-now is the wrong direction for TCPA exposure — every additional call/SMS after revocation is a separate statutory violation.

---

## 3. Manual scrub procedure (when a `REVOKE CONSENT` email arrives)

### Step 1 — Confirm identity (10 minutes)

1. Open the email. Note the sender address and any phone number(s) provided.
2. Look up the buyer in the admin panel (`/admin/buyers`) by email **and** by phone — they may not match if the buyer signed up by phone and emailed from a different address.
3. If you cannot identify the buyer with reasonable confidence, reply asking them to confirm: full name, phone number used at signup, and city. **Do not send marketing while waiting** — be conservative.

### Step 2 — Stop outbound on our side

1. In our DB (`buyerProfiles` collection), set:
   ```
   smsNotifications: false
   marketingOptOut: true
   tcpaRevokedAt: <ISO timestamp>
   tcpaRevokedVia: 'email' | 'sms-stop' | 'agent-relayed' | 'admin'
   ```
2. Confirm the buyer is no longer in any active GHL workflow that sends SMS/calls. Use the GHL contact search by phone.
3. Flag any active referral agreements involving this buyer for review — see Step 4.

### Step 3 — Stop outbound on the GHL side

GHL inherits our DB state for *future* enrollments, but contacts already in workflows must be removed manually:

1. Open the GHL contact for the buyer's phone number.
2. Add the system tags `do-not-call` and `tcpa-revoked-{date}`.
3. Remove the contact from every active workflow / sequence / campaign.
4. Confirm the contact's "DND" toggles for SMS, Call, Email are all set to ON.
5. If the same phone number is in multiple GHL contacts (rare but happens after merges/imports), repeat for each.

### Step 4 — Notify Partner Agents who have this buyer's contact info

Per our Terms, the agent has an independent obligation to honor revocations. We add a layer:

1. Pull all referral agreements for this buyer where the status is anything other than `voided` or `closed`.
2. Email each agent at the address on their account. Subject: `URGENT — Buyer revoked TCPA consent — case #{buyerId}`.
3. Body (template — Appendix A):
   - State the buyer revoked consent
   - List the buyer's name (no other PII beyond what the agent already has)
   - Instruct the agent to stop all calls/SMS to that buyer immediately
   - Remind them this is required by federal law (TCPA) and by §9 of our Realtor Terms
   - Note that any further contact may result in suspension of their Ownerfi account
4. Void any active referral agreements with that buyer (use the existing void-agreement admin endpoint), unless the agent has an active transaction in progress and the buyer has explicitly told the agent they want the transaction to continue (rare; verify in writing).

### Step 5 — Confirm to the buyer

Reply to the original email within 5 business days:

> Subject: Re: Revoke consent — completed
>
> Hi {firstName},
>
> Confirming we've removed your phone number from all Ownerfi outbound calls, SMS, and marketing automations as of {date}.
>
> We've also notified the licensed agent(s) who previously received your contact information that you have revoked TCPA consent and instructed them to stop contacting you. By federal law and by our Terms with them, they must comply.
>
> If any agent contacts you again after {date}, please reply to this email immediately with the date/time and we will take action against the agent.
>
> Note: revoking SMS/call consent does not delete your account or your saved properties. If you also want your account deleted, reply with "DELETE ACCOUNT" and we'll process that separately within 30 days.
>
> — Ownerfi

### Step 6 — Log the case

In the same case-tracker used for Fair Housing / abuse:

- Case ID, opened/closed dates
- Buyer ID + revocation channel
- Agents notified (list)
- Referral agreements voided (list)
- Confirmation sent date

Retention: 7 years (matches privacy-policy retention).

---

## 4. Automation we should build (priority order)

These reduce the manual surface area. Until they exist, the manual procedure above is the only thing standing between us and TCPA damages.

| Priority | Build | Effort | Why |
| --- | --- | --- | --- |
| **P0** | Webhook from Twilio `STOP` → mirror to `buyerProfiles.smsNotifications=false` + GHL DND tag | small | Closes the silent-revocation gap where Twilio blocks but GHL keeps trying via a different number |
| **P0** | `REVOKE CONSENT` email auto-router that creates a ticket + applies the DB flags + posts to a Slack channel | small | Prevents the email sitting in an inbox unread |
| **P1** | Cron that finds buyers with `tcpaRevokedAt` set but still enrolled in active GHL workflows, and removes them | small-medium | Catches the case where a workflow re-enrolls a contact after manual scrub |
| **P1** | Admin button on `/admin/buyers/[id]` to one-click "Revoke TCPA + notify agents" | small | Standardizes the manual path |
| **P2** | Scheduled audit: list all `tcpaRevokedAt` buyers and verify zero outbound activity in the past 7 days | small | Catch-all defense |
| **P2** | Quarterly export of all active referral agreements + cross-check against revocation list | medium | Defense in depth |

Track these as GitHub issues / TaskCreate tasks, not in this runbook.

---

## 5. Templates

### Appendix A — Agent revocation notice

> Subject: URGENT — Buyer revoked TCPA consent — case #{caseId}
>
> Hi {agentName},
>
> The buyer **{buyerName}** has revoked their consent to receive calls and text messages from any party including yourself.
>
> Effective immediately, you must stop all outbound calls and SMS to this buyer. This is required by:
>
> 1. The federal Telephone Consumer Protection Act (TCPA), 47 USC §227
> 2. Section 9 (Prohibited Conduct) and Section 12 (Indemnification) of your Ownerfi Realtor Terms
>
> Continued contact may result in TCPA statutory damages of **$500–$1,500 per call/SMS**, payable by you, and may result in suspension or termination of your Ownerfi account.
>
> Email contact may also be unwelcome — confirm with the buyer in writing before sending any email.
>
> If you are mid-transaction with this buyer and the buyer wants the transaction to continue, get that confirmation **in writing from the buyer** and forward it to this address. Do not call them to ask.
>
> Acknowledge receipt of this notice by replying to this email.
>
> — Ownerfi Trust & Safety

### Appendix B — Buyer confirmation

(included in §3 step 5 above)

---

## 6. What to do if a buyer says "I never consented in the first place"

Sometimes a buyer claims they never signed up. Treat as a revocation regardless — there is no upside to debating consent with someone who is mad enough to email us. Then:

1. Pull the signup record from our DB (timestamp, IP, user agent).
2. Confirm the consent text shown on the signup form at that time (we keep the source under git; any timestamp can be matched to a commit).
3. If the records show legitimate signup, reply: "Our records show your account was created on {date} via {channel}. We've nonetheless removed your information per your request and you should receive no further contact." Don't argue.
4. If the records show no signup OR the records show signup happened from someone else's IP/device → escalate to founder + outside counsel. This may indicate identity theft or bad-actor signup.

---

## 7. Legal posture reminders

- Honoring revocation is **not optional**. TCPA is one of the most aggressively litigated consumer statutes in the US and class actions are routine.
- The carrier-level STOP from Twilio is good but not sufficient — agents may have the number in their personal CRM or phone and call from there. Notifying agents is what makes us defensible.
- Our Realtor Terms §12 indemnifies us for the agent's TCPA violations *if and only if* we behaved reasonably on our side. Failing to forward revocation to the agent makes that indemnity weaker.
- Outside counsel should review any TCPA demand letter before any response.
