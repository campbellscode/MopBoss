'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useReducer, useRef, type FormEvent } from 'react';
import logo from '@/assets/brand/mopboss-logo.png';
import { PlaceholderChip } from '@/components/content/Placeholder';
import { ArrowRight, Eyebrow, Sparkle, renderHeadline } from '@/components/ui';
import { bossClassName, ghostClassName } from '@/components/ui/Button';
import { brand, business, nav, quoteCopy, quoteOptions, services, telHref } from '@/content';
import type { QuoteOption } from '@/content/quote';
import {
  STEP_COUNT,
  contactErrors,
  contactSummary,
  firstName,
  initialState,
  progressPercent,
  quoteReducer,
  sizeSummary,
  stepValid,
  type ChoiceField,
  type ContactField,
  type QuoteState,
  type StepIndex,
} from '@/lib/quote/machine';
import { isMockSubmission, submitQuoteRequest, toPayload } from '@/lib/quote/submit';
import styles from './QuoteFlow.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/**
 * The six-step quote flow: service, property, size, frequency, contact, review,
 * then a confirmation. One client component with local state; answers survive
 * Back, Continue and the Edit links on the review step.
 */
export function QuoteFlow() {
  const [state, dispatch] = useReducer(quoteReducer, undefined, initialState);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const { answers, step, done } = state;

  // Move focus to the new step's heading so screen readers and keyboards follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, done]);

  // Hand the request to the submit adapter when the reducer enters "submitting".
  useEffect(() => {
    if (state.status !== 'submitting') return;
    let cancelled = false;
    submitQuoteRequest(toPayload(answers)).then((result) => {
      if (!cancelled) dispatch({ type: result.ok ? 'submitted' : 'failed' });
    });
    return () => {
      cancelled = true;
    };
    // Only the transition into "submitting" should trigger a send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const pct = progressPercent(state);
  const valid = stepValid(answers, step);
  const hint = valid ? '' : quoteCopy.steps[step].hint;
  const submitting = state.status === 'submitting';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: 'next' });
  };

  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">
        {nav.skipLink}
      </a>
      <header className={styles.header}>
        <div className={cx(styles.wrap, styles.headerInner)}>
          <Link href="/" aria-label={nav.homeAriaLabel} className={styles.logoLink}>
            <Image src={logo} alt={brand.logoAlt} width={84} height={58} className={styles.logo} />
          </Link>
          <div className={styles.headerRight}>
            <span className={styles.stepLabel}>
              {done ? quoteCopy.doneLabel : quoteCopy.stepLabel(step + 1, STEP_COUNT)}
            </span>
            <Link href="/" className={styles.exit}>
              {quoteCopy.exit}
            </Link>
          </div>
        </div>
      </header>

      <div className={cx(styles.wrap, styles.trackWrap)}>
        <SweepTrack
          pct={pct}
          label={done ? quoteCopy.doneLabel : quoteCopy.stepLabel(step + 1, STEP_COUNT)}
        />
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <main id="main" className={cx(styles.wrap, styles.main)}>
          <div className={styles.stepCol}>
            {done ? (
              <Done
                state={state}
                headingRef={headingRef}
                onRestart={() => dispatch({ type: 'restart' })}
              />
            ) : (
              <div key={step} className={styles.stepIn}>
                <StepView state={state} dispatch={dispatch} headingRef={headingRef} />
              </div>
            )}
          </div>
          <BossSheet state={state} />
        </main>

        {done ? null : (
          <div className={styles.bar}>
            <div className={cx(styles.wrap, styles.barInner)}>
              <button
                type="button"
                className={ghostClassName({ size: 'flow' })}
                onClick={() => dispatch({ type: 'back' })}
                disabled={step === 0 || submitting}
              >
                {quoteCopy.nav.back}
              </button>
              <span className={styles.hint} aria-hidden="true">
                {state.status === 'error' ? '' : hint}
              </span>
              <button
                type="submit"
                className={bossClassName({ lift: true })}
                aria-disabled={!valid || submitting}
                aria-describedby={hint ? 'quote-hint' : undefined}
              >
                {submitting
                  ? quoteCopy.nav.sending
                  : step === STEP_COUNT - 1
                    ? quoteCopy.nav.send
                    : quoteCopy.nav.next}{' '}
                <ArrowRight />
              </button>
              <span id="quote-hint" className="visually-hidden">
                {hint}
              </span>
              {/* Announced only when someone tries to continue with the step incomplete. */}
              <span className="visually-hidden" role="alert">
                {state.attempted && !valid ? hint : ''}
              </span>
            </div>
            {state.status === 'error' ? (
              <p className={cx(styles.wrap, styles.submitError)} role="alert">
                {quoteCopy.submitError} <a href={telHref}>{business.phone.display}</a>
              </p>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
}

// ---------- Sweep Track ----------

function SweepTrack({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={quoteCopy.progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={label}
      className={styles.track}
    >
      <div className={styles.trackFill} style={{ width: `${pct}%` }} />
      <div className={styles.knob} style={{ left: `${pct}%` }} aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0B0B0C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 2l-4 11" />
          <path d="M8.5 13h7l1 3h-9z" fill="#FC1D8A" />
          <path d="M7 16c-2 1.5-3 4-2.5 6h15c.5-2-.5-4.5-2.5-6z" fill="#FF7DB8" />
        </svg>
      </div>
    </div>
  );
}

// ---------- Steps ----------

type StepProps = {
  state: QuoteState;
  dispatch: React.Dispatch<Parameters<typeof quoteReducer>[1]>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
};

function StepHeading({
  step,
  headingRef,
  id,
}: {
  step: StepIndex;
  headingRef: StepProps['headingRef'];
  id: string;
}) {
  const copy = quoteCopy.steps[step];
  return (
    <div className={styles.stepHead}>
      <Eyebrow className={styles.stepEyebrow}>{copy.eyebrow}</Eyebrow>
      <h1 ref={headingRef} id={id} tabIndex={-1} className={cx('display', styles.stepTitle)}>
        {renderHeadline(copy.heading)}
      </h1>
      {'lead' in copy && copy.lead ? <p className={styles.lead}>{copy.lead}</p> : null}
    </div>
  );
}

function StepView({ state, dispatch, headingRef }: StepProps) {
  const headingId = useId();
  const { step, answers } = state;

  const optionStep = (field: ChoiceField, options: readonly QuoteOption[], note?: string) => (
    <div className={styles.stepBody}>
      <StepHeading step={step} headingRef={headingRef} id={headingId} />
      <div role="group" aria-labelledby={headingId} className={styles.options}>
        {options.map((o, i) => {
          const on = answers[field] === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              className={cx(styles.opt, on && styles.optOn)}
              onClick={() => dispatch({ type: 'choose', field, value: o.value })}
            >
              <span className={cx('accent', styles.optNum)} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={styles.optText}>
                <span className={styles.optLabel}>{o.value}</span>
                {o.hint ? <span className={styles.optHint}>{o.hint}</span> : null}
              </span>
              <span className={styles.dot} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {note ? <PlaceholderChip className={styles.selfStart}>{note}</PlaceholderChip> : null}
    </div>
  );

  switch (step) {
    case 0:
      return optionStep(
        'service',
        quoteOptions.services,
        "Draft service list — pending Linda's approval",
      );
    case 1:
      return optionStep('property', quoteOptions.properties);
    case 2:
      return (
        <SizeStep state={state} dispatch={dispatch} headingRef={headingRef} headingId={headingId} />
      );
    case 3:
      return optionStep(
        'frequency',
        quoteOptions.frequencies,
        'Frequency options — confirm with Linda',
      );
    case 4:
      return (
        <ContactStep
          state={state}
          dispatch={dispatch}
          headingRef={headingRef}
          headingId={headingId}
        />
      );
    case 5:
      return (
        <ReviewStep
          state={state}
          dispatch={dispatch}
          headingRef={headingRef}
          headingId={headingId}
        />
      );
  }
}

function SizeStep({ state, dispatch, headingRef, headingId }: StepProps & { headingId: string }) {
  const { answers } = state;
  const sqftId = useId();
  const counter = (field: 'beds' | 'baths') => {
    const isBeds = field === 'beds';
    const limits = isBeds ? quoteOptions.bedrooms : quoteOptions.bathrooms;
    const labelId = `${headingId}-${field}`;
    const value = answers[field];
    return (
      <div className={styles.counter} role="group" aria-labelledby={labelId}>
        <span id={labelId} className={styles.counterLabel}>
          {isBeds ? quoteCopy.size.bedrooms : quoteCopy.size.bathrooms}
        </span>
        <span className={styles.counterControls}>
          <button
            type="button"
            className={styles.round}
            aria-label={isBeds ? quoteCopy.size.fewerBedrooms : quoteCopy.size.fewerBathrooms}
            disabled={value <= limits.min}
            onClick={() => dispatch({ type: 'count', field, delta: -1 })}
          >
            −
          </button>
          <output className={cx('display', styles.count)} aria-live="polite">
            {value}
          </output>
          <button
            type="button"
            className={styles.round}
            aria-label={isBeds ? quoteCopy.size.moreBedrooms : quoteCopy.size.moreBathrooms}
            disabled={value >= limits.max}
            onClick={() => dispatch({ type: 'count', field, delta: 1 })}
          >
            +
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className={cx(styles.stepBody, styles.sizeBody)}>
      <StepHeading step={2} headingRef={headingRef} id={headingId} />
      <div className={styles.counters}>
        {counter('beds')}
        {counter('baths')}
      </div>
      <div className={styles.sqft}>
        <div id={sqftId} className={styles.sqftLabel}>
          {quoteCopy.size.squareFeet}
        </div>
        <div role="group" aria-labelledby={sqftId} className={styles.pills}>
          {quoteOptions.sizes.map((o) => {
            const on = answers.size === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                className={cx(styles.pill, on && styles.pillOn)}
                onClick={() => dispatch({ type: 'choose', field: 'size', value: o.value })}
              >
                {o.value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContactStep({
  state,
  dispatch,
  headingRef,
  headingId,
}: StepProps & { headingId: string }) {
  const { answers, attempted, touched } = state;
  const errors = contactErrors(answers);
  const reqId = useId();
  const show = (field: 'email' | 'phone' | 'zip') =>
    !!errors[field] && (attempted || touched[field]);

  const field = (
    name: Exclude<ContactField, 'notes' | 'website'>,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => {
    const errorKey = name === 'name' ? null : name;
    const invalid =
      name === 'name' ? attempted && !answers.name.trim() : errorKey ? show(errorKey) : false;
    const errorId = `${reqId}-${name}-error`;
    const inputId = `${reqId}-${name}`;
    // The error sits outside the <label> so it never becomes part of the field's name.
    return (
      <div className={styles.field}>
        <label htmlFor={inputId}>{label}</label>
        <input
          {...props}
          id={inputId}
          name={name}
          value={answers[name]}
          onChange={(e) => dispatch({ type: 'type', field: name, value: e.target.value })}
          onBlur={() => dispatch({ type: 'blur', field: name })}
          aria-invalid={invalid || undefined}
          aria-describedby={cx(reqId, invalid && errorId) || undefined}
          aria-required={name === 'name' || undefined}
        />
        {errorKey && show(errorKey) ? (
          <span id={errorId} className={styles.fieldError}>
            {quoteCopy.errors[errorKey]}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.stepBody}>
      <StepHeading step={4} headingRef={headingRef} id={headingId} />
      <div className={styles.fields}>
        {field('name', quoteCopy.contact.name, { type: 'text', autoComplete: 'name' })}
        {field('phone', quoteCopy.contact.phone, {
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
        })}
        {field('email', quoteCopy.contact.email, { type: 'email', autoComplete: 'email' })}
        {field('zip', quoteCopy.contact.zip, {
          type: 'text',
          inputMode: 'numeric',
          autoComplete: 'postal-code',
        })}
      </div>
      <label className={styles.field}>
        {quoteCopy.contact.notes}
        <textarea
          name="notes"
          rows={3}
          value={answers.notes}
          onChange={(e) => dispatch({ type: 'type', field: 'notes', value: e.target.value })}
        />
      </label>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={answers.website}
            onChange={(e) => dispatch({ type: 'type', field: 'website', value: e.target.value })}
          />
        </label>
      </div>
      <div className={styles.requirement}>
        <p
          id={reqId}
          className={cx(attempted && !stepValid(answers, 4) && styles.requirementError)}
        >
          {quoteCopy.contact.requirement}
        </p>
        {business.privacyNote ? (
          <p className={styles.privacy}>{business.privacyNote}</p>
        ) : (
          <PlaceholderChip>[Privacy note — confirm]</PlaceholderChip>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ state, dispatch, headingRef, headingId }: StepProps & { headingId: string }) {
  const { answers } = state;
  const labels = quoteCopy.review.labels;
  const rows: { key: string; label: string; value: string; step: StepIndex }[] = [
    { key: 'service', label: labels.service, value: answers.service, step: 0 },
    { key: 'property', label: labels.property, value: answers.property, step: 1 },
    { key: 'size', label: labels.size, value: sizeSummary(answers), step: 2 },
    { key: 'frequency', label: labels.frequency, value: answers.frequency, step: 3 },
    { key: 'contact', label: labels.contact, value: contactSummary(answers), step: 4 },
  ];
  return (
    <div className={cx(styles.stepBody, styles.reviewBody)}>
      <StepHeading step={5} headingRef={headingRef} id={headingId} />
      <dl className={styles.review}>
        {rows.map((row) => (
          <div key={row.key} className={styles.reviewRow}>
            <div className={styles.reviewText}>
              <dt className={styles.reviewKey}>{row.label}</dt>
              <dd className={styles.reviewValue}>{row.value}</dd>
            </div>
            <button
              type="button"
              className={styles.edit}
              aria-label={`${quoteCopy.review.edit} ${row.label.toLowerCase()}`}
              onClick={() => dispatch({ type: 'edit', step: row.step })}
            >
              {quoteCopy.review.edit}
            </button>
          </div>
        ))}
        {answers.notes.trim() ? (
          <div className={styles.reviewRow}>
            <div className={styles.reviewText}>
              <dt className={styles.reviewKey}>Notes</dt>
              <dd className={styles.reviewValue}>{answers.notes.trim()}</dd>
            </div>
            <button
              type="button"
              className={styles.edit}
              aria-label={`${quoteCopy.review.edit} notes`}
              onClick={() => dispatch({ type: 'edit', step: 4 })}
            >
              {quoteCopy.review.edit}
            </button>
          </div>
        ) : null}
      </dl>
      <p className={styles.paymentNote}>{quoteCopy.review.paymentNote}</p>
    </div>
  );
}

// ---------- Confirmation ----------

function Done({
  state,
  headingRef,
  onRestart,
}: {
  state: QuoteState;
  headingRef: StepProps['headingRef'];
  onRestart: () => void;
}) {
  const name = firstName(state.answers, quoteCopy.done.fallbackName);
  return (
    <div className={cx(styles.stepIn, styles.done)}>
      <Sparkle motion="pop" delay=".25s" style={{ width: 48, height: 48, right: '12%', top: -6 }} />
      <Sparkle motion="pop" delay=".4s" style={{ width: 26, height: 26, right: '4%', top: 70 }} />
      <Sparkle
        motion="pop"
        delay=".55s"
        style={{ width: 34, height: 34, right: '22%', top: 120 }}
      />
      <Eyebrow className={styles.stepEyebrow}>{quoteCopy.done.eyebrow}</Eyebrow>
      <h1 ref={headingRef} tabIndex={-1} className={cx('display', styles.doneTitle)}>
        {renderHeadline(quoteCopy.done.heading(name))}
      </h1>
      <p className={styles.doneBody}>
        {quoteCopy.done.body} <a href={telHref}>{business.phone.display}</a>.
      </p>
      {isMockSubmission ? (
        <div className={styles.stamp} role="note">
          {quoteCopy.done.demoStamp}
        </div>
      ) : null}
      <div className={styles.doneActions}>
        <Link href="/" className={bossClassName({ lift: true })}>
          {quoteCopy.done.home}
        </Link>
        <button type="button" className={ghostClassName({ size: 'flow' })} onClick={onRestart}>
          {quoteCopy.done.restart}
        </button>
      </div>
    </div>
  );
}

// ---------- The Boss Sheet ----------

function BossSheet({ state }: { state: QuoteState }) {
  const { answers, step, done } = state;
  const dash = '—';
  const labels = quoteCopy.review.labels;
  const rows = [
    { k: labels.service, v: answers.service || dash },
    { k: labels.property, v: answers.property || dash },
    { k: labels.size, v: step >= 2 || done ? sizeSummary(answers) : dash },
    { k: labels.frequency, v: answers.frequency || dash },
    { k: labels.contact, v: answers.name.trim() || dash },
  ];
  const anyPricing = services.some((s) => s.pricing !== null);
  return (
    <aside aria-label={quoteCopy.sheet.label} className={styles.sheet}>
      <div className={styles.sheetHead}>
        <span className={cx('display', styles.sheetTitle)}>{quoteCopy.sheet.title}</span>
        <span className={cx('accent', styles.sheetAccent)}>{quoteCopy.sheet.accent}</span>
      </div>
      <dl className={styles.sheetRows}>
        {rows.map((r) => (
          <div key={r.k} className={styles.sheetRow}>
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.sheetFoot}>
        {anyPricing ? null : (
          <PlaceholderChip className={styles.selfStart}>
            [Pricing — set by Linda, shown after review]
          </PlaceholderChip>
        )}
        <span className={styles.sheetCall}>
          {quoteCopy.sheet.questions} <a href={telHref}>{business.phone.display}</a>
        </span>
      </div>
    </aside>
  );
}
