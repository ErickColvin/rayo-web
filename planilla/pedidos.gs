/**
 * Rayo · pedidos de la web en una planilla de Google
 *
 * Guarda cada pedido con Mercado Pago (plan, nombre, correo y número) como una
 * fila de la hoja «Pedidos». Así puedes cruzarlo con el pago en Mercado Pago y
 * con el ticket de Discord antes de entregar la clave.
 *
 * Cómo instalarlo (una sola vez):
 *  1. Crea una planilla en Google Sheets, por ejemplo «Pedidos Rayo».
 *  2. En la planilla: Extensiones → Apps Script. Borra lo que haya, pega todo
 *     este archivo y guarda (Ctrl + S).
 *  3. Implementar → Nueva implementación → tipo «Aplicación web».
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier usuario
 *     Pulsa Implementar y autoriza con tu cuenta. Si Google avisa que la app
 *     no está verificada: Configuración avanzada → Ir a … (es tu propio script).
 *  4. Copia la URL de la aplicación web (termina en /exec) y pégala en
 *     planillaPedidos, al inicio de js/main.js.
 *
 * Si después cambias este código: Implementar → Administrar implementaciones →
 * editar (lápiz) → Versión: Nueva versión. La URL sigue siendo la misma.
 */

const HOJA = 'Pedidos';
const PLANES = {
  pro: { nombre: 'Pro', monto: 3990 },
  elite: { nombre: 'Elite', monto: 6990 },
};
const COLUMNAS = ['Fecha', 'Plan', 'Monto (CLP)', 'Nombre', 'Correo', 'Número', 'Estado', 'Clave entregada'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  const plan = PLANES[p.plan];
  const nombre = limpiar(p.nombre, 80);
  const correo = limpiar(p.correo, 120);
  const numero = limpiar(p.numero, 30);

  const valido = plan
    && nombre.length >= 2
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)
    && numero.replace(/\D/g, '').length >= 8;
  if (!valido) return responder(false);

  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    // El número siempre como texto, para no perder el + ni los ceros
    hoja().appendRow([new Date(), plan.nombre, plan.monto, texto(nombre), texto(correo), `'${numero}`, 'Pendiente', '']);
  } finally {
    candado.releaseLock();
  }
  return responder(true);
}

// Abrir la URL en el navegador muestra esto: sirve para comprobar que funciona
function doGet() {
  return ContentService.createTextOutput('Pedidos de Rayo: funcionando.');
}

function hoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA);
  if (!h) h = libro.insertSheet(HOJA);
  if (h.getLastRow() === 0) {
    h.appendRow(COLUMNAS);
    h.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function limpiar(valor, largo) {
  return String(valor || '').replace(/\s+/g, ' ').trim().slice(0, largo);
}

// Sheets ejecuta como fórmula lo que empieza con = + - @: el apóstrofo lo
// guarda como texto (y no se ve en la celda)
function texto(valor) {
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function responder(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok }))
    .setMimeType(ContentService.MimeType.JSON);
}
