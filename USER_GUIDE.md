# Purrfect Relationship Dashboard User Guide

Purrfect is a private relationship check-in app for couples. Each partner submits their own feelings through daily, weekly, and monthly check-ups. The app then shows shared scores, differences between partners, history, reflection prompts, and conversation topics.

The goal is not to judge the relationship with a number. The goal is to make feelings visible early, kindly, and consistently.

## Main Idea

Each person fills in check-ups from their own account. Your partner sees your submitted feelings, and you see theirs.

The app tracks six relationship principles:

- **Recognition**: feeling noticed, appreciated, and valued.
- **Acceptance**: feeling free to be yourself without pressure to perform or shrink.
- **Emotional Stability**: feeling that the relationship is steady and emotionally predictable.
- **Initiative**: feeling that both people put effort into connection and care.
- **Emotional Intimacy**: feeling emotionally close, known, and safe to be vulnerable.
- **Safety**: feeling respected, secure, and protected emotionally and practically.

## Getting Started

1. Open the app.
2. Create an account or log in.
3. Go to **Profile** and set your display name.
4. Connect with your partner.
5. Once both accounts are connected, start submitting check-ups.

If you are not logged in, you will see the authentication landing page. The dashboard is protected and only becomes useful after login.

## Profile

The **Profile** page lets you control how you appear in the app.

You can set:

- Display name
- Short bio
- Instagram
- X / Twitter
- Website

Your **display name** is saved to Supabase and is visible to your partner inside check-ups, history, and score comparisons.

The bio and social links are currently stored locally in your browser. They are useful for personalizing your profile screen, but they are not yet shared as relationship data.

Your profile page also shows:

- Your email
- Your user ID
- A button to copy your user ID

Your partner can use your email or user ID to find you.

## Connecting With Your Partner

Until you are connected with a partner, the app shows the onboarding flow instead of the main dashboard.

### Recommended Method: Couple Request

1. Ask your partner to create an account.
2. Search for them by email or user ID.
3. Click **Look up**.
4. If the account is found, click **Send request**.
5. Your partner logs in and accepts the request.
6. The dashboard unlocks for both of you.

Requests can be:

- Incoming: someone sent a request to you.
- Outgoing: you sent a request and are waiting.
- Accepted: the couple workspace is created.
- Rejected or cancelled: the request is no longer active.

### Fallback Method: Invite Code

If lookup is inconvenient, one person can create an invite code and the other person can join by code.

The request flow is preferred because it is clearer and easier to track.

## Header Status

The top navigation bar shows compact account and couple status.

You will see:

- **Signed in**: your current account or display name.
- **Setup needed**: you are logged in but not fully connected.
- **Connected couple**: your partner is connected.
- **Pending**: there are pending couple requests.
- **Sign out**: ends your session.

This keeps important status visible without taking up too much page space.

## Check-Ups

The app has three check-up types:

- **Daily check-up**: quick daily pulse.
- **Weekly check-up**: pattern check.
- **Monthly check-up**: deeper review.

Each check-up asks questions linked to the six principles.

Answers use a 1 to 5 scale:

- 1: Hardly
- 2: A little
- 3: Somewhat
- 4: Mostly
- 5: Very much

Scores are converted to a 0-100 scale.

## Check-Up Timing Rules

Check-ups can only be submitted once per window:

- Daily: once per calendar day.
- Weekly: once per week.
- Monthly: once per month.

After you submit a check-up for the current window, the submit button becomes disabled for that period until the next window opens.

The database also enforces this rule, so refreshing the page or double-clicking cannot create duplicate submissions.

## Initial Scores

When a couple is first created, the app starts from a neutral-perfect baseline of **100** for every principle.

This means the dashboard does not start by assuming something is wrong. Scores begin changing only as partners submit check-ups.

## Overview

The **Overview** page shows the current relationship picture.

It includes:

- Shared couple score
- Your score
- Partner score
- Largest gap between partners
- Trend summary
- Recent shared history
- Milestones
- Principle cards

Draft slider changes do not affect Overview. Only submitted check-ups count.

## Score Weighting

The overall score uses weighted check-ups:

- Daily: 20%
- Weekly: 30%
- Monthly: 50%

