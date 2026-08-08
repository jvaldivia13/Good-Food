// app.js — Arranque: teclado PIN, login y eventos globales
document.addEventListener('DOMContentLoaded', () => {
  // Teclado numérico del login
  const pad = $$('pinPad');
  const pinInput = $$('pinInput');
  let pin = '';
  ['1','2','3','4','5','6','7','8','9','clear','0','ok'].forEach((k) => {
    const b = document.createElement('button');
    b.dataset.k = k;
    b.textContent = k === 'clear' ? '⌫' : k === 'ok' ? '✓' : k;
    b.onclick = () => {
      if (k === 'clear') { pin = ''; pinInput.value = ''; }
      else if (k === 'ok') { $$('loginBtn').click(); }
      else { if (pin.length < 4) { pin += k; pinInput.value = '•'.repeat(pin.length); } }
      $$('loginError').textContent = '';
    };
    pad.appendChild(b);
  });
  // Botón ingresar
  $$('loginBtn').onclick = () => { if (pin.length >= 4) doLogin(pin); else $$('loginError').textContent = 'Ingresa los 4 dígitos'; };
  // Botón cancelar: borra el último dígito (comportamiento de tecla retroceso)
  $$('cancelBtn').onclick = () => { pin = pin.slice(0, -1); pinInput.value = '•'.repeat(pin.length); $$('loginError').textContent = ''; };
  // Salir
  $$('logoutBtn').onclick = () => {
    App.socket && App.socket.disconnect();
    App.user = null;
    $$('appView').classList.add('hidden');
    $$('loginView').classList.remove('hidden');
    pin = ''; pinInput.value = '';
  };
  // Mostrar botón ingreso cuando hay 4+ dígitos via input físico
  pinInput.addEventListener('input', () => { pin = pinInput.value.replace(/\D/g, ''); pinInput.value = pin; });
  pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pin.length >= 4) doLogin(pin); });
});
