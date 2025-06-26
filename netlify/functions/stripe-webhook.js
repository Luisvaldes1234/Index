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

  if (event.type === 'invoice.paid' && event.data.object.status === 'paid') {
    const invoice = event.data.object;
    
    // --- LÓGICA SIMPLIFICADA Y CORREGIDA ---
    // Extraemos el primer item de la factura, que contiene todo lo que necesitamos.
    const lineItem = invoice.lines.data[0];

    if (!lineItem) {
      console.error("La factura no contiene items (line items).");
      return { statusCode: 200, body: 'Factura sin items.' };
    }

    try {
      const serial = lineItem.metadata?.serial;
      const periodEnd = lineItem.period?.end;

      console.log(`Datos extraídos de la factura: Serial -> "${serial}", Fin de Periodo -> ${periodEnd}`);

      if (!serial || !periodEnd) {
        throw new Error(`No se encontró 'serial' o 'period.end' en el primer item de la factura.`);
      }
      
      const subscriptionEndDate = new Date(periodEnd * 1000);
      
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
        console.log(`¡ÉXITO TOTAL! Se actualizó la suscripción para la máquina con serial "${serial}"`);
      } else {
        console.warn(`ADVERTENCIA: La consulta se ejecutó, pero no se encontró ninguna máquina con el serial "${serial}". Revisa que el serial en Supabase sea idéntico.`);
      }

    } catch (err) {
      console.error('Error durante el procesamiento de la factura:', err.message);
      return { statusCode: 500, body: `Error interno: ${err.message}` };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
