// auth.js

const supabaseUrl = 'https://ikuouxllerfjnibjtlkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdW91eGxsZXJmam5pYmp0bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNzQ5ODIsImV4cCI6MjA2MTY1MDk4Mn0.ofmYTPFMfRrHOI2YQxjIb50uB_uO8UaHuiQ0T1kbv2U';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// auth.js

const emailIn     = document.getElementById('email');
const passIn      = document.getElementById('password');
const otpIn       = document.getElementById('otp');
const signupBtn   = document.getElementById('signupBtn');
const verifyBtn   = document.getElementById('verifyBtn');
const msg         = document.getElementById('message');

function showMessage(text, color='black') {
  msg.textContent = text;
  msg.style.color = color;
}

signupBtn.addEventListener('click', async () => {
  const email    = emailIn.value.trim();
  const password = passIn.value.trim();
  if (!email || !password) {
    return showMessage('Ingresa email y contraseña.', 'red');
  }

  // 1) Enviar OTP para "signup"
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });

  if (error) {
    showMessage('Error enviando OTP: ' + error.message, 'red');
  } else {
    showMessage('OTP enviado. Revisa tu correo.', 'green');
    // mostrar campo de OTP
    otpIn.style.display     = 'block';
    verifyBtn.style.display = 'block';
    signupBtn.disabled      = true;
  }
});

verifyBtn.addEventListener('click', async () => {
  const email = emailIn.value.trim();
  const otp   = otpIn.value.trim();
  const password = passIn.value.trim();

  if (!otp) {
    return showMessage('Ingresa el código OTP.', 'red');
  }

  // 2) Verificar OTP (tipo "signup")
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'signup'
  });

  if (error) {
    return showMessage('OTP inválido: ' + error.message, 'red');
  }

  // 3) (Opcional) Asignar la contraseña que el usuario ingresó
  const { error: upErr } = await supabase.auth.updateUser({ password });
  if (upErr) {
    return showMessage('No se pudo asignar contraseña: ' + upErr.message, 'red');
  }

  showMessage('Cuenta verificada y creada exitosamente. ¡Bienvenido!', 'green');
  setTimeout(() => window.location.href = '/dashboard.html', 1500);
});
