# Fair Housing & Agent Abuse Intake Runbook

**Owner:** support@ownerfi.ai
**Source of truth:** this file
**Why it exists:** Our Terms of Service (Buyer Terms §5) commit to reviewing reports of (a) Fair Housing violations and (b) agent harassment / abuse. We promised "may, in our discretion, review" — even soft language carries operational risk if we ignore reports. Plaintiffs' counsel routinely use uninvestigated complaints as evidence of negligent retention. This runbook is the minimum viable process to honor what we said.

---

## 1. Inbox setup

**Email aliases that route to the on-call inbox (one human owns per week):**

| Subject keyword | Routes to | Triage SLA |
| --- | --- | --- |
| `FAIR HOUSING` | Compliance lead | **48 hours acknowledgement** |
| `AGENT REPORT` | Compliance lead | **3 business days acknowledgement** |
| `ACCESSIBILITY` | Engineering on-call | 5 business days |
| `REVOKE CONSENT` | Engineering on-call | 24 hours (TCPA risk) |
| `CCPA REQUEST` | Compliance lead | 45 days (CCPA statutory) |
| `DO NOT SELL/SHARE MY INFO` | Engineering on-call | 15 business days (CPRA) |
| `PRIVACY` | Compliance lead | 30 days |

**Setup tasks:**
- [ ] Create a label/folder in the support inbox for each subject keyword
- [ ] Forward all `support@ownerfi.ai` mail through a Gmail filter that auto-applies the label by subject substring
- [ ] Auto-acknowledgement: send a templated reply within 1 hour confirming receipt and giving a case ID
- [ ] Weekly on-call rotation tracked in a shared calendar — one person responsible at any time

---

## 2. Fair Housing complaint triage

A Fair Housing complaint = a buyer alleging a Partner Agent treated them differently or refused service based on **race, color, national origin, religion, sex (including gender identity / sexual orientation), familial status, disability**, or a state-protected class (source of income, military status, etc.).

### Triage steps

1. **Acknowledge in 48 hours.** Use the templated reply (Appendix A). Open a case in the tracker.
2. **Capture the facts.**
   - Buyer name, phone, email, city/state
   - Agent name (if known), brokerage, phone/email
   - Date(s) of contact
   - What the buyer says happened (verbatim, in quotes)
   - Any screenshots, call recordings, or text messages the buyer can send
3. **Pull our records.**
   - GHL contact history for the buyer
   - Referral agreement(s) signed
   - Any internal logs of the agent's conduct on this lead
4. **Decide within 7 calendar days:**
   - **No reasonable basis** → close the case. Reply explaining we reviewed the records and didn't find a violation. Tell the complainant they can still file with HUD (1-800-669-9777) or state agency.
   - **Reasonable basis** → open an agent investigation. Notify the agent in writing they're under review, request their account of the incident within 5 business days, suspend their lead access pending the review.
   - **Apparent serious violation** (slurs, refusal to show, steering) → suspend immediately, then investigate.
5. **Conclude within 30 calendar days of opening.**
   - Decisions: dismissal, formal warning, account suspension (typically 30/60/90 days), or permanent termination.
   - Document the rationale in the case file.
   - Notify the complainant of the outcome (general terms — no PII about the agent beyond confirming action was taken).
   - If termination: void any pending referral agreements with that agent (use the existing `void agreement` admin endpoint), notify the agent's broker if known.
6. **Always tell complainants they retain their right to file with HUD / state agency / file a private lawsuit** — we're not a substitute for regulators.

### What we DO NOT do

- We **do not** mediate fair-housing claims as a neutral third party. We're not equipped, and pretending to be creates additional liability.
- We **do not** make legal conclusions ("the agent violated the Fair Housing Act"). We make platform decisions ("we removed this agent's access for conduct inconsistent with our Terms").
- We **do not** share complainant identity with the agent without the complainant's written consent.
- We **do not** retaliate against any complainant by closing or restricting their account.

---

## 3. Agent abuse / harassment intake

Trigger: buyer reports that a Partner Agent (a) contacted them after they asked the agent to stop, (b) made deceptive statements about a property, (c) pressured them, (d) repeatedly contacted them in violation of TCPA/DNC, or (e) behaved unprofessionally in a non–Fair-Housing way.

### Triage steps

1. **Acknowledge in 3 business days.** Templated reply (Appendix B). Open a case.
2. **Capture the facts:** same as Fair Housing intake (buyer, agent, dates, what happened, evidence).
3. **First-strike vs repeat-offender:**
   - **First report against an agent** → send the agent a warning email citing the section of our Realtor Terms violated (typically §9 Prohibited Conduct or §10). Keep the report in their file. Tell the buyer we've warned the agent and to email back if contact continues.
   - **Second report (any buyer, any subject) within 12 months** → 30-day suspension. Notify the agent's broker.
   - **Third report or any single egregious incident** → permanent termination. Void pending referral agreements. Notify broker.
