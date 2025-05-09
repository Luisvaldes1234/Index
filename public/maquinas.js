// Conexión a Supabase
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === CARGAR USUARIO AUTENTICADO ===
let user = null;

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

  const newMachine = {
    serial: document.getElementById("serial").value,
    nombre: document.getElementById("name").value,
    user_id: user.id,
    litros1: parseFloat(document.getElementById("litros1").value),
    litros2: parseFloat(document.getElementById("litros2").value),
    litros3: parseFloat(document.getElementById("litros3").value),
    precio1: parseFloat(document.getElementById("precio1").value),
    precio2: parseFloat(document.getElementById("precio2").value),
    precio3: parseFloat(document.getElementById("precio3").value),
    last_seen: new Date().toISOString() // al registrar, se considera activa
  };

  const { error } = await supabase.from("maquinas").insert([newMachine]);
  if (error) return alert("Error al registrar: " + error.message);

  e.target.reset();
  loadMachines();
});

// === CARGAR MÁQUINAS REGISTRADAS ===
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

    const card = `
      <div class="p-4 bg-white dark:bg-gray-800 shadow rounded">
        <h3 class="text-lg font-bold">${maquina.nombre}</h3>
        <p class="text-sm text-gray-600">Serial: ${maquina.serial}</p>
        <p class="mt-2">${estadoHTML}</p>
      </div>
    `;

    contenedor.innerHTML += card;
  });
}  
