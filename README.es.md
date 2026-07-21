# yamtrack-mcp

![Security Policy](https://img.shields.io/badge/Security-Policy-blue)

[Read in English](README.md)

Un servidor [Model Context Protocol](https://modelcontextprotocol.org)
independiente (transporte **stdio** o **http**, TypeScript) que expone la
API REST de [Yamtrack](https://github.com/URD0TH/Yamtrack) como herramientas
para LLMs (Claude Desktop, OpenCode, VS Code, Hermes, etc.).

Funciona en **cualquier máquina** y se comunica con una instancia de Yamtrack
a través de su API REST pública. No requiere código Django.

## Requisitos

- Node.js 18+ (desarrollado en v22/v26)
- Una instancia de Yamtrack accesible (ej. `http://localhost:8000` o tu URL)
- Un token de API para esa instancia (desde Account settings → Integrations)

## Instalación

Distribuido solo por **GitHub** — no está publicado en npmjs.com.
`npx yamtrack-mcp` (el nombre público sin scope) **no** funciona. Elegí uno
de los dos métodos.

### 1. Instalación global desde tarball del release (recomendado)

Descargá el tarball precompilado desde el [último release](https://github.com/URD0TH/yamtrack-mcp/releases/latest)
e instalalo globalmente:

```bash
npm install -g https://github.com/URD0TH/yamtrack-mcp/releases/latest/download/urd0th-yamtrack-mcp-0.1.2.tgz
```

Después de esto, el comando `yamtrack-mcp` está disponible en todo el sistema.

O ejecutalo directamente con npx (sin instalar):

```bash
npx github:URD0TH/yamtrack-mcp
```

> **Nota de seguridad:** fijá una versión explícita (cambia `0.1.2` por el tag
> que quieras) en lugar de usar `latest`, para evitar que un push malicioso se
> instale automáticamente.

### 2. GitHub Packages (registry con scope — requiere token)

El workflow `Publish` sube `@urd0th/yamtrack-mcp` a GitHub Packages en cada
tag `v*`. **GitHub Packages requiere autenticación incluso para paquetes
públicos**, por lo que hay que configurar el scope `@urd0th` y un token de
GitHub con permiso `read:packages` antes de instalar:

```bash
echo "@urd0th:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<GITHUB_TOKEN>" >> ~/.npmrc
npm install -g @urd0th/yamtrack-mcp        # latest
npm install -g @urd0th/yamtrack-mcp@0.1.0  # versión específica
```

> **Nota de seguridad:** fijá una versión explícita (`@0.1.0`) en lugar de
> `@latest`. Sin las entradas de `.npmrc`, `npm install -g @urd0th/yamtrack-mcp`
> devuelve 401.

## Compilar desde fuente

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install        # instalar dependencias
npm run build      # compilar src/ -> dist/ (TypeScript estricto)
```

## Ejecución

Después de instalar globalmente (método 1 o 2):

```bash
yamtrack-mcp --transport http --port 8080                                # primer plano (dev / testing)
yamtrack-mcp --transport http --port 8080 --base-url http://url:port/api # primer plano, instancia personalizada
yamtrack-mcp serve --port 9123                                              # daemonizado vía PM2 (producción)
yamtrack-mcp serve --port 9123 --base-url http://url:port/api              # daemonizado, instancia personalizada
yamtrack-mcp --transport stdio                 # por defecto, para clientes stdio locales
yamtrack-mcp serve:status                      # ver estado del servidor
yamtrack-mcp serve:restart                     # reiniciar
yamtrack-mcp serve:stop                        # detener
yamtrack-mcp serve:logs                        # rutas de logs
yamtrack-mcp --help                            # mostrar todas las opciones
```

> `**serve` vs sin `serve`:** Sin `serve` el proceso corre en primer plano —
> usalo para desarrollo, testing, o con tu propio supervisor (systemd, Docker
> `restart:`). Con `serve` el proceso se daemoniza via PM2 con autoreinicio y
> gestión de logs (no requiere instalación separada de PM2).

Con npx (sin instalar):

```bash
npx github:URD0TH/yamtrack-mcp --transport http
```

Desde compilación local:

```bash
node dist/index.js --transport http
```

## Autenticación

El servidor se autentica en Yamtrack con una **única clave de API estática**
(desde Account settings → Integrations), pasada mediante `--token <token>` o
la variable de entorno `YAMTRACK_API_KEY`. Nunca expira y es la única
credencial que el servidor acepta.


| Opción               | Variable de entorno | Descripción                                                 |
| -------------------- | ------------------- | ----------------------------------------------------------- |
| `--transport <type>` | –                   | `stdio` (por defecto) o `http`                              |
| `--base-url <url>`   | `YAMTRACK_BASE_URL` | URL base de la API. Por defecto `http://localhost:8000/api` |
| `--token <token>`    | `YAMTRACK_API_KEY`  | Clave de API estática (fallback http cuando no hay header)  |
| `--port <n>`         | –                   | Puerto para transporte `http`. Por defecto `8080`           |
| `--help`             | –                   | Mostrar ayuda                                               |


Las herramientas de solo lectura (`search_media`, `get_details`) funcionan
**sin** autenticación.

> **Un token, dos formas de pasarlo.** Hay una **única** credencial — tu clave
> de API de Yamtrack. "Bearer" es solo *cómo* se envía, no un token diferente.
>
> - **stdio:** poné la clave directamente en `YAMTRACK_API_KEY` (o `--token`).
> No escribas `Bearer` — el servidor agrega el prefijo `Bearer`  cuando llama
> a la API REST.
>   ```json
>   "env": { "YAMTRACK_API_KEY": "<token>" }
>   ```
> - **http:** el cliente envía `Authorization: Bearer <token>` y el servidor
> reenvía esa misma clave. Acá **sí** se escribe `Bearer`.
>   ```json
>   "headers": { "Authorization": "Bearer <token>" }
>   ```
>
> El valor de `<token>` es idéntico en ambos casos.

### Transporte HTTP

Con `--transport http` el servidor escucha en `POST /mcp` (StreamableHTTP,
sin estado). Cada conexión se autentica mediante el header `Authorization: Bearer <token>` que recibe, con fallback a `--token` / `YAMTRACK_API_KEY`
cuando el header está ausente. Luego el token se reenvía como Bearer a la
API REST de Yamtrack, exactamente como en el transporte stdio.

> **Nota de seguridad:** el transporte HTTP no tiene TLS ni rate limiting
> incorporados. Enlazalo a `localhost` y exponelo solo detrás de un proxy
> inverso con HTTPS/autenticación — nunca directamente a internet.

## Herramientas

Todas las herramientas mapean 1:1 a la API REST documentada en
[wiki/API.md](https://github.com/FuzzyGrim/Yamtrack/wiki/API).


| Herramienta          | Endpoint REST                                   |
| -------------------- | ----------------------------------------------- |
| `search_media`       | `GET /search/`                                  |
| `get_details`        | `GET /details/<source>/<type>/<id>/` (+ season) |
| `list_tracked_media` | `GET /media/<type>/`                            |
| `get_home`           | `GET /home/`                                    |
| `get_history`        | `GET /history/<source>/<type>/<id>/`            |
| `create_entry`       | `POST /media/<type>/create/`                    |
| `manual_create`      | `POST /media/manual/create/`                    |
| `update_entry`       | `PATCH /media/<type>/<instance_id>/`            |
| `update_progress`    | `POST /media/<type>/<instance_id>/progress/`    |
| `update_score`       | `POST /media/<type>/<instance_id>/score/`       |
| `delete_entry`       | `DELETE /media/<type>/<instance_id>/delete/`    |
| `sync_metadata`      | `POST /sync/<source>/<type>/<id>/`              |
| `create_episode`     | `POST /episodes/`                               |
| `get_statistics`     | `GET /statistics/`                              |
| `get_me`             | `GET /auth/me/`                                 |


Valores de enum: `media_type` ∈ {`tv`, `movie`, `anime`, `manga`, `game`,
`book`, `comic`, `boardgame`, `season`}, `status` ∈ {`Completed`,
`In progress`, `Planning`, `Paused`, `Dropped`}, `source` ∈ {`tmdb`, `mal`,
`igdb`, `openlibrary`, `mangaupdates`, `comicvine`, `custom`}.

## Configuración de clientes

Si instalaste globalmente (método 1), usá `"command": "yamtrack-mcp"`.
Si preferís npx (sin instalar), usá `"command": "npx"` con
`"args": ["github:URD0TH/yamtrack-mcp"]`.

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "yamtrack-mcp",
      "env": { "YAMTRACK_API_KEY": "<token>" }
    }
  }
}
```

### OpenCode (`opencode.json`)

```json
{
  "mcp": {
    "servers": {
      "yamtrack": {
        "type": "stdio",
        "command": "yamtrack-mcp",
        "env": { "YAMTRACK_API_KEY": "<token>" }
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`) / Hermes (`~/.hermes/config.yaml`)

Misma estructura `command`; pasá el token mediante la variable de entorno
`YAMTRACK_API_KEY`.

### Transporte HTTP (cualquier cliente que soporte `url` + `headers`)

Iniciá el servidor:

```bash
yamtrack-mcp serve --port 8080 --base-url http://url:port/api
```

Luego configurá el cliente:

```json
{
  "mcpServers": {
    "yamtrack": {
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Ver la [wiki MCP](https://github.com/URD0TH/Yamtrack/wiki/MCP) para ejemplos
detallados de configuración para cada cliente.

## Desarrollo

```bash
npm run verify   # typecheck (tsc) + lint/format (biome) + tests (vitest)
npm run typecheck
npm run lint     # biome check .
npm run format   # biome format --write .
npm run test     # vitest run
npm run dev      # build + run
```

Los tests de integración (`tests/server.test.ts`, `tests/http.test.ts`) manejan
cada herramienta contra una API REST mock en proceso sobre `InMemoryTransport`
y HTTP, cubriendo auth (token estático, header Bearer por petición, token de
fallback) y formas de request/response.

## Resiliencia

Para stdio, el cliente MCP reinicia el proceso al salir. Para HTTP, usá el
subcomando `serve` que corre bajo PM2 con reinicio automático y gestión de
logs (no requiere instalación separada de PM2).

Alternativamente, ejecutá `yamtrack-mcp --transport http` con tu propio
supervisor (systemd, Docker `restart:`, etc.). También hay un helper
`supervise.sh` disponible en el repo.

## Estructura del proyecto

```
yamtrack-mcp/
├── src/
│   ├── index.ts     # Entry: selección de transporte (stdio/http), args CLI
│   ├── client.ts    # YamtrackClient: wrapper REST, auth Bearer
│   └── tools.ts     # Definiciones de herramientas mapeadas a REST (schemas zod)
├── tests/           # Tests de integración con API REST mock
├── biome.json       # Config de lint + format
├── tsconfig*.json   # TypeScript (build + typecheck)
└── vitest.config.ts
```

## FAQ

### `npm install -g github:URD0TH/yamtrack-mcp` no funciona

Ese comando crea un enlace simbólico en nodemodules global apuntando a un
directorio temporal de npm que se elimina al terminar la instalación,
dejando el binario inservible. Es un problema conocido de `npm install -g`
con dependencias git.

Usá en su lugar el tarball del release (método 1) o el paquete de GitHub
Packages (método 2).

## Licencia

Parte del [proyecto Yamtrack](https://github.com/URD0TH/Yamtrack). Ver la
licencia del repositorio principal.