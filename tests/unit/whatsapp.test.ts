import { describe, it, expect } from 'vitest';
import { waLink } from '../../src/lib/whatsapp';
import { site } from '../../src/content/site';

describe('waLink', () => {
  it('default message with number', () => {
    expect(waLink({ number: '60123456789' })).toBe(
      "https://wa.me/60123456789?text=Hi%20Advent%2C%20I'd%20like%20to%20talk%20about%20a%20project.",
    );
  });

  it('service message', () => {
    expect(waLink({ number: '1', service: 'Brand identity' })).toMatch(
      /\?text=Hi%20Advent%2C%20I'd%20like%20to%20talk%20about%20Brand%20identity\.$/,
    );
  });

  it('empty number falls back to number-less link', () => {
    expect(waLink({ number: '' }).startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('defaults to site.whatsappNumber', () => {
    expect(waLink()).toBe(waLink({ number: site.whatsappNumber }));
  });
});
