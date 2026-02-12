import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Tipos
interface PhysicalCard {
  id: string;
  number: string;
  digitalNumber?: string;
  label: string;
}

interface Card {
  id: string;
  name: string;
  cardType: string;
  physicalCardNumber?: string;
  digitalCardNumber?: string;
  physicalCards?: PhysicalCard[];
  availableCredit: number;
  creditLimit: number;
  bankId: string;
  owner: string;
  householdId: string;
}

interface Bank {
  id: string;
  name: string;
}

interface PhysicalCardResponse {
  label: string;
  lastDigitsPhysical: string | null;
  lastDigitsDigital: string | null;
}

interface CardResponse {
  id: string;
  name: string;
  bankName: string;
  owner: string;
  lastDigitsPhysical: string | null;
  lastDigitsDigital: string | null;
  physicalCards: PhysicalCardResponse[];
  availableCredit: number;
  creditLimit: number;
  cardType: string;
}

// Middleware de autenticación por token
const validateApiToken = (req: functions.https.Request): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  const apiSecret = process.env.API_SECRET || functions.config().api?.secret;

  if (!apiSecret) {
    console.error('API_SECRET not configured');
    return false;
  }

  return token === apiSecret;
};

// Helper para obtener últimos 4 dígitos
const getLast4Digits = (cardNumber?: string): string | null => {
  if (!cardNumber) return null;
  const cleaned = cardNumber.replace(/\s/g, '');
  return cleaned.length >= 4 ? cleaned.slice(-4) : null;
};

// GET /api/cards/credit - Obtener crédito disponible de tarjetas bancarias
export const getCardsCredit = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Validar token
  if (!validateApiToken(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const householdId = req.query.householdId as string | undefined;

    // Obtener tarjetas bancarias (excluir Departamental)
    let cardsQuery = db.collection('cards')
      .where('cardType', 'in', ['Visa', 'Mastercard', 'Amex']);

    if (householdId) {
      cardsQuery = db.collection('cards')
        .where('householdId', '==', householdId)
        .where('cardType', 'in', ['Visa', 'Mastercard', 'Amex']);
    }

    const cardsSnapshot = await cardsQuery.get();

    if (cardsSnapshot.empty) {
      res.json({ success: true, cards: [] });
      return;
    }

    // Obtener todos los bancos para hacer lookup
    const banksSnapshot = await db.collection('banks').get();
    const banksMap = new Map<string, string>();
    banksSnapshot.docs.forEach(doc => {
      const bank = doc.data() as Bank;
      banksMap.set(doc.id, bank.name);
    });

    // Mapear tarjetas a response
    const cards: CardResponse[] = cardsSnapshot.docs.map(doc => {
      const card = { id: doc.id, ...doc.data() } as Card;

      // Construir array de tarjetas físicas
      let physicalCards: PhysicalCardResponse[];
      if (card.physicalCards && card.physicalCards.length > 0) {
        physicalCards = card.physicalCards.map(pc => ({
          label: pc.label,
          lastDigitsPhysical: getLast4Digits(pc.number),
          lastDigitsDigital: getLast4Digits(pc.digitalNumber),
        }));
      } else {
        // Fallback a campos legacy
        physicalCards = [{
          label: card.owner,
          lastDigitsPhysical: getLast4Digits(card.physicalCardNumber),
          lastDigitsDigital: getLast4Digits(card.digitalCardNumber),
        }];
      }

      return {
        id: card.id,
        name: card.name,
        bankName: banksMap.get(card.bankId) || 'Desconocido',
        owner: card.owner,
        lastDigitsPhysical: physicalCards[0].lastDigitsPhysical,
        lastDigitsDigital: physicalCards[0].lastDigitsDigital,
        physicalCards,
        availableCredit: card.availableCredit,
        creditLimit: card.creditLimit,
        cardType: card.cardType,
      };
    });

    // Ordenar por banco y nombre
    cards.sort((a, b) => {
      if (a.bankName !== b.bankName) return a.bankName.localeCompare(b.bankName);
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      count: cards.length,
      cards,
    });

  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /api/cards/:cardId/credit - Actualizar crédito disponible
export const updateCardCredit = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'PATCH') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Validar token
  if (!validateApiToken(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    // Obtener cardId de la URL (formato: /api/cards/{cardId}/credit)
    const pathParts = req.path.split('/').filter(p => p);
    const cardIdIndex = pathParts.indexOf('cards') + 1;
    const cardId = pathParts[cardIdIndex];

    if (!cardId) {
      res.status(400).json({ success: false, error: 'Card ID is required' });
      return;
    }

    const { availableCredit } = req.body;

    if (typeof availableCredit !== 'number' || availableCredit < 0) {
      res.status(400).json({
        success: false,
        error: 'availableCredit must be a positive number'
      });
      return;
    }

    // Obtener tarjeta actual
    const cardRef = db.collection('cards').doc(cardId);
    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    const cardData = cardDoc.data() as Card;
    const previousCredit = cardData.availableCredit;

    // Actualizar crédito disponible
    await cardRef.update({
      availableCredit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'api',
      updatedByName: 'API External',
    });

    res.json({
      success: true,
      card: {
        id: cardId,
        name: cardData.name,
        previousCredit,
        newCredit: availableCredit,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error updating card credit:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
