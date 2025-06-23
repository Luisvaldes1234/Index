// =================================================================================
// maquina.js - Gestión Completa de Máquinas con Mapas
// =================================================================================

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---

// Conexión a Supabase (Usa tus claves)
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES ---
let user = null;
let machinesCache = []; // Almacena las máquinas cargadas para un acceso rápido
let pickerMap, pickerMarker, displayMap; // Mapas principales
let editMap, editMarker; // Mapa y marcador para el modal de edición
let currentEditingMachineId = null; // ID de la máquina que se está editando en el modal

// --- PUNTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    // A. Lógica de navegación móvil
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const toggleMobileNav = () => {
        hamburger.classList.toggle('active');
        mobileNav.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
    };
    hamburger.addEventListener('click', toggleMobileNav);
    mobileOverlay.addEventListener('click', toggleMobileNav);

    // B. Lógica para mostrar/ocultar formulario de registro
    const registrationFormContainer = document.getElementById('registration-form-container');
    const showFormBtn = document.getElementById('show-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const showFormContainer = document.getElementById('show-form-button-container');

    showFormBtn.addEventListener('click', () => {
        registrationFormContainer.classList.remove('hidden');
        showFormContainer.classList.add('hidden');
        // Asegurarse de que el mapa se renderice correctamente al mostrarse
        setTimeout(() => pickerMap.invalidateSize(), 0);
    });

    cancelFormBtn.addEventListener('click', () => {
        registrationFormContainer.classList.add('hidden');
        showFormContainer.classList.remove('hidden');
    });

    // C. Listeners para el Modal de Edición de Mapa
    const locationModal = document.getElementById('location-modal');
    document.getElementById('confirm-location-btn').addEventListener('click', confirmLocationChange);
    document.getElementById('cancel-location-btn').addEventListener('click', () => locationModal.classList.add('hidden'));
    
    // D. Autenticar usuario e inicializar la aplicación
    getUser();
});


// --- 2. AUTENTICACIÓN ---

async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('No estás autenticado. Por favor, inicia sesión.');
        // Opcional: Redirigir a la página de login
        // window.location.href = '/login.html';
        return;
    }
    user = session.user;
    initializePickerMap();
    initializeDisplayMap();
    loadMachines();
}


// --- 3. LÓGICA DE MAPAS ---

function initializePickerMap() {
    const initialCoords = [20.6736, -103.344]; // Coordenadas por defecto (Guadalajara)
    pickerMap = L.map('locationPickerMap').setView(initialCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(pickerMap);
    
    pickerMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('latitude').value = lat;
        document.getElementById('longitude').value = lng;
        if (pickerMarker) {
            pickerMarker.setLatLng(e.latlng);
        } else {
            pickerMarker = L.marker(e.latlng).addTo(pickerMap);
        }
    });
}

