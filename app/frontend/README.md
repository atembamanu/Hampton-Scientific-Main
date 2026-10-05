# Hampton Scientific frontend

Production UI for the Hampton portal (facility + admin).

## Docker (recommended)

From the repo root:

```bash
docker compose up -d --build frontend
```

Open **http://localhost:3001**

`REACT_APP_BACKEND_URL` is baked in at image build time (Compose build arg / Dokploy build args).

## Local yarn (optional)

```bash
yarn install
yarn start
```

Uses repo-root `.env` `PORT` (default 3001) and `REACT_APP_BACKEND_URL`.
