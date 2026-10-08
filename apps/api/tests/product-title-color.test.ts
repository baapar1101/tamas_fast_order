import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanProductTitleColor } from '../src/lib/product-title-color.js';

describe('cleanProductTitleColor', () => {
  it('removes an attached colour after the model without touching the model', () => {
    const result = cleanProductTitleColor('پایه نگهدارنده برند YESIDO مدل C262مشکی', 'مشکی');
    assert.equal(result.title, 'پایه نگهدارنده برند YESIDO مدل C262');
    assert.equal(result.color, 'مشکی');
    assert.equal(result.colorConflict, false);
  });

  it('removes the colour label and handles Arabic spelling variants', () => {
    const result = cleanProductTitleColor('ماوس برند hoco مدل GM37 رنگ مشكي', 'مشکی');
    assert.equal(result.title, 'ماوس برند hoco مدل GM37');
    assert.equal(result.color, 'مشکی');
    assert.equal(result.colorConflict, false);
  });

  it('recognizes transparent and grey aliases', () => {
    assert.equal(cleanProductTitleColor('گلس iPhone 13 Pro Maxبدون رنگ', 'شفاف').title, 'گلس iPhone 13 Pro Max');
    assert.equal(cleanProductTitleColor('پاوربانک مدل YP95طوسي', 'خاکستری').title, 'پاوربانک مدل YP95');
  });

  it('fills a missing colour from an explicit title suffix', () => {
    const result = cleanProductTitleColor('ساعت مدل B19 رنگ آبی', null);
    assert.equal(result.title, 'ساعت مدل B19');
    assert.equal(result.color, 'آبی');
    assert.equal(result.colorConflict, false);
  });

  it('preserves the existing colour parameter when it disagrees with the title', () => {
    const result = cleanProductTitleColor('کابل مدل LX-24 بنفش', 'سفید');
    assert.equal(result.title, 'کابل مدل LX-24');
    assert.equal(result.color, 'سفید');
    assert.equal(result.detectedColor, 'بنفش');
    assert.equal(result.colorConflict, true);
  });

  it('keeps non-colour texture and model names', () => {
    assert.equal(cleanProductTitleColor('محافظ صفحه Apple Watch 42 MM مشكي مات', 'مشکی').title,
      'محافظ صفحه Apple Watch 42 MM مات');
    assert.equal(cleanProductTitleColor('Hanofer 5300 4G 16/2 GB Android', null).changed, false);
  });
});