4. **Buyer-side protective action** in every case:
   - Manually unsubscribe the buyer from any GHL workflow targeting the offending agent
   - If the buyer asks to be removed entirely, mark them inactive in our DB and stop all marketing
5. **Conclude within 14 calendar days.**

### What if the agent disputes the report?

- Get both sides in writing. Apply the Terms standard, not "he said / she said." If the conduct alleged would violate Terms regardless of motive (e.g., contact after a STOP), the report stands.

---

## 4. Documentation we keep

Per case (FH or abuse), in the tracker:

- Case ID, opened date, closed date
- Complainant ID + contact info
- Agent ID + brokerage
- Allegation summary (verbatim quote where possible)
- Evidence collected (links to screenshots, call recordings, GHL exports)
- Internal investigation notes
- Decision + rationale
- Notification log (when we replied to whom)

Retention: **7 years** from case close (matches our privacy-policy retention for transaction-related records).

---

## 5. Escalation

| Situation | Escalate to |
| --- | --- |
| Lawsuit threatened or filed | Outside counsel before any further communication |
| HUD or state agency contacts us about a complaint | Outside counsel — do **not** respond directly without legal review |
| Pattern across multiple agents at one brokerage | Notify the brokerage in writing; consider suspending all agents at that brokerage pending broker response |
| Media or press inquiry | Founder + outside counsel before responding |
| Complainant alleges Ownerfi (not just agent) discriminated | Founder + outside counsel — this is direct corporate exposure |

---

## 6. Templates

### Appendix A — Fair Housing acknowledgement (within 48 hours)

> Subject: Your Fair Housing report — Case #{caseId}
>
> Hi {firstName},
>
> Thank you for reporting your concern. Discrimination has no place on Ownerfi's platform, and we take complaints under the Fair Housing Act seriously.
>
> Your report is now Case #{caseId}. A member of our compliance team will review the details you provided and may follow up within the next 7 calendar days for additional information or documentation. We aim to reach a decision within 30 days.
>
> Independently of our internal review, you have the right to file a complaint with the U.S. Department of Housing and Urban Development (1-800-669-9777, or hud.gov/fairhousing) or with your state's fair-housing or real-estate commission. You may also seek private legal counsel. Our internal review is not a substitute for these channels and does not affect your rights.
>
> If you have any additional information — screenshots, text messages, dates, or witnesses — please reply to this email.
>
> — Ownerfi Compliance

### Appendix B — Agent abuse acknowledgement (within 3 business days)

> Subject: Your agent report — Case #{caseId}
>
> Hi {firstName},
>
> We received your report about an agent's conduct. Thank you for telling us — we rely on reports like yours to keep the platform safe.
>
> Your report is Case #{caseId}. We'll review the agent's record and the details you provided. If we determine the conduct violates our Terms of Service, we'll take action up to and including removing the agent from the platform.
>
> If the agent contacts you again before we get back to you, please reply STOP to any text and forward the message to this address.
>
> — Ownerfi Trust & Safety

### Appendix C — Agent first warning

> Subject: Conduct review — your Ownerfi account
>
> Hi {agentName},
>
> We received a report from a buyer regarding {brief generic description, e.g. "continued contact after the buyer asked you to stop"}. This is inconsistent with Section {N} of our Realtor Terms of Service.
>
> This is a formal warning. A second report will result in a 30-day suspension. A third or any egregious incident will result in permanent removal from the platform and voiding of any pending referral agreements.
>
> If you have additional context for this incident, reply within 5 business days. Otherwise, the warning will remain in your file.
>
> — Ownerfi Trust & Safety

### Appendix D — Agent suspension / termination notice

> Subject: Account {suspension|termination} — Ownerfi
>
> Hi {agentName},
>
> Effective {date}, your Ownerfi account is {suspended for {N} days|permanently terminated}. The basis is the conduct described in our prior warning(s) on {date(s)} and the additional report we received on {date}.
>
> {If suspension:} Lead access will resume on {date} provided no further reports are filed. {If termination:} All pending referral agreements with leads from our platform are void. Per Section 10 of our Realtor Terms, you remain obligated to pay referral fees on any transactions arising from leads you accepted prior to today.
>
> If you wish to appeal, email this address within 14 days with any additional information.
>
> — Ownerfi Trust & Safety

---

## 7. Legal posture reminders

- We are a **lead-generation platform**, not a brokerage. Our role in a Fair Housing claim is platform-level (we can remove an agent's access). We do not adjudicate liability.
- Our Terms say "Ownerfi may, in our discretion, review reports … makes no guarantee of any particular response, timeframe, or outcome." That is the legal floor. This runbook is the operational ceiling we hold ourselves to. Failing to meet the ceiling exposes us; failing to meet the floor exposes us more.
- If anything in this runbook conflicts with advice from outside counsel on a specific case, follow counsel.
