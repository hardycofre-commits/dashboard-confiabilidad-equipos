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
function celdaCopiable(valor){
  const texto=String(valor||'-');
  return `<span class="copyable" role="button" tabindex="0" title="Clic para copiar" data-copy="${escapeHtml(texto)}">${escapeHtml(texto)}</span>`;
}

const CONFIG={owner:'hardycofre-commits',repo:'dashboard-confiabilidad-equipos',branch:'main',folder:'datos'};
const FECHA_INICIO_CONFIABILIDAD=new Date(2025,0,1);
const UNIDADES_BASE=['HATCHERY','FF2','ALEVINAJE','PRE SMOLT','RILES','FILTRADO','GENERADORES','OTROS'];
const MAPEO_BASE=[['HATCHERY','HATCHERY'],['HAT','HATCHERY'],['FF2','FF2'],['FF','FF2'],['ALEVINAJE','ALEVINAJE'],['ALEV','ALEVINAJE'],['PRE-SMOLT','PRE SMOLT'],['PRE SMOLT','PRE SMOLT'],['PRESMOLT','PRE SMOLT'],['RILES','RILES'],['FILTRADO','FILTRADO'],['FILTRO','FILTRADO'],['GEN','GENERADORES'],['GENERADOR','GENERADORES']];
const TIPOS_BASE=['BOMBA','ESTANQUE','TRICKING'];
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
let datosOriginales=[], datosBase=[], bloquesLYD=[], planAnual=[], archivoPlanAnual='', mapaColumnas={}, ordenesZ1PorPlan=new Map(), listaEquipos=[], palabrasDescripcion=[], pendientes=[], pendienteIndex=0;
const registrosSeleccionados=new Map();
const actividadesPlanSeleccionadas=new Map();
let pendientesTipo=[], pendienteTipoIndex=0;
const tiposOmitidosSesion=new Set();
const equiposSeleccionados=new Set();
let ordenFecha='asc';
let rankingCampoOrden='disponibilidad',rankingDireccionOrden='desc',rankingMinimizado=true;
let estadoPlanSeleccionado='';
let estadoAvisoSeleccionado='';
const $=id=>document.getElementById(id);

