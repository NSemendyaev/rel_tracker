import { useEffect, useMemo, useState } from 'react'
import './App.css'
import dashboard from './assets/dashboard.png'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const storageKey = 'purrfect-relationship-tracker'
const getInviteCode = () => Math.random().toString(36).slice(2, 10).toUpperCase()
const getProfileExtrasKey = (userId) => `purrfect-profile-extras-${userId}`

const getFriendlyError = (error, fallback = 'Something went wrong. Please try again.') => {
  const message = error?.message ?? String(error ?? '')

  if (message.includes('duplicate key') && message.includes('couple_members')) {
    return 'You have already joined this couple workspace.'
  }

  if (message.includes('one_checkup_submission_per_window')) {
    return 'You already submitted this check-up for the current window. It will open again next cycle.'
  }

  if (message.includes('duplicate key') || error?.code === '23505') {
    return 'There is already a pending couple request between these two accounts.'
  }

  if (message.includes('row-level security')) {
    return 'This action was blocked by the database security rules. Run the latest supabase-schema.sql in Supabase, then refresh this app.'
  }

  if (message.includes('profiles.bio') || message.includes('profiles.social_links')) {
    return 'The app was trying to read old profile fields. Refresh the page to load the latest version.'
  }

  if (message.includes('Couple request was not found')) {
    return 'That couple request is no longer pending. Refresh and check the current request list.'
  }

  if (message.includes('Only the recipient can accept')) {
    return 'Only the person who received this request can accept it.'
  }

  if (message.includes("Could not find the table 'public.couple_requests'")) {
    return 'The couple request table is missing in Supabase. Run the latest supabase-schema.sql in the Supabase SQL editor, then refresh this app.'
  }

  if (message.includes('schema cache')) {
    return 'Supabase has not refreshed its schema cache yet. Run the latest supabase-schema.sql, wait a moment, then refresh this app.'
  }

  if (message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }

  if (message.includes('Password should be at least')) {
    return 'Use a password with at least 6 characters.'
  }

  return message || fallback
}

const isPeriodWindowSchemaCacheError = (error) => {
  const message = error?.message ?? String(error ?? '')

  return message.includes('period_window') && message.includes('schema cache')
}

const people = {
  me: { id: 'me', label: 'Me', possessive: 'My' },
  partner: { id: 'partner', label: 'Partner', possessive: "Partner's" },
}

const weights = {
  daily: 0.2,
  weekly: 0.3,
  monthly: 0.5,
}

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'checkups', label: 'Check-ups' },
  { id: 'history', label: 'History' },
  { id: 'talk', label: 'Talk' },
  { id: 'profile', label: 'Profile' },
  { id: 'health', label: 'Health' },
]

const principles = [
  {
    id: 'recognition',
    title: 'Recognition',
    baseValue: 85,
    tone: 'rose',
    icon: 'heart',
    cropX: 160,
    cropY: 132,
    meaning:
      'Recognition is the feeling that someone notices you and values your presence, effort, or achievements. It helps a person feel seen rather than ignored, and it strengthens confidence in a relationship because actions and contributions are acknowledged.',
  },
  {
    id: 'acceptance',
    title: 'Acceptance',
    baseValue: 90,
    tone: 'green',
    icon: 'check',
    cropX: 570,
    cropY: 132,
    meaning:
      'Acceptance means being allowed to be yourself without feeling pressured to change your personality, opinions, or behaviour to be loved or included. It creates comfort and reduces fear of judgment.',
  },
  {
    id: 'stability',
    title: 'Emotional Stability',
    baseValue: 70,
    tone: 'blue',
    icon: 'shield',
    cropX: 980,
    cropY: 132,
    meaning:
      'Emotional Stability refers to consistency in how people behave emotionally towards each other. It means moods and reactions are not unpredictable or extreme, so the relationship feels steady and reliable over time.',
  },
  {
    id: 'initiative',
    title: 'Initiative',
    baseValue: 60,
    tone: 'amber',
    icon: 'bolt',
    cropX: 160,
    cropY: 614,
    meaning:
      'Initiative is when both people actively contribute to maintaining the relationship instead of one person doing all the work. It includes starting conversations, making plans, and showing effort without being asked.',
  },
  {
    id: 'intimacy',
    title: 'Emotional Intimacy',
    baseValue: 80,
    tone: 'purple',
    icon: 'heart',
    cropX: 570,
    cropY: 614,
    meaning:
      'Emotional Intimacy is the ability to share thoughts, feelings, and vulnerabilities in a safe way. It develops trust and closeness because both people feel understood and supported at a deeper level.',
  },
  {
    id: 'safety',
    title: 'Safety',
    baseValue: 95,
    tone: 'rose',
    icon: 'shield',
    cropX: 980,
    cropY: 614,
    meaning:
      'Safety covers feeling secure in all ways: physically protected, emotionally respected, and practically supported. It means there is no fear of harm, manipulation, or instability in the relationship.',
  },
]

const questionSets = {
  daily: {
    title: 'Daily check-up',
    eyebrow: 'Tiny pulse',
    summary: 'A fast end-of-day reflection. Use the person switch to fill it as you or as your partner.',
    weightLabel: '20% of overall score',
    cadence: 'Today',
    questions: {
      recognition: ['How seen or appreciated did you feel today?'],
      acceptance: ['Did you feel free to be yourself today?'],
      stability: ['How emotionally steady did the relationship feel today?'],
      initiative: ['Did both people show effort today?'],
      intimacy: ['Did you feel emotionally connected today?'],
      safety: ['Did you feel respected and secure today?'],
    },
  },
  weekly: {
    title: 'Weekly check-up',
    eyebrow: 'Pattern check',
    summary: 'A weekly look at repeated behaviour. Compare both sides to spot mismatched experiences.',
    weightLabel: '30% of overall score',
    cadence: 'This week',
    questions: {
      recognition: [
        'Were your efforts noticed or acknowledged this week?',
        'Did appreciation feel specific rather than automatic?',
      ],
      acceptance: [
        'Did you feel accepted without needing to perform or shrink yourself?',
        'Were differences in opinions, moods, or needs handled kindly?',
      ],
      stability: [
        'Were conflicts or mood changes handled calmly this week?',
        'Did the relationship feel reliable across good and difficult moments?',
      ],
      initiative: [
        'Did both people contribute to plans, care, or communication?',
        'Did effort feel balanced rather than carried by one person?',
      ],
      intimacy: [
        'Did you have meaningful emotional conversations this week?',
        'Was there space for vulnerability without judgment?',
      ],
      safety: [
        'Did the relationship feel safe, respectful, and reliable this week?',
        'Were boundaries and practical needs respected?',
      ],
    },
  },
  monthly: {
    title: 'Monthly check-up',
    eyebrow: 'Deep review',
    summary: 'A slower relationship health review. Monthly answers carry the heaviest influence.',
    weightLabel: '50% of overall score',
    cadence: 'This month',
    questions: {
      recognition: [
        'Have you felt valued in a lasting way over the past month?',
        'Were your contributions remembered beyond the moment?',
        'Did recognition strengthen your confidence in the relationship?',
      ],
      acceptance: [
        'Have you felt loved as you are over the past month?',
        'Could you show imperfect or complicated parts of yourself safely?',
        'Did the relationship make room for growth without pressure to become someone else?',
      ],
      stability: [
        'Has the relationship felt predictable and emotionally reliable?',
        'Were recurring tensions handled with more care over time?',
        'Did you recover from hard moments without fear of sudden distance or instability?',
      ],
      initiative: [
        'Has effort felt balanced between both people this month?',
        'Did both people invest in connection without needing constant prompting?',
        'Were plans, repair, and care shared in a way that felt fair?',
      ],
      intimacy: [
        'Has trust and closeness grown, stayed stable, or weakened?',
        'Were deeper feelings, worries, or needs welcomed?',
        'Did you feel known by the other person in a meaningful way?',
      ],
      safety: [
        'Have you felt secure physically, emotionally, and practically?',
        'Were boundaries, consent, and emotional limits respected consistently?',
        'Did the relationship feel like a safe place to return to?',
      ],
    },
  },
}

const ratingLabels = ['Hardly', 'A little', 'Somewhat', 'Mostly', 'Very much']
const maxRating = 5

const formatDate = (dateValue) => (
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue))
)

const getWeekStart = (date) => {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() + diff)
  return weekStart
}

const getPeriodWindow = (period, dateValue = new Date()) => {
  const date = new Date(dateValue)
  const start = new Date(date)
  const end = new Date(date)

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0)
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 1)
  } else if (period === 'weekly') {
    start.setTime(getWeekStart(date).getTime())
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 7)
  } else {
    start.setFullYear(date.getFullYear(), date.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    end.setTime(start.getTime())
    end.setMonth(end.getMonth() + 1)
  }

  const windowKey = period === 'daily'
    ? start.toISOString().slice(0, 10)
    : period === 'weekly'
      ? `week-${start.toISOString().slice(0, 10)}`
      : start.toISOString().slice(0, 7)

  return { end, start, windowKey }
}

const getPeriodAvailability = (period, history, person) => {
  const window = getPeriodWindow(period)
  const submittedEntry = history.find((entry) => {
    if (entry.period !== period || entry.person !== person) {
      return false
    }

    const submittedAt = new Date(entry.createdAt)
    return submittedAt >= window.start && submittedAt < window.end
  })

  return {
    ...window,
    isSubmitted: Boolean(submittedEntry),
    submittedEntry,
  }
}

const makeInitialResponses = () => (
  Object.fromEntries(
    Object.entries(questionSets).map(([period, set]) => [
      period,
      Object.fromEntries(
        principles.map((principle) => [
          principle.id,
          set.questions[principle.id].map(() => maxRating),
        ]),
      ),
    ]),
  )
)

const makeCoupleResponses = () => ({
  me: makeInitialResponses(),
  partner: makeInitialResponses(),
})

const getEmptyNotes = () => (
  Object.fromEntries(Object.keys(questionSets).map((period) => [period, '']))
)

