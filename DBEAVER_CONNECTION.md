# Configuracion de Conexion DBeaver

Este archivo no debe contener credenciales reales.
Usa variables de entorno o un gestor de secretos para compartir accesos.

## Ejemplo de conexion PostgreSQL

- Host: `<DB_HOST>`
- Puerto: `5432`
- Base de datos: `<DB_NAME>`
- Usuario: `<DB_USER>`
- Contrasena: `<DB_PASSWORD>`
- Schema: `public`

## URL JDBC de ejemplo

`jdbc:postgresql://<DB_HOST>:5432/<DB_NAME>`

## Recomendaciones

1. No subir credenciales a git.
2. Rotar contrasenas si alguna fue expuesta.
3. Habilitar SSL en conexiones remotas.
4. Limitar acceso por IP cuando sea posible.