document.addEventListener('DOMContentLoaded',()=>{
  migrarTiposAgrupados();
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
  $('btnCopiarSeleccionados').onclick=copiarRegistrosSeleccionados;
  $('btnCopiarPlanSeleccionados').onclick=copiarPlanSeleccionados;
  $('cardSinClasificar').onclick=abrirWizard;
  $('cardTiposSinClasificar').onclick=abrirWizardTipo;
  configurarMacroAvisos('cardAvisos','');
  configurarMacroAvisos('cardAvisosCerrados','CERRADO');
  configurarMacroAvisos('cardAvisosTratamiento','EN TRATAMIENTO');
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
  configurarBuscadorDescripcion();
  $('busquedaUbicacion').oninput=()=>{completarEquipoDesdeUbicacionResumen();aplicarFiltros();};
  configurarBuscadorEquipos('confBuscarEquipo','sugerenciasEquipoConf','btnAbrirEquiposConf',{
    alEscribir:analizarConfiabilidadAutomaticamente,
    alSeleccionar:analizarConfiabilidadAutomaticamente,
    incluirTodos:true
  });
  $('confBuscarUbicacion').oninput=()=>{completarEquipoDesdeUbicacionConfiabilidad();analizarConfiabilidadAutomaticamente();};
  document.addEventListener('click',e=>{if(!e.target.closest('.search-field'))ocultarBuscadoresEquipos();});
  if($('confUnidadFiltro'))$('confUnidadFiltro').onchange=()=>{
    rankingMinimizado=true;
    analizarConfiabilidadAutomaticamente();
    renderRankingUnidad();
  };
  if($('btnToggleRanking'))$('btnToggleRanking').onclick=toggleRanking;
  document.querySelectorAll('.ranking-sort-btn').forEach(boton=>boton.onclick=()=>cambiarOrdenRanking(boton.dataset.campo,boton.dataset.direccion));
  ['confDesde','confHasta'].forEach(id=>{
    if($(id))$(id).onchange=()=>{
      analizarConfiabilidadAutomaticamente();
      renderRankingUnidad();
    };
  });

  $('btnOrdenAsc').onclick=()=>cambiarOrdenFecha('asc');
  $('btnOrdenDesc').onclick=()=>cambiarOrdenFecha('desc');
  $('unidadFiltro').onchange=aplicarFiltros;
  $('tipoFiltro').onchange=aplicarFiltros;
  $('claseAvisoFiltro').onchange=aplicarFiltros;
  $('btnGuardarUnidades').onclick=guardarTodosNombresUnidades;
  if($('planBuscar'))$('planBuscar').oninput=renderPlanAnual;
  if($('planUbicacion'))$('planUbicacion').oninput=()=>{completarEquipoDesdeUbicacionPlan();renderPlanAnual();};
  if($('planMes'))$('planMes').onchange=renderPlanAnual;
  document.querySelectorAll('.plan-kpi-filter').forEach(kpi=>{
    kpi.onclick=()=>cambiarFiltroEstadoPlan(kpi.dataset.estado);
    kpi.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cambiarFiltroEstadoPlan(kpi.dataset.estado);}};
  });
  if($('btnLimpiarPlan'))$('btnLimpiarPlan').onclick=()=>{$('planBuscar').value='';$('planUbicacion').value='';$('planMes').value='';estadoPlanSeleccionado='';renderPlanAnual();};
}
function cambiarVista(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
  document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
  if(v==='unidades'){$('viewUnidades').classList.remove('hidden');renderTablaUnidades();}
  else if(v==='confiabilidad'){
    $('viewConfiabilidad').classList.remove('hidden');
    rankingMinimizado=true;
    cargarFiltroUnidades();
    analizarConfiabilidadAutomaticamente();
    renderRankingUnidad();
  } else if(v==='gantt'){
    $('viewGantt').classList.remove('hidden');
  } else if(v==='plan-anual'){
    $('viewPlanAnual').classList.remove('hidden');
    renderPlanAnual();
  } else {$('viewResumen').classList.remove('hidden');}
  document.querySelector(`.menu-item[data-view="${v}"]`).classList.add('active');
}
function configurarFechas(){if($('confDesde'))$('confDesde').value='2025-01-01';if($('confHasta'))$('confHasta').value='2026-12-31';}
async function cargarDesdeGitHub(){
 try{
  setEstado('Buscando','warning','Consultando carpeta datos/ en GitHub...');
  const archivos=await listarArchivosDatos(), sap=selUlt(archivos,esSAP), gantt=selUlt(archivos,esGantt), plan=selUlt(archivos,esPlanAnual);
  if(!sap) throw new Error('No se encontró archivo SAP/EXPORT en carpeta datos.');
  await cargarSAP(sap); if(gantt) await cargarGantt(gantt); else renderTablaLYD([]); if(plan) await cargarPlanAnual(plan); else renderPlanAnual();
  $('txtLectura').textContent=new Date().toLocaleString('es-CL');
  setEstado('Validado','ok',`SAP: ${sap.name}<br>Gantt: ${gantt?gantt.name:'No encontrado'}<br>Plan anual: ${plan?plan.name:'No encontrado'}<br>Clasificaciones guardadas: ${reglasUsuario.length}`);
 }catch(e){mostrarError(e.message);console.error(e);}
}
async function listarArchivosDatos(){const r=await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}&t=${Date.now()}`); if(!r.ok)throw new Error('No fue posible leer carpeta datos desde GitHub.'); return r.json();}
function esSAP(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&(n.includes('sap')||n.includes('export'))&&!n.includes('gantt')&&!esPlanAnual(i);}
function esGantt(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&n.includes('gantt');}
function esPlanAnual(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&n.includes('plan')&&(n.includes('anual')||n.includes('mantencion')||n.includes('mantenimiento'));}
function selUlt(arr,f){const x=arr.filter(f).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));return x[x.length-1];}
async function cargarSAP(a){$('kArchivo').textContent=a.name;$('txtArchivo').textContent=a.name;const rows=await leerExcel(a.download_url,'json');mapaColumnas=detectarColumnas(Object.keys(rows[0]||{}));ordenesZ1PorPlan=construirOrdenesZ1(rows);datosOriginales=rows.filter(r=>valor(r[mapaColumnas.orden]).trim()!=='');$('txtRegistros').textContent=`${rows.length.toLocaleString('es-CL')} registros SAP leídos`;cargarListaEquipos(rows);cargarFiltroUnidades();cargarFiltroTipos();aplicarFiltros();}
async function cargarGantt(a){$('kArchivoGantt').textContent=a.name;$('txtGantt').textContent=a.name;const m=await leerExcel(a.download_url,'array');bloquesLYD=extraerBloquesLYD(m);renderTablaLYD(bloquesLYD);renderTablaUnidades();}
async function cargarPlanAnual(a){archivoPlanAnual=a.name;const rows=await leerExcel(a.download_url,'json');planAnual=rows.map(normalizarFilaPlan).filter(x=>(x.fecha||x.equipo||x.plan)&&(x.estado!=='Vencido'||x.orden.trim()!==''));cargarMesesPlan();renderPlanAnual();}
async function leerExcel(url,modo){const r=await fetch(url+'?v='+Date.now());if(!r.ok)throw new Error('No fue posible descargar archivo.');const b=await r.arrayBuffer(), wb=XLSX.read(b,{type:'array',cellDates:true}), sh=wb.Sheets[wb.SheetNames[0]];return modo==='array'?XLSX.utils.sheet_to_json(sh,{header:1,defval:''}):XLSX.utils.sheet_to_json(sh,{defval:''});}

function normalizarFilaPlan(r){
  const get=(...nombres)=>{const clave=Object.keys(r).find(k=>nombres.includes(normalizar(k)));return clave?r[clave]:'';};
  const fecha=convertirFecha(get('fechaplanificada'));
  const status=valor(get('statordentrega','statusorden','estado'));
  const completado=normalizar(status).includes('concluido');
  const ubicacion=valor(get('ubicaciontecnica'));
  const plan=valor(get('txtplanmantenim','textoplanmantenimiento'));
  const ordenOriginal=valor(get('orden')).trim();
  const ordenZ1=completado?ordenesZ1PorPlan.get(`${normalizar(plan)}|${normalizar(ubicacion)}`)?.orden||'':'';
  const hoy=new Date();hoy.setHours(23,59,59,999);
  return{fecha,status,estado:completado?'Completado':(fecha&&fecha<hoy?'Vencido':'Pendiente'),equipo:valor(get('denominaciondelaubicaciontecnica','denominacionubicaciontecnica')),ubicacion,plan,operacion:valor(get('textobreveoperacion')),orden:ordenOriginal||ordenZ1,ordenRecuperada:!ordenOriginal&&!!ordenZ1,trabajo:numero(get('trabajo')),unidadTrabajo:valor(get('unidaddetrabajo'))};
}
function configurarMacroAvisos(id,estado){
  const card=$(id);
  const activar=()=>{estadoAvisoSeleccionado=estado&&estadoAvisoSeleccionado===estado?'':estado;aplicarFiltros();};
  card.onclick=activar;
  card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activar();}};
}

function construirOrdenesZ1(rows){
  const mapa=new Map();
  rows.forEach((r,i)=>{
    if(normalizar(r[mapaColumnas.claseAviso])!=='z1')return;
    const orden=valor(r[mapaColumnas.orden]).trim(),descripcion=valor(r[mapaColumnas.descripcion]),ubicacion=valor(r[mapaColumnas.ubicacionTecnica]);
    if(!orden||!descripcion||!ubicacion)return;
    const clave=`${normalizar(descripcion)}|${normalizar(ubicacion)}`;
    const fecha=convertirFecha(r[mapaColumnas.fechaAviso]);
    const candidato={orden,fecha:fecha?.getTime()??-Infinity,aviso:numero(r[mapaColumnas.aviso]),i};
    const actual=mapa.get(clave);
    if(!actual||candidato.fecha>actual.fecha||(candidato.fecha===actual.fecha&&candidato.aviso>actual.aviso)||(candidato.fecha===actual.fecha&&candidato.aviso===actual.aviso&&i>actual.i))mapa.set(clave,candidato);
  });
  return mapa;
}
function claveOrden(orden){return normalizarFrase(orden).replace(/\s+/g,'');}
function obtenerOrdenesCerradasSAP(){
  return new Set(construirDatosBase(datosOriginales).filter(r=>r.estadoAviso==='CERRADO'&&r.orden).map(r=>claveOrden(r.orden)).filter(Boolean));
}
function obtenerPlanActualizadoConSAP(){
  const cerradas=obtenerOrdenesCerradasSAP();
  return planAnual.map(x=>{
    const cerradoSAP=Boolean(x.orden&&cerradas.has(claveOrden(x.orden)));
    return cerradoSAP?{...x,estado:'Completado',cerradoSAP:true}:x;
  });
}
function cargarMesesPlan(){
  const meses=[...new Set(obtenerPlanActualizadoConSAP().filter(x=>x.fecha).map(x=>`${x.fecha.getFullYear()}-${String(x.fecha.getMonth()+1).padStart(2,'0')}`))].sort();
  $('planMes').innerHTML='<option value="">Todos los meses</option>'+meses.map(m=>{const [a,n]=m.split('-');const t=new Date(+a,+n-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'});return `<option value="${m}">${t}</option>`;}).join('');
}
function cambiarFiltroEstadoPlan(estado){
  estadoPlanSeleccionado=estadoPlanSeleccionado===estado?'':estado;
  renderPlanAnual();
}
function renderPlanAnual(){
  if(!$('tablaPlan'))return;
  const planVigente=obtenerPlanActualizadoConSAP(),actualizadasSAP=planVigente.filter(x=>x.cerradoSAP).length;
  const total=planVigente.length,completados=planVigente.filter(x=>x.estado==='Completado').length,pendientes=planVigente.filter(x=>x.estado==='Pendiente').length,vencidos=planVigente.filter(x=>x.estado==='Vencido').length;
  const avance=total?Math.round(completados/total*100):0;
  $('planAvance').textContent=$('planAvanceCabecera').textContent=`${avance}%`;$('planCompletado').textContent=completados.toLocaleString('es-CL');$('planPendiente').textContent=pendientes.toLocaleString('es-CL');$('planVencido').textContent=vencidos.toLocaleString('es-CL');$('planConteoAvance').textContent=`${completados.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')} actividades`;$('planProgressBar').style.width=`${avance}%`;$('planFuente').textContent=archivoPlanAnual?`Fuente: ${archivoPlanAnual}. ${actualizadasSAP.toLocaleString('es-CL')} actividades marcadas como realizadas según el SAP de Resumen.`:'No se encontró un archivo de plan anual en datos/.';
  document.querySelectorAll('.plan-kpi-filter').forEach(b=>{const activo=b.dataset.estado===estadoPlanSeleccionado;b.classList.toggle('active',activo);b.setAttribute('aria-pressed',String(activo));});
  const texto=normalizar($('planBuscar').value),ubicacion=normalizar($('planUbicacion').value),mes=$('planMes').value,estado=estadoPlanSeleccionado;
  const filtradas=planVigente.filter(x=>(!texto||[x.equipo,x.plan,x.operacion,x.orden].some(v=>normalizar(v).includes(texto)))&&(!ubicacion||normalizar(x.ubicacion).includes(ubicacion))&&(!mes||`${x.fecha?.getFullYear()}-${String((x.fecha?.getMonth()??-1)+1).padStart(2,'0')}`===mes)&&(!estado||x.estado===estado)).sort((a,b)=>(a.fecha||0)-(b.fecha||0));
  $('planFilas').textContent=`${filtradas.length.toLocaleString('es-CL')} filas`;$('planContexto').textContent=(texto||ubicacion||mes||estado)?'Resultados según los filtros aplicados':'Todas las actividades del plan anual';
  const tbody=$('tablaPlan').querySelector('tbody');
  tbody.innerHTML=filtradas.length?filtradas.map(x=>`<tr><td class="seleccionar-col"><input type="checkbox" class="seleccionar-plan" data-clave="${escapeHtml(claveActividadPlan(x))}" aria-label="Seleccionar actividad ${escapeHtml(x.equipo||x.plan||'-')}" ${actividadesPlanSeleccionadas.has(claveActividadPlan(x))?'checked':''}></td><td>${fmtF(x.fecha)}</td><td><span class="plan-status ${normalizar(x.estado)}">${x.estado}</span></td><td>${celdaCopiable(x.orden)}</td><td>${celdaCopiable(x.equipo)}</td><td class="descripcion">${escapeHtml(x.plan||'-')}</td><td class="descripcion">${escapeHtml(x.operacion||'-')}</td><td>${celdaCopiable(x.ubicacion)}</td></tr>`).join(''):'<tr><td colspan="8">No hay actividades que coincidan con la búsqueda.</td></tr>';
  const porClavePlan=new Map(filtradas.map(x=>[claveActividadPlan(x),x]));
  const checksPlan=[...tbody.querySelectorAll('.seleccionar-plan')];
  checksPlan.forEach(check=>check.onchange=()=>{
    const actividad=porClavePlan.get(check.dataset.clave);
    if(check.checked&&actividad)actividadesPlanSeleccionadas.set(check.dataset.clave,actividad);else actividadesPlanSeleccionadas.delete(check.dataset.clave);
    actualizarSeleccionPlan(checksPlan);
  });
  const seleccionarTodosPlan=$('seleccionarTodosPlan');
  if(seleccionarTodosPlan)seleccionarTodosPlan.onchange=()=>checksPlan.forEach(check=>{if(check.checked!==seleccionarTodosPlan.checked){check.checked=seleccionarTodosPlan.checked;check.onchange();}});
  actualizarSeleccionPlan(checksPlan);
  tbody.querySelectorAll('.copyable').forEach(el=>{
    const copiar=()=>copiarTexto(el,el.dataset.copy);
    el.onclick=copiar;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();copiar();}};
  });
}

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

  const descripcionBuscada=normalizar($('busquedaDescripcion').value);
  if(descripcionBuscada){
    base=base.filter(r=>normalizar(r.descripcion).includes(descripcionBuscada));
  }

  const txt=normalizar($('busquedaEquipo').value);
  const ubicacionBuscada=normalizar($('busquedaUbicacion').value);
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
  if(ubicacionBuscada){
    base=base.filter(r=>normalizar(r.ubicacionTecnica).includes(ubicacionBuscada));
    $('txtFiltro').textContent='Ubicación técnica: '+$('busquedaUbicacion').value;
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
  const claseAviso=normalizar($('claseAvisoFiltro').value);
  if(claseAviso){
    base=base.filter(r=>normalizar(r.claseAviso)===claseAviso);
    $('txtFiltro').textContent=`Clase de aviso: ${claseAviso.toLocaleUpperCase('es-CL')}`;
  }
  if(descripcionBuscada)$('txtFiltro').textContent=`Descripción: ${$('busquedaDescripcion').value}`;

  actualizarKPIs(base);
  if(estadoAvisoSeleccionado){
    base=base.filter(r=>r.estadoAviso===estadoAvisoSeleccionado);
    $('txtFiltro').textContent=`Estado: ${estadoAvisoSeleccionado}`;
  }

  base=ordenarRegistrosPorFecha(base);
  datosBase=base;
  renderTablaBase(base.slice(0,300));
  renderTablaUnidades();
  $('filasBase').textContent=`${base.length.toLocaleString('es-CL')} filas`;
}

