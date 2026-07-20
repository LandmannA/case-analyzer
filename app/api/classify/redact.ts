// Best-effort PII redaction: masks common personal identifiers in case text
// before it is sent to the Claude API. Emails/phones/order-serial numbers are
// reliable regex matches; name detection is a lighter-touch heuristic
// (capitalized "First Last" pairs) and will miss edge cases — documented as
// a known limitation in the README rather than over-engineered here.

export type RedactionCounts = {
  email: number;
  phone: number;
  order: number;
  name: number;
};

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d[\d\-\s()]{7,}\d)/g;
const ORDER_SERIAL_RE = /\b(?:ORD|SN|SERIAL|ORDER)[-\s]?[A-Z0-9-]{4,}\b/gi;
// Two consecutive capitalized words (e.g. "Anna Example") — a common shape
// for a full name in support-ticket sign-offs and salutations.
const NAME_RE = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;

export function redactText(text: string, counts: RedactionCounts): string {
  let result = text;
  result = result.replace(EMAIL_RE, () => {
    counts.email++;
    return "[EMAIL]";
  });
  result = result.replace(ORDER_SERIAL_RE, () => {
    counts.order++;
    return "[ORDER]";
  });
  result = result.replace(PHONE_RE, () => {
    counts.phone++;
    return "[PHONE]";
  });
  result = result.replace(NAME_RE, () => {
    counts.name++;
    return "[NAME]";
  });
  return result;
}

export function newCounts(): RedactionCounts {
  return { email: 0, phone: 0, order: 0, name: 0 };
}
