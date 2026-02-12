import { prisma } from '../index';

const WEBHOOK_URL = process.env.CHECKOUT_COMPLETE_WEBHOOK_URL;

/**
 * Notify external system (e.g. Home Assistant) when a checkout completes.
 * Sends POST with form data. Fire-and-forget; errors are logged but not thrown.
 */
export async function notifyCheckoutComplete(checkoutId: string): Promise<void> {
  if (!WEBHOOK_URL) return;

  try {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: { timer: { include: { person: true } } },
    });

    if (!checkout || checkout.status !== 'COMPLETED') return;

    const form = new URLSearchParams({
      timer_name: checkout.timer.name,
      person_name: checkout.timer.person.name,
      person_id: checkout.timer.personId,
      checkout_id: checkout.id,
      timer_id: checkout.timerId,
      used_seconds: String(checkout.usedSeconds),
      allocated_seconds: String(checkout.allocatedSeconds),
      allocated_minutes: String(Math.floor(checkout.allocatedSeconds / 60)),
    });

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (response.ok) {
      console.log('Checkout complete webhook: OK checkout=%s timer=%s status=%d', checkoutId, checkout.timer.name, response.status);
    } else {
      console.error('Checkout complete webhook: failed checkout=%s timer=%s status=%d', checkoutId, checkout.timer.name, response.status);
    }
  } catch (err) {
    console.error('Checkout complete webhook error:', err);
  }
}