function claveActividadPlan(x){return `${x.fecha?.getTime()||''}|${x.equipo||''}|${x.ubicacion||''}|${x.plan||''}|${x.operacion||''}|${x.orden||''}`;}
function actualizarSeleccionPlan(checks=[...document.querySelectorAll('.seleccionar-plan')]){
  const todos=$('seleccionarTodosPlan');
  if(todos){todos.checked=checks.length>0&&checks.every(x=>x.checked);todos.indeterminate=checks.some(x=>x.checked)&&!todos.checked;}
  const boton=$('btnCopiarPlanSeleccionados'),cantidad=actividadesPlanSeleccionadas.size;
  boton.textContent=`Copiar seleccionados (${cantidad.toLocaleString('es-CL')})`;
  boton.disabled=!cantidad;
}
async function copiarPlanSeleccionados(){
  const seleccionadas=[...actividadesPlanSeleccionadas.values()];
  if(!seleccionadas.length)return;
  const limpiar=v=>String(v??'').replace(/[\t\r\n]+/g,' ').trim();
  const filas=seleccionadas.map(x=>[fmtF(x.fecha),x.estado,x.orden,x.equipo,x.plan,x.operacion,x.ubicacion]);
  const texto=filas.map(f=>f.map(limpiar).join('\t')).join('\n');
  let copiado=false;
  if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(texto);copiado=true;}catch(error){}}
  if(!copiado){const auxiliar=document.createElement('textarea');auxiliar.value=texto;auxiliar.style.position='fixed';auxiliar.style.opacity='0';document.body.appendChild(auxiliar);auxiliar.select();try{copiado=document.execCommand('copy');}catch(error){}auxiliar.remove();}
  const boton=$('btnCopiarPlanSeleccionados'),original=boton.textContent;
  boton.textContent=copiado?'Copiado para Excel':'No se pudo copiar';
  setTimeout(()=>{boton.textContent=original;},1200);
}
function claveRegistroBase(r){return `${r.aviso}|${r.orden}|${r.descripcion}|${r.fechaAviso?.getTime()||''}`;}
function actualizarBotonSeleccionados(){
  const boton=$('btnCopiarSeleccionados'),cantidad=registrosSeleccionados.size;
  boton.textContent=`Copiar seleccionados (${cantidad.toLocaleString('es-CL')})`;
  boton.disabled=!cantidad;
}
async function copiarRegistrosSeleccionados(){
  const seleccionados=[...registrosSeleccionados.values()];
  if(!seleccionados.length)return;
  const limpiar=v=>String(v??'').replace(/[\t\r\n]+/g,' ').trim();
  const filas=seleccionados.map(r=>[
    fmtF(r.fechaAviso),r.claseAviso,r.aviso,r.statusSistema,r.estadoAviso,r.orden,r.descripcion,
    r.ubicacionTecnica,r.denominacionUbicacionTecnica,r.tipoEquipo,r.unidad,
    r.estadoUnidad,r.estadoTipo,r.inicioAveria,r.finAveria,r.duracionParada
  ]);
  const texto=filas.map(f=>f.map(limpiar).join('\t')).join('\n');
  let copiado=false;
  if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(texto);copiado=true;}catch(error){}}
  if(!copiado){const auxiliar=document.createElement('textarea');auxiliar.value=texto;auxiliar.style.position='fixed';auxiliar.style.opacity='0';document.body.appendChild(auxiliar);auxiliar.select();try{copiado=document.execCommand('copy');}catch(error){}auxiliar.remove();}
  const boton=$('btnCopiarSeleccionados'),original=boton.textContent;
  boton.textContent=copiado?'Copiado para Excel':'No se pudo copiar';
  setTimeout(()=>{boton.textContent=original;},1200);
}
function construirDatosBase(rows){return rows.filter(r=>valor(r[mapaColumnas.orden]).trim()!=='').map(r=>{const ini=unirFechaHora(r[mapaColumnas.inicioFecha],r[mapaColumnas.inicioHora]), fin=unirFechaHora(r[mapaColumnas.finFecha],r[mapaColumnas.finHora]);const den=valor(r[mapaColumnas.denominacionUbicacionTecnica]), ubi=valor(r[mapaColumnas.ubicacionTecnica]), des=valor(r[mapaColumnas.descripcion]).toLocaleUpperCase('es-CL'), aviso=valor(r[mapaColumnas.aviso]), statusSistema=valor(r[mapaColumnas.statusSistema]);const texto=`${den} ${ubi} ${des}`;const unidad=unidadesAviso[aviso]||unidadesDenominacion[normalizarFrase(den)]||obtenerUnidad(texto);const tipoEquipo=obtenerTipoEquipo(den,tiposAviso[aviso]);return{fechaAviso:convertirFecha(r[mapaColumnas.fechaAviso]),claseAviso:valor(r[mapaColumnas.claseAviso]),aviso:aviso,statusSistema,estadoAviso:obtenerEstadoAviso(statusSistema),orden:valor(r[mapaColumnas.orden]),descripcion:des,ubicacionTecnica:ubi,denominacionUbicacionTecnica:den,textoClasificacion:texto,unidad:unidad,estadoUnidad:unidad==='Sin clasificar'?'Revisar':'OK',tipoEquipo:tipoEquipo,estadoTipo:tipoEquipo==='Sin clasificar'?'Revisar':'OK',inicioAveria:ini?ini.toLocaleString('es-CL'):'',inicioAveriaFecha:ini,finAveria:fin?fin.toLocaleString('es-CL'):'',finAveriaFecha:fin,fechaEvento:ini||convertirFecha(r[mapaColumnas.fechaAviso]),duracionParada:numero(r[mapaColumnas.duracionParada])};});}
function obtenerEstadoAviso(statusSistema){const codigos=normalizarFrase(statusSistema).split(' ');return codigos.includes('mece')?'CERRADO':'EN TRATAMIENTO';}
function obtenerUnidad(texto){const n=normalizar(texto);for(const r of [...reglasUsuario,...MAPEO_BASE.map(x=>({buscar:x[0],unidad:x[1]}))]) if(n.includes(normalizar(r.buscar))) return nombreUnidad(r.unidad); return 'Sin clasificar';}
function normalizarFrase(texto){return String(texto??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function contieneFraseCompleta(texto,frase){const base=` ${normalizarFrase(texto)} `,busqueda=normalizarFrase(frase);return Boolean(busqueda)&&base.includes(` ${busqueda} `);}
function normalizarNombreTipo(tipo){const nombre=String(tipo||'').trim(),clave=normalizarFrase(nombre);if(clave==='no aplica')return 'NO APLICA';if(clave.startsWith('estanque'))return 'ESTANQUE';if(clave.startsWith('bomba'))return 'BOMBA';return nombre;}
function migrarTiposAgrupados(){tiposUsuario=[...new Set(tiposUsuario.map(normalizarNombreTipo))].filter(tipo=>tipo&&!['ESTANQUE','BOMBA'].includes(tipo));reglasTipoUsuario=reglasTipoUsuario.map(r=>({...r,tipo:normalizarNombreTipo(r.tipo)}));tiposAviso=Object.fromEntries(Object.entries(tiposAviso).map(([aviso,tipo])=>[aviso,normalizarNombreTipo(tipo)]));localStorage.setItem(KEY_TIPOS,JSON.stringify(tiposUsuario));localStorage.setItem(KEY_REGLAS_TIPO,JSON.stringify(reglasTipoUsuario));localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));}
function obtenerTipoEquipo(denominacion,tipoManual=''){const frase=normalizarFrase(denominacion),manual=normalizarNombreTipo(tipoManual);if(!frase)return manual||'Sin clasificar';if(manual)return manual;const reglaExacta=reglasTipoUsuario.find(r=>normalizarFrase(r.buscar)===frase);if(reglaExacta)return normalizarNombreTipo(reglaExacta.tipo);if(contieneFraseCompleta(frase,'ESTANQUE'))return 'ESTANQUE';if(contieneFraseCompleta(frase,'BOMBA'))return 'BOMBA';for(const tipo of [...TIPOS_BASE,...tiposUsuario])if(contieneFraseCompleta(frase,tipo))return normalizarNombreTipo(tipo);return 'Sin clasificar';}
function nombreUnidad(u){return normalizarUnidadGantt(u);}
function actualizarKPIs(base=datosBase){
  const avisosUnicos=estado=>new Set(base.filter(r=>!estado||r.estadoAviso===estado).map(r=>r.aviso).filter(Boolean)).size;
  $('kEquipos').textContent=new Set(base.map(r=>r.ubicacionTecnica).filter(Boolean)).size.toLocaleString('es-CL');
  $('kAvisos').textContent=avisosUnicos('').toLocaleString('es-CL');
  $('kAvisosCerrados').textContent=avisosUnicos('CERRADO').toLocaleString('es-CL');
  $('kAvisosTratamiento').textContent=avisosUnicos('EN TRATAMIENTO').toLocaleString('es-CL');
  $('kSinClasificar').textContent=getPendientes().length.toLocaleString('es-CL');
  $('kTiposSinClasificar').textContent=getPendientesTipo().length.toLocaleString('es-CL');
  [['cardAvisos',''],['cardAvisosCerrados','CERRADO'],['cardAvisosTratamiento','EN TRATAMIENTO']].forEach(([id,estado])=>{
    const activa=estadoAvisoSeleccionado===estado;
    $(id).classList.toggle('active',activa);
    $(id).setAttribute('aria-pressed',String(activa));
  });
}

