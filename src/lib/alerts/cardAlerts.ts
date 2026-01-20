/**
 * Alertas relacionadas con tarjetas de crédito
 */

import type { Card } from '../types';
import type { CardPeriodAnalysis } from '../dashboardMetrics';
import type { SmartAlert } from './types';

interface CardAlertsContext {
  cards: Card[];
  cardPeriods: CardPeriodAnalysis[];
  banks: { id: string; name: string }[];
  today: Date;
}

/**
 * Genera alertas para tarjetas sin pago programado después del corte
 */
export function generateCardNoPaymentAlerts(ctx: CardAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const getBankName = (bankId: string) => {
    const bank = ctx.banks.find((b) => b.id === bankId);
    return bank?.name || '';
  };

  const cardsNeedingPayment = ctx.cardPeriods.filter(
    (analysis) =>
      analysis.currentPeriod.status === 'not_programmed' &&
      ctx.today > analysis.currentPeriod.closingDate
  );

  cardsNeedingPayment.forEach((analysis) => {
    const daysAfterClosing = Math.floor(
      (ctx.today.getTime() - analysis.currentPeriod.closingDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    alerts.push({
      id: `card-no-payment-${analysis.card.id}`,
      type: 'card_no_payment',
      severity: 'critical',
      title: `Tarjeta ${getBankName(analysis.card.bankId)} ${analysis.card.owner}`,
      description: `${analysis.card.name} cortó hace ${daysAfterClosing} día${daysAfterClosing !== 1 ? 's' : ''}`,
      action: {
        label: 'Programar pago',
        route: '/payments',
        params: { cardId: analysis.card.id, from: 'dashboard' },
      },
      data: analysis,
      sortValue: daysAfterClosing,
    });
  });

  return alerts;
}

/**
 * Genera alertas para tarjetas con crédito disponible bajo (<20%)
 */
export function generateLowCreditAlerts(ctx: CardAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const lowCreditCards = ctx.cards.filter(
    (card) =>
      card.creditLimit > 0 &&
      (card.availableCredit / card.creditLimit) * 100 < 20
  );

  lowCreditCards.forEach((card) => {
    const percentage = Math.round(
      (card.availableCredit / card.creditLimit) * 100
    );

    alerts.push({
      id: `low-credit-${card.id}`,
      type: 'low_credit',
      severity: 'warning',
      title: 'Crédito disponible bajo',
      description: `${card.name} solo tiene ${percentage}% de crédito disponible`,
      action: {
        label: 'Ver tarjeta',
        route: '/cards',
      },
      data: card,
    });
  });

  return alerts;
}
