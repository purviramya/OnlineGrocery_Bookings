// Better Auth browser client. The only place that talks to /api/auth/*.
// Facebook and Instagram both use authClient.signIn.social({ provider }).
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