function getPendientes(){const all=construirDatosBase(datosOriginales).filter(r=>r.unidad==='Sin clasificar');const m=new Map();for(const r of all){const key=r.denominacionUbicacionTecnica||r.ubicacionTecnica||r.descripcion;if(!m.has(key))m.set(key,{equipo:key,ubicacion:r.ubicacionTecnica,descripcion:r.descripcion,texto:r.textoClasificacion,cantidad:0,avisos:[]});const pendiente=m.get(key);pendiente.cantidad++;if(r.aviso&&!pendiente.avisos.includes(r.aviso))pendiente.avisos.push(r.aviso);}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad);}
function abrirWizard(){pendientes=getPendientes();pendienteIndex=0;$('wizardClasificacion').classList.remove('hidden');renderWizard();}
function cerrarWizard(){$('wizardClasificacion').classList.add('hidden');aplicarFiltros();}
function renderWizard(){pendientes=getPendientes();if(!pendientes.length){$('wizardContenido').classList.add('hidden');$('wizardFinalizado').classList.remove('hidden');$('wizardProgreso').textContent='Finalizado';return;}$('wizardContenido').classList.remove('hidden');$('wizardFinalizado').classList.add('hidden');if(pendienteIndex>=pendientes.length)pendienteIndex=pendientes.length-1;const p=pendientes[pendienteIndex];$('wizardProgreso').textContent=`${pendienteIndex+1} de ${pendientes.length}`;$('wizardEquipo').textContent=p.equipo;$('wizardUbicacion').textContent=p.ubicacion||'-';$('wizardDescripcion').textContent=p.descripcion||'-';$('wizardCantidad').textContent=p.cantidad;llenarUnidades();$('boxNuevaUnidad').classList.add('hidden');$('wizardNuevaUnidad').value='';}
function llenarUnidades(){const select=$('wizardUnidad');const unidades=[...new Set([...UNIDADES_BASE,...unidadesUsuario])];select.innerHTML='<option value="">Seleccionar unidad</option>'+unidades.map(u=>`<option value="${u}">${nombreUnidad(u)}</option>`).join('')+'<option value="__NUEVA__">➕ Nueva unidad...</option>';}
function guardarWizard(){const p=pendientes[pendienteIndex];if(!p)return alert('No hay un equipo pendiente para guardar.');const selector=$('wizardUnidad');let unidad=selector.value;if(unidad==='__NUEVA__'){unidad=$('wizardNuevaUnidad').value.trim().toUpperCase();if(!unidad)return alert('Escribe el nombre de la nueva unidad.');if(!unidadesUsuario.includes(unidad)){unidadesUsuario.push(unidad);nombresUnidades[unidad]=unidad;localStorage.setItem(KEY_UNIDADES,JSON.stringify(unidadesUsuario));localStorage.setItem(KEY_NOMBRES,JSON.stringify(nombresUnidades));}}if(!unidad)return alert('Selecciona una unidad.');selector.disabled=true;$('btnGuardarSiguiente').disabled=true;try{const clave=normalizarFrase(p.equipo);unidadesDenominacion[clave]=unidad;for(const aviso of p.avisos||[])unidadesAviso[aviso]=unidad;localStorage.setItem(KEY_DEN_UNIDADES,JSON.stringify(unidadesDenominacion));localStorage.setItem(KEY_AVISO_UNIDADES,JSON.stringify(unidadesAviso));cargarFiltroUnidades();aplicarFiltros();analizarConfiabilidadAutomaticamente();renderRankingUnidad();pendientes=getPendientes();if(pendienteIndex>=pendientes.length)pendienteIndex=Math.max(0,pendientes.length-1);renderWizard();}catch(error){console.error(error);alert('No fue posible guardar la unidad. Intenta nuevamente.');}finally{selector.disabled=false;$('btnGuardarSiguiente').disabled=false;}}
function generarRegla(t){return String(t).split(' ').filter(Boolean).slice(0,6).join(' ');}

function obtenerListaTipos(){return [...new Set([...TIPOS_BASE,...tiposUsuario,...reglasTipoUsuario.map(r=>r.tipo)].map(normalizarNombreTipo))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));}
function cargarFiltroTipos(){
  const select=$('tipoFiltro');
  if(!select)return;
  const actual=select.value;
  const tipos=['Sin clasificar',...obtenerListaTipos()];
  select.innerHTML='<option value="">Todos</option>'+tipos.map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('');
  if(tipos.includes(actual))select.value=actual;
}
function getPendientesTipo({incluirOmitidos=true}={}){const all=construirDatosBase(datosOriginales).filter(r=>r.tipoEquipo==='Sin clasificar');const m=new Map();for(const r of all){const key=r.denominacionUbicacionTecnica||r.ubicacionTecnica||r.descripcion;if(!incluirOmitidos&&tiposOmitidosSesion.has(key))continue;if(!m.has(key))m.set(key,{equipo:key,ubicacion:r.ubicacionTecnica,descripcion:r.descripcion,cantidad:0,avisos:[]});const pendiente=m.get(key);pendiente.cantidad++;if(r.aviso&&!pendiente.avisos.includes(r.aviso))pendiente.avisos.push(r.aviso);}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad);}
function abrirWizardTipo(){tiposOmitidosSesion.clear();pendientesTipo=getPendientesTipo({incluirOmitidos:false});pendienteTipoIndex=0;$('wizardTipo').classList.remove('hidden');renderWizardTipo();}
function cerrarWizardTipo(){$('wizardTipo').classList.add('hidden');cargarFiltroTipos();aplicarFiltros();}
function renderWizardTipo(){pendientesTipo=getPendientesTipo({incluirOmitidos:false});if(!pendientesTipo.length){$('wizardTipoContenido').classList.add('hidden');$('wizardTipoFinalizado').classList.remove('hidden');$('wizardTipoProgreso').textContent='Revisión finalizada';return;}$('wizardTipoContenido').classList.remove('hidden');$('wizardTipoFinalizado').classList.add('hidden');if(pendienteTipoIndex>=pendientesTipo.length)pendienteTipoIndex=pendientesTipo.length-1;const p=pendientesTipo[pendienteTipoIndex];$('wizardTipoProgreso').textContent=`${pendienteTipoIndex+1} de ${pendientesTipo.length}`;$('wizardTipoEquipo').textContent=p.equipo;$('wizardTipoUbicacion').textContent=p.ubicacion||'-';$('wizardTipoDescripcion').textContent=p.descripcion||'-';$('wizardTipoCantidad').textContent=p.cantidad;llenarTipos();$('boxNuevoTipo').classList.add('hidden');$('wizardNuevoTipo').value='';}
function llenarTipos(){const select=$('wizardTipoSelect'),tipos=[...new Set(['NO APLICA',...obtenerListaTipos()])];select.innerHTML='<option value="">Seleccionar tipo</option>'+tipos.map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('')+'<option value="__NUEVO__">➕ Nuevo tipo...</option>';}
function guardarWizardTipo(){const p=pendientesTipo[pendienteTipoIndex];if(!p)return alert('No hay un tipo pendiente para guardar.');const selector=$('wizardTipoSelect');let tipo=selector.value;if(tipo==='__NUEVO__'){tipo=normalizarNombreTipo($('wizardNuevoTipo').value.trim().toUpperCase());if(!tipo)return alert('Escribe el nombre del nuevo tipo de equipo.');if(!TIPOS_BASE.includes(tipo)&&!tiposUsuario.includes(tipo))tiposUsuario.push(tipo);}if(!tipo)return alert('Selecciona un tipo de equipo.');tipo=normalizarNombreTipo(tipo);selector.disabled=true;$('btnGuardarSiguienteTipo').disabled=true;try{const denominacion=normalizarFrase(p.equipo);reglasTipoUsuario=reglasTipoUsuario.filter(r=>normalizarFrase(r.buscar)!==denominacion);reglasTipoUsuario.unshift({buscar:p.equipo,tipo});for(const aviso of p.avisos||[])tiposAviso[aviso]=tipo;localStorage.setItem(KEY_TIPOS,JSON.stringify(tiposUsuario));localStorage.setItem(KEY_REGLAS_TIPO,JSON.stringify(reglasTipoUsuario));localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));cargarFiltroTipos();aplicarFiltros();analizarConfiabilidadAutomaticamente();renderRankingUnidad();pendientesTipo=getPendientesTipo({incluirOmitidos:false});if(pendienteTipoIndex>=pendientesTipo.length)pendienteTipoIndex=Math.max(0,pendientesTipo.length-1);renderWizardTipo();}catch(error){console.error(error);alert('No fue posible guardar el tipo de equipo. Intenta nuevamente.');}finally{selector.disabled=false;$('btnGuardarSiguienteTipo').disabled=false;}}
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
  const ubicacion=$('confBuscarUbicacion').value.trim();
  const coincidenciaExacta=listaEquipos.some(e=>normalizar(e)===normalizar(equipo));
  const ubicacionExacta=construirDatosBase(datosOriginales).some(r=>normalizar(r.ubicacionTecnica)===normalizar(ubicacion));
  if(coincidenciaExacta||ubicacionExacta)analizarConfiabilidad({silencioso:true});
  else mostrarConfiabilidadTotal();
}

