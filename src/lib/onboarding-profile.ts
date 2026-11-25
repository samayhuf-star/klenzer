/**
 * Onboarding questions and the answers a person gives. Pure logic only (no Expo or native imports)
 * so it can be unit tested in Node. The answers are stored on the device and never uploaded.
 */

export type QuestionId = 'pain' | 'fullness' | 'library' | 'goal' | 'blocker' | 'clutter';

export type Option = { id: string; label: string; icon: string };

export type Question = {
  id: QuestionId;
  title: string;
  subtitle: string;
  multi: boolean;
  options: Option[];
};

export const QUESTIONS: Question[] = [
  {
    id: 'pain',
    title: 'What eats most of your storage?',
    subtitle: 'Pick all that apply. We will look there first.',
    multi: true,
    options: [
      { id: 'photos', label: 'Photos', icon: 'images-outline' },
      { id: 'videos', label: 'Videos', icon: 'videocam-outline' },
      { id: 'screenshots', label: 'Screenshots', icon: 'phone-portrait-outline' },
      { id: 'contacts', label: 'Contacts', icon: 'people-outline' },
    ],
  },
  {
    id: 'fullness',
    title: 'How full is your phone?',
    subtitle: 'A rough guess is fine.',
    multi: false,
    options: [
      { id: 'half', label: 'About half full', icon: 'battery-half-outline' },
      { id: 'most', label: 'Almost full', icon: 'battery-charging-outline' },
      { id: 'full', label: 'Completely full', icon: 'warning-outline' },
    ],
  },
  {
    id: 'library',
    title: 'About how many photos do you have?',
    subtitle: 'Check the Photos app if you are not sure.',
    multi: false,
    options: [
      { id: 'few', label: 'Under 2,000', icon: 'albums-outline' },
      { id: 'some', label: '2,000 to 10,000', icon: 'albums-outline' },
      { id: 'many', label: '10,000 to 30,000', icon: 'albums-outline' },
      { id: 'huge', label: 'More than 30,000', icon: 'albums-outline' },
    ],
  },
  {
    id: 'goal',
    title: 'What matters most to you?',
    subtitle: 'We will shape the app around it.',
    multi: false,
    options: [
      { id: 'space', label: 'Free up space fast', icon: 'speedometer-outline' },
      { id: 'organise', label: 'Keep my library tidy', icon: 'sparkles-outline' },
      { id: 'privacy', label: 'Keep private photos private', icon: 'lock-closed-outline' },
      { id: 'speed', label: 'A faster, lighter phone', icon: 'flash-outline' },
    ],
  },
  {
    id: 'blocker',
    title: 'What stops you from cleaning up?',
    subtitle: 'Pick all that apply.',
    multi: true,
    options: [
      { id: 'toomany', label: 'There is too much to sort', icon: 'layers-outline' },
      { id: 'unsure', label: 'I am not sure what is safe to delete', icon: 'help-circle-outline' },
      { id: 'time', label: 'It takes too long', icon: 'time-outline' },
      { id: 'memories', label: 'I do not want to lose memories', icon: 'heart-outline' },
    ],
  },
  {
    id: 'clutter',
    title: 'What would you like to clear?',
    subtitle: 'Pick all that apply.',
    multi: true,
    options: [
      { id: 'duplicates', label: 'Duplicate photos', icon: 'copy-outline' },
      { id: 'screenshots', label: 'Old screenshots', icon: 'phone-portrait-outline' },
      { id: 'bigvideos', label: 'Huge videos', icon: 'videocam-outline' },
      { id: 'contacts', label: 'Duplicate contacts', icon: 'people-outline' },
      { id: 'secret', label: 'Hide private photos', icon: 'eye-off-outline' },
    ],
  },
];

export type Profile = {
  answers: Partial<Record<QuestionId, string[]>>;
  /** Local hour (0 to 23) for cleanup reminders, or null when the person chose no reminders. */
  reminderHour: number | null;
};

export const EMPTY_PROFILE: Profile = { answers: {}, reminderHour: 8 };

/** Reminder choices on the reminders screen. `hour: null` means no reminders. */
export const REMINDER_CHOICES: { id: string; label: string; hour: number | null }[] = [
  { id: 'morning', label: 'Morning, 8:00', hour: 8 },
  { id: 'lunch', label: 'Lunch break, 13:00', hour: 13 },
  { id: 'evening', label: 'Evening, 20:00', hour: 20 },
  { id: 'none', label: 'No reminders', hour: null },
];

export function pick(profile: Profile, id: QuestionId): string[] {
  return profile.answers[id] ?? [];
}

export function setAnswer(profile: Profile, id: QuestionId, value: string[]): Profile {
  return { ...profile, answers: { ...profile.answers, [id]: value } };
}

/** Toggle an option. Single-choice questions replace the answer. */
export function toggleOption(profile: Profile, q: Question, optionId: string): Profile {
  const cur = pick(profile, q.id);
  if (!q.multi) return setAnswer(profile, q.id, [optionId]);
  return setAnswer(profile, q.id, cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]);
}

export const isAnswered = (profile: Profile, id: QuestionId) => pick(profile, id).length > 0;

