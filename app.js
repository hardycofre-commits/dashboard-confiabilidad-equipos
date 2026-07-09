const fileInput = document.getElementById('fileInput');
const btnActualizar = document.getElementById('btnActualizar');

const kArchivo = document.getElementById('kArchivo');
const kActualizacion = document.getElementById('kActualizacion');
const kEquipos = document.getElementById('kEquipos');
const kAvisos = document.getElementById('kAvisos');
const txtRegistros = document.getElementById('txtRegistros');
const txtArchivo = document.getElementById('txtArchivo');
const txtLectura = document.getElementById('txtLectura');

const equipoFiltro = document.getElementById('equipoFiltro');
const estadoValidacion = document.getElementById('estadoValidacion');
const validacionDetalle = document.getElementById('validacionDetalle');
const filasPreview = document.getElementById('filasPreview');

const tabla = document.getElementById('tablaPreview');
const thead = tabla.querySelector('thead');
const tbody = tabla.querySelector('tbody');

let datosOriginales = [];
let mapaColumnas = {};

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await leerExcel(file);
});

btnActualizar.addEventListener('click', () => {
  if(datosOriginales.length) procesarDatos(datosOriginales, kArchivo.textContent);
});

async function leerExcel(file){
  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array', cellDates:true});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});

    datosOriginales = rows;
    procesarDatos(rows, file.name);
  }catch(error){
    mostrarError('No fue posible leer el archivo. Verifica que sea un Excel válido.');
    console.error(error);
  }
}

function procesarDatos(rows, fileName){
  const columnas = rows.length ? Object.keys(rows[0]) : [];
  mapaColumnas = detectarColumnas(columnas);

  kArchivo.textContent = fileName;
  txtArchivo.textContent = fileName;
  txtRegistros.textContent = `${rows.length.toLocaleString('es-CL')} registros leídos`;

  const ahora = new Date().toLocaleString('es-CL');
  kActualizacion.textContent = ahora;
  txtLectura.textContent = ahora;

  const equipos = contarUnicos(rows, mapaColumnas.equipo);
  const avisos = contarUnicos(rows, mapaColumnas.aviso);

  kEquipos.textContent = equipos.toLocaleString('es-CL');
  kAvisos.textContent = avisos.toLocaleString('es-CL');

  cargarFiltroEquipos(rows, mapaColumnas.equipo);
  validarColumnas(mapaColumnas, columnas);
  renderTabla(rows.slice(0, 25), columnas);
  filasPreview.textContent = `${Math.min(rows.length,25)} de ${rows.length} filas`;
}

function detectarColumnas(columnas){
  const normalizadas = columnas.map(c => ({original:c, key:normalizar(c)}));

  return {
    equipo: buscarColumna(normalizadas, ['equipo','denominacionequipo','ubicaciontecnica','objeto','denominacion']),
    aviso: buscarColumna(normalizadas, ['aviso','avisosap','numeroaviso','nroaviso']),
    inicio: buscarColumna(normalizadas, ['inicioaveria','iniciodeaveria','inicioaveriafecha','fecha inicio averia','inicio']),
    fin: buscarColumna(normalizadas, ['finaveria','findeaveria','finaveriafecha','fecha fin averia','fin']),
    parada: buscarColumna(normalizadas, ['parada','indparada','indicadorparada'])
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

function cargarFiltroEquipos(rows, columna){
  equipoFiltro.innerHTML = '<option value="">Todos</option>';
  if(!columna) return;

  const equipos = [...new Set(rows.map(r => r[columna]).filter(Boolean))]
    .sort((a,b) => String(a).localeCompare(String(b),'es'));

  equipos.slice(0,500).forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq;
    opt.textContent = eq;
    equipoFiltro.appendChild(opt);
  });
}

function validarColumnas(mapa, columnas){
  const faltantes = [];

  if(!mapa.equipo) faltantes.push('Equipo');
  if(!mapa.aviso) faltantes.push('Aviso');
  if(!mapa.inicio) faltantes.push('Inicio avería');
  if(!mapa.fin) faltantes.push('Fin avería');

  if(faltantes.length === 0){
    estadoValidacion.textContent = 'Validado';
    estadoValidacion.className = 'status ok';
    validacionDetalle.innerHTML = `
      <b>Archivo validado correctamente.</b><br>
      Equipo: ${mapa.equipo}<br>
      Aviso: ${mapa.aviso}<br>
      Inicio avería: ${mapa.inicio}<br>
      Fin avería: ${mapa.fin}<br>
      Parada: ${mapa.parada || 'No detectada'}
    `;
  }else{
    estadoValidacion.textContent = 'Revisar';
    estadoValidacion.className = 'status error';
    validacionDetalle.innerHTML = `
      <b>No se detectaron todas las columnas necesarias.</b><br>
      Faltantes: ${faltantes.join(', ')}<br><br>
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

  const colsPreferidas = [
    mapaColumnas.equipo,
    mapaColumnas.aviso,
    mapaColumnas.inicio,
    mapaColumnas.fin,
    mapaColumnas.parada
  ].filter(Boolean);

  const otras = columnas.filter(c => !colsPreferidas.includes(c)).slice(0,6);
  const cols = [...colsPreferidas, ...otras];

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  tbody.innerHTML = rows.map(row => `
    <tr>${cols.map(c => `<td>${formatearCelda(row[c])}</td>`).join('')}</tr>
  `).join('');
}

function formatearCelda(valor){
  if(valor instanceof Date) return valor.toLocaleString('es-CL');
  return String(valor ?? '');
}

function mostrarError(msg){
  estadoValidacion.textContent = 'Error';
  estadoValidacion.className = 'status error';
  validacionDetalle.textContent = msg;
}
