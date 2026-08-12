async function copiarTexto(el,valor){
  const texto=String(valor);
  let copiado=false;
  if(navigator.clipboard&&window.isSecureContext){
    try{
      await navigator.clipboard.writeText(texto);
      copiado=true;
    }catch(error){}
  }
  if(!copiado){
    const auxiliar=document.createElement('textarea');
    auxiliar.value=texto;
    auxiliar.setAttribute('readonly','');
    auxiliar.style.position='fixed';
    auxiliar.style.opacity='0';
    document.body.appendChild(auxiliar);
    auxiliar.select();
    try{copiado=document.execCommand('copy');}catch(error){}
    auxiliar.remove();
  }
  const original=el.textContent;
  el.textContent=copiado?'✔ Copiado':'No se pudo copiar';
  setTimeout(()=>{el.textContent=original;},900);
}

const CONFIG={owner:'hardycofre-commits',repo:'dashboard-confiabilidad-equipos',branch:'main',folder:'datos'};
const UNIDADES_BASE=['HATCHERY','FF2','ALEVINAJE','PRE SMOLT','RILES','FILTRADO','GENERADORES','OTROS'];
const MAPEO_BASE=[['HATCHERY','HATCHERY'],['HAT','HATCHERY'],['FF2','FF2'],['FF','FF2'],['ALEVINAJE','ALEVINAJE'],['ALEV','ALEVINAJE'],['PRE-SMOLT','PRE SMOLT'],['PRE SMOLT','PRE SMOLT'],['PRESMOLT','PRE SMOLT'],['RILES','RILES'],['FILTRADO','FILTRADO'],['FILTRO','FILTRADO'],['GEN','GENERADORES'],['GENERADOR','GENERADORES']];
const TIPOS_BASE=['TRICKING'];
const KEY_REGLAS='confEq_reglas_v21', KEY_UNIDADES='confEq_unidades_v21', KEY_NOMBRES='confEq_nombresUnidades_v23', KEY_AVISO_UNIDADES='confEq_avisoUnidades_v44', KEY_DEN_UNIDADES='confEq_denominacionUnidades_v1';
const KEY_TIPOS='confEq_tipos_v1', KEY_REGLAS_TIPO='confEq_reglasTipos_v2', KEY_AVISO_TIPOS='confEq_avisoTipos_v1';
let reglasUsuario=JSON.parse(localStorage.getItem(KEY_REGLAS)||'[]');
let unidadesUsuario=JSON.parse(localStorage.getItem(KEY_UNIDADES)||'[]');
let nombresUnidades=JSON.parse(localStorage.getItem(KEY_NOMBRES)||'{"Hat":"Hatchery","Hatchery":"Hatchery","FF":"FF2","FF2":"FF2","Pre":"Pre Smolt","Pre Smolt":"Pre Smolt","Alev":"Alevinaje","Alevinaje":"Alevinaje"}');
let unidadesAviso=JSON.parse(localStorage.getItem(KEY_AVISO_UNIDADES)||'{}');
let unidadesDenominacion=JSON.parse(localStorage.getItem(KEY_DEN_UNIDADES)||'{}');
let tiposUsuario=JSON.parse(localStorage.getItem(KEY_TIPOS)||'[]');
let reglasTipoUsuario=JSON.parse(localStorage.getItem(KEY_REGLAS_TIPO)||'[]');
let tiposAviso=JSON.parse(localStorage.getItem(KEY_AVISO_TIPOS)||'{}');
let datosOriginales=[], datosBase=[], bloquesLYD=[], mapaColumnas={}, listaEquipos=[], pendientes=[], pendienteIndex=0;
let pendientesTipo=[], pendienteTipoIndex=0;
const tiposOmitidosSesion=new Set();
const equiposSeleccionados=new Set();
let ordenFecha='asc';
const $=id=>document.getElementById(id);

document.addEventListener('DOMContentLoaded',()=>{
  configurarFechas();
  setupEventos();
  cargarDesdeGitHub();
  setInterval(actualizarConfiabilidadPorTiempo,60000);
});

