# PRODUCT.md - Ritmo

**Plataforma (impeccable):** `adaptive` (APK Android verificado en emulador + PWA verificada en navegador + proyecto iOS generado sin verificar). Se usa `audit.native` / `adapt.native`; no `detect`/`live`/`generate`.

## Usuario y propósito
Persona que quiere llevar a la vez **hábitos diarios** y **gastos/ingresos** sin abrir dos apps, a menudo con mala señal (transporte, sótanos). Debe poder anotar en 5 segundos, con o sin red, y ver cómo va su semana.

## Registro de marca
- Nombre: **Ritmo**. Tono: directo, cálido, sin culpa ("Aún no hay hábitos. Crea el primero").
- Personalidad: instrumento de medición amable, no gamificación. Un símbolo: pulso.
- Paleta propia: ámbar profundo (acción), pizarra neutra, verde/rojo solo para ingreso/gasto **siempre con icono y signo**. Sin azul/violeta de plantilla.
- Tipografía: Bricolage Grotesque Bold (títulos y cifras) + Manrope 400/600 (texto). Ambas OFL, desde `recursos\tipografias`.

## Principios
1. Offline primero: nada espera a la red; el estado de sincronización siempre está visible.
2. Material 3 nativo en Android: bottom bar de 4 destinos, una FAB por pantalla, Back del sistema vivo, tema oscuro de primera clase.
3. Cifras legibles: tabulares, etiquetas directas en el gráfico y alternativa de tabla.
4. Los datos de otro usuario no existen para ti (RLS verificada con 2 usuarios).

## Anti-referencias
Gamificación con confeti y rachas culpabilizantes; dashboards de tarjetas iguales; glass/neón; emoji como iconos.

## Datos de demostración
"Cargar datos de ejemplo" crea datos **ficticios** rotulados "Dato de ejemplo". Ningún dato real en capturas.
