/**
 * Quote flow state machine, ported from the script block in Quote.dc.html.
 * Pure functions only, so every rule is unit-testable without rendering.
 */

import { quoteOptions } from '@/content/quote';

export const STEP_COUNT = 6;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type QuoteAnswers = {
  service: string;
  property: string;
  beds: number;
  baths: number;
  size: string;
  frequency: string;
  name: string;
  phone: string;
  email: string;
  zip: string;
  notes: string;
  /** Honeypot: hidden from people, often filled by bots. Must stay empty. */
  website: string;
};

export type SubmitStatus = 'idle' | 'submitting' | 'error';

export type QuoteState = {
  step: StepIndex;
  done: boolean;
  status: SubmitStatus;
  /** Set when the visitor tries to continue past an incomplete step. */
  attempted: boolean;
  /** Contact fields the visitor has left at least once (to time error messages). */
  touched: Partial<Record<ContactField, boolean>>;
  answers: QuoteAnswers;
};

export type ContactField = 'name' | 'phone' | 'email' | 'zip' | 'notes' | 'website';
export type ChoiceField = 'service' | 'property' | 'size' | 'frequency';

export function initialState(): QuoteState {
  return {
    step: 0,
    done: false,
    status: 'idle',
    attempted: false,
    touched: {},
    answers: {
      service: '',
      property: '',
      beds: quoteOptions.bedrooms.initial,
      baths: quoteOptions.bathrooms.initial,
      size: '',
      frequency: '',
      name: '',
      phone: '',
      email: '',
      zip: '',
      notes: '',
      website: '',
    },
  };
}

export type QuoteAction =
  | { type: 'choose'; field: ChoiceField; value: string }
  | { type: 'count'; field: 'beds' | 'baths'; delta: 1 | -1 }
  | { type: 'type'; field: ContactField; value: string }
  | { type: 'blur'; field: ContactField }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'edit'; step: StepIndex }
  | { type: 'submitted' }
  | { type: 'failed' }
  | { type: 'restart' };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ---------- Validation ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP = /^\d{5}(-\d{4})?$/;

export type ContactErrors = Partial<Record<'email' | 'phone' | 'zip', 'email' | 'phone' | 'zip'>>;

/** Format checks for optional fields; only applied when something was typed. */
export function contactErrors(a: QuoteAnswers): ContactErrors {
  const errors: ContactErrors = {};
  if (a.email.trim() && !EMAIL.test(a.email.trim())) errors.email = 'email';
  if (a.phone.trim() && a.phone.replace(/\D/g, '').length < 10) errors.phone = 'phone';
  if (a.zip.trim() && !ZIP.test(a.zip.trim())) errors.zip = 'zip';
  return errors;
}

/** The prototype's rule: a name plus a phone number or an email. */
export function hasContactRoute(a: QuoteAnswers): boolean {
  return !!(a.name.trim() && (a.phone.trim() || a.email.trim()));
}

/** Whether the visitor may continue from `step`. */
export function stepValid(a: QuoteAnswers, step: StepIndex): boolean {
  switch (step) {
    case 0:
      return !!a.service;
    case 1:
      return !!a.property;
    case 2:
      return !!a.size;
    case 3:
      return !!a.frequency;
    case 4:
      return hasContactRoute(a) && Object.keys(contactErrors(a)).length === 0;
    case 5:
      return true;
  }
}

/** First step that still needs an answer, or null when everything is complete. */
export function firstIncompleteStep(a: QuoteAnswers): StepIndex | null {
  for (let s = 0; s < STEP_COUNT; s++) {
    if (!stepValid(a, s as StepIndex)) return s as StepIndex;
  }
  return null;
}

// ---------- Reducer ----------

export function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'choose':
      return { ...state, answers: { ...state.answers, [action.field]: action.value } };

    case 'count': {
      const limits = action.field === 'beds' ? quoteOptions.bedrooms : quoteOptions.bathrooms;
      const value = clamp(state.answers[action.field] + action.delta, limits.min, limits.max);
      return { ...state, answers: { ...state.answers, [action.field]: value } };
    }

    case 'type':
      return { ...state, answers: { ...state.answers, [action.field]: action.value } };

    case 'blur':
      return { ...state, touched: { ...state.touched, [action.field]: true } };

    case 'next': {
      if (state.done || state.status === 'submitting') return state;
      if (!stepValid(state.answers, state.step)) return { ...state, attempted: true };
      if (state.step === STEP_COUNT - 1) {
        // Review step: guard against a stale answer, then hand over to the adapter.
        const missing = firstIncompleteStep(state.answers);
        if (missing !== null) return { ...state, step: missing, attempted: true };
        return { ...state, status: 'submitting' };
      }
      return { ...state, step: (state.step + 1) as StepIndex, attempted: false };
    }

    case 'back':
      if (state.status === 'submitting') return state;
      return {
        ...state,
        step: Math.max(0, state.step - 1) as StepIndex,
        attempted: false,
        status: 'idle',
      };

    case 'edit':
      return { ...state, step: action.step, attempted: false, status: 'idle' };

    case 'submitted':
      return { ...state, done: true, status: 'idle' };

    case 'failed':
      return { ...state, status: 'error' };

    case 'restart':
      return initialState();
  }
}

// ---------- Derived values ----------

export function progressPercent(state: QuoteState): number {
  return state.done ? 100 : Math.round(((state.step + 1) / STEP_COUNT) * 100);
}

export function sizeSummary(a: QuoteAnswers): string {
  return `${a.beds} bed · ${a.baths} bath${a.size ? ` · ${a.size}` : ''}`;
}

export function contactSummary(a: QuoteAnswers): string {
  return [a.name, a.phone, a.email, a.zip]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(' · ');
}

export function firstName(a: QuoteAnswers, fallback: string): string {
  return a.name.trim().split(/\s+/)[0] || fallback;
}
