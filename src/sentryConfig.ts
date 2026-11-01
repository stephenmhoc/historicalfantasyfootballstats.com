// Shared by the browser and the Worker, so both report the same release. A DSN only
// allows sending events, and it ships in the client bundle anyway, so it is not a secret.
export const sentryOptions = {
  dsn: 'https://58692f0ccd6e2745819d4b41d340e1b3@o4510771621789696.ingest.us.sentry.io/4512358195986432',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  tracesSampleRate: 0.2,
  // The site has no accounts, so nothing about visitors is needed to debug it.
  dataCollection: {
    userInfo: false,
    cookies: false,
    queryParams: false,
    httpBodies: [],
    httpHeaders: {
      request: { allow: ['user-agent', 'accept', 'mcp-protocol-version', 'mcp-method', 'mcp-name'] },
      response: false,
    },
  },
};
