// auth.js

const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Detect form and page
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value;
      const password = loginForm.password.value;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert('Error al iniciar sesión: ' + error.message);
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupForm.email.value;
      const password = signupForm.password.value;

      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        alert('Error al registrarse: ' + error.message);
      } else {
        alert('Cuenta creada con éxito. Por favor inicia sesión.');
        window.location.href = 'login.html';
      }
    });
  }
});
