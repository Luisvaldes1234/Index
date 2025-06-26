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
    console.error(`Error en la verificación de la firma del webhook: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  
  console.log(`Evento recibido: ${event.type}`);

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    
    // --- ¡CORRECCIÓN CLAVE! ---
    // Buscamos los datos en la ruta correcta que vimos en tus logs.
    // Usamos '?' (optional chaining) por seguridad, por si 'parent' o 'subscription_details' no vinieran.
    const subscriptionDetails = invoice.parent?.subscription_details;

    // Ahora la condición SÍ debería funcionar.
    if (invoice.paid && subscriptionDetails?.subscription) {
      console.log('Factura de suscripción pagada. Procesando actualización...');

      try {
        // Obtenemos los datos de la ubicación correcta.
        const subscriptionId = subscriptionDetails.subscription;
        const serial = subscriptionDetails.metadata?.serial;

        console.log(`ID de la suscripción: "${subscriptionId}"`);
        console.log(`Serial extraído de los metadatos: "${serial}"`);

        if (!serial) {
          console.error('El serial de la máquina no se encontró en los metadatos. Abortando.');
          return { statusCode: 200, body: 'Serial no encontrado en metadatos.' };
        }
        
        // Para la fecha de fin, sí necesitamos consultar el objeto de suscripción completo.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
        console.log(`Nueva fecha de vencimiento calculada: ${subscriptionEndDate.toISOString()}`);

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
          console.log(`¡ÉXITO! Se actualizó la suscripción para la máquina con serial "${serial}" hasta ${subscriptionEndDate.toLocaleDateString()}`);
        } else {
          console.warn(`ADVERTENCIA: La consulta se ejecutó, pero no se encontró ninguna máquina con el serial "${serial}". Revisa que el serial en Supabase sea idéntico.`);
        }

      } catch (err) {
        console.error('Error durante el procesamiento de la suscripción:', err.message);
        return { statusCode: 500, body: `Error interno: ${err.message}` };
      }
    } else {
        console.warn("La factura no está pagada o no contiene detalles de suscripción en la ruta esperada. Se ignora el evento.");
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
