import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chequeDueDate,
  firstChequeSubmissionDeadline,
  formatPersianDueDate,
  nextThursdayDueDate,
  tehranWeekWindow,
} from '../src/payment-dates.js';

const orderAtMehr20 = new Date('2026-10-12T12:00:00+03:30'); // ۲۰ مهر ۱۴۰۵

test('monthly cheques start on day 25 of the following Persian month', () => {
  const first = chequeDueDate(orderAtMehr20, 0, 1);
  const second = chequeDueDate(orderAtMehr20, 1, 1);
  assert.match(formatPersianDueDate(first), /۲۵ آبان ۱۴۰۵/);
  assert.match(formatPersianDueDate(second), /۲۵ آذر ۱۴۰۵/);
});

test('bimonthly cheques preserve day 25 every two Persian months', () => {
  const first = chequeDueDate(orderAtMehr20, 0, 2);
  const second = chequeDueDate(orderAtMehr20, 1, 2);
  assert.match(formatPersianDueDate(first), /۲۵ آذر ۱۴۰۵/);
  assert.match(formatPersianDueDate(second), /۲۵ بهمن ۱۴۰۵/);
});

test('weekly credit uses the next Thursday and cheque submission closes after five days', () => {
  const saturday = new Date('2026-10-17T12:00:00+03:30');
  assert.equal(nextThursdayDueDate(saturday), '2026-10-22');
  assert.equal(firstChequeSubmissionDeadline(saturday).toISOString(), '2026-10-22T20:29:59.999Z');
  const week = tehranWeekWindow(new Date('2026-10-21T12:00:00+03:30'));
  assert.equal(week.start.toISOString(), '2026-10-16T20:30:00.000Z');
  assert.equal(week.end.toISOString(), '2026-10-23T20:30:00.000Z');
});
