import { business, contentAudit } from '@/content';
import { PlaceholderChip } from './Placeholder';

type Props = {
  /** Wraps the confirmed facts and placeholder chips. Omitted when nothing is left to show. */
  className?: string;
  lineClassName?: string;
  /** Audit labels; the prototype words them slightly differently per page. */
  labels?: { email: string; hours: string; serviceArea: string };
  order?: ReadonlyArray<'email' | 'hours' | 'serviceArea'>;
};

const defaultLabels = { email: '[Email]', hours: '[Hours]', serviceArea: '[Service area]' };

/**
 * Email, hours and service area: the confirmed ones as text, the rest as audit chips.
 * In production, with none confirmed, it renders nothing at all.
 */
export function ContactFacts({
  className,
  lineClassName,
  labels = defaultLabels,
  order = ['email', 'hours', 'serviceArea'],
}: Props) {
  const confirmed = order.filter((key) => business[key] !== null);
  const missing = order.filter((key) => business[key] === null);

  return (
    <>
      {confirmed.map((key) =>
        key === 'email' ? (
          <div key={key} className={lineClassName}>
            <a href={`mailto:${business.email}`}>{business.email}</a>
          </div>
        ) : (
          <div key={key} className={lineClassName}>
            {business[key]}
          </div>
        ),
      )}
      <MissingChips keys={missing} labels={labels} className={className} />
    </>
  );
}

function MissingChips({
  keys,
  labels,
  className,
}: {
  keys: ReadonlyArray<'email' | 'hours' | 'serviceArea'>;
  labels: { email: string; hours: string; serviceArea: string };
  className?: string;
}) {
  const chips = keys.map((key) => <PlaceholderChip key={key}>{labels[key]}</PlaceholderChip>);
  // PlaceholderChip renders null outside audit mode; only wrap when chips will show.
  if (keys.length === 0 || !contentAudit) return null;
  return <div className={className}>{chips}</div>;
}