const makeCoupleNotes = () => ({
  me: getEmptyNotes(),
  partner: getEmptyNotes(),
})

const normalizeResponses = (responses) => {
  const fallback = makeInitialResponses()

  return Object.fromEntries(
    Object.entries(questionSets).map(([period, set]) => [
      period,
      Object.fromEntries(
        principles.map((principle) => {
          const savedAnswers = responses?.[period]?.[principle.id]
          const expectedLength = set.questions[principle.id].length

          if (!Array.isArray(savedAnswers) || savedAnswers.length !== expectedLength) {
            return [principle.id, fallback[period][principle.id]]
          }

          return [
            principle.id,
            savedAnswers.map((answer) => Math.min(5, Math.max(1, Number(answer) || 3))),
          ]
        }),
      ),
    ]),
  )
}

const normalizeCoupleResponses = (responses) => {
  if (responses?.me || responses?.partner) {
    return {
      me: normalizeResponses(responses.me),
      partner: normalizeResponses(responses.partner),
    }
  }

  return {
    me: normalizeResponses(responses),
    partner: makeInitialResponses(),
  }
}

const normalizeCoupleNotes = (notes) => {
  const fallback = makeCoupleNotes()

  if (notes?.me || notes?.partner) {
    return {
      me: { ...fallback.me, ...(notes.me ?? {}) },
      partner: { ...fallback.partner, ...(notes.partner ?? {}) },
    }
  }

  return {
    me: { ...fallback.me, ...(notes ?? {}) },
    partner: fallback.partner,
  }
}

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) {
    return []
  }

  return history.map((entry) => ({
    ...entry,
    person: entry.person ?? 'me',
    personLabel: entry.personLabel ?? people[entry.person ?? 'me'].label,
  }))
}

const mapSubmissionRow = (row, currentUserId, memberLabels = {}) => {
  const isCurrentUser = row.user_id === currentUserId
  const person = isCurrentUser ? 'me' : 'partner'

  return {
    id: row.id,
    person,
    personLabel: isCurrentUser ? people.me.label : (memberLabels[row.user_id] ?? people.partner.label),
    period: row.period,
    periodLabel: questionSets[row.period].title,
    principleScores: row.principle_scores,
    overallScore: row.overall_score,
    responses: row.responses,
    note: row.note ?? '',
    createdAt: row.created_at,
    periodWindow: row.period_window,
    userId: row.user_id,
  }
}

const getQuestionAverage = (answers) => (
  answers.reduce((total, answer) => total + answer, 0) / answers.length
)

const getPeriodPrincipleScore = (answers) => Math.round((getQuestionAverage(answers) / 5) * 100)

const getInitialPeriodScores = () => (
  Object.fromEntries(
    Object.keys(questionSets).map((period) => [
      period,
      getPeriodScores(period, makeInitialResponses()[period]),
    ]),
  )
)

const getLatestSubmittedPeriods = (history, person) => {
  const fallback = getInitialPeriodScores()

  return Object.fromEntries(
    Object.keys(questionSets).map((period) => {
      const latestEntry = history.find((entry) => entry.person === person && entry.period === period)
      return [period, latestEntry ?? fallback[period]]
    }),
  )
}

const calculateSubmittedScores = (history, person) => {
  const submittedPeriods = getLatestSubmittedPeriods(history, person)

  const principleScores = Object.fromEntries(
    principles.map((principle) => {
      const weightedScore = Object.keys(questionSets).reduce((total, period) => (
        total + (submittedPeriods[period].principleScores?.[principle.id] ?? 0) * weights[period]
      ), 0)

      return [principle.id, Math.round(weightedScore)]
    }),
  )

  const overallScore = Math.round(
    Object.values(principleScores).reduce((total, score) => total + score, 0) / principles.length,
  )

  return { principleScores, overallScore }
}

const calculateSubmittedCoupleScores = (history) => {
  const me = calculateSubmittedScores(history, 'me')
  const partner = calculateSubmittedScores(history, 'partner')
  const principleScores = Object.fromEntries(
    principles.map((principle) => [
      principle.id,
      Math.round((me.principleScores[principle.id] + partner.principleScores[principle.id]) / 2),
    ]),
  )
  const overallScore = Math.round((me.overallScore + partner.overallScore) / 2)

  return { me, partner, couple: { principleScores, overallScore } }
}

const getPeriodScores = (period, periodResponses) => {
  const principleScores = Object.fromEntries(
    principles.map((principle) => [
      principle.id,
      getPeriodPrincipleScore(periodResponses[principle.id]),
    ]),
  )

  const overallScore = Math.round(
    Object.values(principleScores).reduce((total, score) => total + score, 0) / principles.length,
  )

  return {
    period,
    periodLabel: questionSets[period].title,
    principleScores,
    overallScore,
  }
}

const getSavedState = () => {
  const fallback = {
    responses: makeCoupleResponses(),
    notes: makeCoupleNotes(),
    history: [],
    discussionItems: [],
  }

  try {
    const rawState = window.localStorage.getItem(storageKey)

    if (!rawState) {
      return fallback
    }

    const savedState = JSON.parse(rawState)

    return {
      responses: normalizeCoupleResponses(savedState.responses),
      notes: normalizeCoupleNotes(savedState.notes),
      history: normalizeHistory(savedState.history),
      discussionItems: normalizeDiscussionItems(savedState.discussionItems),
    }
  } catch {
    return fallback
  }
}

const getTrendSummary = (history) => {
  if (history.length < 2) {
    return {
      direction: 'steady',
      label: 'No trend yet',
      detail: 'Save at least two check-ups to see movement over time.',
    }
  }

  const latest = history[0]
  const previous = history.find((entry) => (
    entry.person === latest.person && entry.period === latest.period && entry.id !== latest.id
  )) ?? history[1]
  const delta = latest.overallScore - previous.overallScore

  if (delta >= 3) {
    return {
      direction: 'up',
      label: `Up ${delta} points`,
      detail: `${latest.personLabel}'s ${latest.periodLabel} improved compared with their previous saved check-up.`,
    }
  }

  if (delta <= -3) {
    return {
      direction: 'down',
      label: `Down ${Math.abs(delta)} points`,
      detail: `${latest.personLabel}'s ${latest.periodLabel} dipped compared with their previous saved check-up.`,
    }
  }

  return {
    direction: 'steady',
    label: 'Mostly steady',
    detail: `${latest.personLabel}'s ${latest.periodLabel} is close to their previous saved check-up.`,
  }
}

const getLargestGap = (scores) => {
  return principles
    .map((principle) => ({
      ...principle,
      gap: Math.abs(scores.me.principleScores[principle.id] - scores.partner.principleScores[principle.id]),
      meScore: scores.me.principleScores[principle.id],
      partnerScore: scores.partner.principleScores[principle.id],
    }))
    .sort((a, b) => b.gap - a.gap)[0]
}

const promptLibrary = {
  recognition: {
    prompt: 'What is one effort from this week that you wish I noticed more clearly?',
    action: 'Name one specific thing you appreciated before the next check-in.',
  },
  acceptance: {
    prompt: 'Where did you feel most able, or least able, to be yourself with me?',
    action: 'Ask one curious question before giving advice or correction.',
  },
  stability: {
    prompt: 'What moment felt emotionally predictable, and what moment felt shaky?',
    action: 'Agree on one calming repair phrase to use during tension.',
  },
  initiative: {
    prompt: 'Where did effort feel balanced, and where did one person carry too much?',
    action: 'Let each person choose one small act of care to initiate this period.',
  },
  intimacy: {
    prompt: 'What feeling have you been holding that you would like me to understand better?',
    action: 'Make ten uninterrupted minutes for a no-fixing, just-listening conversation.',
  },
  safety: {
    prompt: 'What helped you feel safe recently, and what boundary needs more respect?',
    action: 'Repeat one boundary or need back in your own words before responding.',
  },
}

const getLowestPrinciple = (principleScores) => (
  principles
    .map((principle) => ({ ...principle, score: principleScores[principle.id] ?? 100 }))
    .sort((a, b) => a.score - b.score)[0]
)

const createReflection = (entry, scores, partnerLabel = people.partner.label) => {
  const lowest = getLowestPrinciple(entry.principleScores)
  const largestGap = getLargestGap(scores)
  const prompt = promptLibrary[lowest.id]

  return {
    id: `reflection-${entry.id}`,
    action: prompt.action,
    createdAt: entry.createdAt,
    entryId: entry.id,
    gapDetail: `${largestGap.title}: Me ${largestGap.meScore}/100, ${partnerLabel} ${largestGap.partnerScore}/100.`,
    lowestPrinciple: lowest,
    periodLabel: entry.periodLabel,
    prompt: prompt.prompt,
    title: `${lowest.title} needs the gentlest attention right now.`,
  }
}

const createDiscussionItem = (reflection) => ({
  id: `talk-${reflection.entryId}`,
  action: reflection.action,
  createdAt: reflection.createdAt,
  principleId: reflection.lowestPrinciple.id,
  principleTitle: reflection.lowestPrinciple.title,
  prompt: reflection.prompt,
  resolved: false,
  source: reflection.periodLabel,
})

const normalizeDiscussionItems = (items) => {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item) => ({
    ...item,
    resolved: Boolean(item.resolved),
  }))
}

