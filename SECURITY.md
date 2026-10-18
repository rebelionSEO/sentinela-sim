# Seguridad / Security

## Reportar una vulnerabilidad

No abras un issue público. Usa **Security → Report a vulnerability** en este repositorio
(reporte privado de GitHub). Respondo en un plazo de 7 días.

*Please don't open a public issue. Use **Security → Report a vulnerability** (GitHub private reporting).*

## Qué es y qué no es este proyecto

- Es un **sitio estático**: no tiene servidor, base de datos, login ni manejo de datos personales.
- Todo lo que se ve (agentes, leads, correos, "PII") es **simulado**. No hay datos reales.
- No usa claves de API ni secretos. Si alguna vez se agregan, van en variables de entorno, nunca en el código
  (el `.gitignore` ya excluye `.env`).
- Solo carga recursos externos de Google Fonts.

## Dependencias

- Dependencias de producción: React, React DOM y Framer Motion, con versiones fijas y `package-lock.json`.
- Dependabot revisa dependencias y GitHub Actions cada semana.
- La CI falla si `npm audit` encuentra vulnerabilidades **altas** en dependencias de producción.

### Aviso conocido (solo desarrollo)

`npm audit` reporta `braces` (GHSA-vfj7-8cjw-p6xm) a través de `vite-plugin-singlefile`.
Solo se usa al compilar, procesa nuestra propia configuración y no llega al navegador.
La corrección existe en una versión del plugin publicada en octubre de 2026; se adoptará cuando tenga tiempo de uso
(Dependabot abrirá el PR).

## Encabezados de seguridad al publicar

`public/_headers` (Netlify) y `vercel.json` (Vercel) aplican CSP, `nosniff`, `Referrer-Policy` y
`Permissions-Policy`. `frame-ancestors` permite incrustarlo solo en `geramejia.com`.
