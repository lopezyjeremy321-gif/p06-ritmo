# supabase/ - Ritmo (P06)

- `migrations/p06_001_init.sql`: esquema completo, **idempotente**, solo objetos `p06_*` en `public` (proyecto compartido).
  Para la nube: pegar en el SQL Editor y ejecutar (se puede repetir sin dano). No necesita ninguna clave de servicio.
- `config.toml`: entorno LOCAL de pruebas (Docker, puertos 3160-3166, project_id `p06`).
- Local: `npm run db:start` (arranca y aplica `p06_*.sql`), `npm run db:reset`, `npm run db:stop`.
- Tras aplicar en la nube: Authentication > URL Configuration > anadir `ritmo://auth/callback` a Redirect URLs.
- Apuntar la app a la nube: solo `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clave publishable) en `.env`.
