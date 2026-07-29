// ===== CONSTANTES =====
const R     = 8.314;   // J/(mol·K)
const R_atm = 0.08206; // L·atm/(mol·K)

// Cp(T) = a + b*T + c*T²  [J/(mol·K)]  — coeficientes del PDF
// b y c vienen multiplicados por 1e-3 y 1e-6 respectivamente en la tabla
// Cv(T) = Cp(T) - R  (gas ideal)
const GAS_DATA = {
  H2:   { nombre: 'H₂ (g)',   a: 29.066,  b: -0.836e-3,  c:  20.117e-7 },
  O2:   { nombre: 'O₂ (g)',   a: 25.503,  b: 13.612e-3,  c: -42.555e-7 },
  Cl2:  { nombre: 'Cl₂ (g)',  a: 31.696,  b: 10.144e-3,  c: -40.376e-7 },
  Br2:  { nombre: 'Br₂ (g)',  a: 35.240,  b:  4.075e-3,  c: -14.874e-7 },
  N2:   { nombre: 'N₂ (g)',   a: 26.984,  b:  5.910e-3,  c:  -3.376e-7 },
  H2O:  { nombre: 'H₂O (g)',  a: 30.206,  b:  9.933e-3,  c:  11.171e-7 },
  CO:   { nombre: 'CO (g)',   a: 26.537,  b:  7.683e-3,  c: -11.719e-7 },
  CO2:  { nombre: 'CO₂ (g)',  a: 26.648,  b: 42.258e-3,  c:-142.460e-7 },
  NH3:  { nombre: 'NH₃ (g)',  a: 25.894,  b: 32.999e-3,  c: -30.459e-7 },
  SO2:  { nombre: 'SO₂ (g)',  a: 28.434,  b: 48.484e-3,  c: -12.614e-7 },
  SO3:  { nombre: 'SO₃ (g)',  a: 15.074,  b: 151.920e-3, c:1206.160e-7 },
  H2S:  { nombre: 'H₂S (g)',  a: 29.100,  b: 15.376e-3,  c:  30.960e-7 },
  HCl:  { nombre: 'HCl (g)',  a: 28.166,  b:  1.809e-3,  c:  15.468e-7 },
  CH4:  { nombre: 'CH₄ (g)',  a: 14.143,  b: 75.495e-3,  c:-179.640e-7 },
  C2H6: { nombre: 'C₂H₆ (g)', a:  9.404,  b:159.836e-3,  c:-462.280e-7 },
  C3H8: { nombre: 'C₃H₈ (g)', a: 10.080,  b:239.300e-3,  c:-733.580e-7 },
  C6H6: { nombre: 'C₆H₆ (g)', a: -1.711,  b:324.770e-3,  c:-1105.780e-7},
};

// Gases ideales con Cp y Cv constantes (para procesos adiabáticos)
// Cv = f/2 * R  y  Cp = Cv + R, según los grados de libertad f
const ADIABATIC_GAS_DATA = {
  mono:  { nombre: 'Monoatómico', Cv: 3 * R / 2, Cp: 5 * R / 2 },
  di:    { nombre: 'Diatómico',   Cv: 5 * R / 2, Cp: 7 * R / 2 },
  tri:   { nombre: 'Triatómico',  Cv: 7 * R / 2, Cp: 9 * R / 2 },
  otro:  { nombre: 'Otro (elegir gas específico)' }, // Cv/Cp se calculan dinámicamente a partir de GAS_DATA, evaluados en T1
};

// ===== FUNCIONES DE Cp, Cv E INTEGRALES =====
// Cp(T) = a + b·T + c·T²
function Cp_T(gas, T) {
  return gas.a + gas.b * T + gas.c * T * T;
}
// Cv(T) = Cp(T) - R
function Cv_T(gas, T) {
  return Cp_T(gas, T) - R;
}
// ∫T1→T2 Cp dT = a·ΔT + b/2·(T2²-T1²) + c/3·(T2³-T1³)
function integralCp(gas, T1, T2) {
  return gas.a * (T2 - T1)
       + gas.b / 2 * (T2 ** 2 - T1 ** 2)
       + gas.c / 3 * (T2 ** 3 - T1 ** 3);
}
// ∫T1→T2 Cv dT = ∫Cp dT - R·ΔT
function integralCv(gas, T1, T2) {
  return integralCp(gas, T1, T2) - R * (T2 - T1);
}
// Cp promedio en [T1,T2]
function CpMean(gas, T1, T2) {
  if (Math.abs(T2 - T1) < 1e-9) return Cp_T(gas, T1);
  return integralCp(gas, T1, T2) / (T2 - T1);
}
// Cv promedio en [T1,T2]
function CvMean(gas, T1, T2) {
  if (Math.abs(T2 - T1) < 1e-9) return Cv_T(gas, T1);
  return integralCv(gas, T1, T2) / (T2 - T1);
}

let lastResult = null;

// Todos los campos de datos numéricos que el usuario llena para calcular
const DATA_INPUT_IDS = [
  'inT','inP1','inP2','inP','inV1','inV2','inN','inT2',
  'inVcor','inT1cor','inT2cor','inP1cor','inP2cor','inPext'
];

// Borra todos los campos de datos (excepto el que se está editando, si se indica)
function clearAllDataInputs(exceptId) {
  DATA_INPUT_IDS.forEach(id => {
    if (id !== exceptId) document.getElementById(id).value = '';
  });
}

