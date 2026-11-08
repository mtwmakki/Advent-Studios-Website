import { site } from '../content/site';

const DEFAULT_MESSAGE = "Hi Advent, I'd like to talk about a project.";

/** Builds a wa.me link with a pre-filled message. */
export function waLink(opts: { service?: string; number?: string } = {}): string {
  const number = (opts.number ?? site.whatsappNumber).replace(/\D/g, '');
  const message = opts.service ? `Hi Advent, I'd like to talk about ${opts.service}.` : DEFAULT_MESSAGE;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
