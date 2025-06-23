
const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


// --- VARIABLES GLOBALES Y REFERENCIAS UI ---
let user = null;
const loadingEl = () => document.getElementById('loading');
const subscriptionListEl = () => document.getElementById('subscriptionList');

// --- PUNTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadPageData();
});

// --- 2. SETUP Y FUNCIONES AUXILIARES ---

function setupNavigation() {
    // Lógica del menú de hamburguesa
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

    // Lógica de Logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    };
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    document.getElementById('btnLogoutMobile').addEventListener('click', handleLogout);
}

function showLoading() { loadingEl().classList.remove('hidden'); }
function hideLoading() { loadingEl().classList.add('hidden'); }


// --- 3. LÓGICA PRINCIPAL ---

async function loadPageData() {
    showLoading();
    subscriptionListEl().innerHTML = '';

    try {
        // Autenticar usuario
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = '/login.html';
            return;
        }
        user = session.user;

        // Cargar máquinas del usuario
        const { data: maquinas, error: machinesError } = await supabase
            .from("maquinas")
            .select("*")
            .eq("user_id", user.id)
            .order("nombre", { ascending: true });

        if (machinesError) {
            throw machinesError;
        }

        if (maquinas.length === 0) {
            subscriptionListEl().innerHTML = '<p class="text-center text-gray-500">No tienes máquinas registradas.</p>';
        } else {
            maquinas.forEach(maquina => {
                const card = document.createElement('div');
                card.className = 'section-card subscription-card p-6'; // Usando clases del tema
                card.innerHTML = renderSubscriptionCard(maquina);
                subscriptionListEl().appendChild(card);
            });
        }

    } catch (error) {
        console.error("Error cargando la página:", error);
        subscriptionListEl().innerHTML = `<p class="text-center text-red-500">Error al cargar los datos: ${error.message}</p>`;
    } finally {
        hideLoading();
    }
}

// Función para iniciar el proceso de pago con una función de Netlify
async function subscribe(serial, plan) {
    try {
        // Podríamos añadir un spinner al botón específico que se clickeó
        const res = await fetch("/.netlify/functions/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serial, plan, userId: user.id }) // Es buena idea pasar el userId
        });

        if (!res.ok) throw new Error(`El servidor respondió con un error: ${res.statusText}`);

        const data = await res.json();
        if (data.url) {
            window.location.href = data.url; // Redirigir a la pasarela de pago (Stripe)
        } else {
            throw new Error("No se recibió una URL de pago del servidor.");
        }
    } catch (err) {
        console.error("Error al suscribirse:", err);
        alert("Hubo un error al intentar procesar la suscripción. Por favor, intenta de nuevo.");
    }
}

// Exponer la función al objeto window para que los botones 'onclick' puedan encontrarla
window.subscribe = subscribe;


// --- 4. RENDERIZADO ---

function renderSubscriptionCard(maquina) {
    const isSubscribed = maquina.suscripcion_hasta && new Date(maquina.suscripcion_hasta) > new Date();
    const expirationDate = isSubscribed 
        ? new Date(maquina.suscripcion_hasta).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Inactiva';

    const statusHTML = isSubscribed
        ? `<span class="px-3 py-1 text-sm font-semibold text-green-800 bg-green-200 rounded-full">Activa hasta ${expirationDate}</span>`
        : `<span class="px-3 py-1 text-sm font-semibold text-red-800 bg-red-200 rounded-full">Inactiva</span>`;

    return `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h3 class="text-xl font-bold text-gray-800">${maquina.nombre || "Sin nombre"}</h3>
                <p class="text-sm text-gray-500">Serial: ${maquina.serial}</p>
                <p class="mt-2 font-semibold">Estado: ${statusHTML}</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                <button onclick="subscribe('${maquina.serial}', 'mensual')" class="modern-button text-sm">Mensual</button>
                <button onclick="subscribe('${maquina.serial}', 'semestral')" class="modern-button secondary text-sm">Semestral</button>
                <button onclick="subscribe('${maquina.serial}', 'anual')" class="modern-button success text-sm">Anual</button>
            </div>
        </div>
    `;
}
