/** Shared, concise copy for moments that benefit from an encouraging nudge. */
export const motivation = {
  today(progress: number, total: number) {
    if (!total) return 'Choose one small action to begin building a routine that lasts.';
    if (progress === 1) return 'You followed through on every plan today. Take a moment to own that win.';
    if (progress >= 0.75) return 'You are close. Give your next small action the same care.';
    if (progress >= 0.4) return 'You have momentum. Keep it simple and take the next step.';
    return 'Start where you are. One completed habit is meaningful progress.';
  },
  reminder(name: string, variation = 0) {
    const options = [
      `A little time for ${name} can move your day forward.`,
      `Keep your promise to yourself: ${name} is ready when you are.`,
      `Small actions add up. Take a moment for ${name}.`,
    ];
    return options[(name.length + variation) % options.length];
  },
  streak(days: number) {
    return days > 0 ? `${days} days of showing up. Keep building at your own pace.` : 'A missed day does not erase your progress. Begin again today.';
  },
  achievement(title: string) { return `You earned ${title}. Consistency is taking shape.`; },
} as const;
