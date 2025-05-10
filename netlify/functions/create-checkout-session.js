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
      mensual: 'prod_SHNC52tOTXyFVX',
      trimestral: 'prod_SHNHQFIMRaGMcB',
      semestral: 'prod_SHNHEr809HlcIm',
      anual: 'prod_SHNLBEv8pgJkdG',
    };

    const productId = prices[plan];

    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plan inválido' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'mxn',
          product: productId,
          unit_amount: {
            mensual: 49900,
            trimestral: 140000,
            semestral: 250000,
            anual: 450000,
          }[plan],
          recurring: {
            interval: {
              mensual: 'month',
              trimestral: 'month',
              semestral: 'month',
              anual: 'year',
            }[plan],
            interval_count: {
              mensual: 1,
              trimestral: 3,
              semestral: 6,
              anual: 1,
            }[plan]
          }
        },
        quantity: 1
      }],
      success_url: 'https://trackmyvend.com/subscripcion.html?success=true',
      cancel_url: 'https://trackmyvend.com/subscripcion.html?cancel=true',
      metadata: { serial, plan }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
