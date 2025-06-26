// Ruta: netlify/functions/create-checkout-session.js  
// 1. --- CONFIGURACIÓN INICIAL ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Usaremos las variables de entorno que configurarás en Netlify
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Para esta función, la clave pública (anon) es suficiente
const supabase = createClient(supabaseUrl, supabaseKey);

// --- LÓGICA PRINCIPAL DE LA FUNCIÓN ---
exports.handler = async (event) => {
  // Solo aceptamos peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { serial, plan, userId } = JSON.parse(event.body);

    if (!serial || !plan || !userId) {
      return { statusCode: 400, body: 'Faltan parámetros: serial, plan, o userId son requeridos.' };
    }

    // 2. --- MAPEO DE PLANES A PRECIOS DE STRIPE ---
    // ¡REEMPLAZA ESTO CON TUS IDS DE PRECIOS REALES DE STRIPE!
    const priceIDs = {
      mensual: 'price_1ReCt4LPG9Lo6pOs9VwtBHZ1',
      trimestral: 'price_1RMoWiLPG9Lo6pOs4jojGv0q',
      semestral: 'price_1RMoX9LPG9Lo6pOspcvGjXsQ',
      anual: 'price_1ReDrNLPG9Lo6pOs8RQB0m1p',
    };

    const priceId = priceIDs[plan];
    if (!priceId) {
      return { statusCode: 400, body: `Plan no válido: ${plan}` };
    }
    
    // 3. --- CREACIÓN DE LA SESIÓN DE PAGO EN STRIPE ---
    // URLs a las que Stripe redirigirá al usuario después del pago
    const successUrl = process.env.SUCCESS_URL || 'https://tu-sitio.com/pago-exitoso.html';
    const cancelUrl = process.env.CANCEL_URL || 'https://tu-sitio.com/pago-cancelado.html';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      
      // 4. --- ¡LA PARTE MÁS IMPORTANTE! ---
      // Aquí "etiquetamos" la suscripción con el serial de la máquina.
      // Estos metadatos nos llegarán en el webhook más tarde.
      subscription_data: {
        metadata: {
          machine_serial: serial 
        }
      },
      // Para asociar el pago con el usuario de Supabase
      client_reference_id: userId,
    });

    // 5. --- DEVOLVER LA URL DE PAGO AL FRONTEND ---
    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error(`Error al crear la sesión de checkout: ${err.message}`);
    return {
      statusCode: 500,
      body: 'Error interno del servidor.',
    };
  }
};
