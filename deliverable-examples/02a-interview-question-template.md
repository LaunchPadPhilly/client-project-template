# Data Discovery Interview Template

**Used for:** Task 2 — Document Current Data Model
**Needed before:** running any stakeholder interview
**Goal of each interview:** leave with a field-level understanding of one data-owning stakeholder's system(s) — not just what the system is, but every field it holds, its type, and a real example value. AND a plan to access that system, whether through a new account created for us, an API, or regularly scheduled downloads.

## How to use this

1. Identify one interview per data-owning role (see "Who to interview" below) — don't try to cover every system in one session.
2. Send the relevant section(s) to the stakeholder ahead of time if they can pull field lists/exports themselves; it shortens the live session.
3. During the interview, fill in the [Data Model — Example Output](02b-current-data-model-example.md) table live, on screen, so the stakeholder can correct you in real time. Take screen shots of any documents the client shares so you can confirm no fields are missed. 
4. End every interview by reading the filled table back to them and asking: *"Did I miss any field you regularly reference?"*

## Who to interview

| Role | Likely systems they own | Priority |
|---|---|---|
| Executive Director / CEO | Board reporting, high-level KPIs, strategic plan | High |
| Finance / Bookkeeper | Accounting platform (e.g., QuickBooks), budget, cash flow | High |
| Program Director / Manager | Program/case management system, attendance, outcomes | High |
| Development / Fundraising Lead | Donor CRM, grants tracker, campaign platform | High |
| HR / Operations | HRIS, payroll, staff records | Medium |
| Communications / Marketing | Website analytics, email platform, social | Medium |
| IT / Systems Admin (if any) | Shared drives, single sign-on, integrations already in place | Medium |

## Opening questions (ask every stakeholder)

1. Walk me through the systems you use in a typical week — what systems do you log into and what do you use each one for?
2. What report or number do you have to produce on a recurring basis? Where does the data for it come from?
3. What report or process takes you the longest to compile? How regularly do you produce it? 
4. If you had to guess, how many places does [key metric, e.g., "number of active clients"] live right now? Do they ever disagree with each other?
5. What's the one piece of data you wish you could get instantly but currently have to ask someone else for?
6. What process do you most want to automate and never have to do again? 
6. Who else touches this data before or after you?

## Per-system field questions

For **each system** the stakeholder names, work through:

1. What is this system called, and who is the vendor (if any)?
2. How do you (or would we) get data out of it — a dashboard export, an API, a manual download, direct database access?
3. Walk me through every field/column you see when you export or view a record. For each one:
   - What is it called in the system?
   - What kind of value is it (text, number, date, yes/no, dropdown/category, currency)?
   - Can you give me a real (or realistic, de-identified) example value?
   - Is it always filled in, sometimes blank, or calculated from other fields?
   - What fields need to be ignored for privacy reasons?
4. Is there a field here that means the same thing as a field in another system we've already discussed, even if it's named differently?
5. Is there a field you *used* to use but don't trust anymore (e.g., someone stopped updating it)?
6. Who is allowed to edit this data, and who just views it?

## Closing questions

1. Of everything we just went through, what's most important to get right first?
2. Is there a system we haven't talked about yet that you think matters?
3. Can you send me a sample export (with real or dummy data) after this call so we have something concrete to map fields against?

## Notes for the interviewer

- Make sure to record the interview to be able to accurately assess nuanced answers that the client will provide. 
- Ask for a live screen-share of the actual system when possible; people describe fields less accurately from memory than when looking at the screen and this will also let you take screen shots so you can get accurate documentation while waiting for them to share the full document. 
- Flag anything you don't fully understand as `NEEDS FOLLOW-UP` rather than guessing — clean up in a 15-minute follow-up call rather than carrying bad assumptions into the data model.
