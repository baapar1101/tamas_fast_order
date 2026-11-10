import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatProductTitle } from '../src/product-title.js';

describe('formatProductTitle', () => {
  it('converts all-caps names to title case', () => {
    assert.equal(formatProductTitle('XIAOMI POCO C81 PRO'), 'Xiaomi Poco C81 Pro');
  });

  it('starts a new capitalized word after a hyphen', () => {
    assert.equal(formatProductTitle('REDMI-NOTE 15 PRO-MAX'), 'Redmi-Note 15 Pro-Max');
  });

  it('keeps model codes, technical acronyms, units, and intentional brand case', () => {
    assert.equal(formatProductTitle('USB-C 4G 128 GB 100cm iPhone MicroUSB'),
      'USB-C 4G 128 GB 100cm iPhone MicroUSB');
    assert.equal(formatProductTitle('OG SUPER X LX-24 CH/A GALAXY S25 FE'),
      'OG Super X LX-24 CH/A Galaxy S25 FE');
  });

  it('formats units correctly', () => {
    assert.equal(formatProductTitle('100 CM 5000 MAH 60 HZ'), '100 cm 5000 mAh 60 Hz');
  });

  it('differentiates between 2-letter brands/acronyms and short words', () => {
    assert.equal(formatProductTitle('LG PLUG IN WALL'), 'LG Plug In Wall');
  });

  it('preserves 3-letter regional codes', () => {
    assert.equal(formatProductTitle('IPHONE 13 PRO CHN/A'), 'Iphone 13 Pro CHN/A');
  });

  it('preserves 2-letter prefixes before a dash but title-cases longer ones', () => {
    assert.equal(formatProductTitle('AB-12 ABC-12'), 'AB-12 Abc-12');
  });

  it('leaves Persian text unchanged and is idempotent', () => {
    const title = 'گوشی XIAOMI POCO C81 PRO رنگ آبی';
    const formatted = formatProductTitle(title);
    assert.equal(formatted, 'گوشی Xiaomi Poco C81 Pro رنگ آبی');
    assert.equal(formatProductTitle(formatted), formatted);
  });
});
