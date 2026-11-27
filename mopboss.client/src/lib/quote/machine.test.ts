import { describe, expect, it } from 'vitest';
import {
  contactErrors,
  contactSummary,
  firstName,
  initialState,
  progressPercent,
  quoteReducer,
  sizeSummary,
  stepValid,
  type QuoteAction,
  type QuoteState,
} from './machine';

const run = (actions: QuoteAction[], from: QuoteState = initialState()) =>
  actions.reduce(quoteReducer, from);

const completeToReview: QuoteAction[] = [
  { type: 'choose', field: 'service', value: 'Deep Cleaning' },
  { type: 'next' },
  { type: 'choose', field: 'property', value: 'House' },
  { type: 'next' },
  { type: 'choose', field: 'size', value: '1,000 to 2,000' },
  { type: 'next' },
  { type: 'choose', field: 'frequency', value: 'Weekly' },
  { type: 'next' },
  { type: 'type', field: 'name', value: 'Dana Smith' },
  { type: 'type', field: 'phone', value: '(513) 555-0100' },
  { type: 'next' },
];

describe('step validation', () => {
  it('blocks each choice step until something is picked', () => {
    const s = initialState();
    expect(stepValid(s.answers, 0)).toBe(false);
    expect(stepValid(s.answers, 1)).toBe(false);
    expect(stepValid(s.answers, 2)).toBe(false);
    expect(stepValid(s.answers, 3)).toBe(false);
    expect(stepValid(s.answers, 5)).toBe(true);
  });

  it('does not advance from an incomplete step and flags the attempt', () => {
    const s = run([{ type: 'next' }]);
    expect(s.step).toBe(0);
    expect(s.attempted).toBe(true);
  });

  it('requires a name plus a phone or an email on the contact step', () => {
    const base = initialState().answers;
    expect(stepValid({ ...base, name: 'Dana' }, 4)).toBe(false);
    expect(stepValid({ ...base, phone: '5135550100' }, 4)).toBe(false);
    expect(stepValid({ ...base, name: '  ', email: 'a@b.co' }, 4)).toBe(false);
    expect(stepValid({ ...base, name: 'Dana', phone: '5135550100' }, 4)).toBe(true);
    expect(stepValid({ ...base, name: 'Dana', email: 'dana@example.com' }, 4)).toBe(true);
  });

  it('checks the format of email, phone and ZIP only when they are filled in', () => {
    const base = { ...initialState().answers, name: 'Dana' };
    expect(contactErrors({ ...base, email: 'dana@' })).toEqual({ email: 'email' });
    expect(contactErrors({ ...base, phone: '555-0100' })).toEqual({ phone: 'phone' });
    expect(contactErrors({ ...base, zip: '4520' })).toEqual({ zip: 'zip' });
    expect(contactErrors({ ...base, zip: '45202' })).toEqual({});
    expect(contactErrors({ ...base, zip: '45202-1234' })).toEqual({});
    expect(stepValid({ ...base, email: 'dana@example.com', zip: '452' }, 4)).toBe(false);
  });

  it('keeps bedroom and bathroom counts inside their limits', () => {
    let s = initialState();
    for (let i = 0; i < 12; i++) s = quoteReducer(s, { type: 'count', field: 'beds', delta: 1 });
    expect(s.answers.beds).toBe(9);
    for (let i = 0; i < 12; i++) s = quoteReducer(s, { type: 'count', field: 'baths', delta: -1 });
    expect(s.answers.baths).toBe(1);
    for (let i = 0; i < 12; i++) s = quoteReducer(s, { type: 'count', field: 'beds', delta: -1 });
    expect(s.answers.beds).toBe(0);
  });
});

describe('moving back and forward', () => {
  it('keeps every answer when going back and forward again', () => {
    const atReview = run(completeToReview);
    expect(atReview.step).toBe(5);
    const back = run([{ type: 'back' }, { type: 'back' }, { type: 'back' }], atReview);
    expect(back.step).toBe(2);
    expect(back.answers).toEqual(atReview.answers);
    const forward = run([{ type: 'next' }, { type: 'next' }, { type: 'next' }], back);
    expect(forward.step).toBe(5);
    expect(forward.answers).toEqual(atReview.answers);
  });

  it('never goes back past the first step', () => {
    expect(run([{ type: 'back' }]).step).toBe(0);
  });

  it('reports progress as (step + 1) / 6, and 100% when done', () => {
    expect(progressPercent(initialState())).toBe(17);
    expect(progressPercent(run(completeToReview))).toBe(100);
    expect(progressPercent({ ...initialState(), step: 2 })).toBe(50);
    expect(progressPercent({ ...initialState(), done: true })).toBe(100);
  });
});