function actualizarConfiabilidadPorTiempo(){
  if($('viewConfiabilidad')?.classList.contains('hidden'))return;
  analizarConfiabilidadAutomaticamente();
  renderRankingUnidad();
}
function setupEventos(){
  document.querySelectorAll('.menu-item').forEach(a=>a.onclick=e=>{e.preventDefault();cambiarVista(a.dataset.view);});
  $('btnActualizar').onclick=cargarDesdeGitHub;
  $('cardSinClasificar').onclick=abrirWizard;
  $('cardTiposSinClasificar').onclick=abrirWizardTipo;
  $('btnCerrarWizard').onclick=cerrarWizard;
  $('btnFinalizarWizard').onclick=cerrarWizard;
  $('btnAnterior').onclick=()=>{if(pendienteIndex>0){pendienteIndex--;renderWizard();}};
  $('btnGuardarSiguiente').onclick=guardarWizard;
  $('wizardUnidad').onchange=()=>{$('boxNuevaUnidad').classList.toggle('hidden',$('wizardUnidad').value!=='__NUEVA__');};
  $('btnCerrarWizardTipo').onclick=cerrarWizardTipo;
  $('btnFinalizarWizardTipo').onclick=cerrarWizardTipo;
  $('btnAnteriorTipo').onclick=()=>{if(pendienteTipoIndex>0){pendienteTipoIndex--;renderWizardTipo();}};
  $('btnOmitirTipo').onclick=omitirWizardTipo;
  $('btnGuardarSiguienteTipo').onclick=guardarWizardTipo;
  $('wizardTipoSelect').onchange=()=>{$('boxNuevoTipo').classList.toggle('hidden',$('wizardTipoSelect').value!=='__NUEVO__');};
  configurarBuscadorEquipos('busquedaEquipo','sugerenciasEquipo','btnAbrirEquipos',{
    alEscribir:aplicarFiltros,
    alSeleccionar:aplicarFiltros,
    seleccionMultiple:true
  });
  configurarBuscadorEquipos('confBuscarEquipo','sugerenciasEquipoConf','btnAbrirEquiposConf',{
    alEscribir:analizarConfiabilidadAutomaticamente,
    alSeleccionar:()=>analizarConfiabilidad({silencioso:true})
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.search-field'))ocultarBuscadoresEquipos();});
  if($('confUnidadFiltro'))$('confUnidadFiltro').onchange=()=>{
    analizarConfiabilidadAutomaticamente();
    renderRankingUnidad();
  };
  ['confDesde','confHasta'].forEach(id=>{
    if($(id))$(id).onchange=()=>{
      analizarConfiabilidadAutomaticamente();
      renderRankingUnidad();
    };
  });

  $('fechaDesde').onchange=aplicarFiltros;$('fechaHasta').onchange=aplicarFiltros;
  $('btnOrdenAsc').onclick=()=>cambiarOrdenFecha('asc');
  $('btnOrdenDesc').onclick=()=>cambiarOrdenFecha('desc');
  $('unidadFiltro').onchange=aplicarFiltros;
  $('tipoFiltro').oninput=aplicarFiltros;
  $('btnGuardarUnidades').onclick=guardarTodosNombresUnidades;
}
function cambiarVista(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
  document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
  if(v==='unidades'){$('viewUnidades').classList.remove('hidden');renderTablaUnidades();}
  else if(v==='confiabilidad'){
    $('viewConfiabilidad').classList.remove('hidden');
  } else if(v==='gantt'){
    $('viewGantt').classList.remove('hidden');
  } else {$('viewResumen').classList.remove('hidden');}
  document.querySelector(`.menu-item[data-view="${v}"]`).classList.add('active');
}
function configurarFechas(){$('fechaDesde').value='2025-01-01';$('fechaHasta').value='2026-12-31';if($('confDesde'))$('confDesde').value='2025-01-01';if($('confHasta'))$('confHasta').value='2026-12-31';}
async function cargarDesdeGitHub(){
 try{
  setEstado('Buscando','warning','Consultando carpeta datos/ en GitHub...');
  const archivos=await listarArchivosDatos(), sap=selUlt(archivos,esSAP), gantt=selUlt(archivos,esGantt);
  if(!sap) throw new Error('No se encontró archivo SAP/EXPORT en carpeta datos.');
  await cargarSAP(sap); if(gantt) await cargarGantt(gantt); else renderTablaLYD([]);
  $('txtLectura').textContent=new Date().toLocaleString('es-CL');
  setEstado('Validado','ok',`SAP: ${sap.name}<br>Gantt: ${gantt?gantt.name:'No encontrado'}<br>Clasificaciones guardadas: ${reglasUsuario.length}`);
 }catch(e){mostrarError(e.message);console.error(e);}
}
async function listarArchivosDatos(){const r=await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}&t=${Date.now()}`); if(!r.ok)throw new Error('No fue posible leer carpeta datos desde GitHub.'); return r.json();}
function esSAP(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&(n.includes('sap')||n.includes('export'))&&!n.includes('gantt');}
function esGantt(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&n.includes('gantt');}
function selUlt(arr,f){const x=arr.filter(f).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));return x[x.length-1];}
async function cargarSAP(a){$('kArchivo').textContent=a.name;$('txtArchivo').textContent=a.name;const rows=await leerExcel(a.download_url,'json');datosOriginales=rows.filter(r=>valor(r[detectarColumnas(Object.keys(rows[0]||{})).orden]).trim()!=='');mapaColumnas=detectarColumnas(Object.keys(rows[0]||{}));$('txtRegistros').textContent=`${rows.length.toLocaleString('es-CL')} registros SAP leídos`;cargarListaEquipos(rows);cargarFiltroUnidades();cargarFiltroTipos();aplicarFiltros();}
async function cargarGantt(a){$('kArchivoGantt').textContent=a.name;$('txtGantt').textContent=a.name;const m=await leerExcel(a.download_url,'array');bloquesLYD=extraerBloquesLYD(m);$('kBloquesLYD').textContent=bloquesLYD.length.toLocaleString('es-CL');renderTablaLYD(bloquesLYD);renderTablaUnidades();}
async function leerExcel(url,modo){const r=await fetch(url+'?v='+Date.now());if(!r.ok)throw new Error('No fue posible descargar archivo.');const b=await r.arrayBuffer(), wb=XLSX.read(b,{type:'array',cellDates:true}), sh=wb.Sheets[wb.SheetNames[0]];return modo==='array'?XLSX.utils.sheet_to_json(sh,{header:1,defval:''}):XLSX.utils.sheet_to_json(sh,{defval:''});}

function cambiarOrdenFecha(tipo){
  ordenFecha=tipo;
  $('btnOrdenAsc').classList.toggle('active',tipo==='asc');
  $('btnOrdenDesc').classList.toggle('active',tipo==='desc');
  aplicarFiltros();
}

function fechaOrdenRegistro(registro){
  return registro.inicioAveriaFecha || registro.fechaAviso || null;
}

function ordenarRegistrosPorFecha(registros){
  return registros.sort((a,b)=>{
    const fa=fechaOrdenRegistro(a);
    const fb=fechaOrdenRegistro(b);

    if(!fa && !fb) return 0;
    if(!fa) return 1;
    if(!fb) return -1;

    return ordenFecha==='asc' ? fa-fb : fb-fa;
  });
}

function aplicarFiltros(){
  let base=construirDatosBase(datosOriginales);

  const d=$('fechaDesde').value?new Date($('fechaDesde').value+'T00:00:00'):null;
  const h=$('fechaHasta').value?new Date($('fechaHasta').value+'T23:59:59'):null;

  if(d||h){
    base=base.filter(r=>{
      const f=r.inicioAveriaFecha||r.fechaAviso;
      if(!f)return true;
      return (!d||f>=d)&&(!h||f<=h);
    });
  }

  const txt=normalizar($('busquedaEquipo').value);
  const seleccionadosNormalizados=new Set([...equiposSeleccionados].map(normalizar));
  if(seleccionadosNormalizados.size){
    base=base.filter(r=>seleccionadosNormalizados.has(normalizar(r.denominacionUbicacionTecnica||r.ubicacionTecnica)));
    $('txtFiltro').textContent=`Grupo: ${seleccionadosNormalizados.size} equipos`;
  }else if(txt){
    base=base.filter(r=>
      normalizar(r.denominacionUbicacionTecnica).includes(txt) ||
      normalizar(r.ubicacionTecnica).includes(txt) ||
      normalizar(r.descripcion).includes(txt)
    );
    $('txtFiltro').textContent='Equipo: '+$('busquedaEquipo').value;
  }else{
    $('txtFiltro').textContent='Todos los equipos';
  }

  const unidadSeleccionada=$('unidadFiltro').value;
  if(unidadSeleccionada){
    base=base.filter(r=>r.unidad===unidadSeleccionada);
    $('txtFiltro').textContent=`Unidad: ${unidadSeleccionada}`;
  }

  const tipoBuscado=normalizar($('tipoFiltro').value);
  if(tipoBuscado){
    base=base.filter(r=>normalizar(r.tipoEquipo).includes(tipoBuscado));
    $('txtFiltro').textContent=`Tipo: ${$('tipoFiltro').value}`;
  }

  base=ordenarRegistrosPorFecha(base);
  datosBase=base;
  actualizarKPIs();
  renderTablaBase(base.slice(0,300));
  renderTablaUnidades();
  $('filasBase').textContent=`${base.length.toLocaleString('es-CL')} filas`;
}
function construirDatosBase(rows){return rows.filter(r=>valor(r[mapaColumnas.orden]).trim()!=='').map(r=>{const ini=unirFechaHora(r[mapaColumnas.inicioFecha],r[mapaColumnas.inicioHora]), fin=unirFechaHora(r[mapaColumnas.finFecha],r[mapaColumnas.finHora]);const den=valor(r[mapaColumnas.denominacionUbicacionTecnica]), ubi=valor(r[mapaColumnas.ubicacionTecnica]), des=valor(r[mapaColumnas.descripcion]), aviso=valor(r[mapaColumnas.aviso]);const texto=`${den} ${ubi} ${des}`;const unidad=unidadesAviso[aviso]||unidadesDenominacion[normalizarFrase(den)]||obtenerUnidad(texto);const tipoEquipo=tiposAviso[aviso]||obtenerTipoEquipo(den);return{fechaAviso:convertirFecha(r[mapaColumnas.fechaAviso]),claseAviso:valor(r[mapaColumnas.claseAviso]),aviso:aviso,orden:valor(r[mapaColumnas.orden]),descripcion:des,ubicacionTecnica:ubi,denominacionUbicacionTecnica:den,textoClasificacion:texto,unidad:unidad,estadoUnidad:unidad==='Sin clasificar'?'Revisar':'OK',tipoEquipo:tipoEquipo,estadoTipo:tipoEquipo==='Sin clasificar'?'Revisar':'OK',inicioAveria:ini?ini.toLocaleString('es-CL'):'',inicioAveriaFecha:ini,finAveria:fin?fin.toLocaleString('es-CL'):'',finAveriaFecha:fin,fechaEvento:ini||convertirFecha(r[mapaColumnas.fechaAviso]),duracionParada:numero(r[mapaColumnas.duracionParada])};});}
function obtenerUnidad(texto){const n=normalizar(texto);for(const r of [...reglasUsuario,...MAPEO_BASE.map(x=>({buscar:x[0],unidad:x[1]}))]) if(n.includes(normalizar(r.buscar))) return nombreUnidad(r.unidad); return 'Sin clasificar';}
function normalizarFrase(texto){return String(texto??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function contieneFraseCompleta(texto,frase){const base=` ${normalizarFrase(texto)} `,busqueda=normalizarFrase(frase);return Boolean(busqueda)&&base.includes(` ${busqueda} `);}
function obtenerTipoEquipo(denominacion){const frase=normalizarFrase(denominacion);if(!frase)return 'Sin clasificar';for(const tipo of [...TIPOS_BASE,...tiposUsuario])if(contieneFraseCompleta(frase,tipo))return tipo;for(const r of reglasTipoUsuario)if(normalizarFrase(r.buscar)===frase)return r.tipo;return 'Sin clasificar';}
function nombreUnidad(u){return normalizarUnidadGantt(u);}
function actualizarKPIs(){const all=construirDatosBase(datosOriginales);$('kEquipos').textContent=new Set(datosBase.map(r=>r.ubicacionTecnica).filter(Boolean)).size.toLocaleString('es-CL');$('kAvisos').textContent=new Set(datosBase.map(r=>r.aviso).filter(Boolean)).size.toLocaleString('es-CL');$('kSinClasificar').textContent=getPendientes().length.toLocaleString('es-CL');$('kTiposSinClasificar').textContent=getPendientesTipo().length.toLocaleString('es-CL');}

function getPendientes(){const all=construirDatosBase(datosOriginales).filter(r=>r.unidad==='Sin clasificar');const m=new Map();for(const r of all){const key=r.denominacionUbicacionTecnica||r.ubicacionTecnica||r.descripcion;if(!m.has(key))m.set(key,{equipo:key,ubicacion:r.ubicacionTecnica,descripcion:r.descripcion,texto:r.textoClasificacion,cantidad:0,avisos:[]});const pendiente=m.get(key);pendiente.cantidad++;if(r.aviso&&!pendiente.avisos.includes(r.aviso))pendiente.avisos.push(r.aviso);}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad);}
function abrirWizard(){pendientes=getPendientes();pendienteIndex=0;$('wizardClasificacion').classList.remove('hidden');renderWizard();}
function cerrarWizard(){$('wizardClasificacion').classList.add('hidden');aplicarFiltros();}
function renderWizard(){pendientes=getPendientes();if(!pendientes.length){$('wizardContenido').classList.add('hidden');$('wizardFinalizado').classList.remove('hidden');$('wizardProgreso').textContent='Finalizado';return;}$('wizardContenido').classList.remove('hidden');$('wizardFinalizado').classList.add('hidden');if(pendienteIndex>=pendientes.length)pendienteIndex=pendientes.length-1;const p=pendientes[pendienteIndex];$('wizardProgreso').textContent=`${pendienteIndex+1} de ${pendientes.length}`;$('wizardEquipo').textContent=p.equipo;$('wizardUbicacion').textContent=p.ubicacion||'-';$('wizardDescripcion').textContent=p.descripcion||'-';$('wizardCantidad').textContent=p.cantidad;llenarUnidades();$('boxNuevaUnidad').classList.add('hidden');$('wizardNuevaUnidad').value='';}
function llenarUnidades(){const select=$('wizardUnidad');const unidades=[...new Set([...UNIDADES_BASE,...unidadesUsuario])];select.innerHTML='<option value="">Seleccionar unidad</option>'+unidades.map(u=>`<option value="${u}">${nombreUnidad(u)}</option>`).join('')+'<option value="__NUEVA__">➕ Nueva unidad...</option>';}
function guardarWizard(){const p=pendientes[pendienteIndex];if(!p)return alert('No hay un equipo pendiente para guardar.');const selector=$('wizardUnidad');let unidad=selector.value;if(unidad==='__NUEVA__'){unidad=$('wizardNuevaUnidad').value.trim().toUpperCase();if(!unidad)return alert('Escribe el nombre de la nueva unidad.');if(!unidadesUsuario.includes(unidad)){unidadesUsuario.push(unidad);nombresUnidades[unidad]=unidad;localStorage.setItem(KEY_UNIDADES,JSON.stringify(unidadesUsuario));localStorage.setItem(KEY_NOMBRES,JSON.stringify(nombresUnidades));}}if(!unidad)return alert('Selecciona una unidad.');selector.disabled=true;$('btnGuardarSiguiente').disabled=true;try{const clave=normalizarFrase(p.equipo);unidadesDenominacion[clave]=unidad;for(const aviso of p.avisos||[])unidadesAviso[aviso]=unidad;localStorage.setItem(KEY_DEN_UNIDADES,JSON.stringify(unidadesDenominacion));localStorage.setItem(KEY_AVISO_UNIDADES,JSON.stringify(unidadesAviso));cargarFiltroUnidades();aplicarFiltros();pendientes=getPendientes();if(pendienteIndex>=pendientes.length)pendienteIndex=Math.max(0,pendientes.length-1);renderWizard();}catch(error){console.error(error);alert('No fue posible guardar la unidad. Intenta nuevamente.');}finally{selector.disabled=false;$('btnGuardarSiguiente').disabled=false;}}
function generarRegla(t){return String(t).split(' ').filter(Boolean).slice(0,6).join(' ');}

function obtenerListaTipos(){return [...new Set([...TIPOS_BASE,...tiposUsuario,...reglasTipoUsuario.map(r=>r.tipo)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));}
function cargarFiltroTipos(){const lista=$('listaTiposEquipo');if(lista)lista.innerHTML=['Sin clasificar',...obtenerListaTipos()].map(tipo=>`<option value="${escapeHtml(tipo)}"></option>`).join('');}
function getPendientesTipo({incluirOmitidos=true}={}){const all=construirDatosBase(datosOriginales).filter(r=>r.tipoEquipo==='Sin clasificar');const m=new Map();for(const r of all){const key=r.denominacionUbicacionTecnica||r.ubicacionTecnica||r.descripcion;if(!incluirOmitidos&&tiposOmitidosSesion.has(key))continue;if(!m.has(key))m.set(key,{equipo:key,ubicacion:r.ubicacionTecnica,descripcion:r.descripcion,cantidad:0,avisos:[]});const pendiente=m.get(key);pendiente.cantidad++;if(r.aviso&&!pendiente.avisos.includes(r.aviso))pendiente.avisos.push(r.aviso);}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad);}
function abrirWizardTipo(){tiposOmitidosSesion.clear();pendientesTipo=getPendientesTipo({incluirOmitidos:false});pendienteTipoIndex=0;$('wizardTipo').classList.remove('hidden');renderWizardTipo();}
function cerrarWizardTipo(){$('wizardTipo').classList.add('hidden');cargarFiltroTipos();aplicarFiltros();}
function renderWizardTipo(){pendientesTipo=getPendientesTipo({incluirOmitidos:false});if(!pendientesTipo.length){$('wizardTipoContenido').classList.add('hidden');$('wizardTipoFinalizado').classList.remove('hidden');$('wizardTipoProgreso').textContent='Revisión finalizada';return;}$('wizardTipoContenido').classList.remove('hidden');$('wizardTipoFinalizado').classList.add('hidden');if(pendienteTipoIndex>=pendientesTipo.length)pendienteTipoIndex=pendientesTipo.length-1;const p=pendientesTipo[pendienteTipoIndex];$('wizardTipoProgreso').textContent=`${pendienteTipoIndex+1} de ${pendientesTipo.length}`;$('wizardTipoEquipo').textContent=p.equipo;$('wizardTipoUbicacion').textContent=p.ubicacion||'-';$('wizardTipoDescripcion').textContent=p.descripcion||'-';$('wizardTipoCantidad').textContent=p.cantidad;llenarTipos();$('boxNuevoTipo').classList.add('hidden');$('wizardNuevoTipo').value='';}
function llenarTipos(){const select=$('wizardTipoSelect');select.innerHTML='<option value="">Seleccionar tipo</option>'+obtenerListaTipos().map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('')+'<option value="__NUEVO__">➕ Nuevo tipo...</option>';}
function guardarWizardTipo(){const p=pendientesTipo[pendienteTipoIndex];if(!p)return alert('No hay un tipo pendiente para guardar.');const selector=$('wizardTipoSelect');let tipo=selector.value;if(tipo==='__NUEVO__'){tipo=$('wizardNuevoTipo').value.trim().toUpperCase();if(!tipo)return alert('Escribe el nombre del nuevo tipo de equipo.');if(!tiposUsuario.includes(tipo))tiposUsuario.push(tipo);}if(!tipo)return alert('Selecciona un tipo de equipo.');selector.disabled=true;$('btnGuardarSiguienteTipo').disabled=true;try{const denominacion=normalizarFrase(p.equipo);reglasTipoUsuario=reglasTipoUsuario.filter(r=>normalizarFrase(r.buscar)!==denominacion);reglasTipoUsuario.unshift({buscar:p.equipo,tipo});for(const aviso of p.avisos||[])tiposAviso[aviso]=tipo;localStorage.setItem(KEY_TIPOS,JSON.stringify(tiposUsuario));localStorage.setItem(KEY_REGLAS_TIPO,JSON.stringify(reglasTipoUsuario));localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));cargarFiltroTipos();aplicarFiltros();pendientesTipo=getPendientesTipo({incluirOmitidos:false});if(pendienteTipoIndex>=pendientesTipo.length)pendienteTipoIndex=Math.max(0,pendientesTipo.length-1);renderWizardTipo();}catch(error){console.error(error);alert('No fue posible guardar el tipo de equipo. Intenta nuevamente.');}finally{selector.disabled=false;$('btnGuardarSiguienteTipo').disabled=false;}}
function omitirWizardTipo(){const p=pendientesTipo[pendienteTipoIndex];if(!p)return;tiposOmitidosSesion.add(p.equipo);renderWizardTipo();}

function obtenerListaUnidades(){
  const unidades = new Set();

  construirDatosBase(datosOriginales).forEach(r=>{
    if(r.unidad && r.unidad !== 'Sin clasificar') unidades.add(r.unidad);
  });

  bloquesLYD.forEach(b=>unidades.add(nombreUnidad(b.unidad)));
  unidadesUsuario.forEach(u=>unidades.add(nombreUnidad(u)));

  return [...unidades].sort((a,b)=>a.localeCompare(b,'es'));
}

function cargarFiltroUnidades(){
  const actual = $('unidadFiltro')?.value || '';
  const actualConf = $('confUnidadFiltro')?.value || '';
  const unidades = obtenerListaUnidades();
  $('unidadFiltro').innerHTML = '<option value="">Todas</option>' +
    unidades.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
  if($('confUnidadFiltro'))$('confUnidadFiltro').innerHTML = '<option value="">Todas</option>' +
    unidades.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');

  if(unidades.includes(actual)) $('unidadFiltro').value = actual;
  if(unidades.includes(actualConf)) $('confUnidadFiltro').value = actualConf;
}

function analizarConfiabilidadAutomaticamente(){
  const equipo=$('confBuscarEquipo').value.trim();
  const coincidenciaExacta=listaEquipos.some(e=>normalizar(e)===normalizar(equipo));
  if(coincidenciaExacta)analizarConfiabilidad({silencioso:true});
  else limpiarResultadosConfiabilidad();
}

function analizarConfiabilidad({silencioso=false}={}){
  const equipo=$('confBuscarEquipo').value.trim();
  if(!equipo){limpiarResultadosConfiabilidad();return;}
  if(!datosOriginales.length){
    if(!silencioso)alert('Los datos SAP todavía no están disponibles.');
    return;
  }
  const desde=$('confDesde').value?new Date($('confDesde').value+'T00:00:00'):null;
  const hasta=$('confHasta').value?new Date($('confHasta').value+'T23:59:59'):null;
  if(desde&&hasta&&desde>hasta){
    limpiarResultadosConfiabilidad();
    if(!silencioso)alert('La fecha desde no puede ser posterior a la fecha hasta.');
    return;
  }
  const unidad=$('confUnidadFiltro').value;
  const equipoNormalizado=normalizar(equipo);
  const registrosEquipo=construirDatosBase(datosOriginales).filter(r=>{
    const equipoRegistro=r.denominacionUbicacionTecnica||r.ubicacionTecnica;
    const fecha=r.inicioAveriaFecha||r.fechaAviso;
    return normalizar(equipoRegistro)===equipoNormalizado &&
      (!unidad||r.unidad===unidad) &&
      (!desde||!fecha||fecha>=desde) &&
      (!hasta||!fecha||fecha<=hasta);
  });
  const registros=registrosEquipo
    .filter(r=>normalizar(r.claseAviso)==='z2'&&r.inicioAveriaFecha)
    .sort((a,b)=>a.inicioAveriaFecha-b.inicioAveriaFecha);
  const periodosZ1=registrosEquipo.filter(esPeriodoZ1FueraOperacion);
  const fechaCorte=obtenerFechaCorteAnalisis(hasta);
  const kpis=calcularKpisConfiabilidad(registros,periodosZ1,fechaCorte);
  window.datosConfiabilidad=kpis.filas;
  window.periodosZ1Confiabilidad=periodosZ1;
  $('confEquipo').textContent=equipo;
  $('confUnidad').textContent=unidad||([...new Set(registros.map(r=>r.unidad))].join(', ')||'-');
  $('confFallas').textContent=new Set(registros.map(r=>r.aviso).filter(Boolean)).size.toLocaleString('es-CL');
  $('confMtbf').textContent=kpis.mtbf==null?'--':`${fmtN(kpis.mtbf)} h`;
  $('confMttr').textContent=kpis.mttr==null?'--':`${fmtN(kpis.mttr)} h`;
  $('confDisponibilidad').textContent=kpis.disponibilidad==null?'--':`${fmtN(kpis.disponibilidad)} %`;
  $('kDisponibilidad').textContent=kpis.disponibilidad==null?'--':`${fmtN(kpis.disponibilidad)} %`;
  renderCronologiaConfiabilidad(kpis.filas,kpis.periodoActual);
}

function limpiarResultadosConfiabilidad(){
  window.datosConfiabilidad=[];
  window.periodosZ1Confiabilidad=[];
  $('confEquipo').textContent='-';
  $('confUnidad').textContent='-';
  $('confFallas').textContent='0';
  $('confMtbf').textContent='--';
  $('confMttr').textContent='--';
  $('confDisponibilidad').textContent='--';
  $('kDisponibilidad').textContent='--';
  $('confBody').innerHTML='<tr><td colspan="7">Busque o seleccione un equipo para calcular sus indicadores.</td></tr>';
}

function construirCronologiaConfiabilidad(registros,periodosZ1=[]){
  return registros.map((registro,i)=>{
    const finAnterior=i>0?registros[i-1].finAveriaFecha:null;
    const diferencia=finAnterior?(registro.inicioAveriaFecha-finAnterior)/3600000:null;
    const horasCalendario=diferencia!=null&&diferencia>=0?diferencia:null;
    const horasNoOperativas=horasCalendario==null?null:Math.min(horasCalendario,calcularHorasNoOperativas(finAnterior,registro.inicioAveriaFecha,registro.unidad,periodosZ1));
    const horasOperativas=horasCalendario==null?null:Math.max(0,horasCalendario-horasNoOperativas);
    return{...registro,finAveriaAnterior:finAnterior,horasCalendario,horasNoOperativas,horasOperativas};
  });
}

function obtenerFechaCorteAnalisis(hasta){
  const ahora=new Date();
  return hasta&&hasta<ahora?hasta:ahora;
}

function calcularKpisConfiabilidad(registros,periodosZ1=[],fechaCorte=new Date()){
  const filas=construirCronologiaConfiabilidad(registros,periodosZ1);
  const intervalosMtbf=filas.filter(f=>Number.isFinite(f.horasOperativas));
  const ultimaFalla=registros.at(-1);
  const inicioPeriodoActual=ultimaFalla?.finAveriaFecha;
  let horasOperacionActual=null;
  let periodoActual=null;
  if(inicioPeriodoActual&&fechaCorte&&fechaCorte>inicioPeriodoActual){
    const horasCalendarioActual=(fechaCorte-inicioPeriodoActual)/3600000;
    const horasNoOperativasActual=Math.min(
      horasCalendarioActual,
      calcularHorasNoOperativas(inicioPeriodoActual,fechaCorte,ultimaFalla.unidad,periodosZ1)
    );
    horasOperacionActual=Math.max(0,horasCalendarioActual-horasNoOperativasActual);
    periodoActual={
      inicio:inicioPeriodoActual,
      fin:fechaCorte,
      horasCalendario:horasCalendarioActual,
      horasNoOperativas:horasNoOperativasActual,
      horasOperativas:horasOperacionActual
    };
  }
  const horasMtbf=intervalosMtbf.reduce((s,f)=>s+f.horasOperativas,0)+(horasOperacionActual??0);
  const cantidadIntervalos=intervalosMtbf.length+(horasOperacionActual==null?0:1);
  const mtbf=cantidadIntervalos?horasMtbf/cantidadIntervalos:null;
  const mttr=calcularMttr(registros);
  return{filas,mtbf,mttr,horasOperacionActual,periodoActual,disponibilidad:calcularDisponibilidad(mtbf,mttr)};
}

function renderRankingUnidad(){
  const panel=$('rankingUnidad'),unidad=$('confUnidadFiltro').value;
  if(!panel)return;
  if(!unidad||!datosOriginales.length){
    panel.classList.add('hidden');
    $('rankingBody').innerHTML='';
    return;
  }
  const desde=$('confDesde').value?new Date($('confDesde').value+'T00:00:00'):null;
  const hasta=$('confHasta').value?new Date($('confHasta').value+'T23:59:59'):null;
  const fechaCorte=obtenerFechaCorteAnalisis(hasta);
  if(desde&&hasta&&desde>hasta){panel.classList.add('hidden');return;}
  const grupos=new Map();
  construirDatosBase(datosOriginales)
    .filter(r=>{
      const fecha=r.inicioAveriaFecha||r.fechaAviso;
      return r.unidad===unidad&&(!desde||!fecha||fecha>=desde)&&(!hasta||!fecha||fecha<=hasta);
    })
    .forEach(r=>{
      const equipo=r.denominacionUbicacionTecnica||r.ubicacionTecnica;
      if(!equipo)return;
      if(!grupos.has(equipo))grupos.set(equipo,[]);
      grupos.get(equipo).push(r);
    });
  const ranking=[...grupos].map(([equipo,registrosEquipo])=>{
    const fallas=registrosEquipo
      .filter(r=>normalizar(r.claseAviso)==='z2'&&r.inicioAveriaFecha)
      .sort((a,b)=>a.inicioAveriaFecha-b.inicioAveriaFecha);
    const periodosZ1=registrosEquipo.filter(esPeriodoZ1FueraOperacion);
    const kpis=calcularKpisConfiabilidad(fallas,periodosZ1,fechaCorte);
    return{equipo,fallas:new Set(fallas.map(r=>r.aviso).filter(Boolean)).size,...kpis};
  }).sort((a,b)=>{
    const da=Number.isFinite(a.disponibilidad)?a.disponibilidad:-Infinity;
    const db=Number.isFinite(b.disponibilidad)?b.disponibilidad:-Infinity;
    return db-da||(Number.isFinite(b.mtbf)?b.mtbf:-Infinity)-(Number.isFinite(a.mtbf)?a.mtbf:-Infinity)||a.equipo.localeCompare(b.equipo,'es');
  });
  $('rankingTitulo').textContent=`Ranking de disponibilidad — ${unidad}`;
  $('rankingCantidad').textContent=`${ranking.length.toLocaleString('es-CL')} equipos`;
  $('rankingBody').innerHTML=ranking.length?ranking.map((r,i)=>`
    <tr class="ranking-equipo-row" role="button" tabindex="0" title="Ver detalle de ${escapeHtml(r.equipo)}" data-equipo="${escapeHtml(r.equipo)}" onclick="seleccionarEquipoRanking(this.dataset.equipo)" onkeydown="if(event.key==='Enter')seleccionarEquipoRanking(this.dataset.equipo)">
      <td>${i+1}</td>
      <td>${escapeHtml(r.equipo)}</td>
      <td>${r.fallas.toLocaleString('es-CL')}</td>
      <td>${r.mtbf==null?'--':`${fmtN(r.mtbf)} h`}</td>
      <td>${r.mttr==null?'--':`${fmtN(r.mttr)} h`}</td>
      <td>${r.disponibilidad==null?'--':`${fmtN(r.disponibilidad)} %`}</td>
    </tr>
  `).join(''):'<tr><td colspan="6">No hay equipos para la unidad y período seleccionados.</td></tr>';
  panel.classList.remove('hidden');
}

function seleccionarEquipoRanking(equipo){
  $('confBuscarEquipo').value=equipo;
  analizarConfiabilidad({silencioso:true});
  const detalle=$('detalleEquipo');
  if(detalle)detalle.scrollIntoView({behavior:'smooth',block:'start'});
}

function esPeriodoZ1FueraOperacion(registro){
  return normalizar(registro.claseAviso)==='z1' &&
    registro.duracionParada>0 &&
    registro.inicioAveriaFecha &&
    registro.finAveriaFecha &&
    registro.finAveriaFecha>registro.inicioAveriaFecha;
}

function calcularMttr(registros){
  const reparaciones=registros
    .filter(r=>r.inicioAveriaFecha&&r.finAveriaFecha&&r.finAveriaFecha>=r.inicioAveriaFecha)
    .map(r=>(r.finAveriaFecha-r.inicioAveriaFecha)/3600000);
  return reparaciones.length?reparaciones.reduce((s,h)=>s+h,0)/reparaciones.length:null;
}

function calcularDisponibilidad(mtbf,mttr){
  if(!Number.isFinite(mtbf)||!Number.isFinite(mttr)||mtbf+mttr<=0)return null;
  return mtbf/(mtbf+mttr)*100;
}

function calcularHorasNoOperativas(inicio,fin,unidad,periodosZ1=[]){
  if(!inicio||!fin||fin<=inicio)return 0;
  const intervalosLYD=bloquesLYD
    .filter(b=>normalizar(nombreUnidad(b.unidad))===normalizar(unidad))
    .map(b=>{
      const finInclusivo=new Date(b.fin.getTime()+86400000);
      return[inicio>b.inicio?inicio:b.inicio,fin<finInclusivo?fin:finInclusivo];
    });
  const intervalosZ1=periodosZ1
    .filter(r=>normalizar(r.unidad)===normalizar(unidad))
    .map(r=>[
      inicio>r.inicioAveriaFecha?inicio:r.inicioAveriaFecha,
      fin<r.finAveriaFecha?fin:r.finAveriaFecha
    ]);
  const intervalos=[...intervalosLYD,...intervalosZ1].filter(([a,z])=>z>a).sort((a,b)=>a[0]-b[0]);
  if(!intervalos.length)return 0;
  const unidos=[];
  intervalos.forEach(([a,z])=>{
    const ultimo=unidos[unidos.length-1];
    if(!ultimo||a>ultimo[1])unidos.push([a,z]);
    else if(z>ultimo[1])ultimo[1]=z;
  });
  return unidos.reduce((s,[a,z])=>s+(z-a)/3600000,0);
}

function renderCronologiaConfiabilidad(filas,periodoActual=null){
  if(!filas.length){
    $('confBody').innerHTML='<tr><td colspan="7">No se encontraron avisos Z2 con inicio de avería para los filtros seleccionados.</td></tr>';
    return;
  }
  const filasFallas=filas.map(f=>`
    <tr>
      <td><span class="copyable" role="button" tabindex="0" title="Clic para copiar" onclick="copiarTexto(this,'${escapeHtml(f.aviso||'-')}')" onkeydown="if(event.key==='Enter')copiarTexto(this,'${escapeHtml(f.aviso||'-')}')">${escapeHtml(f.aviso||'-')}</span></td>
      <td>${escapeHtml(f.inicioAveria||'-')}</td>
      <td>${escapeHtml(f.finAveria||'-')}</td>
      <td>${f.finAveriaAnterior?escapeHtml(f.finAveriaAnterior.toLocaleString('es-CL')):'--'}</td>
      <td>${f.horasCalendario==null?'--':fmtN(f.horasCalendario)}</td>
      <td>${f.horasNoOperativas==null?'--':fmtN(f.horasNoOperativas)}</td>
      <td>${f.horasOperativas==null?'--':fmtN(f.horasOperativas)}</td>
    </tr>
  `).join('');
  const filaPeriodoActual=periodoActual?`
    <tr class="periodo-operacion-actual">
      <td colspan="2"><strong>En operaci&oacute;n actualmente</strong><small>Tiempo incluido en el MTBF</small></td>
      <td><small>Fecha de corte</small>${escapeHtml(periodoActual.fin.toLocaleString('es-CL'))}</td>
      <td><small>Desde el fin de la &uacute;ltima aver&iacute;a</small>${escapeHtml(periodoActual.inicio.toLocaleString('es-CL'))}</td>
      <td>${fmtN(periodoActual.horasCalendario)}</td>
      <td>${fmtN(periodoActual.horasNoOperativas)}</td>
      <td><strong>${fmtN(periodoActual.horasOperativas)}</strong></td>
    </tr>
  `:'';
  $('confBody').innerHTML=filasFallas+filaPeriodoActual;
}

let edicionUnidades = {};

function renderTablaUnidades(){
  if(!$('tablaUnidades')) return;

  const unidades = obtenerListaUnidades();

  $('tablaUnidades').querySelector('thead').innerHTML = `
    <tr>
      <th>Unidad</th>
      <th>Editar</th>
    </tr>
  `;

  $('tablaUnidades').querySelector('tbody').innerHTML = unidades.length
    ? unidades.map((unidad, i)=>`
      <tr>
        <td>
          <div id="unidad_texto_${i}" class="unidad-display">${escapeHtml(unidad)}</div>
          <input id="unidad_input_${i}" class="unidad-edit-input hidden"
                 value="${escapeHtml(unidad)}"
                 data-original="${escapeHtml(unidad)}">
        </td>
        <td>
          <button class="edit-pencil" onclick="editarUnidad(${i})" title="Editar nombre">✏️</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="2">No hay unidades para mostrar</td></tr>';

  $('btnGuardarUnidades').disabled = true;
}

function editarUnidad(indice){
  const texto = $('unidad_texto_' + indice);
  const input = $('unidad_input_' + indice);
  if(!texto || !input) return;

  texto.classList.add('hidden');
  input.classList.remove('hidden');
  input.focus();
  input.select();

  input.oninput = ()=>{
    edicionUnidades[input.dataset.original] = input.value.trim();
    $('btnGuardarUnidades').disabled = false;
  };
}

function guardarTodosNombresUnidades(){
  const cambios = Object.entries(edicionUnidades)
    .filter(([original,nuevo])=>nuevo && nuevo !== original);

  if(!cambios.length){
    alert('No hay cambios pendientes.');
    return;
  }

  cambios.forEach(([original,nuevo])=>{
    // Actualiza cualquier clave que actualmente muestre el nombre original
    Object.keys(nombresUnidades).forEach(clave=>{
      if(nombreUnidad(clave) === original || clave === original){
        nombresUnidades[clave] = nuevo;
      }
    });

    // Si no existía una clave propia, crea una equivalencia directa
    if(!Object.keys(nombresUnidades).some(clave=>clave===original || nombresUnidades[clave]===nuevo)){
      nombresUnidades[original] = nuevo;
    }

    // Actualiza reglas creadas por el usuario que guarden ese nombre
    reglasUsuario.forEach(regla=>{
      if(nombreUnidad(regla.unidad) === original || regla.unidad === original){
        regla.unidad = nuevo;
      }
    });

    const idx = unidadesUsuario.indexOf(original);
    if(idx >= 0) unidadesUsuario[idx] = nuevo;
  });

  localStorage.setItem(KEY_NOMBRES, JSON.stringify(nombresUnidades));
  localStorage.setItem(KEY_REGLAS, JSON.stringify(reglasUsuario));
  localStorage.setItem(KEY_UNIDADES, JSON.stringify([...new Set(unidadesUsuario)]));

  edicionUnidades = {};
  cargarFiltroUnidades();
  aplicarFiltros();
  renderTablaUnidades();
  setEstado('Validado','ok',`Se guardaron ${cambios.length} cambio(s) de unidad correctamente.`);
}

function escapeHtml(texto){
  return String(texto ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function detectarColumnas(cols){const c=cols.map(x=>({original:x,key:normalizar(x)}));return{fechaAviso:buscar(c,['fechadeaviso','fechaaviso']),claseAviso:buscar(c,['clasedeaviso','claseaviso']),aviso:buscarExact(c,['aviso']),orden:buscar(c,['orden','numeroorden','ordensap']),descripcion:buscar(c,['descripcion','descripciondelaviso','textoaviso']),ubicacionTecnica:buscarExact(c,['ubicaciontecnica']),denominacionUbicacionTecnica:buscar(c,['denominaciondelaubicaciontecnica','denominacionubicaciontecnica','denominaciondelubicaciontecnica']),inicioFecha:buscarExact(c,['iniciodeaveria','inicioaveria']),inicioHora:buscar(c,['iniciodeaveriahora','inicioaveriahora','hora inicio averia']),finFecha:buscarExact(c,['findeaveria','finaveria']),finHora:buscar(c,['findelaaveriahora','findeaveriahora','finaveriahora','hora fin averia']),duracionParada:buscar(c,['duraciondeparada','duracionparada'])};}
function buscar(cols,ps){for(const p0 of ps){const p=normalizar(p0);const e=cols.find(c=>c.key.includes(p)||p.includes(c.key));if(e)return e.original;}return null;}
function buscarExact(cols,ps){for(const p0 of ps){const p=normalizar(p0),e=cols.find(c=>c.key===p);if(e)return e.original;}return buscar(cols,ps);}
function cargarListaEquipos(rows){
  listaEquipos=[...new Set(
    construirDatosBase(rows)
      .map(r=>r.denominacionUbicacionTecnica||r.ubicacionTecnica)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'es'));
}
const buscadoresEquipos=[];
function configurarBuscadorEquipos(inputId,sugerenciasId,botonId,acciones={}){
  const input=$(inputId),contenedor=$(sugerenciasId),boton=$(botonId);
  if(!input||!contenedor)return;
  const estado={seleccion:-1,resultados:[],ocultar(){contenedor.style.display='none';contenedor.innerHTML='';}};
  buscadoresEquipos.push(estado);
  const marcarSeleccion=()=>{
    [...contenedor.children].forEach((item,i)=>item.classList.toggle('selected',i===estado.seleccion));
    const elegido=contenedor.children[estado.seleccion];
    if(elegido)elegido.scrollIntoView({block:'nearest'});
  };
  const seleccionar=i=>{
    if(i<0||i>=estado.resultados.length)return;
    const equipo=estado.resultados[i];
    if(acciones.seleccionMultiple){
      if(equiposSeleccionados.has(equipo))equiposSeleccionados.delete(equipo);
      else equiposSeleccionados.add(equipo);
      const busquedaActual=input.value;
      renderEquiposSeleccionados();
      mostrar(busquedaActual);
    }else{
      input.value=equipo;
      estado.ocultar();
    }
    if(acciones.alSeleccionar)acciones.alSeleccionar();
  };
  const mostrar=texto=>{
    const clave=normalizar(texto);
    estado.resultados=(clave?listaEquipos.filter(e=>normalizar(e).includes(clave)):listaEquipos).slice(0,100);
    estado.seleccion=estado.resultados.length?0:-1;
    contenedor.innerHTML='';
    if(!estado.resultados.length){
      const vacio=document.createElement('div');
      vacio.className='suggestion-empty';
      vacio.textContent='Sin coincidencias';
      contenedor.appendChild(vacio);
    }else{
      estado.resultados.forEach((equipo,i)=>{
        const item=document.createElement('div');
        item.className='suggestion-item';
        if(acciones.seleccionMultiple){
          item.setAttribute('role','option');
          item.setAttribute('aria-selected',String(equiposSeleccionados.has(equipo)));
          if(equiposSeleccionados.has(equipo))item.classList.add('is-picked');
        }
        item.textContent=equipo;
        item.onmouseenter=()=>{estado.seleccion=i;marcarSeleccion();};
        item.onmousedown=e=>e.preventDefault();
        item.onclick=()=>seleccionar(i);
        contenedor.appendChild(item);
      });
    }
    contenedor.style.display='block';
    marcarSeleccion();
  };
  input.oninput=()=>{mostrar(input.value.trim());if(acciones.alEscribir)acciones.alEscribir();};
  input.onfocus=()=>mostrar(input.value.trim());
  input.onkeydown=e=>{
    if(e.key!=='ArrowDown'&&e.key!=='ArrowUp'&&e.key!=='Enter'&&e.key!=='Escape')return;
    if(e.key==='Escape'){estado.ocultar();return;}
    e.preventDefault();
    if(contenedor.style.display!=='block')mostrar(input.value.trim());
    if(!estado.resultados.length)return;
    if(e.key==='Enter'){seleccionar(estado.seleccion);return;}
    const paso=e.key==='ArrowDown'?1:-1;
    estado.seleccion=(estado.seleccion+paso+estado.resultados.length)%estado.resultados.length;
    marcarSeleccion();
  };
  if(boton)boton.onclick=()=>{input.focus();mostrar('');};
}
function ocultarBuscadoresEquipos(){buscadoresEquipos.forEach(b=>b.ocultar());}
function renderEquiposSeleccionados(){
  const contenedor=$('equiposSeleccionados');
  if(!contenedor)return;
  contenedor.innerHTML='';
  equiposSeleccionados.forEach(equipo=>{
    const chip=document.createElement('span');
    chip.className='equipment-chip';
    const texto=document.createElement('span');
    texto.textContent=equipo;
    const quitar=document.createElement('button');
    quitar.type='button';
    quitar.setAttribute('aria-label',`Quitar ${equipo}`);
    quitar.textContent='\u00d7';
    quitar.onclick=()=>{equiposSeleccionados.delete(equipo);renderEquiposSeleccionados();aplicarFiltros();};
    chip.append(texto,quitar);
    contenedor.appendChild(chip);
  });
  if(equiposSeleccionados.size>1){
    const limpiar=document.createElement('button');
    limpiar.type='button';
    limpiar.className='clear-equipment';
    limpiar.textContent='Limpiar grupo';
    limpiar.onclick=()=>{equiposSeleccionados.clear();renderEquiposSeleccionados();aplicarFiltros();};
    contenedor.appendChild(limpiar);
  }
}
function renderTablaBase(base){
  $('tablaBase').querySelector('thead').innerHTML=`
    <tr>
      <th>Fecha aviso</th>
      <th>Clase aviso</th>
      <th>Aviso</th>
      <th>Descripción</th>
      <th>Ubicación técnica</th>
      <th>Denominación ubicación técnica</th>
      <th>Tipo de equipo</th>
      <th>Unidad</th>
      <th>Inicio avería</th>
      <th>Fin avería</th>
      <th>Duración parada</th>
    </tr>
  `;

  $('tablaBase').querySelector('tbody').innerHTML=base.length
    ? base.map(r=>`
      <tr class="${r.unidad==='Sin clasificar'?'fila-sin-clasificar':''} ${r.tipoEquipo==='Sin clasificar'?'fila-tipo-sin-clasificar':''}">
        <td>${fmtF(r.fechaAviso)}</td>
        <td>${r.claseAviso}</td>
        <td><span class="copyable" onclick="copiarTexto(this,'${r.aviso}')">${r.aviso}</span></td>
        <td class="descripcion">${r.descripcion}</td>
        <td>${r.ubicacionTecnica}</td>
        <td>${r.denominacionUbicacionTecnica}</td>
        <td>
          <div class="aviso-unidad">
            <span class="tipo-badge ${r.tipoEquipo==='Sin clasificar'?'pending':''}">${escapeHtml(r.tipoEquipo)}</span>
            <button type="button" class="edit-pencil aviso-unidad-editar" title="Cambiar tipo de equipo" data-aviso="${escapeHtml(r.aviso)}" data-tipo="${escapeHtml(r.tipoEquipo)}" onclick="editarTipoAviso(this)">✏️</button>
          </div>
        </td>
        <td>
          <div class="aviso-unidad">
            <span>${escapeHtml(r.unidad)}</span>
            <button type="button" class="edit-pencil aviso-unidad-editar" title="Cambiar unidad del aviso" data-aviso="${escapeHtml(r.aviso)}" data-unidad="${escapeHtml(r.unidad)}" onclick="editarUnidadAviso(this)">✏️</button>
          </div>
        </td>
        <td>${r.inicioAveria}</td>
        <td>${r.finAveria}</td>
        <td>${fmtN(r.duracionParada)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="11">No hay datos</td></tr>';
}

function editarTipoAviso(boton){
  const aviso=boton.dataset.aviso,actual=boton.dataset.tipo,celda=boton.closest('td');
  const selector=document.createElement('select');
  selector.className='unidad-aviso-select';
  selector.innerHTML='<option value="__AUTO__">Clasificación automática</option><option value="No aplica">Omitir / no aplica</option>'+
    [...new Set([...obtenerListaTipos(),actual,'Sin clasificar'])].sort((a,b)=>a.localeCompare(b,'es')).map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('');
  selector.value=tiposAviso[aviso]||'__AUTO__';
  selector.onchange=()=>{
    if(selector.value==='__AUTO__')delete tiposAviso[aviso];
    else tiposAviso[aviso]=selector.value;
    localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));
    cargarFiltroTipos();
    aplicarFiltros();
  };
  celda.innerHTML='';
  celda.appendChild(selector);
  selector.focus();
}

function editarUnidadAviso(boton){
  const aviso=boton.dataset.aviso,actual=boton.dataset.unidad,celda=boton.closest('td');
  const selector=document.createElement('select');
  selector.className='unidad-aviso-select';
  const automatica=document.createElement('option');
  automatica.value='__AUTO__';
  automatica.textContent='Clasificación automática';
  selector.appendChild(automatica);
  [...new Set([...obtenerListaUnidades(),actual,'Sin clasificar'])].sort((a,b)=>a.localeCompare(b,'es')).forEach(unidad=>{
    const opcion=document.createElement('option');
    opcion.value=unidad;
    opcion.textContent=unidad;
    selector.appendChild(opcion);
  });
  selector.value=unidadesAviso[aviso]||'__AUTO__';
  selector.onchange=()=>{
    if(selector.value==='__AUTO__')delete unidadesAviso[aviso];
    else unidadesAviso[aviso]=selector.value;
    localStorage.setItem(KEY_AVISO_UNIDADES,JSON.stringify(unidadesAviso));
    cargarFiltroUnidades();
    aplicarFiltros();
    analizarConfiabilidadAutomaticamente();
    renderRankingUnidad();
  };
  celda.innerHTML='';
  celda.appendChild(selector);
  selector.focus();
}

function extraerBloquesLYD(m){const out=[];if(!m.length)return out;const maxCols=Math.max(...m.slice(0,10).map(f=>f.length));for(let c=1;c<maxCols;c++){let unidad='';for(let r=0;r<Math.min(10,m.length);r++){const v=m[r]?.[c];if(v&& !convertirFecha(v)){unidad=String(v);break;}}if(!unidad)continue;let ini=null,fin=null;for(let r=1;r<m.length;r++){const f=convertirFecha(m[r]?.[0]);if(!f)continue;const is=normalizar(m[r]?.[c]).includes('lyd');if(is&&!ini){ini=f;fin=f}else if(is){fin=f}else if(ini){out.push(crearBloque(unidad,ini,fin));ini=null;fin=null}}if(ini)out.push(crearBloque(unidad,ini,fin));}return out;}
function normalizarUnidadGantt(unidad){
  const n=normalizar(unidad);

  const equivalencias=[
    ['alev','ALEVINAJE'],
    ['alevinaje','ALEVINAJE'],
    ['ff','FF2'],
    ['ff2','FF2'],
    ['hat','HATCHERY'],
    ['hatchery','HATCHERY'],
    ['pre','PRE SMOLT'],
    ['presmolt','PRE SMOLT'],
    ['pre smolt','PRE SMOLT'],
    ['filtrado','FILTRADO'],
    ['riles','RILES'],
    ['ap','AGUA POTABLE'],
    ['agua potable','AGUA POTABLE'],
    ['generadores','GENERADORES'],
    ['generador','GENERADORES']
  ];

  const encontrada=equivalencias.find(([codigo])=>n===normalizar(codigo));
  return encontrada ? encontrada[1] : String(unidad||'').toUpperCase();
}

function crearBloque(unidad,inicio,fin){
  const dias=Math.round((fin-inicio)/86400000)+1;
  return{
    unidad:normalizarUnidadGantt(unidad),
    inicio,
    fin,
    dias,
    horas:dias*24
  };
}
function renderTablaLYD(b){
  const contenedor=$('ganttLYD');
  $('filasLYD').textContent=b.length.toLocaleString('es-CL');
  if(!b.length){
    contenedor.innerHTML='<div class="gantt-vacio">No hay per&iacute;odos L&amp;D detectados</div>';
    return;
  }

  const bloques=[...b].sort((a,z)=>nombreUnidad(a.unidad).localeCompare(nombreUnidad(z.unidad),'es')||a.inicio-z.inicio);
  const fechaMinima=new Date(Math.min(...bloques.map(x=>x.inicio)));
  const fechaMaxima=new Date(Math.max(...bloques.map(x=>x.fin)));
  const inicioEje=new Date(fechaMinima.getFullYear(),fechaMinima.getMonth(),1);
  const finEje=new Date(fechaMaxima.getFullYear(),fechaMaxima.getMonth()+1,1);
  const totalMs=finEje-inicioEje;
  const meses=[];
  for(let fecha=new Date(inicioEje);fecha<finEje;fecha=new Date(fecha.getFullYear(),fecha.getMonth()+1,1)){
    const siguiente=new Date(fecha.getFullYear(),fecha.getMonth()+1,1);
    meses.push({
      etiqueta:fecha.toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.',''),
      izquierda:(fecha-inicioEje)/totalMs*100,
      ancho:(siguiente-fecha)/totalMs*100
    });
  }
  const anchoLinea=Math.max(1200,meses.length*140);
  const unidades=[...new Set(bloques.map(x=>nombreUnidad(x.unidad)))];
  const colorUnidad=new Map(unidades.map((unidad,i)=>[unidad,i%6]));
  const ahora=new Date();
  const posicionHoy=ahora>=inicioEje&&ahora<finEje?(ahora-inicioEje)/totalMs*100:null;
  const grillaMeses=meses.map(m=>`<span class="gantt-linea-mes" style="left:${m.izquierda}%"></span>`).join('');
  const ejeMeses=meses.map(m=>`<span style="left:${m.izquierda}%;width:${m.ancho}%">${escapeHtml(m.etiqueta)}</span>`).join('');
  const lineaHoy=posicionHoy==null?'':`<span class="gantt-hoy" style="left:${posicionHoy}%"><i>Hoy</i></span>`;
  const filas=bloques.map(x=>{
    const unidad=nombreUnidad(x.unidad);
    const izquierda=(x.inicio-inicioEje)/totalMs*100;
    const ancho=Math.max((new Date(x.fin.getFullYear(),x.fin.getMonth(),x.fin.getDate()+1)-x.inicio)/totalMs*100,.35);
    const titulo=`${unidad}: ${fmtF(x.inicio)} al ${fmtF(x.fin)} · ${x.dias} días · ${x.horas.toLocaleString('es-CL')} h`;
    return `<div class="gantt-fila">
      <div class="gantt-unidad"><strong>${escapeHtml(unidad)}</strong><small>${fmtF(x.inicio)} — ${fmtF(x.fin)}</small></div>
      <div class="gantt-pista" style="width:${anchoLinea}px">
        ${grillaMeses}${lineaHoy}
        <div class="gantt-barra gantt-color-${colorUnidad.get(unidad)}" style="left:${izquierda}%;width:${ancho}%" title="${escapeHtml(titulo)}">
          <span>${x.dias} d&iacute;as</span><small>${x.horas.toLocaleString('es-CL')} h</small>
        </div>
      </div>
    </div>`;
  }).join('');
  contenedor.innerHTML=`<div class="gantt-tablero" style="--ancho-linea:${anchoLinea}px">
    <div class="gantt-cabecera">
      <div class="gantt-esquina">Unidad / per&iacute;odo</div>
      <div class="gantt-eje" style="width:${anchoLinea}px">${ejeMeses}</div>
    </div>
    ${filas}
  </div>`;
}
function unirFechaHora(fv,hv){const f=convertirFecha(fv);if(!f)return null;const h=convertirHora(hv);return new Date(f.getFullYear(),f.getMonth(),f.getDate(),h.horas,h.minutos,h.segundos);}
function convertirFecha(v){if(!v)return null;if(v instanceof Date&&!isNaN(v))return v;if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000);const s=String(v).trim(),m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);const f=new Date(s);return isNaN(f)?null:f;}
function convertirHora(v){if(!v)return{horas:0,minutos:0,segundos:0};if(v instanceof Date&&!isNaN(v))return{horas:v.getHours(),minutos:v.getMinutes(),segundos:v.getSeconds()};if(typeof v==='number'){const t=Math.round(v*86400);return{horas:Math.floor(t/3600)%24,minutos:Math.floor((t%3600)/60),segundos:t%60};}const m=String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?{horas:+m[1],minutos:+m[2],segundos:+(m[3]||0)}:{horas:0,minutos:0,segundos:0};}
function normalizar(t){return String(t??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function valor(v){return v==null?'':String(v)}function numero(v){if(v==null||v==='')return 0;if(typeof v==='number')return v;const n=Number(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n}
function fmtF(f){return f?f.toLocaleDateString('es-CL'):''}function fmtN(n){return Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:2})}
function setEstado(t,cls,d){if($('estadoValidacion')){$('estadoValidacion').textContent=t;$('estadoValidacion').className='status '+cls;}if($('validacionDetalle'))$('validacionDetalle').innerHTML=d;}
function mostrarError(msg){setEstado('Error','error',msg);}