function initializeDisplayMap() {
    const initialCoords = [20.6736, -103.344];
    displayMap = L.map('map').setView(initialCoords, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(displayMap);
}

function openLocationModal(id) {
    currentEditingMachineId = id;
    const maquina = machinesCache.find(m => m.id == id);
    if (!maquina) return;

    const locationModal = document.getElementById('location-modal');
    locationModal.classList.remove('hidden');

    const currentCoords = (maquina.latitude && maquina.longitude) 
        ? [maquina.latitude, maquina.longitude] 
        : [20.6736, -103.344]; // Default si la máquina no tiene coords

    if (!editMap) { // Si el mapa del modal no existe, lo crea
        editMap = L.map('edit-map').setView(currentCoords, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(editMap);
    } else { // Si ya existe, solo ajusta la vista
        editMap.setView(currentCoords, 15);
    }

    if (editMarker) { // Coloca o mueve el marcador
        editMarker.setLatLng(currentCoords);
    } else {
        editMarker = L.marker(currentCoords).addTo(editMap);
    }
    
    // Listener para actualizar el marcador al hacer clic
    editMap.off('click').on('click', (e) => {
        editMarker.setLatLng(e.latlng);
    });

    // Forzar al mapa a recalcular su tamaño (muy importante para modales)
    setTimeout(() => editMap.invalidateSize(), 10);
}

function confirmLocationChange() {
    if (!currentEditingMachineId || !editMarker) return;

    const newCoords = editMarker.getLatLng();
    
    // Pasa las nuevas coordenadas a los campos ocultos de la tarjeta de edición
    const latInput = document.getElementById(`edit-latitude-${currentEditingMachineId}`);
    const lonInput = document.getElementById(`edit-longitude-${currentEditingMachineId}`);
    
    if (latInput && lonInput) {
        latInput.value = newCoords.lat;
        lonInput.value = newCoords.lng;
    }
    
    document.getElementById('location-modal').classList.add('hidden');
}


// --- 4. GESTIÓN DE MÁQUINAS (CRUD) ---

// CREATE: Registrar nueva máquina
document.getElementById("machineForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const litros = [1, 2, 3, 4].map(i => document.getElementById(`litros${i}`).value || '0').join(',');
    const precios = [1, 2, 3, 4].map(i => document.getElementById(`precio${i}`).value || '0').join(',');

    const newMachine = {
        serial: document.getElementById("serial").value,
        nombre: document.getElementById("name").value,
        ubicacion: document.getElementById("ubicacion").value,
        latitude: document.getElementById("latitude").value || null,
        longitude: document.getElementById("longitude").value || null,
        user_id: user.id,
        liters: litros,
        prices: precios,
    };

    const { error } = await supabase.from("maquinas").insert([newMachine]);
    if (error) return alert("Error al registrar: " + error.message);
    
    alert("¡Máquina registrada con éxito!");
    e.target.reset();
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
    if (pickerMarker) {
        pickerMarker.remove();
        pickerMarker = null;
    }
    document.getElementById('cancel-form-btn').click(); // Ocultar formulario
    loadMachines();
});


// READ: Cargar y mostrar todas las máquinas
async function loadMachines() {
    const { data, error } = await supabase.from("maquinas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) return console.error("Error al cargar máquinas:", error);

    machinesCache = data;
    const machineListContainer = document.getElementById("machineList");
    machineListContainer.innerHTML = "";
    
    // Limpiar marcadores anteriores del mapa de visualización
    displayMap.eachLayer(layer => { if (layer instanceof L.Marker) layer.remove(); });
    const machineLocations = [];

    machinesCache.forEach(maquina => {
        const card = document.createElement('div');
        card.className = 'section-card machine-card';
        card.id = `machine-card-${maquina.id}`;
        card.innerHTML = renderMachineView(maquina);
        machineListContainer.appendChild(card);

        // Añadir marcador al mapa si tiene coordenadas
        if (maquina.latitude && maquina.longitude) {
            const location = [maquina.latitude, maquina.longitude];
            machineLocations.push(location);
            L.marker(location)
             .addTo(displayMap)
             .bindPopup(`<b>${maquina.nombre}</b><br>${maquina.ubicacion || 'Sin descripción'}`);
        }
    });

    // Ajustar el zoom del mapa para que se vean todas las máquinas
    if (machineLocations.length > 0) {
        displayMap.fitBounds(machineLocations, { padding: [50, 50] });
    }
}


// UPDATE: Guardar cambios de una máquina editada
async function guardarCambios(id) {
    const updatedLiters = [0,1,2,3].map(i => document.getElementById(`edit-litro${i}-${id}`).value || '0').join(',');
    const updatedPrices = [0,1,2,3].map(i => document.getElementById(`edit-precio${i}-${id}`).value || '0').join(',');

    const updates = {
        nombre: document.getElementById(`edit-name-${id}`).value,
        ubicacion: document.getElementById(`edit-ubicacion-${id}`).value,
        liters: updatedLiters,
        prices: updatedPrices,
        latitude: document.getElementById(`edit-latitude-${id}`).value || null,
        longitude: document.getElementById(`edit-longitude-${id}`).value || null,
    };
    
    const { error } = await supabase.from('maquinas').update(updates).eq('id', id);
    if (error) return alert("Error al guardar: " + error.message);
    
    alert("Máquina actualizada con éxito.");
    loadMachines();
}


// --- 5. FUNCIONES DE RENDERIZADO (VISTAS) ---

// Renderiza la vista normal de una tarjeta de máquina
function renderMachineView(maquina) {
    const onlineStatus = `<span class="text-green-500 font-semibold">En línea</span>`; // Placeholder
    const prices = (maquina.prices || '0,0,0,0').split(',');
    const liters = (maquina.liters || '0,0,0,0').split(',');
    
    return `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="text-xl font-bold text-gray-800">${maquina.nombre}</h3>
                <p class="text-sm text-gray-500">Serial: ${maquina.serial}</p>
                <p class="text-sm text-gray-600 mt-1">📍 ${maquina.ubicacion || 'Ubicación no especificada'}</p>
            </div>
            <div>${onlineStatus}</div>
        </div>
        <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            ${[0,1,2,3].map(i => `
                <div class="bg-gray-100 p-2 rounded">
                    <p class="font-semibold">Botón ${i+1}</p>
                    <p>${liters[i] || 'N/A'} L</p>
                    <p>$${prices[i] || 'N/A'}</p>
                </div>
            `).join('')}
        </div>
        <div class="text-right mt-4">
            <button onclick="renderEditView(${maquina.id})" class="modern-button text-sm py-2 px-4">✏️ Editar</button>
        </div>
    `;
}

// Renderiza el formulario de edición dentro de una tarjeta de máquina
function renderEditView(id) {
    const maquina = machinesCache.find(m => m.id == id);
    if (!maquina) return;

    const card = document.getElementById(`machine-card-${id}`);
    const prices = (maquina.prices || '0,0,0,0').split(',');
    const liters = (maquina.liters || '0,0,0,0').split(',');

    card.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800 mb-4">Editando: ${maquina.nombre}</h3>
        <div class="space-y-4">
            <input type="hidden" id="edit-latitude-${id}" value="${maquina.latitude || ''}">
            <input type="hidden" id="edit-longitude-${id}" value="${maquina.longitude || ''}">

            <div><label class="form-label">Nombre</label><input id="edit-name-${id}" class="form-input" value="${maquina.nombre}"></div>
            <div class="flex items-end gap-4">
                <div class="flex-grow">
                    <label class="form-label">Ubicación (texto)</label>
                    <input id="edit-ubicacion-${id}" class="form-input" value="${maquina.ubicacion || ''}">
                </div>
                <button onclick="openLocationModal(${id})" class="modern-button text-sm py-2 px-4 whitespace-nowrap">✏️ Cambiar en Mapa</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${[0,1,2,3].map(i => `
                    <div class="p-2 bg-gray-50 rounded">
                        <label class="form-label text-sm">B${i+1} Litros</label><input id="edit-litro${i}-${id}" type="number" class="form-input" value="${liters[i] || ''}">
                        <label class="form-label text-sm mt-2">B${i+1} Precio</label><input id="edit-precio${i}-${id}" type="number" class="form-input" value="${prices[i] || ''}">
                    </div>
                `).join('')}
            </div>
            <div class="flex gap-4 mt-4">
                <button onclick="guardarCambios(${id})" class="modern-button success">💾 Guardar Cambios</button>
                <button onclick="loadMachines()" class="modern-button secondary">✖️ Cancelar</button>
            </div>
        </div>
    `;
}