describe('edit from review', () => {
  it('jumps to the chosen step with answers intact', () => {
    const atReview = run(completeToReview);
    const editing = quoteReducer(atReview, { type: 'edit', step: 1 });
    expect(editing.step).toBe(1);
    expect(editing.answers.property).toBe('House');
    const changed = run(
      [{ type: 'choose', field: 'property', value: 'Townhome' }, { type: 'next' }],
      editing,
    );
    expect(changed.step).toBe(2);
    expect(changed.answers.property).toBe('Townhome');
    expect(changed.answers.service).toBe('Deep Cleaning');
    expect(changed.answers.name).toBe('Dana Smith');
  });

  it('sends the visitor back to any step that became incomplete before submitting', () => {
    const atReview = run(completeToReview);
    const broken = { ...atReview, answers: { ...atReview.answers, frequency: '' } };
    const s = quoteReducer(broken, { type: 'next' });
    expect(s.step).toBe(3);
    expect(s.status).toBe('idle');
  });
});

describe('submitting', () => {
  const send = (key = 'key-1'): QuoteAction => ({ type: 'next', newKey: key });

  it('enters "submitting" with an idempotency key and ignores everything until it settles', () => {
    const submitting = quoteReducer(run(completeToReview), send());
    expect(submitting.status).toBe('submitting');
    expect(submitting.idempotencyKey).toBe('key-1');
    // Double clicks, Back and edits are ignored while a send is in flight.
    expect(quoteReducer(submitting, send('key-2'))).toBe(submitting);
    expect(quoteReducer(submitting, { type: 'back' })).toBe(submitting);
    expect(quoteReducer(submitting, { type: 'type', field: 'name', value: 'X' })).toBe(submitting);
    const done = quoteReducer(submitting, {
      type: 'submitted',
      result: { mode: 'live', reference: 'MB-7K3Q9X' },
    });
    expect(done.done).toBe(true);
    expect(done.result).toEqual({ mode: 'live', reference: 'MB-7K3Q9X' });
  });

  it('keeps the answers and reuses the same key when retrying an uncertain send', () => {
    const failed = run(
      [send('key-1'), { type: 'failed', failure: 'uncertain' }],
      run(completeToReview),
    );
    expect(failed.status).toBe('error');
    expect(failed.failure).toBe('uncertain');
    expect(failed.step).toBe(5);
    expect(failed.answers.name).toBe('Dana Smith');

    const retry = quoteReducer(failed, send('key-2'));
    expect(retry.idempotencyKey).toBe('key-1'); // same request, same key
    expect(retry.failure).toBeNull();
  });

  it('draws a new key once an answer changes, so edited details are a new request', () => {
    const failed = run(
      [send('key-1'), { type: 'failed', failure: 'uncertain' }],
      run(completeToReview),
    );
    const edited = run(
      [
        { type: 'edit', step: 4 },
        { type: 'type', field: 'name', value: 'Dana Smythe' },
      ],
      failed,
    );
    expect(edited.idempotencyKey).toBeNull();
    const unchanged = quoteReducer(failed, { type: 'type', field: 'name', value: 'Dana Smith' });
    expect(unchanged.idempotencyKey).toBe('key-1'); // retyping the same value keeps it
  });

  it('drops a key the server says belongs to different details', () => {
    const conflict = run(
      [send('key-1'), { type: 'failed', failure: 'conflict' }],
      run(completeToReview),
    );
    expect(conflict.idempotencyKey).toBeNull();
    expect(quoteReducer(conflict, send('key-2')).idempotencyKey).toBe('key-2');
  });

  it('ignores stray results when nothing is being sent', () => {
    const s = run(completeToReview);
    expect(quoteReducer(s, { type: 'submitted', result: { mode: 'demo' } })).toBe(s);
    expect(quoteReducer(s, { type: 'failed', failure: 'uncertain' })).toBe(s);
  });

  it('starts over from a clean slate', () => {
    expect(run([{ type: 'restart' }], run(completeToReview))).toEqual(initialState());
  });
});

describe('summaries', () => {
  it('formats size, contact and first name like the prototype', () => {
    const a = run(completeToReview).answers;
    expect(sizeSummary(a)).toBe('2 bed · 1 bath · 1,000 to 2,000');
    expect(sizeSummary({ ...a, size: '' })).toBe('2 bed · 1 bath');
    expect(contactSummary(a)).toBe('Dana Smith · (513) 555-0100');
    expect(firstName(a, 'boss')).toBe('Dana');
    expect(firstName({ ...a, name: ' ' }, 'boss')).toBe('boss');
  });
});