const getMilestones = (history) => {
  const dailyWindows = new Set(history.filter((entry) => entry.period === 'daily').map((entry) => entry.periodWindow ?? entry.createdAt?.slice(0, 10)))
  const weeklyEntries = history.filter((entry) => entry.period === 'weekly')
  const monthlyEntries = history.filter((entry) => entry.period === 'monthly')
  const latest = history[0]
  const previousSamePerson = latest && history.find((entry) => (
    entry.person === latest.person && entry.period === latest.period && entry.id !== latest.id
  ))

  return [
    {
      done: history.length > 0,
      title: 'First check-up submitted',
      detail: history.length > 0 ? 'The shared history has begun.' : 'Submit any check-up to start the record.',
    },
    {
      done: dailyWindows.size >= 1 && ['me', 'partner'].every((person) => history.some((entry) => entry.period === 'daily' && entry.person === person)),
      title: 'Both partners shared a daily check-in',
      detail: 'A small daily rhythm makes mismatches easier to spot.',
    },
    {
      done: weeklyEntries.length >= 2,
      title: 'Weekly pattern started',
      detail: weeklyEntries.length >= 2 ? 'You have enough weekly entries to compare patterns.' : 'Two weekly entries unlock a clearer pattern.',
    },
    {
      done: monthlyEntries.length >= 2,
      title: 'First monthly review cycle',
      detail: monthlyEntries.length >= 2 ? 'Monthly reflection is becoming part of the relationship rhythm.' : 'Monthly reviews carry the heaviest score weight.',
    },
    {
      done: Boolean(latest && previousSamePerson && latest.overallScore > previousSamePerson.overallScore),
      title: 'Improvement spotted',
      detail: latest && previousSamePerson && latest.overallScore > previousSamePerson.overallScore
        ? `${latest.personLabel}'s ${latest.periodLabel} improved by ${latest.overallScore - previousSamePerson.overallScore} points.`
        : 'Submit repeated check-ups to reveal improvement.',
    },
  ]
}

const PersonSwitch = ({ activePerson, onChange }) => (
  <div className="person-switch" aria-label="Current perspective">
    {Object.values(people).map((person) => (
      <button
        className={activePerson === person.id ? 'active' : ''}
        type="button"
        onClick={() => onChange(person.id)}
        key={person.id}
      >
        {person.label}
      </button>
    ))}
  </div>
)

