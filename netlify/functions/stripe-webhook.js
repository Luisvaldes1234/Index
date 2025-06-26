// Ruta: netlify/functions/stripe-webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const endpointSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;

exports.handler = async ({ body, headers }) => {
  console.log('Función stripe-webhook iniciada.');

  let event;
  try {
    const sig = headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Error en la verificación de la firma: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  
  console.log(`Evento recibido: ${event.type}`);

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    const subscriptionDetails = invoice.parent?.subscription_details;

    if (invoice.status === 'paid' && subscriptionDetails?.subscription) {
      console.log('Factura pagada. Procesando actualización...');

      try {
        const subscriptionId = subscriptionDetails.subscription;
        const serial = subscriptionDetails.metadata?.serial;

        if (!serial) {
          throw new Error('El serial de la máquina no se encontró en los metadatos.');
        }
        
        // Obtenemos los detalles completos de la suscripción desde Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // --- ¡LA CORRECCIÓN FINAL ESTÁ AQUÍ! ---
        // Verificamos que 'current_period_end' exista antes de usarlo.
        if (!subscription.current_period_end) {
            throw new Error(`La suscripción ${subscriptionId} no tiene una fecha de fin de periodo (current_period_end).`);
        }

        // Si la fecha existe, la creamos y la usamos.
        const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
        
        console.log(`Intentando actualizar la máquina con serial: "${serial}" con la fecha: ${subscriptionEndDate.toISOString()}`);
        
        const { data, error: updateError } = await supabase
          .from('maquinas')
          .update({ suscripcion_hasta: subscriptionEndDate.toISOString() })
          .eq('serial', serial)
          .select();

        if (updateError) {
          throw new Error(`Error al actualizar Supabase: ${updateError.message}`);
        }
        
        if (data && data.length > 0) {
          console.log(`¡ÉXITO TOTAL! Se actualizó la suscripción para la máquina con serial "${serial}" hasta ${subscriptionEndDate.toLocaleDateString()}`);
        } else {
          console.warn(`ADVERTENCIA: La consulta se ejecutó, pero no se encontró ninguna máquina con el serial "${serial}".`);
        }

      } catch (err) {
        console.error('Error durante el procesamiento de la suscripción:', err.message);
        return { statusCode: 500, body: `Error interno: ${err.message}` };
      }
    } else {
        console.warn("La condición no se cumplió. Status:", invoice.status, "Suscripción existe:", !!subscriptionDetails?.subscription);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
