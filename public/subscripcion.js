const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = localStorage.getItem('supabase_token'); // Reemplaza con tu método real de autenticación
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function cargarMaquinas() {
  const user = await obtenerUsuario();
  if (!user) return alert("No autenticado");

  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("*")
    .eq("user_id", user.id);

  if (error) return alert("Error al cargar máquinas");

  const contenedor = document.getElementById("listaMaquinas");
  contenedor.innerHTML = "";

  const hoy = new Date();

  maquinas.forEach(maquina => {
    const suscripcion = maquina.suscripcion_hasta ? new Date(maquina.suscripcion_hasta) : null;
    const activa = suscripcion && suscripcion > hoy;

    const card = document.createElement("div");
    card.className = "p-4 bg-white dark:bg-gray-800 shadow rounded";

    const estado = activa
      ? `<span class="text-green-500 font-semibold">Activa hasta ${suscripcion.toLocaleDateString()}</span>`
      : `<span class="text-red-500 font-semibold">Inactiva</span>`;

    card.innerHTML = `
      <h2 class="text-lg font-bold">${maquina.nombre || maquina.serial}</h2>
      <p class="text-sm text-gray-500">Serial: ${maquina.serial}</p>
      <p class="mb-3">Estado: ${estado}</p>
      ${!activa ? generarBotonesPago(maquina.serial) : ""}
    `;

    contenedor.appendChild(card);
  });
}

function generarBotonesPago(serial) {
  const planes = [
    { plan: 'mensual', texto: '1 mes – $499' },
    { plan: 'trimestral', texto: '3 meses – $1,400' },
    { plan: 'semestral', texto: '6 meses – $2,500' },
    { plan: 'anual', texto: '12 meses – $4,500' }
  ];

  return planes.map(p =>
    `<button onclick="iniciarPago('${serial}', '${p.plan}')" class="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 mr-2 mb-2">${p.texto}</button>`
  ).join('');
}

async function iniciarPago(serial, plan) {
  try {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, plan })
    });

    const result = await response.json();

    if (result?.url) {
      window.location.href = result.url;
    } else {
      throw new Error("No se recibió la URL de Stripe");
    }
  } catch (err) {
    console.error("Error iniciando pago:", err);
    alert("Error iniciando el pago. Intenta de nuevo.");
  }
}

async function obtenerUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

cargarMaquinas();