/**
 * A rough estimate of the space the person could free, in gigabytes. This is a guess from their own
 * answers, shown before the real scan. It is labelled "about" wherever it is shown.
 */
export function estimateGb(profile: Profile): number {
  const library = pick(profile, 'library')[0];
  const fullness = pick(profile, 'fullness')[0];
  const base = library === 'few' ? 2 : library === 'some' ? 5 : library === 'many' ? 11 : library === 'huge' ? 20 : 6;
  const factor = fullness === 'full' ? 1.4 : fullness === 'most' ? 1.15 : 1;
  const extra = pick(profile, 'pain').includes('videos') ? 1.25 : 1;
  return Math.max(1, Math.round(base * factor * extra));
}

export function paywallCopy(profile: Profile, reclaimBytes: number, formatted: string): { title: string; sub: string } {
  if (reclaimBytes > 0) {
    return { title: `${formatted} ready to review`, sub: 'That is what we found on your phone. Start your free trial to clear it. You still choose every item.' };
  }
  const goal = pick(profile, 'goal')[0];
  const gb = estimateGb(profile);
  const lead = `Free up about ${gb} GB`;
  const sub =
    goal === 'privacy'
      ? 'Clean up and keep private photos private. Everything stays on your phone.'
      : goal === 'speed'
        ? 'A lighter library means a faster, calmer phone. You still choose every item.'
        : goal === 'organise'
          ? 'Keep your library tidy with a few taps. You still choose every item.'
          : 'Start your free trial to clear it fast. You still choose every item.';
  return { title: lead, sub };
}

export type PlanHeadline = { kicker: string; big: string; sub: string; live: boolean };

/**
 * The big number on the last onboarding screen.
 * A scan started earlier (while the questions were answered) gives a real, measured number.
 * Without one (access skipped or denied) it falls back to the rough guess from the answers.
 */
export function planHeadline(
  profile: Profile,
  scan: { started: boolean; scanning: boolean; bytes: number; percent: number },
  formatted: string,
): PlanHeadline {
  if (scan.started && scan.bytes > 0) {
    if (scan.scanning) {
      const pct = Math.max(1, Math.min(99, Math.round(scan.percent)));
      return { kicker: 'FOUND SO FAR', big: formatted, sub: `Still scanning (${pct}%). This number keeps growing. It is measured on your phone, not guessed.`, live: true };
    }
    return { kicker: 'YOUR PLAN IS READY', big: formatted, sub: 'ready to review, measured on your phone. You choose every item.', live: false };
  }
  if (scan.started && scan.scanning) {
    return { kicker: 'SCANNING YOUR PHOTOS', big: 'Counting…', sub: 'Klenzer is measuring your library right now. The first results show up in a moment.', live: true };
  }
  if (scan.started) {
    return { kicker: 'YOUR PLAN IS READY', big: 'Already tidy', sub: 'We did not find much to clear yet. Klenzer will keep watching as your library grows.', live: false };
  }
  return {
    kicker: 'YOUR PLAN IS READY',
    big: `About ${estimateGb(profile)} GB`,
    sub: 'could be ready to review. This is a rough guess from your answers. Allow photo access later and the real scan finds the true number.',
    live: false,
  };
}

/** Plan summary lines for the final onboarding screen. Always at least three. */
export function planLines(profile: Profile): string[] {
  const out: string[] = [];
  const clutter = pick(profile, 'clutter');
  if (clutter.includes('duplicates')) out.push('Find duplicate and near-identical photos');
  if (clutter.includes('screenshots')) out.push('Sweep out old screenshots');
  if (clutter.includes('bigvideos')) out.push('Spot huge videos worth reviewing');
  if (clutter.includes('contacts')) out.push('Preview duplicate contacts before merging');
  if (clutter.includes('secret')) out.push('Set up a private Secret Album');
  const fullness = pick(profile, 'fullness')[0];
  if (profile.reminderHour != null) out.push(`Gentle reminder at ${String(profile.reminderHour).padStart(2, '0')}:00`);
  if (fullness === 'most' || fullness === 'full') out.push('Start with the biggest wins first');
  if (pick(profile, 'blocker').includes('unsure') || pick(profile, 'blocker').includes('memories')) out.push('You review everything before anything is deleted');
  const fillers = ['Review every item before it goes', 'Everything stays on your phone', 'No account needed'];
  for (const f of fillers) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out.slice(0, 5);
}

export function serializeProfile(p: Profile): string {
  return JSON.stringify(p);
}

export function parseProfile(raw: string | null | undefined): Profile {
  if (!raw) return EMPTY_PROFILE;
  try {
    const v = JSON.parse(raw) as Partial<Profile>;
    const answers: Profile['answers'] = {};
    for (const q of QUESTIONS) {
      const a = v?.answers?.[q.id];
      if (Array.isArray(a)) answers[q.id] = a.filter((x): x is string => typeof x === 'string');
    }
    const h = v?.reminderHour;
    return { answers, reminderHour: h === null ? null : typeof h === 'number' && h >= 0 && h <= 23 ? Math.floor(h) : 8 };
  } catch {
    return EMPTY_PROFILE;
  }
}
