import { chequeDueDate, firstChequeSubmissionDeadline, formatPersianDueDate, type PaymentPlanQuote } from '@tamas/shared';

export function buildChequeOrderDTO(
  order: { id: number; orderCode: string; createdAt: Date; paymentPlan: PaymentPlanQuote | null; status: string },
  registeredCount: number,
) {
  const plan = order.paymentPlan;
  if (order.status === 'cancelled' || plan?.kind !== 'cheque') return null;

  const schedule = plan.schedule.flatMap((item, index) => {
    if (item.amount == null || item.amount <= 0) return [];
    const dueDate = item.dueDate ?? chequeDueDate(order.createdAt, index, plan.installmentIntervalMonths ?? 1, plan.termMonths);
    return [{
      index,
      amount: item.amount,
      dueDate,
      dueLabel: formatPersianDueDate(dueDate),
      registered: index < registeredCount,
    }];
  });

  const nextInstallment = schedule.find((item) => !item.registered) ?? null;
  const submissionDeadline = firstChequeSubmissionDeadline(order.createdAt);
  const firstChequeExpired = registeredCount === 0 && Date.now() > submissionDeadline.getTime();

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    createdAt: order.createdAt.toISOString(),
    submissionDeadline: submissionDeadline.toISOString(),
    canSubmitNextCheque: Boolean(nextInstallment) && !firstChequeExpired,
    blockedReason: firstChequeExpired
      ? 'مهلت پنج‌روزه ثبت چک اول این سفارش پایان یافته است.'
      : nextInstallment ? null : 'همه چک‌های این سفارش ثبت شده‌اند.',
    schedule,
    nextInstallment,
  };
}
