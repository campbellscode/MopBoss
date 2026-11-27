import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubmitOutcome } from '@/lib/quote/submit';

const submitSpy = vi.fn();
/** Outcomes the mocked adapter returns, in order; demo once the queue is empty. */
const outcomes: SubmitOutcome[] = [];

vi.mock('@/lib/quote/submit', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/quote/submit')>();
  return {
    ...actual,
    submitQuoteRequest: (...args: Parameters<typeof actual.submitQuoteRequest>) => {
      submitSpy(...args);
      return Promise.resolve(outcomes.shift() ?? { ok: true, result: { mode: 'demo' } });
    },
  };
});

import { QuoteFlow } from './QuoteFlow';

beforeEach(() => {
  submitSpy.mockClear();
  outcomes.length = 0;
});

const alertText = () =>
  screen
    .getAllByRole('alert')
    .map((a) => a.textContent ?? '')
    .join(' ');

const heading = () => screen.getByRole('heading', { level: 1 });
const progress = () => screen.getByRole('progressbar', { name: 'Quote request progress' });
const continueButton = () => screen.getByRole('button', { name: /continue|send my request/i });

async function completeChoices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Deep Cleaning/ }));
  await user.click(continueButton());
  await user.click(screen.getByRole('button', { name: /^Apartment or condo/ }));
  await user.click(continueButton());
  await user.click(screen.getByRole('button', { name: '2,000 to 3,000' }));
  await user.click(continueButton());
  await user.click(screen.getByRole('button', { name: /Every two weeks/ }));
  await user.click(continueButton());
}

