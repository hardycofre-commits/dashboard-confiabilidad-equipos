const fileInput = document.getElementById('fileInput');
const btnDemo = document.getElementById('btnDemo');

const kArchivo = document.getElementById('kArchivo');
const kRegistros = document.getElementById('kRegistros');
const kEquipos = document.getElementById('kEquipos');
const kAvisos = document.getElementById('kAvisos');
const kPeriodo = document.getElementById('kPeriodo');

const estadoValidacion = document.getElementById('estadoValidacion');
const validacionDetalle = document.getElementById('validacionDetalle');
const filasPreview = document.getElementById('filasPreview');

const tabla = document.getElementById('tablaPreview');
const thead = tabla.querySelector('thead');
const tbody = tabla.querySelector('tbody');

const columnasClave = [
  ['equipo', 'Equipo'],
  ['aviso', 'Aviso'],
  ['inicio', 'Inicio avería'],
  ['fin', 'Fin avería']
];

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await leerExcel(file);
});

btnDemo.addEventListener('click', () => fileInput.click());

async function leerExcel(file){
  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array', cellDates:true});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});

    procesarDatos(rows, file.name);
  }catch(error){
    mostrarError('No fue posible leer el archivo. Verifica que sea un Excel válido.');
    console.error(error);
  }
}

function procesarDatos(rows, fileName){
  const columnas = rows.length ? Object.keys(rows[0]) : [];
  const mapa = detectarColumnas(columnas);

  kArchivo.textContent = fileName;
  kRegistros.textContent = rows.length.toLocaleString('es-CL');

  const equipos = contarUnicos(rows, mapa.equipo);
  const avisos = contarUnicos(rows, mapa.aviso);

  kEquipos.textContent = equipos;
  kAvisos.textContent = avisos;
  kPeriodo.textContent = calcularPeriodo(rows, mapa.inicio, mapa.fin);

  validarColumnas(mapa, columnas);
  renderTabla(rows.slice(0, 20), columnas);
  filasPreview.textContent = `${Math.min(rows.length,20)} de ${rows.length} filas`;
}

function detectarColumnas(columnas){
  const normalizadas = columnas.map(c => ({original:c, key:normalizar(c)}));

  return {
    equipo: buscarColumna(normalizadas, ['equipo','ubicaciontecnica','denominacionequipo','objeto']),
    aviso: buscarColumna(normalizadas, ['aviso','avisosap','numeroaviso','nroaviso']),
    inicio: buscarColumna(normalizadas, ['inicioaveria','iniciodeaveria','fecha inicio averia','inicio']),
    fin: buscarColumna(normalizadas, ['finaveria','findeaveria','fecha fin averia','fin'])
  };
}

function buscarColumna(cols, posibles){
  for (const posible of posibles){
    const p = normalizar(posible);
    const encontrada = cols.find(c => c.key.includes(p) || p.includes(c.key));
    if (encontrada) return encontrada.original;
  }
  return null;
}

function normalizar(texto){
  return String(texto)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'');
}

function contarUnicos(rows, columna){
  if(!columna) return 0;
  return new Set(rows.map(r => r[columna]).filter(Boolean)).size;
}

function calcularPeriodo(rows, colInicio, colFin){
  const fechas = [];

  [colInicio, colFin].forEach(col => {
    if(!col) return;
    rows.forEach(r => {
      const f = convertirFecha(r[col]);
      if(f) fechas.push(f);
    });
  });

  if(!fechas.length) return '-';

  const min = new Date(Math.min(...fechas));
  const max = new Date(Math.max(...fechas));

  return `${formatearFecha(min)} al ${formatearFecha(max)}`;
}

function convertirFecha(valor){
  if(!valor) return null;
  if(valor instanceof Date && !isNaN(valor)) return valor;
  const f = new Date(valor);
  return isNaN(f) ? null : f;
}

function formatearFecha(fecha){
  return fecha.toLocaleDateString('es-CL');
}

function validarColumnas(mapa, columnas){
  const faltantes = [];

  if(!mapa.equipo) faltantes.push('Equipo');
  if(!mapa.aviso) faltantes.push('Aviso');
  if(!mapa.inicio) faltantes.push('Inicio avería');
  if(!mapa.fin) faltantes.push('Fin avería');

  if(faltantes.length === 0){
    estadoValidacion.textContent = 'Validado';
    estadoValidacion.className = 'badge ok';
    validacionDetalle.innerHTML = `
      Archivo validado correctamente.<br>
      Columnas detectadas:<br>
      <b>Equipo:</b> ${mapa.equipo}<br>
      <b>Aviso:</b> ${mapa.aviso}<br>
      <b>Inicio avería:</b> ${mapa.inicio}<br>
      <b>Fin avería:</b> ${mapa.fin}
    `;
  }else{
    estadoValidacion.textContent = 'Revisar';
    estadoValidacion.className = 'badge error';
    validacionDetalle.innerHTML = `
      No se detectaron todas las columnas necesarias.<br>
      Faltantes: <b>${faltantes.join(', ')}</b><br><br>
      Columnas encontradas:<br>
      ${columnas.join(' | ')}
    `;
  }
}

function renderTabla(rows, columnas){
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if(!rows.length){
    tbody.innerHTML = '<tr><td>No hay datos para mostrar</td></tr>';
    return;
  }

  const cols = columnas.slice(0, 10);

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  tbody.innerHTML = rows.map(row => `
    <tr>
      ${cols.map(c => `<td>${formatearCelda(row[c])}</td>`).join('')}
    </tr>
  `).join('');
}

function formatearCelda(valor){
  if(valor instanceof Date) return valor.toLocaleString('es-CL');
  return String(valor ?? '');
}

function mostrarError(msg){
  estadoValidacion.textContent = 'Error';
  estadoValidacion.className = 'badge error';
  validacionDetalle.textContent = msg;
}
