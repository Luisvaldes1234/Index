// Configura tu Supabase
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const userId = null;

// Verificar usuario logueado
async function getUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    alert('Debes iniciar sesión.');
    window.location.href = '/login.html';
  } else {
    loadMachines(user.id);
    return user.id;
  }
}

// Cargar lista de máquinas del usuario
async function loadMachines(uid) {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  const list = document.getElementById('machineList');
  list.innerHTML = '';

  if (error) {
    list.innerHTML = '<li class="text-red-500">Error al cargar máquinas.</li>';
    return;
  }

  data.forEach((machine) => {
    const li = document.createElement('li');
    li.className = 'bg-white dark:bg-gray-800 p-4 rounded shadow';
    li.innerHTML = `
      <div class="font-bold text-lg">${machine.name}</div>
      <div class="text-sm">Serie: ${machine.serial}</div>
      <div class="text-sm">Litros: ${machine.liters}</div>
      <div class="text-sm">Precios: ${machine.prices}</div>
    `;
    list.appendChild(li);
  });
}

// Registrar nueva máquina
const form = document.getElementById('machineForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const serial = document.getElementById('serial').value.trim();
  const name = document.getElementById('name').value.trim();
  const liters = document.getElementById('liters').value.trim();
  const prices = document.getElementById('prices').value.trim();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (!user || userError) return alert('No estás autenticado.');

  const { error } = await supabase.from('machines').insert({
    serial,
    name,
    liters,
    prices,
    user_id: user.id
  });

  if (error) {
    alert('Error al registrar la máquina.');
  } else {
    form.reset();
    loadMachines(user.id);
    alert('Máquina registrada con éxito.');
  }
});

getUser();
