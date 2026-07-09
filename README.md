# Dashboard Confiabilidad Equipos - v1.7

## Cambios principales
- Mantiene una sola carpeta `datos/`.
- Detecta automáticamente dos tipos de archivos:
  - SAP / EXPORT
  - GANTT
- Carga el último archivo SAP y el último archivo Gantt desde GitHub API.
- Mantiene la tabla DATOS BASE PARA CÁLCULO DE KPI.
- Agrega panel GANTT PRODUCCIÓN DETECTADO.
- El Gantt queda preparado para descontar vacíos sanitarios en versiones futuras.

## Nombres recomendados en carpeta datos
- SAP_EXPORT_2026-07-09.xlsx
- GANTT_2026.xlsx

## Próxima versión
v1.8: Tabla de confiabilidad usando SAP + Gantt.