const PrincipleCard = ({ onOpen, principle, coupleScore, meScore, partnerScore, partnerLabel = people.partner.label }) => {
  const gap = Math.abs(meScore - partnerScore)

  return (
    <article className={`card card-${principle.tone}`}>
      <div className="card-art">
        <img
          src={dashboard}
          alt=""
          style={{
            '--crop-x': `${(principle.cropX / 1536) * 100}%`,
            '--crop-y': `${(principle.cropY / 1024) * 100}%`,
          }}
        />
        <span className={`badge badge-${principle.icon}`} aria-hidden="true"></span>
      </div>

      <div className="card-body">
        <h2>
          <span className={`title-icon badge-${principle.icon}`} aria-hidden="true"></span>
          {principle.title}
        </h2>

        <p>{principle.meaning}</p>

        <div className="score-row">
          <div
            className="progress"
            role="meter"
            aria-label={`${principle.title} couple score`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={coupleScore}
          >
            <span
              className="progress-fill"
              style={{ width: `${coupleScore}%` }}
            ></span>
          </div>
          <strong>{coupleScore}/100</strong>
        </div>

        <div className="comparison-row">
          <span>Me <b>{meScore}</b></span>
          <span>{partnerLabel} <b>{partnerScore}</b></span>
          <span>Gap <b>{gap}</b></span>
        </div>
        <button className="card-detail-button" type="button" onClick={() => onOpen(principle.id)}>
          View detail
        </button>
      </div>
    </article>
  )
}

const MilestonesPanel = ({ history }) => (
  <section className="milestone-panel" aria-label="Relationship milestones">
    <div className="history-heading">
      <span className="eyebrow">Milestones</span>
      <strong>{getMilestones(history).filter((milestone) => milestone.done).length}/5 reached</strong>
    </div>
    <div className="milestone-list">
      {getMilestones(history).map((milestone) => (
        <article className={milestone.done ? 'milestone done' : 'milestone'} key={milestone.title}>
          <span>{milestone.done ? 'Done' : 'Next'}</span>
          <strong>{milestone.title}</strong>
          <p>{milestone.detail}</p>
        </article>
      ))}
    </div>
  </section>
)

const ReflectionPanel = ({ onAddToTalk, onClose, reflection }) => {
  if (!reflection) {
    return null
  }

  return (
    <section className="reflection-panel">
      <div>
        <span className="eyebrow">After-submit reflection</span>
        <h2>{reflection.title}</h2>
        <p>{reflection.lowestPrinciple.title} scored {reflection.lowestPrinciple.score}/100 in this submission.</p>
        <p><strong>Conversation:</strong> {reflection.prompt}</p>
        <p><strong>Small action:</strong> {reflection.action}</p>
        <small>{reflection.gapDetail}</small>
      </div>
      <div className="reflection-actions">
        <button type="button" onClick={() => onAddToTalk(reflection)}>Add to Talk queue</button>
        <button className="secondary-button" type="button" onClick={onClose}>Dismiss</button>
      </div>
    </section>
  )
}

const Overview = ({ onOpenPrinciple, scores, history, partnerLabel = people.partner.label, setActivePage }) => {
  const latestEntries = history.slice(0, 4)
  const trend = getTrendSummary(history)
  const latestEntry = history[0]
  const largestGap = getLargestGap(scores)

  return (
    <>
      <section className="score-hero" id="overview">
        <div>
          <span className="eyebrow">Shared couple score</span>
          <h1>{scores.couple.overallScore}/100</h1>
          <p>
            Overview uses the latest submitted check-ups from each person. Draft slider changes
            stay private until they are saved.
          </p>
        </div>

        <div className="couple-score-stack" aria-label="Score comparison">
          <div>
            <span>Me</span>
            <strong>{scores.me.overallScore}</strong>
          </div>
          <div>
            <span>{partnerLabel}</span>
            <strong>{scores.partner.overallScore}</strong>
          </div>
          <div>
            <span>Largest gap</span>
            <strong>{largestGap.gap}</strong>
          </div>
        </div>
      </section>

      <section className="insight-grid overview-insights" aria-label="Relationship trends">
        <article className={`insight-card trend-${trend.direction}`}>
          <span className="eyebrow">Trend</span>
          <h2>{trend.label}</h2>
          <p>{trend.detail}</p>
          {latestEntry && (
            <small>
              Latest: {latestEntry.personLabel} saved {latestEntry.periodLabel} on {formatDate(latestEntry.createdAt)}
            </small>
          )}
        </article>

        <article className="insight-card">
          <span className="eyebrow">Largest feeling gap</span>
          <h2>{largestGap.title}</h2>
          <p>
            Me: {largestGap.meScore}/100. {partnerLabel}: {largestGap.partnerScore}/100.
            A high gap can mean one person is having a meaningfully different experience.
          </p>
        </article>

        <article className="history-card">
          <div className="history-heading">
            <span className="eyebrow">Recent shared history</span>
            <strong>{history.length} saved</strong>
          </div>
          {latestEntries.length > 0 ? (
            <ul>
              {latestEntries.map((entry) => (
                <li key={entry.id}>
                  <span>
                    <strong>{entry.personLabel} - {entry.periodLabel}</strong>
                    <small>{formatDate(entry.createdAt)}</small>
                  </span>
                  <b>{entry.overallScore}/100</b>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved check-ups yet.</p>
          )}
        </article>
      </section>

      <section className="quick-entry-panel">
        <span className="eyebrow">Next check-in</span>
        <h2>Record both sides when you are ready.</h2>
        <button type="button" onClick={() => setActivePage('checkups')}>
          Open check-ups
        </button>
      </section>

      <MilestonesPanel history={history} />

      <div className="grid">
        {principles.map((principle) => (
          <PrincipleCard
            onOpen={onOpenPrinciple}
            principle={principle}
            coupleScore={scores.couple.principleScores[principle.id]}
            meScore={scores.me.principleScores[principle.id]}
            partnerScore={scores.partner.principleScores[principle.id]}
            partnerLabel={partnerLabel}
            key={principle.id}
          />
        ))}
      </div>
    </>
  )
}

const CheckupsPage = (props) => {
  const [selectedPeriod, setSelectedPeriod] = useState('daily')
  const { activePerson, responsesByPerson, notesByPerson, history, canSwitchPerson } = props

  return (
    <section className="checkups-page">
      <header className="checkups-hero">
        <div>
          <span className="eyebrow">Shared check-ins</span>
          <h1>Check-ups</h1>
          <p>
            {canSwitchPerson
              ? 'Choose a cadence, then switch between Me and Partner to record each side separately.'
              : 'Choose a cadence and submit your own feelings. Your partner sees them in the shared workspace.'}
          </p>
        </div>

        <div className="period-tabs" aria-label="Check-up cadence">
          {Object.keys(questionSets).map((period) => (
            (() => {
              const availability = getPeriodAvailability(period, history, activePerson)

              return (
                <button
                  className={`${selectedPeriod === period ? 'active' : ''} ${availability.isSubmitted ? 'locked' : ''}`}
                  type="button"
                  onClick={() => setSelectedPeriod(period)}
                  key={period}
                >
                  <span>{availability.isSubmitted ? 'Submitted' : questionSets[period].eyebrow}</span>
                  {questionSets[period].title.replace(' check-up', '')}
                </button>
              )
            })()
          ))}
        </div>
      </header>

      <SurveyPage
        {...props}
        period={selectedPeriod}
        responses={responsesByPerson[activePerson][selectedPeriod]}
        note={notesByPerson[activePerson][selectedPeriod]}
      />
    </section>
  )
}

const SurveyPage = ({
  period,
  activePerson,
  responses,
  note,
  history,
  onAnswerChange,
  onNoteChange,
  onReset,
  onSave,
  canSwitchPerson = true,
}) => {
  const set = questionSets[period]
  const person = people[activePerson]
  const periodHistory = history.filter((entry) => entry.period === period && entry.person === activePerson)
  const latestEntry = periodHistory[0]
  const availability = getPeriodAvailability(period, history, activePerson)
  const periodAverage = Math.round(
    principles.reduce((total, principle) => (
      total + getPeriodPrincipleScore(responses[principle.id])
    ), 0) / principles.length,
  )

  return (
    <section className="checkup-page">
      <header className="checkup-hero">
        <div>
          <span className="eyebrow">{set.eyebrow}</span>
          <h1>{set.title}</h1>
          <p>{person.label} is filling this in. {set.summary}</p>
          <small className="checkup-window">
            {availability.isSubmitted
              ? `Already submitted for this ${period}. Opens again ${formatDate(availability.end)}.`
              : `Open now. Submit before ${formatDate(availability.end)}.`}
          </small>
        </div>

        <div className="checkup-side">
          {canSwitchPerson && (
            <PersonSwitch activePerson={activePerson} onChange={onAnswerChange.switchPerson} />
          )}
          <div className="checkup-score">
            <span>{person.possessive} draft average</span>
            <strong>{periodAverage}/100</strong>
            <small>{set.weightLabel} after submit</small>
          </div>
        </div>
      </header>

      <div className="survey-grid">
        {principles.map((principle) => {
          const answers = responses[principle.id]
          const score = getPeriodPrincipleScore(answers)

          return (
            <article className={`survey-card card-${principle.tone}`} key={principle.id}>
              <div className="survey-card-header">
                <h2>
                  <span className={`title-icon badge-${principle.icon}`} aria-hidden="true"></span>
                  {principle.title}
                </h2>
                <strong>{score}/100</strong>
              </div>

              {set.questions[principle.id].map((question, index) => (
                <label className="question-row" key={question}>
                  <span>{question}</span>
                  <div className="range-wrap">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={answers[index]}
                      onChange={(event) => onAnswerChange.update(period, activePerson, principle.id, index, Number(event.target.value))}
                      aria-label={`${person.label}: ${question}`}
                    />
                    <output>{ratingLabels[answers[index] - 1]}</output>
                  </div>
                </label>
              ))}
            </article>
          )
        })}
      </div>

      <footer className="survey-actions">
        <div>
          <p>
            {availability.isSubmitted
              ? `This ${period} check-up has already been submitted for the current window.`
              : `These answers are a draft. Save when ${person.label.toLowerCase()} is ready to submit this check-up to the shared Overview and History.`}
          </p>
          {latestEntry && (
            <small>
              {person.label} last saved {formatDate(latestEntry.createdAt)} at {latestEntry.overallScore}/100.
            </small>
          )}
        </div>

        <label className="note-field">
          <span>{person.possessive} optional reflection</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(period, activePerson, event.target.value)}
            placeholder="What caused these scores?"
            rows="3"
          />
        </label>

        <div className="survey-button-row">
          <button type="button" onClick={() => onReset(period, activePerson)}>
            Reset
          </button>
          <button type="button" disabled={availability.isSubmitted} onClick={() => onSave(period, activePerson)}>
            {availability.isSubmitted ? 'Submitted' : `Save as ${person.label}`}
          </button>
        </div>
      </footer>
    </section>
  )
}

const HistoryPage = ({ history, setActivePage }) => {
  const historyByPeriod = Object.keys(questionSets).map((period) => ({
    period,
    ...questionSets[period],
    entries: history.filter((entry) => entry.period === period),
  }))

  return (
    <section className="history-page">
      <header className="history-hero">
        <div>
          <span className="eyebrow">Shared saved check-ups</span>
          <h1>History</h1>
          <p>
            Review saved Daily, Weekly, and Monthly check-ups from both people,
            including notes and principle-by-principle scores.
          </p>
        </div>

        <div className="history-summary">
          <strong>{history.length}</strong>
          <span>saved check-ups</span>
        </div>
      </header>

      <div className="history-period-grid">
        {historyByPeriod.map(({ period, title, weightLabel, entries }) => (
          <section className="history-period" key={period}>
            <div className="history-period-header">
              <div>
                <span className="eyebrow">{weightLabel}</span>
                <h2>{title}</h2>
              </div>
              <strong>{entries.length}</strong>
            </div>

            {entries.length > 0 ? (
              <div className="history-entry-list">
                {entries.map((entry) => (
                  <article className={`history-entry person-${entry.person}`} key={entry.id}>
                    <div className="history-entry-top">
                      <span>{entry.personLabel} - {formatDate(entry.createdAt)}</span>
                      <strong>{entry.overallScore}/100</strong>
                    </div>

                    {entry.note && <p>{entry.note}</p>}

                    <div className="principle-chip-grid">
                      {principles.map((principle) => (
                        <span className={`principle-chip chip-${principle.tone}`} key={principle.id}>
                          {principle.title}
                          <b>{entry.principleScores?.[principle.id] ?? '--'}</b>
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <p>No saved {title.toLowerCase()} entries yet.</p>
                <button type="button" onClick={() => setActivePage('checkups')}>
                  Start {title}
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}

const PrincipleDetailPage = ({ history, onAddPrompt, partnerLabel, principle, scores, setActivePage }) => {
  const entries = history
    .filter((entry) => entry.principleScores?.[principle.id] !== undefined)
    .slice(0, 8)
  const prompt = promptLibrary[principle.id]
  const meScore = scores.me.principleScores[principle.id]
  const partnerScore = scores.partner.principleScores[principle.id]
  const gap = Math.abs(meScore - partnerScore)

  return (
    <section className="principle-detail-page">
      <header className={`principle-detail-hero card-${principle.tone}`}>
        <div>
          <span className="eyebrow">Principle detail</span>
          <h1>{principle.title}</h1>
          <p>{principle.meaning}</p>
        </div>
        <div className="principle-detail-score">
          <span>Couple score</span>
          <strong>{scores.couple.principleScores[principle.id]}/100</strong>
          <small>Gap {gap} points</small>
        </div>
      </header>

      <section className="detail-grid">
        <article className="detail-card">
          <span className="eyebrow">Comparison</span>
          <h2>Me {meScore}/100 · {partnerLabel} {partnerScore}/100</h2>
          <p>{gap >= 15 ? 'This is a meaningful mismatch worth discussing gently.' : 'This principle looks relatively aligned right now.'}</p>
        </article>
        <article className="detail-card">
          <span className="eyebrow">Talk prompt</span>
          <h2>{prompt.prompt}</h2>
          <p>{prompt.action}</p>
          <button type="button" onClick={() => onAddPrompt(principle.id)}>Add to Talk queue</button>
        </article>
      </section>

      <section className="detail-card">
        <div className="history-heading">
          <span className="eyebrow">Recent notes and scores</span>
          <button type="button" onClick={() => setActivePage('overview')}>Back to overview</button>
        </div>
        {entries.length > 0 ? (
          <div className="detail-entry-list">
            {entries.map((entry) => (
              <article key={entry.id}>
                <strong>{entry.personLabel} · {entry.periodLabel} · {entry.principleScores[principle.id]}/100</strong>
                <span>{formatDate(entry.createdAt)}</span>
                {entry.note && <p>{entry.note}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p>No submitted notes for this principle yet.</p>
        )}
      </section>
    </section>
  )
}

const TalkQueuePage = ({ items, onResolveItem, onReopenItem, setActivePage }) => {
  const openItems = items.filter((item) => !item.resolved)
  const resolvedItems = items.filter((item) => item.resolved)

  return (
    <section className="talk-page">
      <header className="talk-hero">
        <div>
          <span className="eyebrow">Talk about this</span>
          <h1>Conversation Queue</h1>
          <p>Prompts from reflections and principle details live here until you mark them discussed.</p>
        </div>
        <button type="button" onClick={() => setActivePage('overview')}>Back to overview</button>
      </header>

      <div className="talk-grid">
        <section className="talk-column">
          <div className="history-heading">
            <span className="eyebrow">Open</span>
            <strong>{openItems.length}</strong>
          </div>
          {openItems.length > 0 ? openItems.map((item) => (
            <article className="talk-card" key={item.id}>
              <span>{item.principleTitle} · {item.source}</span>
              <h2>{item.prompt}</h2>
              <p>{item.action}</p>
              <button type="button" onClick={() => onResolveItem(item.id)}>Mark discussed</button>
            </article>
          )) : <p className="empty-talk">No open prompts. Add one from a reflection or principle page.</p>}
        </section>

        <section className="talk-column">
          <div className="history-heading">
            <span className="eyebrow">Discussed</span>
            <strong>{resolvedItems.length}</strong>
          </div>
          {resolvedItems.length > 0 ? resolvedItems.map((item) => (
            <article className="talk-card resolved" key={item.id}>
              <span>{item.principleTitle}</span>
              <h2>{item.prompt}</h2>
              <button type="button" onClick={() => onReopenItem(item.id)}>Reopen</button>
            </article>
          )) : <p className="empty-talk">Resolved prompts will appear here.</p>}
        </section>
      </div>
    </section>
  )
}

const HealthPage = ({
  checks,
  checkedAt,
  couple,
  hasPartner,
  isRunning,
  onRunHealthCheck,
  requests,
  session,
}) => {
  const summary = checks.reduce(
    (totals, check) => ({
      ...totals,
      [check.status]: (totals[check.status] ?? 0) + 1,
    }),
    { pass: 0, warn: 0, fail: 0 },
  )

  return (
    <section className="health-page">
      <header className="health-hero">
        <div>
          <span className="eyebrow">System health</span>
          <h1>Setup Check</h1>
          <p>
            Run a quick read-only check against Supabase auth, database tables, the request function,
            realtime, and your current couple state.
          </p>
        </div>

        <div className="health-actions">
          <button type="button" onClick={onRunHealthCheck} disabled={isRunning}>
            {isRunning ? 'Checking...' : 'Run checks'}
          </button>
          {checkedAt && <small>Last checked {formatDate(checkedAt)}</small>}
        </div>
      </header>

      <div className="health-summary-grid">
        <article className="health-summary-card pass">
          <strong>{summary.pass}</strong>
          <span>Passing</span>
        </article>
        <article className="health-summary-card warn">
          <strong>{summary.warn}</strong>
          <span>Warnings</span>
        </article>
        <article className="health-summary-card fail">
          <strong>{summary.fail}</strong>
          <span>Needs attention</span>
        </article>
      </div>

      <div className="health-context">
        <span>{session ? `Signed in as ${session.user.email}` : 'Not signed in'}</span>
        <span>{couple ? `Couple code ${couple.invite_code}` : 'No couple workspace yet'}</span>
        <span>{hasPartner ? 'Partner connected' : 'Partner not connected'}</span>
        <span>{requests.length} pending request{requests.length === 1 ? '' : 's'}</span>
      </div>

      <div className="health-check-list">
        {checks.map((check) => (
          <article className={`health-check status-${check.status}`} key={check.id}>
            <div>
              <span>{check.label}</span>
              <strong>{check.title}</strong>
            </div>
            <p>{check.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const ProfilePage = ({ profile, profileExtras = { bio: '', social_links: {} }, session, onSaveProfile }) => {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profileExtras.bio ?? '')
  const [instagram, setInstagram] = useState(profileExtras.social_links?.instagram ?? '')
  const [x, setX] = useState(profileExtras.social_links?.x ?? '')
  const [website, setWebsite] = useState(profileExtras.social_links?.website ?? '')
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(session.user.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="profile-page">
      <header className="profile-hero">
        <div>
          <span className="eyebrow">Personal profile</span>
          <h1>Your Profile</h1>
          <p>
            Choose the name your partner sees in check-ups and add optional links that help your account feel like you.
          </p>
        </div>
        <button type="button" onClick={copyId}>{copied ? 'Copied ID' : 'Copy user ID'}</button>
      </header>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSaveProfile({
            display_name: displayName.trim(),
            bio: bio.trim(),
            social_links: {
              instagram: instagram.trim(),
              x: x.trim(),
              website: website.trim(),
            },
          })
        }}
      >
        <label>
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="How your partner should see you"
            required
          />
        </label>
        <label>
          <span>Short bio</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Optional note about you"
            rows="4"
          />
        </label>
        <div className="profile-link-grid">
          <label>
            <span>Instagram</span>
            <input value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="@name or URL" />
          </label>
          <label>
            <span>X / Twitter</span>
            <input value={x} onChange={(event) => setX(event.target.value)} placeholder="@name or URL" />
          </label>
          <label>
            <span>Website</span>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." />
          </label>
        </div>
        <div className="profile-meta">
          <span>Email: {session.user.email}</span>
          <span>User ID: <code>{session.user.id}</code></span>
        </div>
        <button type="submit">Save profile</button>
      </form>
    </section>
  )
}

const OnboardingPage = ({
  couple,
  hasPartner,
  onAcceptRequest,
  onCancelRequest,
  onCreateCouple,
  onFindPartner,
  onJoinCouple,
  onRejectRequest,
  onSendCoupleRequest,
  onStartCheckup,
  partnerProfile,
  profile,
  requests,
  session,
  setActivePage,
}) => {
  const [partnerQuery, setPartnerQuery] = useState('')
  const [foundPartnerProfile, setFoundPartnerProfile] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  const incomingCount = requests.filter((request) => request.direction === 'incoming').length
  const outgoingCount = requests.filter((request) => request.direction === 'outgoing').length
  const displayName = profile?.display_name || session.user.email
  const partnerLabel = partnerProfile?.display_name || partnerProfile?.email || people.partner.label

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(session.user.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="onboarding-page">
      <header className="onboarding-hero">
        <div>
          <span className="eyebrow">Couple setup</span>
          <h1>{hasPartner ? `You are connected with ${partnerLabel}.` : 'Connect your partner to unlock check-ups.'}</h1>
          <p>
            {hasPartner
              ? 'Both accounts are linked. You can now submit your own feelings and see your partner\'s submitted check-ups.'
              : 'Follow these steps once. After your partner accepts, the dashboard unlocks automatically.'}
          </p>
        </div>
        {hasPartner && <button type="button" onClick={onStartCheckup}>Start daily check-up</button>}
      </header>

      <div className="onboarding-steps">
        <article className="onboarding-step">
          <span className="step-number">1</span>
          <div>
            <h2>Your identity</h2>
            <p>You are signed in as <strong>{displayName}</strong>. Your partner can find you by email or user ID.</p>
            <div className="copy-id-row">
              <code>{session.user.id}</code>
              <button type="button" onClick={copyId}>{copied ? 'Copied' : 'Copy ID'}</button>
            </div>
            <button className="secondary-button" type="button" onClick={() => setActivePage('profile')}>
              Edit profile
            </button>
          </div>
        </article>

        <article className="onboarding-step">
          <span className="step-number">2</span>
          <div>
            <h2>Connect with partner</h2>
            <p>Search by email or ID, then send a request. Your partner accepts it from their account.</p>
            <div className="onboarding-actions">
              <label>
                <span>Partner ID or email</span>
                <input
                  value={partnerQuery}
                  onChange={(event) => {
                    setPartnerQuery(event.target.value)
                    setFoundPartnerProfile(null)
                  }}
                  placeholder="uuid or email"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  const found = await onFindPartner(partnerQuery)
                  setFoundPartnerProfile(found)
                }}
              >
                Look up
              </button>
              {foundPartnerProfile && (
                <button type="button" onClick={() => onSendCoupleRequest(foundPartnerProfile.id)}>
                  Send request to {foundPartnerProfile.display_name || foundPartnerProfile.email}
                </button>
              )}
            </div>
            <div className="request-counts">
              <span>{incomingCount} incoming</span>
              <span>{outgoingCount} outgoing</span>
            </div>
            <CoupleRequestList
              requests={requests}
              onAcceptRequest={onAcceptRequest}
              onCancelRequest={onCancelRequest}
              onRejectRequest={onRejectRequest}
            />
          </div>
        </article>

        <article className="onboarding-step">
          <span className="step-number">3</span>
          <div>
            <h2>{hasPartner ? 'Partner connected' : 'Fallback: invite code'}</h2>
            <p>
              {hasPartner
                ? `${partnerLabel} is connected. The relationship dashboard is ready.`
                : 'Request-based pairing is best, but invite codes are available if searching is inconvenient.'}
            </p>
            {!hasPartner && (
              <div className="onboarding-actions">
                {!couple && <button type="button" onClick={() => onCreateCouple()}>Create invite code</button>}
                {couple && <strong className="invite-pill">Your code: {couple.invite_code}</strong>}
                <label>
                  <span>Invite code</span>
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    placeholder="AB12CD34"
                  />
                </label>
                <button type="button" onClick={() => onJoinCouple(inviteCode)}>Join by code</button>
              </div>
            )}
            {hasPartner && <button type="button" onClick={onStartCheckup}>Open check-ups</button>}
          </div>
        </article>
      </div>
    </section>
  )
}

const AuthForm = ({ onGoogleSignIn, onEmailSignIn, onEmailSignUp, message, landing = false }) => {
  const [authMode, setAuthMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submitLabel = authMode === 'sign-in' ? 'Log in' : 'Sign up'
  const toggleLabel = authMode === 'sign-in' ? 'Need an account?' : 'Already registered?'

  return (
    <form
      className={landing ? 'auth-form landing-auth-form' : 'auth-form'}
      onSubmit={(event) => {
        event.preventDefault()
        if (!email.trim()) {
          return
        }

        if (authMode === 'sign-in') {
          onEmailSignIn(email, password)
        } else {
          onEmailSignUp(email, password)
        }
      }}
    >
      <div className="auth-mode-tabs" aria-label="Authentication mode">
        <button
          className={authMode === 'sign-in' ? 'active' : ''}
          type="button"
          onClick={() => setAuthMode('sign-in')}
        >
          Log In
        </button>
        <button
          className={authMode === 'register' ? 'active' : ''}
          type="button"
          onClick={() => setAuthMode('register')}
        >
          Sign Up
        </button>
      </div>
      <label>
        <span>Email</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>Password</span>
        <input
          autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
          minLength="6"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
          type="password"
          value={password}
        />
      </label>
      {message && <p className="auth-error">{message}</p>}
      <button type="submit">{submitLabel}</button>
      <button
        className="secondary-button"
        type="button"
        onClick={() => setAuthMode(authMode === 'sign-in' ? 'register' : 'sign-in')}
      >
        {toggleLabel}
      </button>
      <button className="secondary-button" type="button" onClick={onGoogleSignIn}>
        Continue with Google
      </button>
    </form>
  )
}

const AuthLanding = ({ message, onGoogleSignIn, onEmailSignIn, onEmailSignUp }) => (
  <main className="auth-landing-page">
    <section className="auth-landing-shell">
      <div className="auth-landing-copy">
        <span className="eyebrow">Purrfect Relationship Dashboard</span>
        <h1>Track feelings together, not from one side of the story.</h1>
        <p>
          Share daily, weekly, and monthly check-ups with your partner. Each person submits their own feelings,
          then both of you can see patterns across recognition, acceptance, safety, intimacy, stability, and initiative.
        </p>
        <div className="auth-feature-grid">
          <article>
            <strong>Private couple space</strong>
            <span>Connect by request before any check-ups unlock.</span>
          </article>
          <article>
            <strong>Weighted check-ins</strong>
            <span>Daily, weekly, and monthly answers shape the relationship score.</span>
          </article>
          <article>
            <strong>Shared history</strong>
            <span>See your partner's submitted feelings alongside your own.</span>
          </article>
        </div>
      </div>

      <section className="auth-landing-card" aria-label="Authentication">
        <span className="eyebrow">Start here</span>
        <h2>Log In or Sign Up</h2>
        <AuthForm
          landing
          message={message}
          onGoogleSignIn={onGoogleSignIn}
          onEmailSignIn={onEmailSignIn}
          onEmailSignUp={onEmailSignUp}
        />
      </section>
    </section>
  </main>
)

const AuthPanel = ({ session, onSignOut }) => {
  if (!isSupabaseConfigured) {
    return (
      <section className="auth-panel">
        <div>
          <span className="eyebrow">Local prototype mode</span>
          <h2>Connect Supabase to enable real couple sharing.</h2>
          <p>Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run the SQL in `supabase-schema.sql`.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="auth-panel compact">
      <div>
        <span className="eyebrow">Signed in</span>
        <h2>{session.user.user_metadata?.full_name ?? session.user.email}</h2>
        <p className="user-id-line">Your ID: <code>{session.user.id}</code></p>
      </div>
      <button type="button" onClick={onSignOut}>Sign out</button>
    </section>
  )
}

const HeaderStatus = ({
  couple,
  hasPartner,
  onSignOut,
  partnerProfile,
  profile,
  requests,
  session,
  setActivePage,
}) => {
  const displayName = profile?.display_name || session?.user?.email || 'Signed in'
  const partnerLabel = partnerProfile?.display_name || partnerProfile?.email || people.partner.label
  const pendingCount = requests.length

  return (
    <div className="header-status" aria-label="Account and couple status">
      <button className="status-pill user-pill" type="button" onClick={() => setActivePage('profile')}>
        <span>Signed in</span>
        <strong>{displayName}</strong>
      </button>
      <button className="status-pill couple-pill" type="button" onClick={() => setActivePage('overview')}>
        <span>{hasPartner ? 'Connected couple' : pendingCount > 0 ? `${pendingCount} pending` : 'Setup needed'}</span>
        <strong>{hasPartner ? partnerLabel : couple ? `Code ${couple.invite_code}` : 'Find partner'}</strong>
      </button>
      <button className="header-signout" type="button" onClick={onSignOut}>Sign out</button>
    </div>
  )
}

const CoupleRequestList = ({ requests, onAcceptRequest, onCancelRequest, onRejectRequest }) => {
  const incoming = requests.filter((request) => request.direction === 'incoming')
  const outgoing = requests.filter((request) => request.direction === 'outgoing')

  if (requests.length === 0) {
    return (
      <div className="request-empty">
        No pending requests yet.
      </div>
    )
  }

  return (
    <div className="request-list">
      {incoming.map((request) => (
        <article className="request-card" key={request.id}>
          <div>
            <strong>{request.otherProfile.display_name || request.otherProfile.email}</strong>
            <span>wants to connect with you. Sent {formatDate(request.created_at)}.</span>
          </div>
          <div className="request-actions">
            <button type="button" onClick={() => onAcceptRequest(request.id)}>Accept</button>
            <button className="secondary-button" type="button" onClick={() => onRejectRequest(request.id)}>Reject</button>
          </div>
        </article>
      ))}

      {outgoing.map((request) => (
        <article className="request-card" key={request.id}>
          <div>
            <strong>{request.otherProfile.display_name || request.otherProfile.email}</strong>
            <span>has not answered yet. Sent {formatDate(request.created_at)}.</span>
          </div>
          <div className="request-actions">
            <button className="secondary-button" type="button" onClick={() => onCancelRequest(request.id)}>Cancel</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function App() {
  const [savedState] = useState(getSavedState)
  const [activePage, setActivePage] = useState('overview')
  const [selectedPrincipleId, setSelectedPrincipleId] = useState(principles[0].id)
  const [activePerson, setActivePerson] = useState('me')
  const [responses, setResponses] = useState(savedState.responses)
  const [notes, setNotes] = useState(savedState.notes)
  const [history, setHistory] = useState(savedState.history)
  const [discussionItems, setDiscussionItems] = useState(savedState.discussionItems)
  const [lastReflection, setLastReflection] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileExtras, setProfileExtras] = useState({ bio: '', social_links: {} })
  const [couple, setCouple] = useState(null)
  const [coupleMembers, setCoupleMembers] = useState([])
  const [coupleMemberProfiles, setCoupleMemberProfiles] = useState({})
  const [coupleRequests, setCoupleRequests] = useState([])
  const [healthChecks, setHealthChecks] = useState([
    {
      id: 'start',
      label: 'Ready',
      title: 'Health checks have not run yet.',
      detail: 'Run checks to inspect Supabase setup, auth, requests, realtime, and couple readiness.',
      status: 'warn',
    },
  ])
  const [healthCheckedAt, setHealthCheckedAt] = useState(null)
  const [isHealthRunning, setIsHealthRunning] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const scores = useMemo(() => calculateSubmittedCoupleScores(history), [history])
  const hasPartner = coupleMembers.length >= 2
  const partnerProfile = useMemo(() => (
    Object.values(coupleMemberProfiles).find((profile) => profile.id !== session?.user.id) ?? null
  ), [coupleMemberProfiles, session])
  const partnerLabel = partnerProfile?.display_name || partnerProfile?.email || people.partner.label
  const isRemoteReady = isSupabaseConfigured && session && couple && hasPartner
  const shouldGateRemoteApp = isSupabaseConfigured && (!session || !couple || !hasPartner)

  const runHealthCheck = async () => {
    setIsHealthRunning(true)
    setStatusMessage('')

    const nextChecks = []
    const addCheck = (id, status, title, detail, label = status.toUpperCase()) => {
      nextChecks.push({ id, status, title, detail, label })
      setHealthChecks([...nextChecks])
    }

    try {
      addCheck(
        'supabase-config',
        isSupabaseConfigured ? 'pass' : 'fail',
        isSupabaseConfigured ? 'Supabase environment is configured.' : 'Supabase environment is missing.',
        isSupabaseConfigured
          ? 'The app has a Supabase URL and anon key.'
          : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
      )

      if (!isSupabaseConfigured) {
        return
      }

      addCheck(
        'auth-session',
        session ? 'pass' : 'fail',
        session ? 'User session is active.' : 'No authenticated session.',
        session ? `Signed in as ${session.user.email}.` : 'Log in before testing protected database access.',
      )

      if (!session) {
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()

      addCheck(
        'profile',
        profileError ? 'fail' : 'pass',
        profileError ? 'Profile query failed.' : 'Profile access works.',
        profileError ? getFriendlyError(profileError, 'Could not read your profile.') : 'The profiles table and RLS policy are reachable.',
      )

      const { error: requestTableError } = await supabase
        .from('couple_requests')
        .select('id')
        .limit(1)

      addCheck(
        'couple-requests-table',
        requestTableError ? 'fail' : 'pass',
        requestTableError ? 'Couple requests table is not reachable.' : 'Couple requests table is reachable.',
        requestTableError
          ? getFriendlyError(requestTableError, 'Could not read couple requests.')
          : 'The couple_requests table exists in the API schema and its select policy allows your account to query pending requests.',
      )

      const { error: functionError } = await supabase.rpc('accept_couple_request', {
        target_request_id: crypto.randomUUID(),
      })
      const functionExists = !functionError || !(
        functionError.message?.includes('Could not find the function')
        || functionError.message?.includes('schema cache')
      )

      addCheck(
        'accept-function',
        functionExists ? 'pass' : 'fail',
        functionExists ? 'Accept request function is installed.' : 'Accept request function is missing.',
        functionExists
          ? 'The test call reached the function. A "request not found" response is expected for this harmless fake ID.'
          : getFriendlyError(functionError, 'Run the latest supabase-schema.sql to install accept_couple_request.'),
      )

      const realtimeResult = await new Promise((resolve) => {
        const channel = supabase.channel(`health-check-${session.user.id}-${Date.now()}`)
        const timer = window.setTimeout(() => {
          supabase.removeChannel(channel)
          resolve(false)
        }, 3500)

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            window.clearTimeout(timer)
            supabase.removeChannel(channel)
            resolve(true)
          }
        })
      })

      addCheck(
        'realtime',
        realtimeResult ? 'pass' : 'warn',
        realtimeResult ? 'Realtime connection is available.' : 'Realtime did not confirm a subscription quickly.',
        realtimeResult
          ? 'The client can connect to Supabase Realtime. Table events still require the latest schema publication changes.'
          : 'Run the latest schema and check that Realtime is enabled in your Supabase project.',
      )

      addCheck(
        'couple-state',
        couple ? 'pass' : 'warn',
        couple ? 'Couple workspace found.' : 'No couple workspace yet.',
        couple ? `Current invite code is ${couple.invite_code}.` : 'Send a request, accept a request, or join by invite code.',
      )

      addCheck(
        'partner-state',
        hasPartner ? 'pass' : 'warn',
        hasPartner ? 'Partner is connected.' : 'Partner is not connected yet.',
        hasPartner ? `Connected with ${partnerLabel}.` : 'The dashboard will stay locked until the couple has both members.',
      )

      addCheck(
        'submit-readiness',
        isRemoteReady ? 'pass' : 'warn',
        isRemoteReady ? 'Check-up submission is ready.' : 'Check-up submission is not ready yet.',
        isRemoteReady
          ? 'The app has a signed-in user, couple workspace, and partner membership.'
          : 'Complete partner setup before submitting check-ups.',
      )
    } catch (error) {
      addCheck(
        'unexpected-error',
        'fail',
        'Health check stopped early.',
        getFriendlyError(error, 'An unexpected health check error occurred.'),
      )
    } finally {
      setHealthCheckedAt(new Date().toISOString())
      setIsHealthRunning(false)
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ responses, notes, history, discussionItems }))
    } catch {
      // Storage is a convenience layer. The app should remain usable without it.
    }
  }, [responses, notes, history, discussionItems])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setProfileExtras({ bio: '', social_links: {} })
        setCouple(null)
        setCoupleMembers([])
        setCoupleMemberProfiles({})
        setCoupleRequests([])
        setHistory([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const upsertProfile = async (currentSession) => {
    if (!currentSession) {
      return
    }

    const { user } = currentSession
    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    const profile = {
      id: user.id,
      email: user.email,
      display_name: existingProfile?.display_name ?? user.user_metadata?.full_name ?? user.email,
      avatar_url: existingProfile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    }

    const { data, error } = await supabase.from('profiles').upsert(profile).select().single()

    if (error) {
      throw error
    }

    setProfile(data)

    try {
      setProfileExtras(JSON.parse(window.localStorage.getItem(getProfileExtrasKey(user.id))) ?? { bio: '', social_links: {} })
    } catch {
      setProfileExtras({ bio: '', social_links: {} })
    }
  }

  const loadCouple = async (currentSession = session) => {
    if (!isSupabaseConfigured || !currentSession) {
      return
    }

    await upsertProfile(currentSession)

    const { data: memberships, error: membershipError } = await supabase
      .from('couple_members')
      .select('couple_id, created_at')
      .eq('user_id', currentSession.user.id)
      .order('created_at', { ascending: false })

    if (membershipError) {
      throw membershipError
    }

    if (!memberships?.length) {
      setCouple(null)
      setCoupleMembers([])
      setCoupleMemberProfiles({})
      setHistory([])
      return
    }

    const coupleIds = memberships.map((membership) => membership.couple_id)
    const { data: allMemberRows, error: allMembersError } = await supabase
      .from('couple_members')
      .select('couple_id, user_id')
      .in('couple_id', coupleIds)

    if (allMembersError) {
      throw allMembersError
    }

    const memberCounts = allMemberRows.reduce((counts, member) => ({
      ...counts,
      [member.couple_id]: (counts[member.couple_id] ?? 0) + 1,
    }), {})
    const preferredMembership = memberships.find((membership) => memberCounts[membership.couple_id] >= 2) ?? memberships[0]

    const { data: coupleRow, error: coupleError } = await supabase
      .from('couples')
      .select('id, invite_code')
      .eq('id', preferredMembership.couple_id)
      .single()

    if (coupleError) {
      throw coupleError
    }

    setCouple(coupleRow)
  }

  const loadCoupleRequests = async (currentSession = session) => {
    if (!isSupabaseConfigured || !currentSession) {
      return
    }

    const { data: requests, error: requestError } = await supabase
      .from('couple_requests')
      .select('id, requester_id, recipient_id, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (requestError) {
      throw requestError
    }

    const otherIds = requests.map((request) => (
      request.requester_id === currentSession.user.id ? request.recipient_id : request.requester_id
    ))

    let profiles = []

    if (otherIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', otherIds)

      if (profileError) {
        throw profileError
      }

      profiles = profileRows
    }

    const profileById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]))

    setCoupleRequests(requests.map((request) => {
      const isIncoming = request.recipient_id === currentSession.user.id
      const otherId = isIncoming ? request.requester_id : request.recipient_id

      return {
        ...request,
        direction: isIncoming ? 'incoming' : 'outgoing',
        otherProfile: profileById[otherId] ?? { id: otherId, display_name: 'Your partner', email: otherId },
      }
    }))
  }

  const loadRemoteHistory = async (currentCouple = couple, currentSession = session) => {
    if (!isSupabaseConfigured || !currentCouple || !currentSession) {
      return
    }

    const { data: memberRows, error: membersError } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', currentCouple.id)

    if (membersError) {
      throw membersError
    }

    const memberIds = memberRows.map((member) => member.user_id)
    let profiles = []

    if (memberIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', memberIds)

      if (profilesError) {
        throw profilesError
      }

      profiles = profileRows
    }

    setCoupleMembers(memberRows)
    setCoupleMemberProfiles(Object.fromEntries(profiles.map((profile) => [profile.id, profile])))

    const labels = Object.fromEntries(
      profiles.map((profile) => [
        profile.id,
        profile.display_name || profile.email || people.partner.label,
      ]),
    )
    const { data: submissions, error: submissionsError } = await supabase
      .from('checkup_submissions')
      .select('*')
      .eq('couple_id', currentCouple.id)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      throw submissionsError
    }

    setHistory(submissions.map((row) => mapSubmissionRow(row, currentSession.user.id, labels)))
  }

  useEffect(() => {
    if (!session) {
      return
    }

    const timer = window.setTimeout(() => {
      loadCouple(session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not load your couple workspace.'))
      })
      loadCoupleRequests(session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not load your couple requests.'))
      })
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (!couple || !session) {
      return
    }

    const timer = window.setTimeout(() => {
      loadRemoteHistory(couple, session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not load your shared check-up history.'))
      })
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple, session])

  useEffect(() => {
    if (!isSupabaseConfigured || !session) {
      return undefined
    }

    const refreshRelationshipState = () => {
      loadCouple(session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not refresh your couple workspace.'))
      })
      loadCoupleRequests(session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not refresh your couple requests.'))
      })
    }

    const incomingRequestsChannel = supabase
      .channel(`incoming-couple-requests-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_requests',
          filter: `recipient_id=eq.${session.user.id}`,
        },
        refreshRelationshipState,
      )
      .subscribe()

    const outgoingRequestsChannel = supabase
      .channel(`outgoing-couple-requests-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_requests',
          filter: `requester_id=eq.${session.user.id}`,
        },
        refreshRelationshipState,
      )
      .subscribe()

    const membershipsChannel = supabase
      .channel(`couple-memberships-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_members',
          filter: `user_id=eq.${session.user.id}`,
        },
        refreshRelationshipState,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(incomingRequestsChannel)
      supabase.removeChannel(outgoingRequestsChannel)
      supabase.removeChannel(membershipsChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (!isSupabaseConfigured || !session || !couple) {
      return undefined
    }

    const refreshCoupleData = () => {
      loadRemoteHistory(couple, session).catch((error) => {
        setStatusMessage(getFriendlyError(error, 'Could not refresh your shared dashboard.'))
      })
    }

    const coupleMembersChannel = supabase
      .channel(`couple-member-list-${couple.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_members',
          filter: `couple_id=eq.${couple.id}`,
        },
        refreshCoupleData,
      )
      .subscribe()

    const submissionsChannel = supabase
      .channel(`couple-submissions-${couple.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checkup_submissions',
          filter: `couple_id=eq.${couple.id}`,
        },
        refreshCoupleData,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(coupleMembersChannel)
      supabase.removeChannel(submissionsChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple, session])

  const handleSignIn = async () => {
    setStatusMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setStatusMessage(getFriendlyError(error, 'Could not start Google sign-in.'))
    }
  }

  const handleEmailSignIn = async (email, password) => {
    setStatusMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatusMessage(getFriendlyError(error, 'Could not sign you in.'))
    }
  }

  const handleEmailSignUp = async (email, password) => {
    setStatusMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setStatusMessage(getFriendlyError(error, 'Could not create your account.'))
      return
    }

    if (data.session) {
      await upsertProfile(data.session)
      setStatusMessage('Registered and signed in.')
    } else {
      setStatusMessage('Registered. Check your email to confirm the account, then sign in.')
    }
  }

  const handleSignOut = async () => {
    setStatusMessage('')
    const { error } = await supabase.auth.signOut()

    if (error) {
      setStatusMessage(getFriendlyError(error, 'Could not sign you out.'))
    }
  }

  const handleSaveProfile = async (nextProfile) => {
    try {
      setStatusMessage('')

      const payload = {
        display_name: nextProfile.display_name || session.user.email,
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', session.user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      setProfile(data)
      const extras = {
        bio: nextProfile.bio,
        social_links: nextProfile.social_links,
      }
      window.localStorage.setItem(getProfileExtrasKey(session.user.id), JSON.stringify(extras))
      setProfileExtras(extras)
      setCoupleMemberProfiles((current) => ({
        ...current,
        [data.id]: data,
      }))
      setStatusMessage('Profile saved.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not save your profile.'))
    }
  }

  const handleFindPartner = async (query) => {
    try {
      setStatusMessage('')
      const trimmedQuery = query.trim()

      if (!trimmedQuery) {
        setStatusMessage('Enter a partner ID or email first.')
        return null
      }

      const isEmail = trimmedQuery.includes('@')
      const filter = isEmail ? 'email' : 'id'

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .eq(filter, trimmedQuery)
        .limit(1)

      if (error) {
        throw error
      }

      const profile = data?.[0]

      if (!profile) {
        setStatusMessage('No registered user found with that ID or email.')
        return null
      }

      if (profile.id === session.user.id) {
        setStatusMessage('That is your own account. Search for your partner instead.')
        return null
      }

      setStatusMessage(`Found ${profile.display_name || profile.email}.`)
      return profile
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not find that account.'))
      return null
    }
  }

  const handleCreateCouple = async () => {
    try {
      setStatusMessage('')
      await upsertProfile(session)

      const newCouple = {
        id: crypto.randomUUID(),
        invite_code: getInviteCode(),
        created_by: session.user.id,
      }

      const { error: coupleError } = await supabase.from('couples').insert(newCouple)

      if (coupleError) {
        throw coupleError
      }

      const { error: memberError } = await supabase.from('couple_members').insert({
        couple_id: newCouple.id,
        user_id: session.user.id,
        role: 'owner',
      })

      if (memberError) {
        throw memberError
      }

      setCouple({ id: newCouple.id, invite_code: newCouple.invite_code })
      setCoupleMembers([
        { user_id: session.user.id },
      ])
      setStatusMessage('Invite code created. Share it with your partner to connect.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not create the couple workspace.'))
    }
  }

  const handleSendCoupleRequest = async (partnerId) => {
    try {
      setStatusMessage('')
      await upsertProfile(session)

      if (!partnerId) {
        setStatusMessage('Look up your partner before sending a request.')
        return
      }

      const { error } = await supabase.from('couple_requests').insert({
        requester_id: session.user.id,
        recipient_id: partnerId,
      })

      if (error) {
        throw error
      }

      await loadCoupleRequests(session)
      setStatusMessage('Couple request sent. Your partner can accept it from their account.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not send the couple request.'))
    }
  }

  const handleAcceptRequest = async (requestId) => {
    try {
      setStatusMessage('')
      const { error } = await supabase.rpc('accept_couple_request', {
        target_request_id: requestId,
      })

      if (error) {
        throw error
      }

      await loadCouple(session)
      await loadCoupleRequests(session)
      setStatusMessage('Couple request accepted. Your shared dashboard is ready.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not accept the couple request.'))
    }
  }

  const updateCoupleRequestStatus = async (requestId, status) => {
    const { error } = await supabase
      .from('couple_requests')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) {
      throw error
    }
  }

  const handleRejectRequest = async (requestId) => {
    try {
      setStatusMessage('')
      await updateCoupleRequestStatus(requestId, 'rejected')
      await loadCoupleRequests(session)
      setStatusMessage('Couple request rejected.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not reject the couple request.'))
    }
  }

  const handleCancelRequest = async (requestId) => {
    try {
      setStatusMessage('')
      await updateCoupleRequestStatus(requestId, 'cancelled')
      await loadCoupleRequests(session)
      setStatusMessage('Couple request cancelled.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not cancel the couple request.'))
    }
  }

  const handleJoinCouple = async (inviteCode) => {
    try {
      setStatusMessage('')
      await upsertProfile(session)

      const code = inviteCode.trim().toUpperCase()

      if (!code) {
        setStatusMessage('Enter an invite code first.')
        return
      }

      const { data: coupleRows, error: coupleError } = await supabase
        .from('couples')
        .select('id, invite_code')
        .eq('invite_code', code)
        .limit(1)

      if (coupleError) {
        throw coupleError
      }

      const coupleRow = coupleRows?.[0]

      if (!coupleRow) {
        setStatusMessage('No couple found with that invite code.')
        return
      }

      const { error: memberError } = await supabase.from('couple_members').insert({
        couple_id: coupleRow.id,
        user_id: session.user.id,
        role: 'partner',
      })

      if (memberError) {
        throw memberError
      }

      setCouple(coupleRow)
      setStatusMessage('Joined couple workspace.')
    } catch (error) {
      setStatusMessage(getFriendlyError(error, 'Could not join that couple workspace.'))
    }
  }

  const updateAnswer = (period, person, principleId, questionIndex, value) => {
    setResponses((current) => ({
      ...current,
      [person]: {
        ...current[person],
        [period]: {
          ...current[person][period],
          [principleId]: current[person][period][principleId].map((answer, index) => (
            index === questionIndex ? value : answer
          )),
        },
      },
    }))
  }

  const handleNoteChange = (period, person, value) => {
    setNotes((current) => ({
      ...current,
      [person]: {
        ...current[person],
        [period]: value,
      },
    }))
  }

  const addDiscussionItem = (item) => {
    setDiscussionItems((current) => {
      if (current.some((existing) => existing.id === item.id)) {
        return current
      }

      return [item, ...current].slice(0, 24)
    })
  }

  const handleAddReflectionToTalk = (reflection) => {
    addDiscussionItem(createDiscussionItem(reflection))
    setStatusMessage('Added to the Talk queue.')
  }

  const handleAddPrinciplePrompt = (principleId) => {
    const principle = principles.find((item) => item.id === principleId) ?? principles[0]
    const prompt = promptLibrary[principle.id]

    addDiscussionItem({
      id: `talk-${principle.id}-${Date.now()}`,
      action: prompt.action,
      createdAt: new Date().toISOString(),
      principleId: principle.id,
      principleTitle: principle.title,
      prompt: prompt.prompt,
      resolved: false,
      source: 'Principle detail',
    })
    setStatusMessage('Added to the Talk queue.')
  }

  const handleOpenPrinciple = (principleId) => {
    setSelectedPrincipleId(principleId)
    setActivePage('principle')
  }

  const updateDiscussionItem = (itemId, resolved) => {
    setDiscussionItems((current) => current.map((item) => (
      item.id === itemId ? { ...item, resolved } : item
    )))
  }

  const handleSave = async (period, person) => {
    const availability = getPeriodAvailability(period, history, person)

    if (availability.isSubmitted) {
      setStatusMessage(`You already submitted the ${period} check-up for this window.`)
      return
    }

    const periodWindow = getPeriodWindow(period).windowKey
    const periodScores = getPeriodScores(period, responses[person][period])
    const nextEntry = {
      ...periodScores,
      person,
      personLabel: people[person].label,
      id: `${person}-${period}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      note: notes[person][period].trim(),
      periodWindow,
      responses: responses[person][period],
    }

    if (isSupabaseConfigured && !isRemoteReady) {
      setStatusMessage('Connect with your partner before submitting check-ups.')
      return
    }

    if (isRemoteReady) {
      try {
        setStatusMessage('')

        const submissionPayload = {
          couple_id: couple.id,
          user_id: session.user.id,
          period,
          period_window: periodWindow,
          note: nextEntry.note,
          responses: nextEntry.responses,
          principle_scores: nextEntry.principleScores,
          overall_score: nextEntry.overallScore,
        }

        const { error } = await supabase.from('checkup_submissions').insert(submissionPayload)

        if (error) {
          if (!isPeriodWindowSchemaCacheError(error)) {
            throw error
          }

          const legacyPayload = { ...submissionPayload }
          delete legacyPayload.period_window
          const { error: legacyError } = await supabase.from('checkup_submissions').insert(legacyPayload)

          if (legacyError) {
            throw legacyError
          }
        }

        await loadRemoteHistory(couple, session)
        const reflection = createReflection(nextEntry, scores, partnerLabel)
        setLastReflection(reflection)
        addDiscussionItem(createDiscussionItem(reflection))
        setStatusMessage(error
          ? 'Submitted. Run the latest supabase-schema.sql soon so once-per-window limits are enforced by the database.'
          : 'Submitted to your couple workspace.')
        return
      } catch (error) {
        setStatusMessage(getFriendlyError(error, 'Could not submit this check-up.'))
        return
      }
    }

    setHistory((current) => {
      const nextHistory = [
        nextEntry,
        ...current,
      ].slice(0, 48)
      const nextScores = calculateSubmittedCoupleScores(nextHistory)
      const reflection = createReflection(nextEntry, nextScores, partnerLabel)
      setLastReflection(reflection)
      addDiscussionItem(createDiscussionItem(reflection))
      return nextHistory
    })
  }

  const handleReset = (period, person) => {
    const fresh = makeInitialResponses()
    setResponses((current) => ({
      ...current,
      [person]: {
        ...current[person],
        [period]: fresh[period],
      },
    }))
    setNotes((current) => ({
      ...current,
      [person]: {
        ...current[person],
        [period]: '',
      },
    }))
  }

  if (isSupabaseConfigured && !session) {
    return (
      <AuthLanding
        message={statusMessage}
        onGoogleSignIn={handleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
      />
    )
  }

  return (
    <main className="page">
      <div className="room-detail window" aria-hidden="true">
        <span></span>
      </div>
      <div className="room-detail plant left-plant" aria-hidden="true"></div>
      <div className="room-detail plant right-plant" aria-hidden="true"></div>
      <div className="room-detail cat-tree" aria-hidden="true"></div>
      <div className="room-detail cushion" aria-hidden="true"></div>

      <section className="dashboard-shell" aria-label="Purrfect relationship dashboard">
        <nav className="navbar">
          <button className="brand brand-button" type="button" onClick={() => setActivePage('overview')} aria-label="Purrfect overview">
            <span className="paw" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>
              <strong>Purrfect</strong>
              <small>Relationship Dashboard</small>
            </span>
          </button>

          {isSupabaseConfigured && session && (
            <HeaderStatus
              couple={couple}
              hasPartner={hasPartner}
              onSignOut={handleSignOut}
              partnerProfile={partnerProfile}
              profile={profile}
              requests={coupleRequests}
              session={session}
              setActivePage={setActivePage}
            />
          )}

          <div className="nav-links" aria-label="Dashboard sections">
            {navItems.map((item) => (
              <button
                className={activePage === item.id ? 'active' : ''}
                type="button"
                onClick={() => setActivePage(item.id)}
                key={item.id}
              >
                <span className="nav-icon" aria-hidden="true"></span>
                {item.label}
              </button>
            ))}
          </div>

        </nav>

        {!isSupabaseConfigured && (
          <AuthPanel
            session={session}
            onSignOut={handleSignOut}
          />
        )}

        {statusMessage && <p className="status-message">{statusMessage}</p>}

        <ReflectionPanel
          reflection={lastReflection}
          onAddToTalk={handleAddReflectionToTalk}
          onClose={() => setLastReflection(null)}
        />

        {activePage === 'health' ? (
          <HealthPage
            checks={healthChecks}
            checkedAt={healthCheckedAt}
            couple={couple}
            hasPartner={hasPartner}
            isRunning={isHealthRunning}
            onRunHealthCheck={runHealthCheck}
            requests={coupleRequests}
            session={session}
          />
        ) : activePage === 'profile' ? (
          <ProfilePage
            key={profile?.id ?? 'profile-loading'}
            profile={profile}
            profileExtras={profileExtras}
            session={session}
            onSaveProfile={handleSaveProfile}
          />
        ) : activePage === 'talk' ? (
          <TalkQueuePage
            items={discussionItems}
            onReopenItem={(itemId) => updateDiscussionItem(itemId, false)}
            onResolveItem={(itemId) => updateDiscussionItem(itemId, true)}
            setActivePage={setActivePage}
          />
        ) : activePage === 'principle' ? (
          <PrincipleDetailPage
            history={history}
            onAddPrompt={handleAddPrinciplePrompt}
            partnerLabel={partnerLabel}
            principle={principles.find((principle) => principle.id === selectedPrincipleId) ?? principles[0]}
            scores={scores}
            setActivePage={setActivePage}
          />
        ) : shouldGateRemoteApp ? (
          <OnboardingPage
            couple={couple}
            hasPartner={hasPartner}
            onAcceptRequest={handleAcceptRequest}
            onCancelRequest={handleCancelRequest}
            onCreateCouple={handleCreateCouple}
            onFindPartner={handleFindPartner}
            onJoinCouple={handleJoinCouple}
            onRejectRequest={handleRejectRequest}
            onSendCoupleRequest={handleSendCoupleRequest}
            onStartCheckup={() => setActivePage('checkups')}
            partnerProfile={partnerProfile}
            profile={profile}
            requests={coupleRequests}
            session={session}
            setActivePage={setActivePage}
          />
        ) : activePage === 'overview' ? (
          <Overview
            onOpenPrinciple={handleOpenPrinciple}
            scores={scores}
            history={history}
            partnerLabel={partnerLabel}
            setActivePage={setActivePage}
          />
        ) : activePage === 'history' ? (
          <HistoryPage history={history} setActivePage={setActivePage} />
        ) : (
          <CheckupsPage
            activePerson={isSupabaseConfigured ? 'me' : activePerson}
            responsesByPerson={responses}
            notesByPerson={notes}
            history={history}
            onAnswerChange={{ update: updateAnswer, switchPerson: setActivePerson }}
            onNoteChange={handleNoteChange}
            onReset={handleReset}
            onSave={handleSave}
            canSwitchPerson={!isSupabaseConfigured}
          />
        )}
      </section>
    </main>
  )
}

export default App
