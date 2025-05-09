// Conexión a Supabase
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let user = null;

// === AUTENTICAR USUARIO ===
async function getUser() {
  const { data: { user: currentUser }, error } = await supabase.auth.getUser();
  if (error || !currentUser) {
    alert('No estás autenticado');
    return;
  }
  user = currentUser;
  loadMachines();
}

getUser();

// === REGISTRAR NUEVA MÁQUINA ===
document.getElementById("machineForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const litros = [
    document.getElementById("litros1").value,
    document.getElementById("litros2").value,
    document.getElementById("litros3").value
  ].join(',');

  const precios = [
    document.getElementById("precio1").value,
    document.getElementById("precio2").value,
    document.getElementById("precio3").value
  ].join(',');

  const newMachine = {
    serial: document.getElementById("serial").value,
    nombre: document.getElementById("name").value,
    user_id: user.id,
    liters: litros,
    prices: precios,
    last_seen: new Date().toISOString()
  };

  const { error } = await supabase.from("maquinas").insert([newMachine]);
  if (error) return alert("Error al registrar: " + error.message);

  e.target.reset();
  loadMachines();
});

// === CARGAR MÁQUINAS EXISTENTES ===
async function loadMachines() {
  const { data: maquinas, error } = await supabase
    .from("maquinas")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al cargar máquinas:", error);
    return;
  }

  const contenedor = document.getElementById("machineList");
  contenedor.innerHTML = "";

  const now = new Date();

  maquinas.forEach(maquina => {
    const lastSeen = maquina.last_seen ? new Date(maquina.last_seen) : null;
    const diff = lastSeen ? (now - lastSeen) / 60000 : Infinity;
    const online = diff < 10;

    const estadoHTML = online
      ? `<span class="text-green-500 font-semibold">En línea</span>`
      : `<span class="text-red-500 text-sm">Última conexión: ${lastSeen ? lastSeen.toLocaleString() : 'Nunca'}</span>`;

    const [lit1, lit2, lit3] = (maquina.liters || '').split(',');
    const [pre1, pre2, pre3] = (maquina.prices || '').split(',');

    const card = `
      <div id="card-${maquina.id}" class="p-4 bg-white dark:bg-gray-800 shadow rounded space-y-2">
        <h3 class="text-lg font-bold">${maquina.nombre}</h3>
        <p class="text-sm text-gray-600">Serial: ${maquina.serial}</p>
        <p>${estadoHTML}</p>

        <div id="vista-${maquina.id}" class="grid grid-cols-3 gap-4 mt-2">
          <div>
            <p><strong>Litros:</strong> ${[lit1, lit2, lit3].join(', ')}</p>
          </div>
          <div>
            <p><strong>Precios:</strong> ${[pre1, pre2, pre3].join(', ')}</p>
          </div>
          <div class="flex items-end">
            <button onclick="activarEdicion(${maquina.id}, '${[lit1, lit2, lit3].join(',')}', '${[pre1, pre2, pre3].join(',')}')" class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">Editar</button>
          </div>
        </div>
      </div>
    `;

    contenedor.innerHTML += card;
  });
}

// === ACTIVAR EDICIÓN DE LITROS Y PRECIOS ===
function activarEdicion(id, litros, precios) {
  const contenedor = document.getElementById(`vista-${id}`);
  contenedor.innerHTML = `
    <div>
      <label class="text-sm">Litros</label>
      <input data-id="${id}" data-type="litros" class="updateLitros w-full px-2 py-1 border rounded" value="${litros}" />
    </div>
    <div>
      <label class="text-sm">Precios</label>
      <input data-id="${id}" data-type="precios" class="updatePrecios w-full px-2 py-1 border rounded" value="${precios}" />
    </div>
    <div class="flex items-end gap-2">
      <button onclick="guardarCambios(${id})" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Guardar</button>
      <button onclick="loadMachines()" class="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600">Cancelar</button>
    </div>
  `;
}

// === GUARDAR CAMBIOS ===
async function guardarCambios(id) {
  const inputLitros = document.querySelector(`input[data-id="${id}"][data-type="litros"]`);
  const inputPrecios = document.querySelector(`input[data-id="${id}"][data-type="precios"]`);

  const nuevosLitros = inputLitros.value;
  const nuevosPrecios = inputPrecios.value;

  const { error } = await supabase
    .from("maquinas")
    .update({
      liters: nuevosLitros,
      prices: nuevosPrecios
    })
    .eq("id", id);

  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    alert("Datos actualizados");
    loadMachines();
  }
}
