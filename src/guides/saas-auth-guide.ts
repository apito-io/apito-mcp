export function getSaasAuthGuideContent(): string {
  return `# Apito SaaS app user authentication (MCP)

MCP tools call **system GraphQL** with your project API key (\`X-Apito-Key\`). App end-user auth returns **project/tenant user JWTs** — not console operator cookies. Treat tokens as secrets.

## Tenant context

- **Per-tenant separate DB**: pass \`tenant_id\` on create/search/login tools, or set \`TENANT_ID\` / \`APITO_TENANT_ID\` in MCP env (sent as \`X-Apito-Tenant-ID\`).
- **Shared DB SaaS**: \`tenant_id\` still scopes app users and many data operations.

## Local login (\`login_app_user\`)

1. Ensure auth is enabled in project settings (\`get_auth_settings\`).
2. Call \`login_app_user\` with \`project_id\`, \`password\`, and **email** or **phone**.
3. For SaaS, include \`tenant_id\` when the project uses per-tenant DB.
4. Response: \`{ token, user }\` — use \`token\` as Bearer on **public** \`/secured/graphql\` (not MCP's system key).

## Google OAuth (\`google_oauth_state\` + \`login_app_user_google\`)

1. Configure Google client ID/secret in Console → Project Settings → Authentication (or \`update_auth_settings\`).
2. \`google_oauth_state\` with \`project_id\` → returns \`state\`.
3. Open in browser (replace placeholders):

\`\`\`
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=openid%20email%20profile&state=STATE_FROM_STEP_2
\`\`\`

4. After redirect, copy \`code\` (and confirm \`state\` matches).
5. \`login_app_user_google\` with \`project_id\`, \`code\`, \`state\`, optional \`tenant_id\`.
   - Alternatively pass \`id_token\` if your client obtained one directly.

## Admin user management (same API key as MCP)

| Tool | Purpose |
|------|---------|
| \`search_app_users\` | List users (optional \`tenant_id\`) |
| \`create_app_user\` | Create with password |
| \`update_app_user\` | Update email/phone/role |
| \`delete_app_user\` | Remove user |
| \`reset_app_user_password\` | Set new password |

## Security notes

- Never commit tokens or API keys.
- MCP \`login_*\` tools are for **testing** integrations; production apps should use public GraphQL or your app backend.
- Google OAuth requires a real browser redirect; MCP cannot complete OAuth without you pasting the callback \`code\`.
`;
}
