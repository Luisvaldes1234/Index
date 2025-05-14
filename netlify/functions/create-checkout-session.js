const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    const { serial, plan } = JSON.parse(event.body);

    if (!serial || !plan) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan parámetros válidos' }),
      };
    }

    const prices = {
      mensual: 'price_1RMoRrLPG9Lo6pOsUodPtxXN',
      trimestral: 'price_1RMoWiLPG9Lo6pOs4jojGv0q',
      semestral: 'price_1RMoX9LPG9Lo6pOspcvGjXsQ',
      anual: 'price_1RMoaQLPG9Lo6pOsCkJY3hh5',
    };

    const priceId = prices[plan];

    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plan inválido' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: 'https://trackmyvend.com/subscripcion.html?success=true',
      cancel_url: 'https://trackmyvend.com/subscripcion.html?cancel=true',
      metadata: { serial, plan }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }), // ✅ Esta línea es clave
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
