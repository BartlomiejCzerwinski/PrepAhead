---
title: Behavioral and system design prompts for mid-level interviews
description: Eight open-ended interview prompts on collaboration, trade-offs, and architecture—practice framing answers out loud before your loop.
pubDate: 2026-05-29
type: open-ended
tags:
  - Behavioral
  - System design
  - Mid-level
---

These prompts mirror what interviewers ask when they want reasoning, not a single correct ABCD option. Draft bullet outlines, then practice speaking for two to three minutes per question.

## Behavioral

**1. Tell me about a time you disagreed with a teammate on a technical approach.**

What was at stake? How did you align on criteria (risk, time, maintainability)? What was the outcome?

**2. Describe a production incident you helped resolve.**

What did you observe first? How did you communicate status? What did you change afterward to prevent recurrence?

**3. When have you simplified a system that had grown too complex?**

What pain triggered the work? What did you remove or consolidate? How did you validate you did not break consumers?

## System design (mid-level scope)

**4. Design a URL shortener for internal team use (not global scale).**

Clarify read/write ratio, retention, and auth. Sketch API, storage, and how you would generate unique codes.

**5. How would you add rate limiting to an existing REST API?**

Compare token bucket vs sliding window at the edge vs in-app. Where do you store counters? What happens when limits are hit?

**6. You need to cache job listing results for five minutes.**

What are cache keys? How do you invalidate on updates? What failures are acceptable (stale data vs overload)?

**7. Explain how you would migrate a monolith endpoint to a separate service without a big-bang release.**

Strangler pattern, dual writes, feature flags, and rollback plan—in your own words.

**8. What metrics and logs would you add before launching a new checkout flow?**

Think success rate, latency percentiles, business events, and alert thresholds—not tool names only.

## How to use this post

Read each prompt, outline **situation → action → result** for behavioral items, and **requirements → design → trade-offs** for design items. Timed practice beats rereading silently.