function fechaRegistroConfiabilidad(registro){return registro.inicioAveriaFecha||registro.fechaAviso||null;}
function dentroPeriodoConfiabilidad(registro){const fecha=fechaRegistroConfiabilidad(registro);return Boolean(fecha&&fecha>=FECHA_INICIO_CONFIABILIDAD);}
function tieneClasificacionConfiabilidad(registro){return Boolean(registro&&registro.tipoEquipo&&!['Sin clasificar','NO APLICA'].includes(registro.tipoEquipo));}

function calcularConfiabilidadTotal(base,fechaCorte=new Date()){
  const grupos=new Map();
  base.filter(tieneClasificacionConfiabilidad).forEach(r=>{
    const equipo=r.denominacionUbicacionTecnica||r.ubicacionTecnica;
    if(!equipo)return;
    if(!grupos.has(equipo))grupos.set(equipo,[]);
    grupos.get(equipo).push(r);
  });
  let horasOperativas=0,horasReparacion=0,intervalos=0,reparaciones=0,fallas=0,equipos=0;
  grupos.forEach(registrosEquipo=>{
    const registros=registrosEquipo.filter(r=>normalizar(r.claseAviso)==='z2'&&r.inicioAveriaFecha).sort((a,b)=>a.inicioAveriaFecha-b.inicioAveriaFecha);
    const periodosZ1=registrosEquipo.filter(esPeriodoZ1FueraOperacion),kpis=calcularKpisConfiabilidad(registros,periodosZ1,fechaCorte);
    if(!Number.isFinite(kpis.disponibilidad))return;
    equipos++;
    fallas+=new Set(registros.map(r=>r.aviso).filter(Boolean)).size;
    const intervalosEquipo=kpis.filas.filter(f=>Number.isFinite(f.horasOperativas));
    horasOperativas+=intervalosEquipo.reduce((s,f)=>s+f.horasOperativas,0)+(kpis.horasOperacionActual??0);
    intervalos+=intervalosEquipo.length+(kpis.horasOperacionActual==null?0:1);
    const reparacionesEquipo=registros.filter(r=>r.inicioAveriaFecha&&r.finAveriaFecha&&r.finAveriaFecha>=r.inicioAveriaFecha).map(r=>(r.finAveriaFecha-r.inicioAveriaFecha)/3600000);
    horasReparacion+=reparacionesEquipo.reduce((s,h)=>s+h,0);
    reparaciones+=reparacionesEquipo.length;
  });
  const mtbf=intervalos?horasOperativas/intervalos:null,mttr=reparaciones?horasReparacion/reparaciones:null;
  return{equipos,fallas,mtbf,mttr,disponibilidad:calcularDisponibilidad(mtbf,mttr)};
}

function mostrarConfiabilidadTotal(){
  if(!datosOriginales.length){limpiarResultadosConfiabilidad();return;}
  const unidad=$('confUnidadFiltro').value,base=construirDatosBase(datosOriginales).filter(r=>tieneClasificacionConfiabilidad(r)&&dentroPeriodoConfiabilidad(r)&&(!unidad||r.unidad===unidad));
  const total=calcularConfiabilidadTotal(base,new Date());
  $('confEquipo').textContent=`Todos los equipos (${total.equipos.toLocaleString('es-CL')})`;
  $('confUnidad').textContent=unidad||'Todas las unidades';
  $('confFallas').textContent=total.fallas.toLocaleString('es-CL');
  $('confMtbf').textContent=total.mtbf==null?'--':`${fmtN(total.mtbf)} h`;
  $('confMttr').textContent=total.mttr==null?'--':`${fmtN(total.mttr)} h`;
  $('confDisponibilidad').textContent=total.disponibilidad==null?'--':`${fmtN(total.disponibilidad)} %`;
  $('kDisponibilidad').textContent=total.disponibilidad==null?'--':`${fmtN(total.disponibilidad)} %`;
  $('historialConfiabilidad').classList.add('hidden');
  const puntos=construirDisponibilidadAcumuladaTotal(base,new Date());
  renderGraficoDisponibilidadPuntos(puntos,unidad?`Todos los equipos · ${unidad}`:'Todos los equipos');
}

