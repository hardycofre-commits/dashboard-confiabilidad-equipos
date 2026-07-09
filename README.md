# Dashboard Confiabilidad Equipos - v1.8

## Cambios principales
- Se mantiene una sola carpeta `datos/`.
- Detecta último archivo SAP/EXPORT.
- Detecta último archivo GANTT.
- Interpreta LYD como Lavado y Desinfección.
- Genera tabla automática de períodos LYD:
  - Unidad Gantt
  - Inicio LYD
  - Fin LYD
  - Días LYD
  - Horas no operativas planificadas
- Agrega tabla de equivalencias interna para detectar Unidad Gantt desde SAP.
- Agrega columnas:
  - Unidad Gantt detectada
  - Estado OK / Revisar
- Los equipos sin clasificar quedan marcados como Revisar.

## Tabla de equivalencias inicial
- HATCHERY / HAT -> Hat
- FF / FF2 -> FF
- ALEV / ALEVINAJE -> Alev
- PRE-SMOLT / PRE SMOLT -> Pre
- RILES -> Riles
- FILTRADO / FILTRO -> Filtrado
- GENERADOR / GEN -> Generadores

## Próxima versión
v1.9: Tabla de confiabilidad cruzando SAP + LYD.
