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

    if (invoice.paid && invoice.subscription) {
      console.log('Factura de suscripción pagada. Procesando actualización...');

      try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        
        const serial = subscription.metadata.serial; 
        const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
        
        console.log(`Serial extraído de los metadatos de Stripe: "${serial}"`);

        if (!serial) {
          console.error('El serial de la máquina no se encontró en los metadatos. Abortando.');
          return { statusCode: 200, body: 'Serial no encontrado en metadatos.' };
        }

        console.log(`Intentando actualizar la máquina con serial: "${serial}"`);
        const { data, error: updateError } = await supabase
          .from('maquinas')
          .update({ suscripcion_hasta: subscriptionEndDate.toISOString() })
          .eq('serial', serial)
          .select();

        if (updateError) {
          throw new Error(`Error al actualizar Supabase: ${updateError.message}`);
        }
        
        if (data && data.length > 0) {
          // --- ¡CORRECCIÓN APLICADA AQUÍ! ---
          console.log(`¡ÉXITO! Se actualizó la suscripción para la máquina con serial "${serial}" hasta ${subscriptionEndDate.toLocaleDateString()}`);
        } else {
          console.warn(`ADVERTENCIA: La consulta se ejecutó, pero no se encontró ninguna máquina con el serial "${serial}".`);
        }

      } catch (err) {
        console.error('Error durante el procesamiento de la suscripción:', err.message);
        return { statusCode: 500, body: `Error interno: ${err.message}` };
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