function analizarConfiabilidad({silencioso=false}={}){
  const equipo=$('confBuscarEquipo').value.trim();
  const ubicacion=$('confBuscarUbicacion').value.trim();
  if(!equipo&&!ubicacion){limpiarResultadosConfiabilidad();return;}
  if(!datosOriginales.length){
    if(!silencioso)alert('Los datos SAP todavía no están disponibles.');
    return;
  }
  const desde=FECHA_INICIO_CONFIABILIDAD,hasta=null;
  const unidad=$('confUnidadFiltro').value;
  const equipoNormalizado=normalizar(equipo);
  const ubicacionNormalizada=normalizar(ubicacion);
  const registrosEquipo=construirDatosBase(datosOriginales).filter(r=>{
    const equipoRegistro=r.denominacionUbicacionTecnica||r.ubicacionTecnica;
    const fecha=r.inicioAveriaFecha||r.fechaAviso;
    return tieneClasificacionConfiabilidad(r)&&(!equipoNormalizado||normalizar(equipoRegistro)===equipoNormalizado)&&(!ubicacionNormalizada||normalizar(r.ubicacionTecnica)===ubicacionNormalizada) && fecha&&
      (!unidad||r.unidad===unidad) &&
      fecha>=desde &&
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
  const etiqueta=equipo||ubicacion;
  $('confEquipo').textContent=etiqueta;
  $('confUnidad').textContent=unidad||([...new Set(registros.map(r=>r.unidad))].join(', ')||'-');
  $('confFallas').textContent=new Set(registros.map(r=>r.aviso).filter(Boolean)).size.toLocaleString('es-CL');
  $('confMtbf').textContent=kpis.mtbf==null?'--':`${fmtN(kpis.mtbf)} h`;
  $('confMttr').textContent=kpis.mttr==null?'--':`${fmtN(kpis.mttr)} h`;
  $('confDisponibilidad').textContent=kpis.disponibilidad==null?'--':`${fmtN(kpis.disponibilidad)} %`;
  $('kDisponibilidad').textContent=kpis.disponibilidad==null?'--':`${fmtN(kpis.disponibilidad)} %`;
  $('historialConfiabilidad').classList.remove('hidden');
  renderGraficoDisponibilidadAcumulada(kpis.filas,kpis.periodoActual,etiqueta);
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
  $('graficoDisponibilidad').classList.add('hidden');
  $('graficoDisponibilidadSvg').innerHTML='';
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
  if(!datosOriginales.length){
    panel.classList.add('hidden');
    $('rankingBody').innerHTML='';
    return;
  }
  const desde=FECHA_INICIO_CONFIABILIDAD,hasta=null;
  const fechaCorte=obtenerFechaCorteAnalisis(hasta);
  const grupos=new Map();
  construirDatosBase(datosOriginales)
    .filter(r=>{
      const fecha=r.inicioAveriaFecha||r.fechaAviso;
      return tieneClasificacionConfiabilidad(r)&&Boolean(fecha)&&(!unidad||r.unidad===unidad)&&fecha>=desde&&(!hasta||fecha<=hasta);
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
    const conteoTipos=new Map();
    registrosEquipo.forEach(r=>conteoTipos.set(r.tipoEquipo,(conteoTipos.get(r.tipoEquipo)||0)+1));
    const tipoClasificado=[...conteoTipos].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'es'))[0]?.[0]||'Sin clasificar';
    return{equipo,tipoClasificado,fallas:new Set(fallas.map(r=>r.aviso).filter(Boolean)).size,...kpis};
  }).filter(r=>r.fallas>0&&Number.isFinite(r.mtbf)&&Number.isFinite(r.mttr)&&Number.isFinite(r.disponibilidad)).sort((a,b)=>{
    const diferencia=rankingDireccionOrden==='asc'?a[rankingCampoOrden]-b[rankingCampoOrden]:b[rankingCampoOrden]-a[rankingCampoOrden];
    return diferencia||a.equipo.localeCompare(b.equipo,'es');
  });
  $('rankingTitulo').textContent=`Ranking de disponibilidad — ${unidad||'TODOS LOS EQUIPOS'}`;
  $('rankingCantidad').textContent=`${ranking.length.toLocaleString('es-CL')} equipos`;
  $('rankingBody').innerHTML=ranking.length?ranking.map((r,i)=>`
    <tr class="ranking-equipo-row" role="button" tabindex="0" title="Ver detalle de ${escapeHtml(r.equipo)}" data-equipo="${escapeHtml(r.equipo)}" onclick="seleccionarEquipoRanking(this.dataset.equipo)" onkeydown="if(event.key==='Enter')seleccionarEquipoRanking(this.dataset.equipo)">
      <td>${i+1}</td>
      <td>${escapeHtml(r.equipo)}</td>
      <td class="ranking-classification-cell"><div class="ranking-classification"><span>${escapeHtml(r.tipoClasificado)}</span><button type="button" class="ranking-edit-classification" title="Modificar tipo de equipo" aria-label="Modificar tipo de equipo de ${escapeHtml(r.equipo)}" data-equipo="${escapeHtml(r.equipo)}" data-tipo="${escapeHtml(r.tipoClasificado)}" onclick="event.stopPropagation();editarClasificacionRanking(this)">✏️</button></div></td>
      <td>${r.fallas.toLocaleString('es-CL')}</td>
      <td>${r.mtbf==null?'--':`${fmtN(r.mtbf)} h`}</td>
      <td>${r.mttr==null?'--':`${fmtN(r.mttr)} h`}</td>
      <td>${r.disponibilidad==null?'--':`${fmtN(r.disponibilidad)} %`}</td>
    </tr>
  `).join(''):'<tr><td colspan="7">No hay equipos que coincidan con los filtros y tengan datos suficientes para calcular disponibilidad.</td></tr>';
  panel.classList.toggle('ranking-minimized',rankingMinimizado);
  $('btnToggleRanking').textContent=rankingMinimizado?'Mostrar ranking':'Minimizar ranking';
  document.querySelectorAll('.ranking-sort-btn').forEach(boton=>boton.classList.toggle('active',boton.dataset.campo===rankingCampoOrden&&boton.dataset.direccion===rankingDireccionOrden));
  panel.classList.remove('hidden');
}

function cambiarOrdenRanking(campo,direccion){
  rankingCampoOrden=campo;
  rankingDireccionOrden=direccion;
  rankingMinimizado=false;
  renderRankingUnidad();
}

function toggleRanking(){
  rankingMinimizado=!rankingMinimizado;
  const panel=$('rankingUnidad');
  panel.classList.toggle('ranking-minimized',rankingMinimizado);
  $('btnToggleRanking').textContent=rankingMinimizado?'Mostrar ranking':'Minimizar ranking';
}

function editarClasificacionRanking(boton){
  const equipo=boton.dataset.equipo,actual=boton.dataset.tipo,celda=boton.closest('td'),selector=document.createElement('select');
  selector.className='ranking-classification-select';
  const tipos=[...new Set([...obtenerListaTipos(),actual,'Sin clasificar'])].sort((a,b)=>a.localeCompare(b,'es'));
  selector.innerHTML=tipos.map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('');
  selector.value=actual;
  selector.onclick=evento=>evento.stopPropagation();
  selector.onkeydown=evento=>evento.stopPropagation();
  selector.onchange=()=>guardarClasificacionRanking(equipo,selector.value);
  celda.innerHTML='';celda.appendChild(selector);selector.focus();
}

function guardarClasificacionRanking(equipo,nuevoTipo){
  const claveEquipo=normalizarFrase(equipo),registrosEquipo=construirDatosBase(datosOriginales).filter(r=>normalizar(r.denominacionUbicacionTecnica||r.ubicacionTecnica)===normalizar(equipo));
  reglasTipoUsuario=reglasTipoUsuario.filter(r=>normalizarFrase(r.buscar)!==claveEquipo);
  reglasTipoUsuario.unshift({buscar:equipo,tipo:nuevoTipo});
  registrosEquipo.forEach(r=>{if(r.aviso)delete tiposAviso[r.aviso];});
  if(nuevoTipo!=='Sin clasificar'&&!TIPOS_BASE.includes(nuevoTipo)&&!tiposUsuario.includes(nuevoTipo))tiposUsuario.push(nuevoTipo);
  localStorage.setItem(KEY_REGLAS_TIPO,JSON.stringify(reglasTipoUsuario));
  localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));
  localStorage.setItem(KEY_TIPOS,JSON.stringify([...new Set(tiposUsuario)]));
  cargarFiltroTipos();
  aplicarFiltros();
  analizarConfiabilidadAutomaticamente();
  renderRankingUnidad();
}

