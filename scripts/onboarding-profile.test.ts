import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_PROFILE, estimateGb, planHeadline, paywallCopy, parseProfile, planLines, QUESTIONS, serializeProfile, setAnswer, toggleOption } from '../src/lib/onboarding-profile';
import { nextReminderDates } from '../src/lib/reminder-plan';

describe('onboarding profile', () => {
  it('has seven questions, so welcome + access + questions + reminders + plan is 11 screens', () => {
    assert.equal(QUESTIONS.length, 7);
  });

  it('single choice replaces and multi choice toggles', () => {
    const goal = QUESTIONS.find((q) => q.id === 'goal')!;
    const pain = QUESTIONS.find((q) => q.id === 'pain')!;
    let p = toggleOption(EMPTY_PROFILE, goal, 'space');
    p = toggleOption(p, goal, 'speed');
    assert.deepEqual(p.answers.goal, ['speed']);
    p = toggleOption(p, pain, 'photos');
    p = toggleOption(p, pain, 'videos');
    p = toggleOption(p, pain, 'photos');
    assert.deepEqual(p.answers.pain, ['videos']);
  });

  it('estimates more space for bigger, fuller libraries', () => {
    const small = setAnswer(setAnswer(EMPTY_PROFILE, 'library', ['few']), 'fullness', ['half']);
    const big = setAnswer(setAnswer(EMPTY_PROFILE, 'library', ['huge']), 'fullness', ['full']);
    assert.ok(estimateGb(big) > estimateGb(small));
    assert.ok(estimateGb(EMPTY_PROFILE) >= 1);
  });

  it('paywall copy prefers the real scan number and otherwise the estimate', () => {
    assert.equal(paywallCopy(EMPTY_PROFILE, 5e9, '5 GB').title, '5 GB ready to review');
    assert.match(paywallCopy(setAnswer(EMPTY_PROFILE, 'library', ['many']), 0, '').title, /^Free up about \d+ GB$/);
  });

  it('plan lines always give at least three', () => {
    assert.ok(planLines(EMPTY_PROFILE).length >= 3);
  });

  it('round-trips and survives bad stored data', () => {
    const p = setAnswer({ ...EMPTY_PROFILE, reminderHour: 20 }, 'goal', ['privacy']);
    assert.deepEqual(parseProfile(serializeProfile(p)), p);
    assert.deepEqual(parseProfile('not json'), EMPTY_PROFILE);
    assert.equal(parseProfile(serializeProfile({ ...p, reminderHour: null })).reminderHour, null);
    assert.equal(parseProfile('{"answers":{},"reminderHour":99}').reminderHour, 8);
  });

  it('reminder dates use the chosen hour and stay in the future', () => {
    const now = new Date(2026, 10, 25, 9, 0, 0);
    const [first] = nextReminderDates(now, 1, 3, 20);
    assert.equal(first.getHours(), 20);
    assert.ok(first.getTime() > now.getTime());
    const [dflt] = nextReminderDates(now, 1);
    assert.equal(dflt.getHours(), 8);
  });
});

describe('plan headline', () => {
  it('shows a measured number when a background scan ran, a guess otherwise', () => {
  const base = { started: true, scanning: true, bytes: 4.2e9, percent: 40 };
  const live = planHeadline(EMPTY_PROFILE, base, '4.2 GB');
  assert.equal(live.big, '4.2 GB');
  assert.equal(live.kicker, 'FOUND SO FAR');
  assert.equal(live.live, true);
  const done = planHeadline(EMPTY_PROFILE, { ...base, scanning: false }, '9.8 GB');
  assert.equal(done.big, '9.8 GB');
  assert.equal(done.kicker, 'YOUR PLAN IS READY');
  assert.equal(planHeadline(EMPTY_PROFILE, { ...base, bytes: 0 }, '0 MB').big, 'Counting…');
  assert.equal(planHeadline(EMPTY_PROFILE, { ...base, bytes: 0, scanning: false }, '0 MB').big, 'Already tidy');
  const guess = planHeadline(EMPTY_PROFILE, { started: false, scanning: false, bytes: 0, percent: 0 }, '0 MB');
  assert.match(guess.big, /^About \d+ GB$/);
  assert.match(guess.sub, /rough guess/);
  });
});
