// Ruta: netlify/functions/stripe-webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const endpointSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;

exports.handler = async ({ body, headers }) => {
  console.log('Función stripe-webhook iniciada.');

  const sig = headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Error en la verificación de la firma del webhook: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  
  console.log(`Evento recibido: ${event.type}`);

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;

    // --- ¡NUEVA LÍNEA DE DEPURACIÓN! ---
    // Imprimimos el contenido completo de la factura para inspeccionarla.
    console.log("Contenido del objeto 'invoice':", JSON.stringify(invoice, null, 2));

    if (invoice.paid && invoice.subscription) {
      // El resto del código...
      // ...
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
