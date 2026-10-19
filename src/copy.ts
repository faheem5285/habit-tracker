const DAILY_BOOSTS = [
  'Small actions, repeated often, create lasting change.',
  'Progress is built one honest check-in at a time.',
  'You do not need a perfect day to make a meaningful one.',
  'A steady pace can carry you farther than a burst of effort.',
  'Start with what you can do now; let consistency do the rest.',
  'Showing up imperfectly still counts as showing up.',
  'Make the next step small enough to begin.',
  'Your routine is a practice, not a test.',
  'Every return to your goal strengthens the habit.',
  'A little progress today gives tomorrow a stronger start.',
  'Focus on the action you can take, not the distance ahead.',
  'Consistency grows when you keep your promises manageable.',
  'One completed step is a reason to keep going.',
  'Build a routine that supports the life you want.',
  'You can reset your focus at any point in the day.',
  'Quiet progress is still progress.',
  'Make room for the habits that help you feel your best.',
  'Keep your plans clear, kind, and achievable.',
  'Your effort today is an investment in your future self.',
  'Momentum comes from beginning again, as often as needed.',
];

const STREAK_MILESTONES: Record<number, string> = {
  3: 'Three days of follow-through. Your routine is taking shape.',
  7: 'A full week of consistency. Keep building at your own pace.',
  14: 'Two weeks strong. Small actions are becoming a lasting rhythm.',
  30: 'Thirty days of showing up. That is meaningful progress.',
};
const STREAK_MILESTONE_DAYS = [30, 14, 7, 3] as const;

export const appCopy = {
  dailyBoosts: DAILY_BOOSTS,
  onboarding: [
    { emoji: '✓', title: 'Make room for what matters', body: 'Turn good intentions into small actions you can repeat, one day at a time.' },
    { emoji: '↗', title: 'Notice how far you have come', body: 'Your check-ins and patterns make steady progress easier to see.' },
    { emoji: '♧', title: 'Get a gentle nudge', body: 'Choose reminder times that fit your day. You can change them whenever you need.' },
  ],
  recoveryStart: {
    title: 'Recover your data',
    description: 'Enter your recovery code to decrypt and restore your habits, files, encrypted password vault, finances, notes, and settings.',
    codeLabel: 'Recovery code',
    codePlaceholder: 'Enter your recovery code',
    restore: 'Restore my data',
    restoring: 'Restoring your data',
    startFresh: 'Start fresh',
    privacyNote: 'Your backup is encrypted with this code. Keep it private and choose a strong code; without it, the backup cannot be decrypted.',
    missingCode: 'Enter your recovery code',
    restoreFailedTitle: 'Could not restore data',
    restoreFailedMessage: 'Check the code and try again.',
  },
  habits: {
    dailyReflection: 'Daily reflection',
    reflectionSubtitle: 'A sentence is enough to remember what moved you forward.',
    hideReflection: 'Hide daily reflection',
    showReflection: 'Show daily reflection',
    hide: 'Hide',
    show: 'Show',
    reflectionPromptLabel: 'Choose a prompt, or write freely',
    reflectionPlaceholder: 'Write what you noticed, learned, or want to remember...',
    archivedEmptyTitle: 'No archived habits',
    archivedEmptyHint: 'Paused habits will appear here.',
    completedToast: 'Habit completed',
    undo: 'Undo',
  },
  loans: {
    overdueBalance: 'Overdue balance',
    overdueNeedsAttention: 'needs attention',
    invalidPhoneHint: 'Enter a valid phone number with 7 to 15 digits to use contact actions.',
  },
};

export function dailyBoostForDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return DAILY_BOOSTS[((dayIndex % DAILY_BOOSTS.length) + DAILY_BOOSTS.length) % DAILY_BOOSTS.length];
}

export function streakMilestoneCopy(days: number) {
  const milestone = STREAK_MILESTONE_DAYS.find((threshold) => threshold <= days);
  return milestone === undefined ? undefined : STREAK_MILESTONES[milestone];
}
