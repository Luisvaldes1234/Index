// Conexión a Supabase
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Verifica si el usuario está logueado
async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) {
    alert('Debes iniciar sesión.');
    window.location.href = '/login.html';
  } else {
    loadMachines(user.id);
    return user.id;
  }
}

// Cargar máquinas del usuario
async function loadMachines(userId) {
  const { data, error } = await supabase
    .from('maquinas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const list = document.getElementById('machineList');
  list.innerHTML = '';

  if (error) {
    list.innerHTML = '<li class="text-red-500">Error al cargar máquinas.</li>';
    return;
  }

  data.forEach((m) => {
    const liters = m.liters ? m.liters.split(',') : [];
    const prices = m.prices ? m.prices.split(',') : [];
    const botones = liters.map((litro, i) => `Botón ${i + 1}: ${litro}L - $${prices[i] || '0'}`).join('<br>');

    const li = document.createElement('li');
    li.className = 'bg-white dark:bg-gray-800 p-4 rounded shadow';
    li.innerHTML = `
      <div class="font-bold text-lg">${m.name}</div>
      <div class="text-sm">Serie: ${m.serial}</div>
      <div class="text-sm mt-2">${botones}</div>
    `;
    list.appendChild(li);
  });
}

// Guardar nueva máquina
const form = document.getElementById('machineForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const serial = document.getElementById('serial').value.trim();
  const name = document.getElementById('name').value.trim();
  const liters = [
    document.getElementById('liters1').value.trim(),
    document.getElementById('liters2').value.trim(),
    document.getElementById('liters3').value.trim()
  ];
  const prices = [
    document.getElementById('price1').value.trim(),
    document.getElementById('price2').value.trim(),
    document.getElementById('price3').value.trim()
  ];

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return alert('No estás autenticado.');
  }

  const { error } = await supabase.from('maquinas').insert({
    serial,
    name,
    liters: liters.join(','),
    prices: prices.join(','),
    user_id: user.id
  });

  if (error) {
    alert('Error al registrar la máquina.');
    console.error(error);
  } else {
    form.reset();
    loadMachines(user.id);
    alert('Máquina registrada con éxito.');
  }
});

getUser();
