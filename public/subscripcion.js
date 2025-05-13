// subscripcion.js — TrackMyVend
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

// Autenticar y cargar máquinas
(async () => {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) return alert("No estás autenticado");
  user = currentUser;
  cargarMaquinas();
})();

async function cargarMaquinas() {
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("id, nombre, serial, suscripcion_hasta")
    .eq("user_id", user.id);

  if (error || !maquinas) return alert("Error al cargar máquinas");

  const contenedor = document.getElementById("listaMaquinas");
  contenedor.innerHTML = "";
  const hoy = new Date();

  maquinas.forEach(m => {
    const vencimiento = m.suscripcion_hasta ? new Date(m.suscripcion_hasta) : null;
    const diasRestantes = vencimiento ? Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24)) : 0;
    const vencida = !vencimiento || vencimiento < hoy;

    const estado = vencida
      ? `<span class='text-red-500 font-semibold'>Vencida</span>`
      : `<span class='text-green-500 font-semibold'>Activa</span>`;

    const card = `
      <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-2">
        <h2 class="text-lg font-bold">${m.nombre}</h2>
        <p class="text-sm text-gray-500">Serial: ${m.serial}</p>
        <p>Estado: ${estado}</p>
        <p>${vencida ? `Último día activo: ${vencimiento?.toLocaleDateString('es-MX') || 'Nunca'}`
                     : `Vence en: ${vencimiento.toLocaleDateString('es-MX')} (${diasRestantes} días restantes)`}</p>
        <button onclick="pagarMaquina('${m.id}')" class="mt-2 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">
          ${vencida ? 'Pagar ahora $500' : 'Renovar $500'}
        </button>
      </div>
    `;
    contenedor.innerHTML += card;
  });
}

function pagarMaquina(idMaquina) {
  alert(`Aquí iría el pago real de la máquina con ID ${idMaquina}`);
  // Aquí deberías redireccionar a Mercado Pago u otro servicio con el ID de la máquina
}
