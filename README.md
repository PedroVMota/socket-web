# Socket Web

HTTP chat UI for the C TCP chat server. Browsers connect to this app over
WebSocket at `/ws`; the app bridges those messages to the internal TCP service
`c-web-socket-server:5555`.

## Run

```sh
npm start
```

## Test

```sh
npm test
```

## Docker

```sh
docker build -t socket-web:latest .
docker run --rm -p 8080:8080 socket-web:latest
```

The GitHub Actions workflow publishes:

```text
ghcr.io/<owner>/<repo>:latest
```

## Kubernetes

Raw manifests live in `infra/manifests`. They expose the app through Ingress
host `chat.local` and keep the TCP chat server internal to the cluster.

Add this host entry locally when Traefik is exposed on localhost:

```text
127.0.0.1 chat.local
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `HTTP_HOST` | `0.0.0.0` | Address to bind. |
| `HTTP_PORT` | `8080` | HTTP port to listen on. |
| `CHAT_TCP_HOST` | `c-web-socket-server` | Internal TCP chat service host. |
| `CHAT_TCP_PORT` | `5555` | Internal TCP chat service port. |
| `STATIC_DIR` | `public` | Static asset directory. |