Monthly check-ups carry the most weight because they reflect a deeper and more stable pattern.

## Principle Cards

Each principle card shows:

- Description of the principle
- Couple score
- Your score
- Partner score
- Gap between both partners

Click **View detail** to open the principle detail page.

## Principle Detail Pages

Each principle detail page gives a closer look at one relationship principle.

It shows:

- Principle meaning
- Couple score
- Your score
- Partner score
- Gap size
- Recent submitted notes and scores related to that principle
- A suggested conversation prompt
- A small action to try

You can add the prompt to the Talk queue.

## History

The **History** page shows submitted check-ups grouped by:

- Daily
- Weekly
- Monthly

Each history item shows:

- Who submitted it
- Submission date
- Overall score
- Optional reflection note
- Principle-by-principle scores

Use History to understand how feelings changed over time.

## After-Submit Reflection

After submitting a check-up, the app creates a reflection.

The reflection shows:

- Lowest-scoring principle from that submission
- Biggest gap between partners
- One conversation prompt
- One small action for the next period

This is meant to turn a score into a gentle next step.

The reflection can be added to the Talk queue.

## Talk Queue

The **Talk** page stores discussion prompts.

Prompts can come from:

- After-submit reflections
- Principle detail pages

Each Talk item includes:

- Principle name
- Source
- Conversation prompt
- Suggested action

You can mark prompts as discussed or reopen them later.

The Talk queue is currently stored locally in your browser.

## Milestones

The Overview page includes relationship milestones.

Examples:

- First check-up submitted
- Both partners shared a daily check-in
- Weekly pattern started
- Monthly review cycle
- Improvement spotted

Milestones are meant to make progress visible, not to pressure either partner.

## Health Page

The **Health** page checks whether the app is configured and functioning correctly.

It checks:

- Supabase environment configuration
- Login session
- Profile table access
- Couple request table access
- Accept request function
- Realtime connection
- Couple workspace status
- Partner connection
- Check-up submission readiness

If something feels broken, run Health first. It often explains whether the issue is login, database setup, missing schema, RLS, or partner connection.

## Realtime Updates

The app listens for live changes from Supabase.

This means:

- Pending requests can appear without refreshing.
- Accepted requests can unlock the dashboard automatically.
- Partner submissions can update Overview and History.

Realtime depends on the Supabase schema being applied correctly.

## Common Problems

### “Could not find the table public.couple_requests”

The latest database schema has not been applied to Supabase, or the Supabase API schema cache has not refreshed.

Run `supabase-schema.sql` in Supabase SQL Editor and refresh the app.

### “This action was blocked by database security rules”

This usually means Row Level Security policies are outdated or the latest schema has not been run.

Run `supabase-schema.sql` again, then refresh the app.

### “profiles.bio does not exist”

Refresh the app. The app no longer depends on a `profiles.bio` database column.

### I cannot submit a check-up again

That is expected if you already submitted that check-up for the current window.

Daily opens again the next day. Weekly opens again the next week. Monthly opens again the next month.

### My partner cannot see my latest submission

Check:

- Both users are connected as a couple.
- The submission was saved successfully.
- The partner refreshed or realtime is working.
- Health page passes the relevant checks.

### The Overview score did not change while moving sliders

That is expected. Sliders are drafts. Overview changes only after submission.

## Recommended User Flow

For a new couple:

1. Both users create accounts.
2. Both users set display names in Profile.
3. One user searches for the other by email or ID.
4. One user sends a couple request.
5. The other user accepts.
6. Each person completes a Daily check-up.
7. Review Overview together.
8. Open the Talk page and discuss one prompt.
9. Repeat daily, weekly, and monthly.

## Current Limitations

Some data is still local to the browser:

- Draft answers
- Profile bio/social links
- Talk queue

Submitted check-ups, couple membership, requests, and display names are stored in Supabase.

Future improvements could move the Talk queue and full profile details into Supabase so they sync across devices.

## Best Way To Use The App

Use the app as a gentle ritual:

- Daily: notice small emotional shifts.
- Weekly: talk about patterns.
- Monthly: review the deeper relationship picture.

Do not treat a low score as failure. Treat it as a signal: “This deserves care.”

