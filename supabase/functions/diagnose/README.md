# Función `diagnose`: diagnóstico de hojas por foto

La app manda la foto de una hoja (JPEG de 1024 px como máximo) y los datos del cultivo. La función comprueba la sesión anónima del usuario, aplica un límite de 10 diagnósticos cada 24 horas y le pregunta a Claude. Devuelve lo más probable, qué se ve y tres pasos.

- Modelo por defecto: `claude-opus-5`. Si sus filtros de seguridad rechazan una foto, Anthropic la reintenta sola con otro modelo. Para cambiarlo, define el secreto `DIAGNOSE_MODEL`.
- La clave de Anthropic vive solo en los secretos de la función. Nunca va en `app/.env` ni en el repositorio.
- La tabla `public.diagnosticos` solo guarda quién pidió un diagnóstico y cuándo, para el límite diario. No guarda la foto ni el resultado.

## Activarla (una sola vez)

Todo se hace desde la raíz del repositorio (`zenpai/`).

1. Instala el CLI de Supabase y entra con tu cuenta:

   ```sh
   brew install supabase/tap/supabase
   supabase login
   ```

2. Enlaza el proyecto:

   ```sh
   supabase link --project-ref jsyvskyobatoqcsnmink
   ```

   Si el CLI dice que falta `supabase/config.toml`, ejecuta antes `supabase init`. Solo crea ese archivo y no toca `migrations/` ni `functions/`.

3. Crea la tabla del límite diario. La forma más simple es la misma que usaste con la 0001: abre el SQL Editor del dashboard, pega **completo** `supabase/migrations/0002_diagnosticos.sql` y pulsa Run.

   Si prefieres el CLI: la 0001 la aplicaste a mano, así que primero márcala como aplicada. Si no, `db push` intentaría repetirla y fallaría.

   ```sh
   supabase migration repair --status applied 0001
   supabase db push
   ```

4. Guarda tu clave de Anthropic como secreto de la función. La sacas de console.anthropic.com, en API Keys:

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=tu-clave
   ```

   Opcional, para usar otro modelo (por ejemplo uno más barato):

   ```sh
   supabase secrets set DIAGNOSE_MODEL=claude-sonnet-5
   ```

5. Despliega la función:

   ```sh
   supabase functions deploy diagnose --no-verify-jwt
   ```

   La función ya comprueba la sesión por su cuenta: sin usuario responde 401. Con `--no-verify-jwt`, la petición previa de CORS y las claves nuevas de Supabase (publishable y JWT signing keys) no chocan con la verificación del gateway.

6. Comprueba que los accesos anónimos siguen activos. Están en el dashboard, en Authentication → Sign In / Providers → Allow anonymous sign-ins. El respaldo en la nube ya los usa.

## Probarla

En la app, abre Ajustes → Premium → Probar Premium. Luego, en una carpa, abre el diagnóstico y haz una foto de una hoja. Si algo falla, los errores aparecen en el dashboard, en Edge Functions → diagnose → Logs.

Mensajes que puede ver el usuario:

- «El diagnóstico todavía no está activado en el servidor.»: falta desplegar la función, la tabla 0002 o el secreto `ANTHROPIC_API_KEY`, o la clave no es válida.
- «Llegaste al límite de diagnósticos de hoy.»: ya pidió 10 en las últimas 24 horas.