function seleccionarEquipoRanking(equipo){
  $('confBuscarEquipo').value=equipo;
  $('confBuscarUbicacion').value='';
  analizarConfiabilidad({silencioso:true});
  rankingMinimizado=true;
  $('rankingUnidad').classList.add('ranking-minimized');
  $('btnToggleRanking').textContent='Mostrar ranking';
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

function construirDisponibilidadAcumulada(filas,periodoActual=null){
  const puntos=[];
  let horasOperativas=0,horasReparacion=0,intervalosOperativos=0,reparaciones=0;
  filas.forEach(f=>{
    if(Number.isFinite(f.horasOperativas)){horasOperativas+=f.horasOperativas;intervalosOperativos++;}
    if(f.inicioAveriaFecha&&f.finAveriaFecha&&f.finAveriaFecha>=f.inicioAveriaFecha){horasReparacion+=(f.finAveriaFecha-f.inicioAveriaFecha)/3600000;reparaciones++;}
    if(intervalosOperativos&&reparaciones){
      const mtbf=horasOperativas/intervalosOperativos,mttr=horasReparacion/reparaciones,disponibilidad=calcularDisponibilidad(mtbf,mttr);
      if(Number.isFinite(disponibilidad))puntos.push({fecha:f.finAveriaFecha||f.inicioAveriaFecha,disponibilidad,aviso:f.aviso});
    }
  });
  if(periodoActual&&Number.isFinite(periodoActual.horasOperativas)&&reparaciones){
    const mtbf=(horasOperativas+periodoActual.horasOperativas)/(intervalosOperativos+1),mttr=horasReparacion/reparaciones,disponibilidad=calcularDisponibilidad(mtbf,mttr);
    if(Number.isFinite(disponibilidad))puntos.push({fecha:periodoActual.fin,disponibilidad,aviso:'Actual'});
  }
  return puntos.filter(p=>p.fecha instanceof Date&&!isNaN(p.fecha));
}

function renderGraficoDisponibilidadAcumulada(filas,periodoActual,equipo){
  renderGraficoDisponibilidadPuntos(construirDisponibilidadAcumulada(filas,periodoActual),equipo);
}

function construirDisponibilidadAcumuladaTotal(base,fechaCorte=new Date()){
  const grupos=new Map(),eventos=[];
  base.filter(tieneClasificacionConfiabilidad).forEach(r=>{
    const equipo=r.denominacionUbicacionTecnica||r.ubicacionTecnica;
    if(!equipo)return;
    if(!grupos.has(equipo))grupos.set(equipo,[]);
    grupos.get(equipo).push(r);
  });
  grupos.forEach((registrosEquipo,equipo)=>{
    const registros=registrosEquipo.filter(r=>normalizar(r.claseAviso)==='z2'&&r.inicioAveriaFecha).sort((a,b)=>a.inicioAveriaFecha-b.inicioAveriaFecha);
    const periodosZ1=registrosEquipo.filter(esPeriodoZ1FueraOperacion),kpis=calcularKpisConfiabilidad(registros,periodosZ1,fechaCorte);
    if(!Number.isFinite(kpis.disponibilidad))return;
    kpis.filas.forEach(f=>{
      const reparacion=f.inicioAveriaFecha&&f.finAveriaFecha&&f.finAveriaFecha>=f.inicioAveriaFecha?(f.finAveriaFecha-f.inicioAveriaFecha)/3600000:null;
      eventos.push({fecha:f.finAveriaFecha||f.inicioAveriaFecha,horasOperativas:Number.isFinite(f.horasOperativas)?f.horasOperativas:0,intervalos:Number.isFinite(f.horasOperativas)?1:0,horasReparacion:Number.isFinite(reparacion)?reparacion:0,reparaciones:Number.isFinite(reparacion)?1:0,aviso:f.aviso,equipo});
    });
    if(kpis.periodoActual&&Number.isFinite(kpis.periodoActual.horasOperativas))eventos.push({fecha:kpis.periodoActual.fin,horasOperativas:kpis.periodoActual.horasOperativas,intervalos:1,horasReparacion:0,reparaciones:0,aviso:'Actual',equipo});
  });
  eventos.sort((a,b)=>a.fecha-b.fecha);
  const puntos=[];
  let horasOperativas=0,horasReparacion=0,intervalos=0,reparaciones=0;
  eventos.forEach(e=>{
    horasOperativas+=e.horasOperativas;horasReparacion+=e.horasReparacion;intervalos+=e.intervalos;reparaciones+=e.reparaciones;
    if(intervalos&&reparaciones){
      const disponibilidad=calcularDisponibilidad(horasOperativas/intervalos,horasReparacion/reparaciones);
      if(Number.isFinite(disponibilidad))puntos.push({fecha:e.fecha,disponibilidad,aviso:e.aviso,equipo:e.equipo});
    }
  });
  return puntos.filter(p=>p.fecha instanceof Date&&!isNaN(p.fecha));
}

function resumirPuntosMensuales(puntos){
  const meses=new Map();
  puntos.forEach(p=>meses.set(`${p.fecha.getFullYear()}-${String(p.fecha.getMonth()+1).padStart(2,'0')}`,p));
  return [...meses.values()].sort((a,b)=>a.fecha-b.fecha);
}

function crearCaminoSuave(coordenadas){
  if(!coordenadas.length)return'';
  if(coordenadas.length===1)return`M ${coordenadas[0][0]} ${coordenadas[0][1]}`;
  let camino=`M ${coordenadas[0][0]} ${coordenadas[0][1]}`;
  for(let i=0;i<coordenadas.length-1;i++){
    const [x1,y1]=coordenadas[i],[x2,y2]=coordenadas[i+1],medio=((x1+x2)/2).toFixed(1);
    camino+=` C ${medio} ${y1}, ${medio} ${y2}, ${x2} ${y2}`;
  }
  return camino;
}

function claseSemaforoDisponibilidad(valor){
  if(valor<=60)return'semaforo-rojo';
  if(valor<90)return'semaforo-amarillo';
  return'semaforo-verde';
}

function etiquetaMesConfiabilidad(fecha){
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${meses[fecha.getMonth()]}${String(fecha.getFullYear()).slice(-2)}`;
}

function renderGraficoDisponibilidadPuntos(puntos,equipo){
  const panel=$('graficoDisponibilidad'),contenedor=$('graficoDisponibilidadSvg');
  const esTotal=normalizar(equipo).startsWith('todoslosequipos');
  if(esTotal)puntos=resumirPuntosMensuales(puntos);
  if(!puntos.length){panel.classList.add('hidden');contenedor.innerHTML='';return;}
  const ancho=900,alto=290,margen={izq:62,der:24,arr:22,abajo:66},w=ancho-margen.izq-margen.der,h=alto-margen.arr-margen.abajo;
  const valores=puntos.map(p=>p.disponibilidad),minReal=Math.min(...valores),maxReal=Math.max(...valores);
  let minY=Math.max(0,Math.floor((minReal-1)*10)/10),maxY=Math.min(100,Math.ceil((maxReal+1)*10)/10);
  if(maxY-minY<1){const centro=(maxY+minY)/2;minY=Math.max(0,centro-.5);maxY=Math.min(100,centro+.5);}
  const fechas=puntos.map(p=>p.fecha.getTime()),minX=FECHA_INICIO_CONFIABILIDAD.getTime(),maxX=Math.max(...fechas),rangoX=Math.max(1,maxX-minX),rangoY=Math.max(.1,maxY-minY);
  const x=p=>margen.izq+(p.fecha.getTime()-minX)/rangoX*w,y=p=>margen.arr+(maxY-p.disponibilidad)/rangoY*h;
  const coordenadas=puntos.map(p=>[x(p),y(p)]),camino=crearCaminoSuave(coordenadas);
  const marcasY=[maxY,(maxY+minY)/2,minY];
  const mesesX=[];
  const cursorMes=new Date(FECHA_INICIO_CONFIABILIDAD.getFullYear(),FECHA_INICIO_CONFIABILIDAD.getMonth(),1);
  const limiteMes=new Date(maxX);
  while(cursorMes<=limiteMes){mesesX.push(new Date(cursorMes));cursorMes.setMonth(cursorMes.getMonth()+1);}
  const grilla=marcasY.map(v=>`<line x1="${margen.izq}" y1="${(margen.arr+(maxY-v)/rangoY*h).toFixed(1)}" x2="${ancho-margen.der}" y2="${(margen.arr+(maxY-v)/rangoY*h).toFixed(1)}" class="conf-chart-grid"/><text x="${margen.izq-10}" y="${(margen.arr+(maxY-v)/rangoY*h+4).toFixed(1)}" text-anchor="end" class="conf-chart-axis">${fmtN(v)}%</text>`).join('');
  const etiquetasX=mesesX.map(fecha=>{const posicion=x({fecha}).toFixed(1);return`<text x="${posicion}" y="${alto-15}" text-anchor="end" transform="rotate(-45 ${posicion} ${alto-15})" class="conf-chart-axis conf-chart-month">${escapeHtml(etiquetaMesConfiabilidad(fecha))}</text>`;}).join('');
  const segmentos=coordenadas.slice(0,-1).map(([x1,y1],i)=>{const[x2,y2]=coordenadas[i+1],medio=((x1+x2)/2).toFixed(1),clase=claseSemaforoDisponibilidad((puntos[i].disponibilidad+puntos[i+1].disponibilidad)/2);return`<path d="M ${x1} ${y1} C ${medio} ${y1}, ${medio} ${y2}, ${x2} ${y2}" class="conf-chart-line ${clase}"/>`;}).join('');
  const marcadores=puntos.map(p=>`<circle cx="${x(p).toFixed(1)}" cy="${y(p).toFixed(1)}" r="3.5" class="conf-chart-point ${claseSemaforoDisponibilidad(p.disponibilidad)}" data-fecha="${escapeHtml(fmtF(p.fecha))}" data-valor="${escapeHtml(fmtN(p.disponibilidad))}" data-equipo="${escapeHtml(p.equipo||equipo)}"><title>${escapeHtml(fmtF(p.fecha))} · ${p.equipo?`${escapeHtml(p.equipo)} · `:''}${escapeHtml(p.aviso)} · ${fmtN(p.disponibilidad)}%</title></circle>`).join('');
  const baseY=(margen.arr+h).toFixed(1),area=`${camino} L ${coordenadas.at(-1)[0]} ${baseY} L ${coordenadas[0][0]} ${baseY} Z`;
  contenedor.innerHTML=`<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Disponibilidad acumulada de ${escapeHtml(equipo)}"><defs><linearGradient id="confAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#64748b" stop-opacity=".16"/><stop offset="100%" stop-color="#64748b" stop-opacity=".02"/></linearGradient></defs>${grilla}<path d="${area}" class="conf-chart-area"/>${segmentos}${marcadores}${etiquetasX}</svg><div id="tooltipDisponibilidad" class="conf-chart-tooltip hidden"></div>`;
  const tooltip=$('tooltipDisponibilidad');
  contenedor.querySelectorAll('.conf-chart-point').forEach(punto=>{
    punto.addEventListener('mouseenter',()=>{tooltip.innerHTML=`<strong>${escapeHtml(punto.dataset.valor)}%</strong><span>${escapeHtml(punto.dataset.fecha)}</span>${esTotal?`<small>${escapeHtml(punto.dataset.equipo)}</small>`:''}`;tooltip.classList.remove('hidden');});
    punto.addEventListener('mousemove',evento=>{const caja=contenedor.getBoundingClientRect();tooltip.style.left=`${evento.clientX-caja.left+12}px`;tooltip.style.top=`${evento.clientY-caja.top-52}px`;});
    punto.addEventListener('mouseleave',()=>tooltip.classList.add('hidden'));
  });
  $('subtituloGraficoDisponibilidad').textContent=`${equipo} · ${puntos.length.toLocaleString('es-CL')} ${esTotal?'puntos mensuales acumulados':'puntos acumulados'} · Desde 01-01-2025`;
  const ultimo=$('ultimoValorDisponibilidad');
  ultimo.textContent=`${fmtN(puntos.at(-1).disponibilidad)} %`;
  ultimo.className=`conf-chart-value ${claseSemaforoDisponibilidad(puntos.at(-1).disponibilidad)}`;
  panel.classList.remove('hidden');
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

function detectarColumnas(cols){const c=cols.map(x=>({original:x,key:normalizar(x)}));return{fechaAviso:buscar(c,['fechadeaviso','fechaaviso']),claseAviso:buscar(c,['clasedeaviso','claseaviso']),statusSistema:buscar(c,['statusdelsistema','estatusdelsistema','statussistema','estatussistema']),aviso:buscarExact(c,['aviso']),orden:buscar(c,['orden','numeroorden','ordensap']),descripcion:buscar(c,['descripcion','descripciondelaviso','textoaviso']),ubicacionTecnica:buscarExact(c,['ubicaciontecnica']),denominacionUbicacionTecnica:buscar(c,['denominaciondelaubicaciontecnica','denominacionubicaciontecnica','denominaciondelubicaciontecnica']),inicioFecha:buscarExact(c,['iniciodeaveria','inicioaveria']),inicioHora:buscar(c,['iniciodeaveriahora','inicioaveriahora','hora inicio averia']),finFecha:buscarExact(c,['findeaveria','finaveria']),finHora:buscar(c,['findelaaveriahora','findeaveriahora','finaveriahora','hora fin averia']),duracionParada:buscar(c,['duraciondeparada','duracionparada'])};}
function buscar(cols,ps){for(const p0 of ps){const p=normalizar(p0);const e=cols.find(c=>c.key.includes(p)||p.includes(c.key));if(e)return e.original;}return null;}
function buscarExact(cols,ps){for(const p0 of ps){const p=normalizar(p0),e=cols.find(c=>c.key===p);if(e)return e.original;}return buscar(cols,ps);}
function buscarEquipoPorUbicacion(ubicacion){
  const clave=normalizar(ubicacion);
  if(!clave)return null;
  return construirDatosBase(datosOriginales).find(r=>normalizar(r.ubicacionTecnica)===clave)||null;
}
function completarEquipoDesdeUbicacionResumen(){
  const registro=buscarEquipoPorUbicacion($('busquedaUbicacion').value);
  if(!registro)return;
  $('busquedaEquipo').value=registro.denominacionUbicacionTecnica||registro.ubicacionTecnica;
  equiposSeleccionados.clear();
  renderEquiposSeleccionados();
}
function completarEquipoDesdeUbicacionConfiabilidad(){
  const registro=buscarEquipoPorUbicacion($('confBuscarUbicacion').value);
  if(registro)$('confBuscarEquipo').value=registro.denominacionUbicacionTecnica||registro.ubicacionTecnica;
}
function completarEquipoDesdeUbicacionPlan(){
  const clave=normalizar($('planUbicacion').value);
  if(!clave)return;
  const actividad=planAnual.find(x=>normalizar(x.ubicacion)===clave);
  if(actividad)$('planBuscar').value=actividad.equipo||'';
}
function cargarListaEquipos(rows){
  const base=construirDatosBase(rows);
  listaEquipos=[...new Set(
    base
      .map(r=>r.denominacionUbicacionTecnica||r.ubicacionTecnica)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'es'));
  palabrasDescripcion=[...new Set(base.flatMap(r=>r.descripcion.split(/[^A-ZÁÉÍÓÚÜÑ0-9]+/).filter(p=>p.length>=3)))].sort((a,b)=>a.localeCompare(b,'es'));
}
const buscadoresEquipos=[];
function configurarBuscadorDescripcion(){
  const input=$('busquedaDescripcion'),contenedor=$('sugerenciasDescripcion');
  if(!input||!contenedor)return;
  const estado={ocultar(){contenedor.style.display='none';contenedor.innerHTML='';}};
  buscadoresEquipos.push(estado);
  const mostrar=()=>{
    const clave=normalizar(input.value);
    const resultados=(clave?palabrasDescripcion.filter(p=>normalizar(p).includes(clave)):palabrasDescripcion).slice(0,30);
    contenedor.innerHTML=resultados.length?resultados.map(p=>`<div class="suggestion-item">${escapeHtml(p)}</div>`).join(''):'<div class="suggestion-empty">Sin coincidencias</div>';
    [...contenedor.querySelectorAll('.suggestion-item')].forEach(item=>{
      item.onmousedown=e=>e.preventDefault();
      item.onclick=()=>{input.value=item.textContent;estado.ocultar();aplicarFiltros();};
    });
    contenedor.style.display='block';
  };
  input.oninput=()=>{mostrar();aplicarFiltros();};
  input.onfocus=mostrar;
  input.onkeydown=e=>{if(e.key==='Escape')estado.ocultar();};
}
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
    const opciones=acciones.incluirTodos?['Todos',...listaEquipos]:listaEquipos;
    estado.resultados=(clave?opciones.filter(e=>normalizar(e).includes(clave)):opciones).slice(0,100);
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
      <th class="seleccionar-col">Seleccionar <input type="checkbox" id="seleccionarTodosBase" aria-label="Seleccionar todas las filas visibles"></th>
      <th>Fecha aviso</th>
      <th>Clase aviso</th>
      <th>Aviso</th>
      <th>Estado aviso</th>
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
        <td class="seleccionar-col"><input type="checkbox" class="seleccionar-registro" data-clave="${escapeHtml(claveRegistroBase(r))}" aria-label="Seleccionar orden ${escapeHtml(r.orden||'-')}" ${registrosSeleccionados.has(claveRegistroBase(r))?'checked':''}></td>
        <td>${fmtF(r.fechaAviso)}</td>
        <td>${r.claseAviso}</td>
        <td>${celdaCopiable(r.aviso)}</td>
        <td><span class="estado-aviso ${r.estadoAviso==='CERRADO'?'cerrado':'tratamiento'}" title="Status SAP: ${escapeHtml(r.statusSistema||'-')}">${r.estadoAviso}</span></td>
        <td class="descripcion">${celdaCopiable(r.descripcion)}</td>
        <td>${celdaCopiable(r.ubicacionTecnica)}</td>
        <td>${celdaCopiable(r.denominacionUbicacionTecnica)}</td>
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
    : '<tr><td colspan="13">No hay datos</td></tr>';
  const porClave=new Map(base.map(r=>[claveRegistroBase(r),r]));
  const checks=[...$('tablaBase').querySelectorAll('.seleccionar-registro')];
  checks.forEach(check=>check.onchange=()=>{
    const registro=porClave.get(check.dataset.clave);
    if(check.checked&&registro)registrosSeleccionados.set(check.dataset.clave,registro);else registrosSeleccionados.delete(check.dataset.clave);
    const todos=$('seleccionarTodosBase');
    if(todos){todos.checked=checks.length>0&&checks.every(x=>x.checked);todos.indeterminate=checks.some(x=>x.checked)&&!todos.checked;}
    actualizarBotonSeleccionados();
  });
  const todos=$('seleccionarTodosBase');
  if(todos){
    todos.checked=checks.length>0&&checks.every(x=>x.checked);
    todos.indeterminate=checks.some(x=>x.checked)&&!todos.checked;
    todos.onchange=()=>checks.forEach(check=>{if(check.checked!==todos.checked){check.checked=todos.checked;check.onchange();}});
  }
  $('tablaBase').querySelectorAll('.copyable').forEach(el=>{
    const copiar=()=>copiarTexto(el,el.dataset.copy);
    el.onclick=copiar;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();copiar();}};
  });
  actualizarBotonSeleccionados();
}