// Vuelve el panel de resultados/gráficas a su estado inicial (sin cálculo)
function resetCalculationState() {
  lastResult = null;

  showLog([
    { text: 'Los datos fueron modificados. Ingrese nuevamente todos los valores y presione Calcular.', cls: 'log-warn' },
    { text: 'Nota: debe ingresar siempre las constantes del proceso (T, P, V), n (moles) y al menos 2 campos adicionales.', cls: 'log-warn' },
  ]);

  document.getElementById('statesRow').style.display = 'none';
  document.getElementById('thermoTitle').textContent = 'Variables Termodinámicas';
  document.getElementById('thermoGrid').innerHTML = `
    <div class="placeholder" style="grid-column:span 2">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
      </svg>
      Calcule para ver resultados
    </div>
  `;

  const chart = document.getElementById('chartCanvas');
  chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
  ['piston1', 'piston2'].forEach(id => {
    const c = document.getElementById(id);
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  });
}

// Si ya había un resultado calculado y el usuario edita un dato, se borra el resto
// para evitar mezclar valores de cálculos distintos.
function onDataInputEdited(changedId) {
  if (!lastResult) return;
  clearAllDataInputs(changedId);
  resetCalculationState();
}

// ===== UI STATE =====
function onProcesoChange() {
  if (lastResult) {
    clearAllDataInputs(null);
    resetCalculationState();
  }

  const p = document.getElementById('selectProceso').value;
  const labels = {
    iso_rev:     'Isotérmico Reversible',
    iso_irrev:   'Isotérmico Irreversible',
    isobar:      'Isobárico',
    isocor:      'Isocórico',
    adiab_rev:   'Adiabático Reversible',
    adiab_irrev: 'Adiabático Irreversible',
  };
  document.getElementById('datosTitle').textContent = 'Datos para ' + labels[p];
  document.getElementById('tagProceso').textContent = labels[p];

  const isIsobar  = (p === 'isobar');
  const isIsocor  = (p === 'isocor');
  const isAdiab   = (p === 'adiab_rev' || p === 'adiab_irrev');

  // Campos comunes (isotérmico rev/irrev y adiabático rev/irrev)
  document.getElementById('groupT').style.display   = isIsocor ? 'none' : '';
  document.getElementById('groupP1').style.display  = (isIsobar || isIsocor) ? 'none' : '';
  document.getElementById('groupP2').style.display  = (isIsobar || isIsocor) ? 'none' : '';
  document.getElementById('groupV1').style.display  = isIsocor ? 'none' : '';
  document.getElementById('groupV2').style.display  = isIsocor ? 'none' : '';
  document.getElementById('groupP').style.display   = isIsobar ? '' : 'none';
  document.getElementById('groupT2').style.display  = (isIsobar || isAdiab) ? '' : 'none';

  // Campos exclusivos isocórico
  document.getElementById('groupVcor').style.display  = isIsocor ? '' : 'none';
  document.getElementById('groupT1cor').style.display = isIsocor ? '' : 'none';
  document.getElementById('groupT2cor').style.display = isIsocor ? '' : 'none';
  document.getElementById('groupP1cor').style.display = isIsocor ? '' : 'none';
  document.getElementById('groupP2cor').style.display = isIsocor ? '' : 'none';

  // Limpiar campos no relevantes al cambiar proceso
  if (!isIsobar) document.getElementById('inP').value = '';
  if (!isIsobar && !isAdiab) document.getElementById('inT2').value = '';
  if (!isIsocor) {
    ['inVcor','inT1cor','inT2cor','inP1cor','inP2cor'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }

  // Alternar el selector de gas: 17 gases normales vs. mono/di/triatómico (adiabático)
  setGasSelectorMode(isAdiab);
  onGasChange();
}

function onGasChange() {
  if (lastResult) {
    clearAllDataInputs(null);
    resetCalculationState();
  }

  const proc    = document.getElementById('selectProceso').value;
  const isAdiab = (proc === 'adiab_rev' || proc === 'adiab_irrev');
  const gasKey  = document.getElementById('selectGas').value;
  const showOtro = isAdiab && gasKey === 'otro';
  document.getElementById('groupGasOtro').style.display = showOtro ? '' : 'none';
}

function onGasOtroChange() {
  if (lastResult) {
    clearAllDataInputs(null);
    resetCalculationState();
  }
}

// ===== SELECTOR DE GAS: normal vs. adiabático =====
let lastNormalGas = 'H2';
let lastAdiabGas  = 'di';

function setGasSelectorMode(isAdiab) {
  const sel = document.getElementById('selectGas');
  const current = sel.value;

  if (isAdiab) {
    if (GAS_DATA[current]) lastNormalGas = current;      // veníamos del modo normal
    if (!ADIABATIC_GAS_DATA[current]) {
      sel.innerHTML = Object.entries(ADIABATIC_GAS_DATA)
        .map(([key, g]) => `<option value="${key}">${g.nombre}</option>`).join('');
      sel.value = lastAdiabGas;
    }
  } else {
    if (ADIABATIC_GAS_DATA[current]) lastAdiabGas = current; // veníamos del modo adiabático
    if (!GAS_DATA[current]) {
      sel.innerHTML = Object.entries(GAS_DATA)
        .map(([key, g]) => `<option value="${key}">${g.nombre}</option>`).join('');
      sel.value = lastNormalGas;
    }
  }
}

// ===== AYUDANTES =====
function v(id) {
  const val = parseFloat(document.getElementById(id).value);
  return isNaN(val) ? null : val;
}

function fmt(x, d = 3) {
  if (x === null || x === undefined || isNaN(x)) return '—';
  return x.toFixed(d);
}

function fmtSci(x) {
  if (Math.abs(x) >= 1e5 || (Math.abs(x) < 0.001 && x !== 0)) return x.toExponential(3);
  return x.toFixed(3);
}

// ===== MOSTRAR REGISTRO =====
function showLog(lines) {
  const el = document.getElementById('resultsLog');
  el.innerHTML = '';
  lines.forEach(l => {
    const span = document.createElement('span');
    span.className = l.cls || '';
    span.textContent = l.text;
    el.appendChild(span);
    el.appendChild(document.createTextNode('\n'));
  });
  el.scrollTop = 0;
}

// ===== CÁLCULO PRINCIPAL =====
function calcular() {
  const proc    = document.getElementById('selectProceso').value;
  const gasKey  = document.getElementById('selectGas').value;
  const isAdiab = (proc === 'adiab_rev' || proc === 'adiab_irrev');

  let T    = v('inT'),  P1 = v('inP1'), P2 = v('inP2');
  let V1   = v('inV1'), V2 = v('inV2'), n  = v('inN');
  let T2   = v('inT2'), Pext = v('inPext');
  let lines = [];

  function addLine(text, cls = '') { lines.push({ text, cls }); }

  // ---- CONSTRUIR OBJETO GAS ----
  let gas;
  if (isAdiab) {
    if (gasKey === 'otro') {
      // Gas específico: se calculan Cp/Cv constantes evaluados en T1 (T)
      if (!T) { showLog([{ text: 'Error: ingrese T1 (K) para calcular Cp y Cv del gas seleccionado.', cls: 'log-err' }]); return; }
      const realKey = document.getElementById('selectGasOtro').value;
      const realGas = GAS_DATA[realKey];
      const CvCalc  = Cv_T(realGas, T);
      const CpCalc  = Cp_T(realGas, T);
      gas = { nombre: realGas.nombre + ' (Cp/Cv evaluados en T1)', Cv: CvCalc, Cp: CpCalc };
    } else {
      gas = ADIABATIC_GAS_DATA[gasKey];
    }
  } else {
    gas = GAS_DATA[gasKey];
  }

  // ---- ISOTÉRMICO REVERSIBLE ----
  if (proc === 'iso_rev') {
    if (!n) { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }
    if (!T) { showLog([{ text: 'Error: ingrese T (K).',    cls: 'log-err' }]); return; }

    if (P1 && !V1) { V1 = (n * R_atm * T) / P1; document.getElementById('inV1').value = V1.toFixed(4); }
    if (P2 && !V2) { V2 = (n * R_atm * T) / P2; document.getElementById('inV2').value = V2.toFixed(4); }
    if (!P1 && V1) { P1 = (n * R_atm * T) / V1; document.getElementById('inP1').value = P1.toFixed(4); }
    if (!P2 && V2) { P2 = (n * R_atm * T) / V2; document.getElementById('inP2').value = P2.toFixed(4); }

    if (!P1 || !P2 || !V1 || !V2) {
      showLog([{ text: 'Error: ingrese al menos T, n y 2 de {P1, P2, V1, V2}.', cls: 'log-err' }]);
      return;
    }

    const Wv = -n * R * T * Math.log(V2 / V1);
    const Wp = Wv, q = -Wv, dU = 0, dH = 0, Cp = Cp_T(gas, T), T2c = T;

    addLine('V1 calculado = ' + fmt(V1, 3) + ' L', 'log-val');
    addLine('V2 calculado = ' + fmt(V2, 3) + ' L', 'log-val');
    addLine('PROCESO ISOTÉRMICO REVERSIBLE', 'log-head');
    addLine('');
    addLine('T  = ' + fmt(T,  2) + ' K',   'log-key');
    addLine('P1 = ' + fmt(P1, 3) + ' atm', 'log-key');
    addLine('P2 = ' + fmt(P2, 3) + ' atm', 'log-key');
    addLine('V1 = ' + fmt(V1, 3) + ' L',   'log-key');
    addLine('V2 = ' + fmt(V2, 3) + ' L',   'log-key');
    addLine('n  = ' + fmt(n,  3) + ' mol', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('Trabajo wv = ' + fmtSci(Wv) + ' J', 'log-val');
    addLine('Trabajo wp = ' + fmtSci(Wp) + ' J', 'log-val');
    addLine('Calor q    = ' + fmtSci(q)  + ' J', 'log-val');
    addLine('Cp         = ' + fmt(Cp, 3) + ' J/mol·K', 'log-val');
    addLine('ΔU = 0 J', 'log-val');
    addLine('ΔH = 0 J', 'log-val');

    lastResult = { proc, gas: gasKey, T, T2: T2c, P1, P2, V1, V2, n, Wv, Wp, q, dU, dH, Cp };
    showLog(lines);
    drawChart(); drawPistons(V1, V2, T, T2c, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }

  // ---- ISOTÉRMICO IRREVERSIBLE ----
  if (proc === 'iso_irrev') {
    if (!n)    { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }
    if (!T)    { showLog([{ text: 'Error: ingrese T (K).',     cls: 'log-err' }]); return; }

    if (P1 && !V1) V1 = (n * R_atm * T) / P1;
    if (P2 && !V2) V2 = (n * R_atm * T) / P2;
    if (!V1 || !V2) { showLog([{ text: 'Error: ingrese P1/V1 y P2/V2.', cls: 'log-err' }]); return; }
    if (!P1) P1 = (n * R_atm * T) / V1;
    if (!P2) P2 = (n * R_atm * T) / V2;

    // P2 actúa como presión externa (Pext) en el proceso irreversible
    Pext = P2;

    document.getElementById('inV1').value = V1.toFixed(4);
    document.getElementById('inV2').value = V2.toFixed(4);

    // Wv = -Pext*(V2-V1): positivo en compresión (V2<V1), negativo en expansión (V2>V1)
    const Wv_latm = -Pext * (V2 - V1);
    const Wv = Wv_latm * 101.325;
    const Wp = Wv, q = -Wv, dU = 0, dH = 0, Cp = Cp_T(gas, T), T2c = T;

    addLine('V1 calculado = ' + fmt(V1, 3) + ' L', 'log-val');
    addLine('V2 calculado = ' + fmt(V2, 3) + ' L', 'log-val');
    addLine('PROCESO ISOTÉRMICO IRREVERSIBLE', 'log-head');
    addLine('');
    addLine('T    = ' + fmt(T,    2) + ' K',   'log-key');
    addLine('P1   = ' + fmt(P1,   3) + ' atm', 'log-key');
    addLine('P2   = ' + fmt(P2,   3) + ' atm', 'log-key');
    addLine('Pext = P2 = ' + fmt(Pext, 3) + ' atm', 'log-key');
    addLine('V1   = ' + fmt(V1,   3) + ' L',   'log-key');
    addLine('V2   = ' + fmt(V2,   3) + ' L',   'log-key');
    addLine('n    = ' + fmt(n,    3) + ' mol', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('Trabajo wv = ' + fmtSci(Wv) + ' J', 'log-val');
    addLine('Trabajo wp = ' + fmtSci(Wp) + ' J', 'log-val');
    addLine('Calor q    = ' + fmtSci(q)  + ' J', 'log-val');
    addLine('Cp         = ' + fmt(Cp, 3) + ' J/mol·K', 'log-val');
    addLine('ΔU = 0 J', 'log-val');
    addLine('ΔH = 0 J', 'log-val');

    lastResult = { proc, gas: gasKey, T, T2: T2c, P1, P2, V1, V2, n, Wv, Wp, q, dU, dH, Cp, Pext };
    showLog(lines);
    drawChart(); drawPistons(V1, V2, T, T2c, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }

  // ---- ISOBÁRICO ----
  if (proc === 'isobar') {
    if (!n) { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }
    let P = v('inP');
    if (!P) { showLog([{ text: 'Error: ingrese P (atm).', cls: 'log-err' }]); return; }
    P1 = P; P2 = P;

    let T1 = T;
    if (!T1 && V1) T1 = (P * V1) / (n * R_atm);
    if (!T2 && V2) T2 = (P * V2) / (n * R_atm);
    if (!V1 && T1) { V1 = (n * R_atm * T1) / P; document.getElementById('inV1').value = V1.toFixed(4); }
    if (!V2 && T2) { V2 = (n * R_atm * T2) / P; document.getElementById('inV2').value = V2.toFixed(4); }

    if (!T1 || !T2 || !V1 || !V2) {
      showLog([{ text: 'Error: ingrese P, n, T1 (campo T), T2 y al menos V1 o V2.', cls: 'log-err' }]);
      return;
    }

    // Wv = P·ΔV  (convertido de L·atm a J: ×101.325)
    const Wv = -P * (V2 - V1) * 101.325;
    // Wp = 0 en proceso isobárico
    const Wp = 0;
    const CpAvg = CpMean(gas, T1, T2);
    const CvAvg = CvMean(gas, T1, T2);
    // q = n · ∫T1→T2 Cp(T) dT
    const q  = n * integralCp(gas, T1, T2);
    // ΔU = Wv + q  (primera ley: ΔU = q + w, con w = −Wv para convención química)
    const dU = Wv - q;
    // ΔH = q
    const dH = q;

    addLine('V1 calculado = ' + fmt(V1, 3) + ' L', 'log-val');
    addLine('V2 calculado = ' + fmt(V2, 3) + ' L', 'log-val');
    addLine('PROCESO ISOBÁRICO', 'log-head');
    addLine('');
    addLine('P  = ' + fmt(P,  3) + ' atm', 'log-key');
    addLine('T1 = ' + fmt(T1, 2) + ' K',   'log-key');
    addLine('T2 = ' + fmt(T2, 2) + ' K',   'log-key');
    addLine('V1 = ' + fmt(V1, 3) + ' L',   'log-key');
    addLine('V2 = ' + fmt(V2, 3) + ' L',   'log-key');
    addLine('n  = ' + fmt(n,  3) + ' mol', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('Trabajo wv = P·ΔV = ' + fmtSci(Wv) + ' J', 'log-val');
    addLine('Trabajo wp = 0 J',                           'log-val');
    addLine('q = n·∫Cp dT = '      + fmtSci(q)  + ' J', 'log-val');
    addLine('ΔU = q - wv = '       + fmtSci(dU) + ' J', 'log-val');
    addLine('ΔH = q = '            + fmtSci(dH) + ' J', 'log-val');

    lastResult = { proc, gas: gasKey, T: T1, T2, P1, P2, V1, V2, n, Wv, Wp, q, dU, dH, Cp: CpAvg };
    showLog(lines);
    drawChart(); drawPistons(V1, V2, T1, T2, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }

  // ---- ISOCÓRICO ----
  if (proc === 'isocor') {
    if (!n) { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }

    const Vv  = v('inVcor');
    const T1c = v('inT1cor');
    const T2c = v('inT2cor');
    let   P1c = v('inP1cor');
    let   P2c = v('inP2cor');

    if (!T1c) { showLog([{ text: 'Error: ingrese T1 (K).', cls: 'log-err' }]); return; }
    if (!T2c) { showLog([{ text: 'Error: ingrese T2 (K).', cls: 'log-err' }]); return; }

    // Calcular P1 y P2 desde gas ideal si se proporcionó V
    if (Vv) {
      if (!P1c) { P1c = (n * R_atm * T1c) / Vv; document.getElementById('inP1cor').value = P1c.toFixed(4); }
      if (!P2c) { P2c = (n * R_atm * T2c) / Vv; document.getElementById('inP2cor').value = P2c.toFixed(4); }
    }

    const Wv = 0;
    // Wp = V·(P2−P1)·101.325  sin redondeo
    const Wp     = Vv ? (P2c - P1c) * Vv * 101.325 : n * R * (T2c - T1c);
    const wpLabel = Vv
      ? 'wp = V·(P2−P1)·101.325 = ' + fmtSci(Wp) + ' J'
      : 'wp = n·R·(T2−T1) = '       + fmtSci(Wp) + ' J';
    // qv = n·∫T1→T2 Cv(T) dT
    const qv  = n * integralCv(gas, T1c, T2c);
    // ΔU = qv
    const dU  = qv;
    // ΔH = qv + Wp
    const dH  = qv + Wp;
    const CvAvg = CvMean(gas, T1c, T2c);
    const CpAvg = CpMean(gas, T1c, T2c);

    addLine('PROCESO ISOCÓRICO', 'log-head');
    addLine('');
    addLine('V  = ' + fmt(Vv,  3) + ' L   (constante)', 'log-key');
    addLine('n  = ' + fmt(n,   3) + ' mol',              'log-key');
    addLine('T1 = ' + fmt(T1c, 2) + ' K',                'log-key');
    addLine('T2 = ' + fmt(T2c, 2) + ' K',                'log-key');
    addLine('P1 = ' + fmt(P1c, 4) + ' atm',              'log-key');
    addLine('P2 = ' + fmt(P2c, 4) + ' atm',              'log-key');
    addLine('');
    addLine('Cv(T) = Cp(T) - R', 'log-warn');
    addLine('Cv(T1) = ' + fmt(Cv_T(gas, T1c), 3) + ' J/mol·K', 'log-key');
    addLine('Cv(T2) = ' + fmt(Cv_T(gas, T2c), 3) + ' J/mol·K', 'log-key');
    addLine('Cv̄    = ' + fmt(CvAvg, 3) + ' J/mol·K  (promedio)', 'log-key');
    addLine('Cp̄    = ' + fmt(CpAvg, 3) + ' J/mol·K  (promedio)', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('wv = 0 J  (V constante)',   'log-val');
    addLine(wpLabel,                      'log-val');
    addLine('qv = n·∫Cv dT = '          + fmtSci(qv)  + ' J',   'log-val');
    addLine('ΔU = qv = '                + fmtSci(dU)  + ' J',   'log-val');
    addLine('ΔH = qv + wp = '           + fmtSci(dH)  + ' J',   'log-val');

    lastResult = { proc, gas: gasKey, T: T1c, T2: T2c, P1: P1c, P2: P2c, V1: Vv || 0, V2: Vv || 0, n, Wv, Wp, q: qv, dU, dH, Cp: CpAvg };
    showLog(lines);
    drawChart(); drawPistons(Vv || 1, Vv || 1, T1c, T2c, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }

  // ---- ADIABÁTICO REVERSIBLE ----
  if (proc === 'adiab_rev') {
    if (!n) { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }
    const T1 = T;
    if (!T1) { showLog([{ text: 'Error: ingrese T1 (K).', cls: 'log-err' }]); return; }

    const Cv = gas.Cv, Cp = gas.Cp, gamma = Cp / Cv;

    // Estado 1: se necesita T1 y al menos uno de {P1, V1} (gas ideal resuelve el otro)
    if (P1 && !V1) V1 = (n * R_atm * T1) / P1;
    if (V1 && !P1) P1 = (n * R_atm * T1) / V1;
    if (!P1 || !V1) {
      showLog([{ text: 'Error: ingrese T1, n y al menos P1 o V1.', cls: 'log-err' }]);
      return;
    }

    // Estado 2: se resuelve con el dato disponible entre {T2, P2, V2}
    let T2c, P2c, V2c;
    if (T2) {
      T2c = T2;
      P2c = P1 * Math.pow(T2c / T1, gamma / (gamma - 1));
      V2c = (n * R_atm * T2c) / P2c;
    } else if (P2) {
      P2c = P2;
      T2c = T1 * Math.pow(P1 / P2c, (1 - gamma) / gamma);
      V2c = (n * R_atm * T2c) / P2c;
    } else if (V2) {
      V2c = V2;
      T2c = T1 * Math.pow(V1 / V2c, gamma - 1);
      P2c = (n * R_atm * T2c) / V2c;
    } else {
      showLog([{ text: 'Error: ingrese T2, P2 o V2 para el estado final.', cls: 'log-err' }]);
      return;
    }

    document.getElementById('inP1').value = P1.toFixed(4);
    document.getElementById('inV1').value = V1.toFixed(4);
    document.getElementById('inT2').value = T2c.toFixed(3);
    document.getElementById('inP2').value = P2c.toFixed(4);
    document.getElementById('inV2').value = V2c.toFixed(4);

    const q  = 0;
    const dU = n * Cv * (T2c - T1);
    const dH = n * Cp * (T2c - T1);
    const Wv = dU;
    const Wp = dH;

    addLine('PROCESO ADIABÁTICO REVERSIBLE', 'log-head');
    addLine('');
    addLine('Gas   = ' + gas.nombre, 'log-key');
    addLine('γ = Cp/Cv = ' + fmt(gamma, 4), 'log-key');
    addLine('T1 = ' + fmt(T1,  2) + ' K',   'log-key');
    addLine('T2 = ' + fmt(T2c, 2) + ' K',   'log-key');
    addLine('P1 = ' + fmt(P1,  3) + ' atm', 'log-key');
    addLine('P2 = ' + fmt(P2c, 3) + ' atm', 'log-key');
    addLine('V1 = ' + fmt(V1,  3) + ' L',   'log-key');
    addLine('V2 = ' + fmt(V2c, 3) + ' L',   'log-key');
    addLine('n  = ' + fmt(n,   3) + ' mol', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('q  = 0 J  (adiabático)', 'log-val');
    addLine('Wv = ΔU = n·Cv·(T2−T1) = ' + fmtSci(Wv) + ' J', 'log-val');
    addLine('Wp = ΔH = n·Cp·(T2−T1) = ' + fmtSci(Wp) + ' J', 'log-val');
    addLine('ΔU = ' + fmtSci(dU) + ' J', 'log-val');
    addLine('ΔH = ' + fmtSci(dH) + ' J', 'log-val');

    lastResult = { proc, gas: gasKey, T: T1, T2: T2c, P1, P2: P2c, V1, V2: V2c, n, Wv, Wp, q, dU, dH, Cp, gamma };
    showLog(lines);
    drawChart(); drawPistons(V1, V2c, T1, T2c, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }

  // ---- ADIABÁTICO IRREVERSIBLE ----
  if (proc === 'adiab_irrev') {
    if (!n) { showLog([{ text: 'Error: ingrese n (moles).', cls: 'log-err' }]); return; }
    const T1 = T;
    if (!T1) { showLog([{ text: 'Error: ingrese T1 (K).', cls: 'log-err' }]); return; }
    if (!P1) { showLog([{ text: 'Error: ingrese P1 (atm).', cls: 'log-err' }]); return; }
    if (!P2) { showLog([{ text: 'Error: ingrese P2 (atm) = presión externa constante.', cls: 'log-err' }]); return; }

    const Cv = gas.Cv, Cp = gas.Cp;

    // n·Cv·(T2−T1) = P2·(V1−V2)  con gas ideal  ⇒  T2·(n·Cv+n·R) = T1·((P2/P1)·n·R + n·Cv)
    const T2c = T1 * (Cv + R * (P2 / P1)) / (Cv + R);

    V1 = (n * R_atm * T1)  / P1;
    const V2c = (n * R_atm * T2c) / P2;

    document.getElementById('inV1').value = V1.toFixed(4);
    document.getElementById('inV2').value = V2c.toFixed(4);
    document.getElementById('inT2').value = T2c.toFixed(3);

    const q  = 0;
    const dU = n * Cv * (T2c - T1);
    const dH = n * Cp * (T2c - T1);
    const Wv = dU;
    const Wp = dH;

    addLine('PROCESO ADIABÁTICO IRREVERSIBLE', 'log-head');
    addLine('');
    addLine('Gas  = ' + gas.nombre, 'log-key');
    addLine('Pext = P2 = ' + fmt(P2, 3) + ' atm', 'log-key');
    addLine('T1 = ' + fmt(T1,  2) + ' K',   'log-key');
    addLine('T2 = ' + fmt(T2c, 2) + ' K',   'log-key');
    addLine('P1 = ' + fmt(P1,  3) + ' atm', 'log-key');
    addLine('P2 = ' + fmt(P2,  3) + ' atm', 'log-key');
    addLine('V1 = ' + fmt(V1,  3) + ' L',   'log-key');
    addLine('V2 = ' + fmt(V2c, 3) + ' L',   'log-key');
    addLine('n  = ' + fmt(n,   3) + ' mol', 'log-key');
    addLine('');
    addLine('VARIABLES TERMODINÁMICAS', 'log-head');
    addLine('q  = 0 J  (adiabático)', 'log-val');
    addLine('Wv = ΔU = n·Cv·(T2−T1) = ' + fmtSci(Wv) + ' J', 'log-val');
    addLine('Wp = ΔH = n·Cp·(T2−T1) = ' + fmtSci(Wp) + ' J', 'log-val');
    addLine('ΔU = ' + fmtSci(dU) + ' J', 'log-val');
    addLine('ΔH = ' + fmtSci(dH) + ' J', 'log-val');

    lastResult = { proc, gas: gasKey, T: T1, T2: T2c, P1, P2, V1, V2: V2c, n, Wv, Wp, q, dU, dH, Cp, Pext: P2 };
    showLog(lines);
    drawChart(); drawPistons(V1, V2c, T1, T2c, proc); updateThermoCards(lastResult); updateStates(lastResult);
    return;
  }
}

// ===== TARJETAS TÉRMICAS =====
const PROCESS_LABELS = {
  iso_rev:     'Isotérmico Reversible',
  iso_irrev:   'Isotérmico Irreversible',
  isobar:      'Isobárico',
  isocor:      'Isocórico',
  adiab_rev:   'Adiabático Reversible',
  adiab_irrev: 'Adiabático Irreversible',
};

function updateThermoCards(r) {
  const grid = document.getElementById('thermoGrid');
  const type = r.V1 > r.V2 ? 'Compresión' : 'Expansión';
  document.getElementById('thermoTitle').textContent = type + ' · ' + PROCESS_LABELS[r.proc];

  grid.innerHTML = `
    <div class="thermo-card highlight">
      <div class="tc-label">Trabajo wv (J)</div>
      <div class="tc-val">${fmtSci(r.Wv)}</div>
    </div>
    <div class="thermo-card highlight">
      <div class="tc-label">Trabajo wp (J)</div>
      <div class="tc-val">${fmtSci(r.Wp)}</div>
    </div>
    <div class="thermo-card">
      <div class="tc-label">Calor q (J)</div>
      <div class="tc-val">${fmtSci(r.q)}</div>
    </div>
    <div class="thermo-card">
      <div class="tc-label">Cp promedio (J/mol·K)</div>
      <div class="tc-val">${r.Cp.toFixed(3)}</div>
    </div>
    <div class="thermo-card">
      <div class="tc-label">ΔU (J)</div>
      <div class="tc-val">${fmtSci(r.dU)}</div>
    </div>
    <div class="thermo-card">
      <div class="tc-label">ΔH (J)</div>
      <div class="tc-val">${fmtSci(r.dH)}</div>
    </div>
  `;
}

function updateStates(r) {
  document.getElementById('statesRow').style.display = '';
  document.getElementById('state1Text').innerHTML =
    `P: <span>${fmt(r.P1, 3)} atm</span><br>V: <span>${fmt(r.V1, 3)} L</span><br>T: <span>${fmt(r.T, 2)} K</span>`;
  document.getElementById('state2Text').innerHTML =
    `P: <span>${fmt(r.P2, 3)} atm</span><br>V: <span>${fmt(r.V2, 3)} L</span><br>T: <span>${fmt(r.T2, 2)} K</span>`;
}

// ===== CUADRO =====
function drawChart() {
  if (!lastResult) return;
  const r = lastResult;
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = (canvas.offsetWidth  || 600) * (window.devicePixelRatio || 1);
  canvas.height = 320 * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  const W = canvas.offsetWidth || 600, H = 320;
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 30, r: 30, b: 50, l: 70 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const { proc, P1, P2, V1, V2, T, n, gamma } = r;

  // Build curve points
  let pts = [];
  if (proc === 'iso_rev' || proc === 'iso_irrev') {
    const Vmin = Math.min(V1, V2), Vmax = Math.max(V1, V2);
    for (let i = 0; i <= 200; i++) {
      const vv = Vmin + (Vmax - Vmin) * i / 200;
      pts.push({ x: vv, y: (n * R_atm * T) / vv });
    }
  } else if (proc === 'adiab_rev') {
    const Vmin = Math.min(V1, V2), Vmax = Math.max(V1, V2);
    const K = P1 * Math.pow(V1, gamma);
    for (let i = 0; i <= 200; i++) {
      const vv = Vmin + (Vmax - Vmin) * i / 200;
      pts.push({ x: vv, y: K / Math.pow(vv, gamma) });
    }
  } else {
    // isobárico, isocórico y adiabático irreversible: línea recta entre los dos estados
    pts = [{ x: V1, y: P1 }, { x: V2, y: P2 }];
  }
  if (!pts.length) return;

  // Axis ranges
  let xMin = Math.min(...pts.map(p => p.x)), xMax = Math.max(...pts.map(p => p.x));
  let yMin = Math.min(...pts.map(p => p.y)), yMax = Math.max(...pts.map(p => p.y));
  const xPad = (xMax - xMin) * 0.15 || xMax * 0.15;
  const yPad = (yMax - yMin) * 0.15 || yMax * 0.15;
  xMin -= xPad; xMax += xPad;
  yMin = Math.max(0, yMin - yPad); yMax += yPad;
  if (xMin === xMax) { xMin -= 1; xMax += 1; }
  if (yMin === yMax) { yMin = 0;  yMax += 1; }

  const toX = val => pad.l + (val - xMin) / (xMax - xMin) * cw;
  const toY = val => pad.t + ch - (val - yMin) / (yMax - yMin) * ch;

  // Grid lines
  ctx.strokeStyle = '#e0e8f0'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + ch * i / 5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    const x = pad.l + cw * i / 5;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ch); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#1a2b3c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ch); ctx.lineTo(pad.l + cw, pad.t + ch); ctx.stroke();

  // Axis tick labels
  ctx.fillStyle = '#607d8b'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const yv = yMin + (yMax - yMin) * (1 - i / 5);
    ctx.fillText(yv.toFixed(2), pad.l - 4, toY(yv) + 4);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const xv = xMin + (xMax - xMin) * i / 5;
    ctx.fillText(xv.toFixed(1), toX(xv), pad.t + ch + 18);
  }

  // Axis titles
  ctx.fillStyle = '#0f2a4a'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.save(); ctx.translate(16, pad.t + ch / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('Presión P (atm)', 0, 0); ctx.restore();
  ctx.fillText('Volumen V (L)', pad.l + cw / 2, H - 6);

  // Curve
  const curveColor = { iso_rev: null, iso_irrev: null, isobar: '#1a7ae8', isocor: '#20a850', adiab_rev: '#8e44ad', adiab_irrev: '#8e44ad' };
  if (proc === 'iso_rev' || proc === 'iso_irrev') {
    const grad = ctx.createLinearGradient(toX(V1), 0, toX(V2), 0);
    grad.addColorStop(0, '#e8401a'); grad.addColorStop(1, '#e84090');
    ctx.strokeStyle = grad;
  } else {
    ctx.strokeStyle = curveColor[proc];
  }
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach((p, i) => { i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y)); });
  ctx.stroke();

  // P1V1 & P2V2 dots
  const dotPts = [
    { x: V1, y: P1, label: 'P1,V1' },
    { x: V2, y: P2, label: 'P2,V2' },
  ];
  dotPts.forEach(dp => {
    ctx.fillStyle = '#e010a0';
    ctx.beginPath(); ctx.arc(toX(dp.x), toY(dp.y), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e010a0'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(dp.label, toX(dp.x) + 9, toY(dp.y) - 5);
  });

  // Dashed lines to axes
  ctx.setLineDash([4, 4]); ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
  dotPts.forEach(dp => {
    ctx.beginPath(); ctx.moveTo(toX(dp.x), toY(dp.y)); ctx.lineTo(pad.l, toY(dp.y)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(dp.x), toY(dp.y)); ctx.lineTo(toX(dp.x), pad.t + ch); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Process label
  const procLabels = { iso_rev: 'Isotérmico Reversible', iso_irrev: 'Isotérmico Irreversible', isobar: 'Isobárico', isocor: 'Isocórico', adiab_rev: 'Adiabático Reversible', adiab_irrev: 'Adiabático Irreversible' };
  ctx.fillStyle = '#666'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Proceso: ' + procLabels[proc], pad.l + cw / 2, pad.t - 8);
}

// ===== PISTON DRAWING =====
function drawPistons(V1, V2, T1, T2, proc) {
  drawPiston('piston1', V1, T1, proc, true);
  drawPiston('piston2', V2, T2, proc, false);
}

function drawPiston(canvasId, V, T, proc, isInitial) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxV  = Math.max(lastResult.V1, lastResult.V2);
  const ratio = Math.max(0.15, Math.min(0.95, V / maxV));
  const cx    = W / 2;
  const cylW  = 70, cylH = H - 40;
  const cylX  = cx - cylW / 2;
  const wallT = 7;

  // Cylinder outer body
  const cylGrad = ctx.createLinearGradient(cylX, 0, cylX + cylW, 0);
  cylGrad.addColorStop(0, '#888'); cylGrad.addColorStop(0.15, '#ccc');
  cylGrad.addColorStop(0.85, '#bbb'); cylGrad.addColorStop(1, '#777');
  ctx.fillStyle = cylGrad;
  ctx.beginPath(); ctx.roundRect(cylX, 20, cylW, cylH, [8, 8, 4, 4]); ctx.fill();

  // Inner areas
  const innerX = cylX + wallT, innerW = cylW - wallT * 2;
  const gasH   = (cylH - 20) * ratio;
  const gasY   = 20 + (cylH - 20) - gasH;

  // Space above piston
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(innerX, 20, innerW, (cylH - 20) - gasH);

  // Gas area
  const gasGrad = ctx.createLinearGradient(0, gasY, 0, gasY + gasH);
  gasGrad.addColorStop(0, 'rgba(100,180,255,0.5)');
  gasGrad.addColorStop(1, 'rgba(60,130,220,0.75)');
  ctx.fillStyle = gasGrad;
  ctx.fillRect(innerX, gasY, innerW, gasH);

  // Piston head
  const pistH = 14, pistY = gasY - pistH;
  const pistGrad = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  pistGrad.addColorStop(0, '#999'); pistGrad.addColorStop(0.4, '#eee'); pistGrad.addColorStop(1, '#888');
  ctx.fillStyle = pistGrad;
  ctx.fillRect(innerX - 2, pistY, innerW + 4, pistH);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(innerX - 2, pistY, innerW + 4, pistH);

  // Piston rod
  const rodW  = 12, rodX = cx - rodW / 2;
  const rodGrad = ctx.createLinearGradient(rodX, 0, rodX + rodW, 0);
  rodGrad.addColorStop(0, '#777'); rodGrad.addColorStop(0.5, '#ccc'); rodGrad.addColorStop(1, '#888');
  ctx.fillStyle = rodGrad;
  ctx.fillRect(rodX, 20, rodW, pistY - 20);

  // Rod top cap
  ctx.fillStyle = '#aaa';
  ctx.beginPath(); ctx.ellipse(cx, 20, rodW / 2 + 4, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();

  // Cylinder bottom cap
  const capGrad = ctx.createLinearGradient(cylX, 0, cylX + cylW, 0);
  capGrad.addColorStop(0, '#777'); capGrad.addColorStop(0.3, '#bbb'); capGrad.addColorStop(1, '#888');
  ctx.fillStyle = capGrad;
  ctx.beginPath(); ctx.roundRect(cylX - 4, 20 + cylH - 12, cylW + 8, 12, [0, 0, 6, 6]); ctx.fill();

  // Volume label
  ctx.fillStyle = '#1a2b3c'; ctx.font = 'bold 11px JetBrains Mono, monospace'; ctx.textAlign = 'center';
  ctx.fillText('V = ' + V.toFixed(2) + ' L', cx, H - 6);
}

// ===== INIT =====
DATA_INPUT_IDS.forEach(id => {
  document.getElementById(id).addEventListener('input', () => onDataInputEdited(id));
});
onProcesoChange();
window.addEventListener('resize', () => { if (lastResult) drawChart(); });