describe('QuoteFlow', () => {
  it('starts on step 1 with an accessible progress bar', () => {
    render(<QuoteFlow />);
    expect(heading()).toHaveTextContent('What are we tackling?');
    expect(progress()).toHaveAttribute('aria-valuenow', '17');
    expect(progress()).toHaveAttribute('aria-valuetext', 'Step 1 of 6');
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('marks the chosen option with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    const deep = screen.getByRole('button', { name: /Deep Cleaning/ });
    expect(deep).toHaveAttribute('aria-pressed', 'false');
    await user.click(deep);
    expect(deep).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps Continue focusable but blocks it, announcing why, until a choice is made', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    expect(continueButton()).toHaveAttribute('aria-disabled', 'true');
    expect(continueButton()).toHaveAccessibleDescription('Pick a service to continue');
    await user.click(continueButton());
    expect(heading()).toHaveTextContent('What are we tackling?');
    expect(alertText()).toContain('Pick a service to continue');
  });

  it('moves focus to the step heading on each step change', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await user.click(screen.getByRole('button', { name: /Residential Cleaning/ }));
    await user.click(continueButton());
    expect(heading()).toHaveTextContent('What kind of place is it?');
    expect(heading()).toHaveFocus();
    expect(progress()).toHaveAttribute('aria-valuenow', '33');
  });

  it('preserves answers when going back', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await user.click(screen.getByRole('button', { name: /Move-In \/ Move-Out/ }));
    await user.click(continueButton());
    await user.click(screen.getByRole('button', { name: /Townhome/ }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /Move-In \/ Move-Out/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(continueButton());
    expect(screen.getByRole('button', { name: /Townhome/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('validates the contact step and shows a field error for a bad email', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await completeChoices(user);
    expect(heading()).toHaveTextContent('Where should Linda send your quote?');
    await user.type(screen.getByLabelText('Your name'), 'Dana Smith');
    await user.type(screen.getByLabelText('Email'), 'dana@');
    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/check the email address/i);
    expect(continueButton()).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Email'), 'example.com');
    expect(continueButton()).toHaveAttribute('aria-disabled', 'false');
  });

  it('edits from the review step, keeps the other answers and submits through the adapter', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await completeChoices(user);
    await user.type(screen.getByLabelText('Your name'), 'Dana Smith');
    await user.type(screen.getByLabelText('Phone'), '513 555 0100');
    await user.click(continueButton());

    expect(heading()).toHaveTextContent('Give it a once-over.');
    const review = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!;
    expect(within(review).getByText('Apartment or condo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit property' }));
    expect(heading()).toHaveTextContent('What kind of place is it?');
    expect(screen.getByRole('button', { name: /Apartment or condo/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /^House/ }));
    for (let i = 0; i < 4; i++) await user.click(continueButton());

    expect(heading()).toHaveTextContent('Give it a once-over.');
    // Shown in both the review list and the Boss Sheet.
    expect(screen.getAllByText('House')).toHaveLength(2);
    expect(screen.getAllByText('2 bed · 1 bath · 2,000 to 3,000')).toHaveLength(2);
    expect(screen.getByText('Dana Smith · 513 555 0100')).toBeInTheDocument();

    outcomes.push({ ok: true, result: { mode: 'live', reference: 'MB-7K3Q9X' } });
    await user.click(screen.getByRole('button', { name: /send my request/i }));
    await waitFor(() => expect(heading()).toHaveTextContent('Consider it handled, Dana.'));
    expect(heading()).toHaveFocus();
    expect(screen.getByText('MB-7K3Q9X')).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).toBeNull();
    expect(screen.queryByText(/has your details/i)).toBeNull(); // no claim Linda has it yet
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy.mock.calls[0][0]).toMatchObject({
      service: 'Deep Cleaning',
      property: 'House',
      frequency: 'Every two weeks',
      contact: { name: 'Dana Smith', phone: '513 555 0100' },
      website: '',
    });
  });

  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    await completeChoices(user);
    await user.type(screen.getByLabelText('Your name'), 'Dana Smith');
    await user.type(screen.getByLabelText('Phone'), '513 555 0100');
    await user.click(continueButton());
    expect(heading()).toHaveTextContent('Give it a once-over.');
  }

  it('says plainly in demo mode that nothing was sent and Linda has not received it', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await toReview(user);

    await user.click(continueButton());

    await waitFor(() => expect(heading()).toHaveTextContent('Nothing was sent, Dana.'));
    expect(screen.getByText(/Linda has not received it/)).toBeInTheDocument();
    expect(screen.getByText('Demo only · nothing was sent')).toBeInTheDocument();
    expect(screen.queryByText(/Consider it handled/)).toBeNull();
    expect(screen.queryByText(/Your reference/)).toBeNull();
  });

  it('keeps the answers after an uncertain send and retries with the same key', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await toReview(user);
    outcomes.push({ ok: false, failure: 'uncertain' });

    await user.click(continueButton());

    await waitFor(() => expect(alertText()).toContain("couldn't confirm your request reached us"));
    expect(alertText()).toContain('(513) 319-4988');
    expect(heading()).toHaveTextContent('Give it a once-over.');
    expect(screen.getByText('Dana Smith · 513 555 0100')).toBeInTheDocument();

    outcomes.push({ ok: true, result: { mode: 'live', reference: 'MB-7K3Q9X' } });
    await user.click(continueButton());

    await waitFor(() => expect(heading()).toHaveTextContent('Consider it handled, Dana.'));
    expect(submitSpy).toHaveBeenCalledTimes(2);
    const [firstKey, secondKey] = submitSpy.mock.calls.map((call) => call[1]);
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondKey).toBe(firstKey);
  });

  it.each([
    ['rate-limited', 'Too many requests came from this connection'],
    ['unavailable', "Online quote requests aren't available right now"],
    ['invalid', "Some of these details weren't accepted"],
  ] as const)(
    'explains a %s failure truthfully and offers the phone number',
    async (failure, text) => {
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await toReview(user);
      outcomes.push({ ok: false, failure });

      await user.click(continueButton());

      await waitFor(() => expect(alertText()).toContain(text));
      expect(alertText()).toContain('(513) 319-4988');
      expect(heading()).toHaveTextContent('Give it a once-over.');
    },
  );

  it('sends once even when Send is pressed repeatedly', async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await toReview(user);

    const send = continueButton(); // relabels to "Sending…" after the first press
    await user.click(send);
    await user.click(send);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(heading()).toHaveTextContent('Nothing was sent, Dana.'));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