function editarTipoAviso(boton){
  const aviso=boton.dataset.aviso,actual=boton.dataset.tipo,celda=boton.closest('td');
  const selector=document.createElement('select');
  selector.className='unidad-aviso-select';
  selector.innerHTML='<option value="__AUTO__">Clasificación automática</option><option value="NO APLICA">OMITIR / NO APLICA</option>'+
    [...new Set([...obtenerListaTipos(),actual,'Sin clasificar'])].sort((a,b)=>a.localeCompare(b,'es')).map(tipo=>`<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('');
  selector.value=tiposAviso[aviso]||'__AUTO__';
  selector.onchange=()=>{
    if(selector.value==='__AUTO__')delete tiposAviso[aviso];
    else tiposAviso[aviso]=selector.value;
    localStorage.setItem(KEY_AVISO_TIPOS,JSON.stringify(tiposAviso));
    cargarFiltroTipos();
    aplicarFiltros();
    analizarConfiabilidadAutomaticamente();
    renderRankingUnidad();
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

function extraerBloquesLYD(m){const out=[];if(!m.length)return out;const maxCols=Math.max(...m.slice(0,10).map(f=>f.length));for(let c=1;c<maxCols;c++){let unidad='';for(let r=0;r<Math.min(10,m.length);r++){const v=m[r]?.[c];if(v&& !convertirFecha(v)){unidad=String(v);break;}}if(!unidad)continue;let ini=null,fin=null;for(let r=1;r<m.length;r++){const f=convertirFecha(m[r]?.[0]);if(!f||f.getFullYear()<2000||f.getFullYear()>2100)continue;const is=normalizar(m[r]?.[c]).includes('lyd');if(is&&!ini){ini=f;fin=f}else if(is){fin=f}else if(ini){out.push(crearBloque(unidad,ini,fin));ini=null;fin=null}}if(ini)out.push(crearBloque(unidad,ini,fin));}return out;}
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
