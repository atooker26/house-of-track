# Coach uniform survey (`/survey`)

A standalone page (no nav or footer, but the pixel still loads) for high school track and cross country coaches who buy uniforms. The results feed the team-kit work.

## What it asks

| # | Question | Type |
|---|----------|------|
| 1 | When did your program last buy new uniforms? | pick one |
| 2 | What holds you back from buying new uniforms? | pick any, plus Other (free text, 300 chars) |
| 3 | When do you expect to place your next order? | pick one |
| — | Additional comments or frustrations with this process | optional free text (2,000 chars) |
| — | Name, email, school, state | required |
| — | Role, program | optional dropdowns |
| — | Opt-in: "I'd be interested in being contacted in the future for team kit offers." | checkbox |

The questions and options are defined in `src/lib/survey.ts`, which the form and `/api/join` both use. The server rejects any answer that isn't one of the form's own options.

**Add new options at the end. Don't reword existing ones.** A stored answer is its label text, so rewording an option splits old and new answers into separate groups.

## Where a response goes (TEGO)

Each submission (`formType: "coach-survey"`) produces:

1. **A form submission** on the House of Track Space: every answer under `fields`. The comment is stored as `uniformComments`.
2. **An email contact** with:
   - tags `coach`, `coach-survey`, `survey:coach-uniforms-2026`, and one `limit:<slug>` per Q2 reason
   - custom fields for school, state, role, program, each answer (`uniformLastPurchase`, `uniformLimitingFactor`, `uniformLimitingFactorOther`, `uniformNextOrder`, `uniformComments`) and `surveySubmittedAt`
   - if they ticked the box, the tag `team-kit-offers` plus consent proof. The opt-in is for team-kit offers only. It does **not** add them to the newsletter.
3. **A CRM lead:**
   - the school becomes an organization
   - the coach becomes a CRM contact
   - a deal is created on the **"Coach uniforms"** pipeline (stages: New response → Contacted → Samples / sizing → Quote sent → Ordered / Not now)

   The deal's notes list every answer, including a `Comments:` line when there is one. Its expected close date comes from the Q3 answer.

### Things to know

- **The pipeline is looked up by name.** Renaming "Coach uniforms" in TEGO silently stops new deals from being created.
- **Repeat responses update the same deal.** The deal key is `coach-survey:<email>`, so a second response from the same email updates that deal and doesn't move it back to the first stage.
- **Deals have no custom fields in the v1 API.** That's why the answers go in the notes.

## Local dev

`.env.local` turns on the coming-soon gate, so every page redirects to `/soon`. Run `COMING_SOON=0 npm run dev` to see `/survey`.

## Testing on prod

Submit with an obviously fake email, then check the submission, the contact and the deal in TEGO. Afterwards, delete everything the test created: the deal, the CRM contact, the organization, the email contact, and the submission entry in the Space.
