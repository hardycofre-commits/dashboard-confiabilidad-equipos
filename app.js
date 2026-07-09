const CONFIG = {
  owner: 'hardycofre-commits',
  repo: 'dashboard-confiabilidad-equipos',
  branch: 'main',
  folder: 'datos'
};

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

document.addEventListener('DOMContentLoaded', cargarDesdeGitHub);
btnActualizar.addEventListener('click', cargarDesdeGitHub);

async function cargarDesdeGitHub(){
  try{
    setEstado('Buscando', 'warning', 'Consultando carpeta datos/ en GitHub...');

    const archivo = await obtenerUltimoExcelGitHub();

    if(!archivo){
      throw new Error('No se encontró ningún archivo Excel en la carpeta datos.');
    }

    setEstado('Cargando', 'warning', `Archivo detectado: ${archivo.name}<br>Descargando y procesando información SAP...`);
    const response = await fetch(archivo.download_url + '?v=' + Date.now());

    if(!response.ok){
      throw new Error('No fue posible descargar el archivo Excel desde GitHub.');
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array', cellDates:true});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});

    datosOriginales = rows;
    procesarDatos(rows, archivo.name);
  }catch(error){
    mostrarError(error.message);
    console.error(error);
  }
}

async function obtenerUltimoExcelGitHub(){
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}`;
  const response = await fetch(apiUrl + '&t=' + Date.now());

  if(!response.ok){
    throw new Error('No fue posible leer la carpeta datos desde GitHub. Revisa que exista la carpeta datos y que el repositorio sea público.');
  }

  const archivos = await response.json();

  const excel = archivos
    .filter(item => item.type === 'file')
    .filter(item => /\.(xlsx|xls)$/i.test(item.name))
    .sort((a,b) => compararArchivos(a.name, b.name));

  return excel.length ? excel[excel.length - 1] : null;
}

function compararArchivos(a, b){
  const fa = extraerFechaNombre(a);
  const fb = extraerFechaNombre(b);

  if(fa && fb) return fa - fb;
  return a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'});
}

function extraerFechaNombre(nombre){
  const limpio = nombre.replace(/[_]/g,' ');
  const iso = limpio.match(/(20\d{2})[-. ]?(\d{2})[-. ]?(\d{2})(?:[T _-]?(\d{2})?[:.-]?(\d{2})?[:.-]?(\d{2})?)?/);

  if(!iso) return null;

  const y = Number(iso[1]);
  const m = Number(iso[2]) - 1;
  const d = Number(iso[3]);
  const hh = Number(iso[4] || 0);
  const mm = Number(iso[5] || 0);
  const ss = Number(iso[6] || 0);

  return new Date(y, m, d, hh, mm, ss);
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
    setEstado('Validado', 'ok', `
      <b>Archivo SAP cargado correctamente desde GitHub.</b><br>
      Equipo: ${mapa.equipo}<br>
      Aviso: ${mapa.aviso}<br>
      Inicio avería: ${mapa.inicio}<br>
      Fin avería: ${mapa.fin}<br>
      Parada: ${mapa.parada || 'No detectada'}
    `);
  }else{
    setEstado('Revisar', 'error', `
      <b>No se detectaron todas las columnas necesarias.</b><br>
      Faltantes: ${faltantes.join(', ')}<br><br>
      Columnas encontradas:<br>
      ${columnas.join(' | ')}
    `);
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

function setEstado(texto, tipo, detalle){
  estadoValidacion.textContent = texto;
  estadoValidacion.className = `status ${tipo}`;
  validacionDetalle.innerHTML = detalle;
}

function mostrarError(msg){
  kArchivo.textContent = 'Error';
  txtArchivo.textContent = 'Sin archivo';
  txtRegistros.textContent = '0 registros leídos';
  kEquipos.textContent = '0';
  kAvisos.textContent = '0';
  filasPreview.textContent = '0 filas';
  thead.innerHTML = '';
  tbody.innerHTML = '';
  setEstado('Error', 'error', msg);
}
