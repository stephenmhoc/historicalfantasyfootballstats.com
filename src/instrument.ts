import * as Sentry from '@sentry/react';
import { sentryOptions } from './sentryConfig';

Sentry.init({
  ...sentryOptions,
  integrations: [Sentry.browserTracingIntegration()],
  // Only this site's scripts, which drops the noise from extensions and injected code.
  allowUrls: [window.location.origin],
});
