# Trike Backoffice Dashboard Application SCHEMA SANDBOX

This is a code bundle for Trike Backoffice Dashboard Application SCHEMA SANDBOX. The original project is available at https://www.figma.com/design/aQqsGmiRMNMDNmDl6lfSlA/Trike-Backoffice-Dashboard-Application-SCHEMA-SANDBOX.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Demo Mode Development

**While building demo mode**, there is no real auth session — Edge Function calls will 401 if you use an empty Bearer token. Use the anon key as fallback:

```typescript
const authToken = session?.access_token || publicAnonKey;
headers: { 'Authorization': `Bearer ${authToken}`, 'apikey': publicAnonKey }
```

See **[docs/DEMO_MODE_DEVELOPMENT.md](docs/DEMO_MODE_DEVELOPMENT.md)** for full pattern and checklist.
  