// Ruta: netlify/functions/stripe-webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// --- Configuración ---
// Vamos a necesitar la URL de Supabase y la clave "service_role" para poder modificar datos.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// La clave secreta del webhook, que obtendremos de Stripe más adelante.
const endpointSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;


// --- Lógica Principal ---
exports.handler = async ({ body, headers }) => {
  // 1. VERIFICAR QUE LA PETICIÓN VIENE REALMENTE DE STRIPE
  // Esto es crucial para la seguridad.
  const sig = headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Error en la verificación de la firma del webhook: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  
  // 2. PROCESAR EL EVENTO SI LA FIRMA ES VÁLIDA
  // El evento 'invoice.paid' se dispara CADA VEZ que una suscripción se paga con éxito.
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;

    // Solo actuamos si la factura está pagada y pertenece a una suscripción
    if (invoice.paid && invoice.subscription) {
      try {
        // Para obtener los metadatos, necesitamos recuperar el objeto de la suscripción completo
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        
        // Extraemos el serial de la máquina que guardamos en los metadatos
        const Serial = subscription.metadata.serial;
        // Extraemos la fecha en que termina el periodo que se acaba de pagar
        const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

        if (!machineSerial) {
          throw new Error('El serial de la máquina no se encontró en los metadatos de la suscripción.');
        }

        // 3. ACTUALIZAR LA BASE DE DATOS DE SUPABASE
        const { error: updateError } = await supabase
          .from('maquinas')
          .update({ suscripcion_hasta: subscriptionEndDate.toISOString() })
          .eq('serial', machineSerial); // ¡Actualizamos la máquina por su 'serial'!

        if (updateError) {
          throw new Error(`Error al actualizar Supabase: ${updateError.message}`);
        }

        console.log(`Suscripción actualizada para la máquina con serial ${machineSerial} hasta ${subscriptionEndDate.toLocaleDateString()}`);

      } catch (err) {
        console.error('Error procesando el webhook:', err.message);
        return { statusCode: 500, body: `Error interno: ${err.message}` };
      }
    }
  }

  // 4. DEVOLVER RESPUESTA A STRIPE
  // Enviamos una respuesta exitosa para que Stripe sepa que recibimos el evento y no lo siga enviando.
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
