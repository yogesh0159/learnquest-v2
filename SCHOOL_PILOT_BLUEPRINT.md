# LearnQuest — School Pilot Blueprint

## Product promise

LearnQuest should not be sold to schools as “screen time with quizzes.” The school version must demonstrate that children practise identifiable skills, receive feedback, improve over time, and that teachers can see useful evidence without spending extra time managing the game.

## Pilot target

Start with one narrow, measurable pilot before building a large school ERP layer.

Recommended first pilot:
- grades/ages already supported by the product (4–12 years);
- Maths + English + GK baseline content;
- Jungle + Maths Kingdom gameplay;
- 4–6 week classroom/home pilot;
- teacher assigns short missions;
- parents can see the same child-level evidence already available in the parent dashboard;
- teachers see class-level aggregates, not unnecessary personal data.

## What a school must be able to answer

After using LearnQuest, a teacher should be able to answer:

1. Which curriculum skills did each learner practise?
2. Which skills are becoming mastered?
3. Which topics need intervention?
4. How much learning activity occurred, separate from cosmetic/game activity?
5. Did accuracy improve after repeated practice?
6. Can the teacher assign a mission/homework activity in under a minute?
7. Can the teacher export a simple progress report for parents/school records?

If the software cannot answer these questions reliably, visual quality alone is not enough for a school release.

## School MVP roles

### School admin
- creates school/class structure;
- invites teachers;
- controls class-level settings;
- sees aggregate usage and learning reports;
- does not need access to child PINs/passwords.

### Teacher
- sees assigned classes;
- sees learner mastery summaries;
- assigns learning missions;
- reviews class weak/strong skills;
- controls whether classroom leaderboards are enabled;
- exports progress summaries.

### Parent
- retains child-level visibility;
- receives understandable weekly progress;
- can assign home tasks/rewards;
- does not see other children.

### Child
- sees only their own profile/game progress;
- participates through designed avatars rather than requiring a real photograph;
- receives age-appropriate feedback.

## Data model proposal (feature flagged)

Do not add this schema to production until privacy review and migration tests are ready.

Potential entities:

- `schools`
- `school_memberships`
- `teachers`
- `classes`
- `class_memberships`
- `curriculum_skills`
- `question_skill_map`
- `learning_missions`
- `mission_assignments`
- `skill_mastery`

Keep child identity data minimal. A school membership should reference the existing child record rather than copy unnecessary profile fields.

## Mastery model

Do not call a skill “mastered” after one correct answer.

Initial transparent scoring proposal:
- record attempts and correctness per skill;
- give more weight to recent attempts;
- require repeated evidence across sessions;
- track response time only when it has educational meaning;
- avoid penalising a child for hardware/network delay;
- expose confidence/evidence count alongside mastery percentage;
- allow teachers to understand why a mastery state was produced.

AI can recommend what to practise next, but stored mastery should remain explainable and auditable.

## Learning-through-world mission examples

### Market Mission
The child enters a market, receives a simple shopping goal and must choose quantities/prices/change inside the world. Difficulty adapts to age group.

Evidence:
- money/number skill attempted;
- correct/incorrect choices;
- hints used;
- retry improvement;
- final explanation.

### Bridge Builder
The child repairs a route by selecting or measuring shapes/lengths. The bridge physically responds to the answer.

Evidence:
- geometry/measurement skill;
- estimation accuracy;
- repeated misconception pattern.

### Road & Language Mission
Signs, directions and vocabulary are part of navigation rather than a detached multiple-choice panel.

Evidence:
- vocabulary/direction skill;
- recognition accuracy;
- language selected;
- correction feedback.

## Parent-facing evidence

The upgraded parent dashboard already introduces a weekly learning-coach concept. School work should reuse the same underlying measurements so parents and teachers are not given contradictory scores.

Parent summary should stay simple:
- active learning days;
- questions/activities practised;
- learning accuracy;
- learning-game minutes;
- strengths;
- focus topics;
- recommended short daily routine.

Avoid vanity metrics such as total coins being presented as academic achievement.

## Classroom safety and privacy

Before a school pilot:
- minimise collected child data;
- do not require real-child face uploads or biometric avatars;
- never expose child PINs to teachers/admin reports;
- separate account/security telemetry from learning analytics;
- use role-based authorization on every school endpoint;
- do not make class leaderboards public by default;
- provide delete/export processes appropriate to the deployment/legal context;
- document retention and backup rules;
- log administrative actions without logging secrets.

## Performance requirement

School computers and home phones may be low power. “Premium graphics” must degrade gracefully.

Recommended runtime modes:
- High: enhanced shadows/effects/asset density;
- Balanced: default mobile/school target;
- Low: reduced particles/shadows/LOD while preserving learning interactions.

Measure frame time and adapt. Do not use screen width as the only quality signal.

## Pilot success metrics

A pilot should collect evidence for product improvement, not make unsupported learning claims.

Useful metrics:
- percentage of invited learners who complete onboarding;
- weekly active learners;
- median learning sessions per week;
- assigned mission completion rate;
- repeated-skill accuracy trend;
- teacher time required to assign/review work;
- parent report open/usefulness feedback where available;
- crash-free session rate;
- percentage of sessions that remain playable on target low-power devices.

## Go/no-go gate for a school pilot

Do not start a broad school rollout until:
- learner/teacher authorization tests are present;
- mastery evidence is separated from cosmetic game scoring;
- class data isolation is tested;
- browser smoke tests are stable;
- Railway production database backup/restore has been rehearsed;
- basic accessibility/mobile QA is complete;
- curriculum content has been reviewed by a qualified educator for the target grade/context;
- privacy/terms appropriate to the target schools and jurisdiction have been reviewed.

## Positioning

The strongest school story is:

**“Children enter an adventure world to practise real curriculum and life skills; LearnQuest turns the interaction into understandable mastery evidence for the adults supporting them.”**

That is a stronger and more defensible product than simply making the runner more visually realistic.
