# Dashboard Confiabilidad Equipos - v5.4

Aplicación estática que lee las fuentes Excel desde GitHub y clasifica los equipos mediante el maestro oficial de ubicaciones técnicas.

## Fuentes

- SAP: el `.xlsx` más reciente de `datos/`; solo se procesan avisos con Orden de Trabajo.
- Plan Anual: el `.xlsx` más reciente de `plan_anual/`.
- Uso de Salas: el `.xlsx` más reciente de `gantt_uso_salas/`.
- El nombre del archivo no determina su tipo; lo determina exclusivamente la carpeta.
- Maestro: `lista_ubicaciones_tecnicas.xlsx` ubicado en la raíz del proyecto. Google no es necesario.

## Publicación en GitHub Pages

El workflow `.github/workflows/actualizar-fuentes.yml` genera `fuentes.json` dentro del sitio y realiza una sola publicación, sin crear un segundo commit automático.

Configuración requerida una sola vez en GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.

## Confiabilidad

- Selector Anual/Mensual con multiselección.
- Disponibilidad = `(Tiempo exigible - indisponibilidad Z2) / Tiempo exigible`.
- Tiempo exigible 24x7, descontando intervalos programados Z1 y LYD unidos sin duplicar horas.
- Las fallas abiertas o sin fin válido se excluyen.
- Avisos con la misma Orden se consideran un único evento.
- MTBF y MTTR se calculan independientemente para el período seleccionado.

## Navegación

1. Resumen
2. Confiabilidad
3. Plan Anual
4. Carta Gantt Plan Anual
5. Carta Gantt Uso de Salas

## Costos de mantenimiento


Solo se consideran filas del Excel de costos con **Aviso y Orden presentes**. Si falta cualquiera de ellos, se excluye la fila de ambas asociaciones y de todos los totales. También se admite el encabezado SAP `Suma de costes plan`.

Coloque el Excel SAP en `costo/` y súbalo al repositorio junto con los cambios. El mismo workflow de actualización selecciona la fuente por fecha del último commit del archivo (con desempate por nombre), actualiza `fuentes.json` y conserva la publicación existente. Después de la publicación, pulse Actualizar en el dashboard. Sin manifiesto se utiliza la selección existente mediante la API de GitHub.

La fuente se procesa una vez por actualización y se consulta por Aviso en la tabla base y el historial, y por Orden en el Plan Anual. Los importes ya están en USD: se muestran como `US$ 1.250.430,75`, sin conversión. Valores ausentes o inválidos quedan vacíos. Si falta la fuente, las tablas siguen funcionando sin costos asociados.

Cada total usa todas las intervenciones únicas del conjunto filtrado, incluso las que exceden las 300 filas visibles de la tabla base. El historial mantiene su alcance actual: fallas Z2 cerradas con Orden y fechas válidas. El Plan Anual utiliza sus propios filtros existentes. Las filas duplicadas no acumulan costos: se conserva el primer registro válido de la intervención. No se modifican fórmulas de confiabilidad ni avance del plan.
