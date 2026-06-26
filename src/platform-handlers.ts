import type { ApitoGraphQLClient, GraphQLRequestOptions } from './graphql-client.js';
import * as tenants from './graphql/tenants.js';
import * as appUsers from './graphql/app-users.js';
import * as projectAdmin from './graphql/project-admin.js';
import * as integrations from './graphql/integrations.js';
import * as dataPlane from './graphql/data-plane.js';
import { getSaasAuthGuideContent } from './guides/saas-auth-guide.js';

function textResult(data: unknown, prefix?: string): { content: { type: 'text'; text: string }[] } {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text: prefix ? `${prefix}\n\n${body}` : body }],
  };
}

function reqOpts(args: Record<string, unknown>): GraphQLRequestOptions | undefined {
  const tid = typeof args.tenant_id === 'string' ? args.tenant_id.trim() : '';
  return tid ? { tenantId: tid } : undefined;
}

export async function handlePlatformTool(
  name: string,
  args: Record<string, unknown>,
  client: ApitoGraphQLClient
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const ro = reqOpts(args);

  switch (name) {
    case 'list_tenants':
      return textResult(await tenants.listTenants(client, ro));
    case 'create_tenant':
      return textResult(
        await tenants.createTenant(
          client,
          {
            name: String(args.name),
            data: args.data != null ? String(args.data) : undefined,
            domain: args.domain != null ? String(args.domain) : undefined,
          },
          ro
        )
      );
    case 'update_tenant':
      return textResult(
        await tenants.updateTenant(
          client,
          {
            tenant_id: String(args.tenant_id),
            name: args.name != null ? String(args.name) : undefined,
            data: args.data != null ? String(args.data) : undefined,
            domain: args.domain != null ? String(args.domain) : undefined,
          },
          ro
        )
      );
    case 'delete_tenant':
      return textResult({ ok: await tenants.deleteTenant(client, String(args.tenant_id), ro) });
    case 'generate_tenant_token': {
      const result = await tenants.generateTenantToken(
        client,
        {
          tenant_id: String(args.tenant_id),
          duration: String(args.duration),
          role: args.role != null ? String(args.role) : undefined,
        },
        ro
      );
      return textResult(result, appUsers.SENSITIVE_TOKEN_WARNING);
    }
    case 'search_tenant_by_domain':
      return textResult(
        await tenants.searchTenantByDomain(
          client,
          { project_id: String(args.project_id), domain: String(args.domain) },
          ro
        )
      );

    case 'search_app_users':
      return textResult(
        await appUsers.searchAppUsers(
          client,
          {
            project_id: String(args.project_id),
            limit: args.limit as number | undefined,
            offset: args.offset as number | undefined,
            tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
          },
          ro
        )
      );
    case 'create_app_user':
      return textResult(
        await appUsers.createAppUser(
          client,
          {
            project_id: String(args.project_id),
            password: String(args.password),
            email: args.email != null ? String(args.email) : undefined,
            phone: args.phone != null ? String(args.phone) : undefined,
            role: args.role != null ? String(args.role) : undefined,
            username: args.username != null ? String(args.username) : undefined,
            tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
          },
          ro
        )
      );
    case 'update_app_user':
      return textResult(
        await appUsers.updateAppUser(
          client,
          {
            user_id: String(args.user_id),
            email: args.email != null ? String(args.email) : undefined,
            phone: args.phone != null ? String(args.phone) : undefined,
            role: args.role != null ? String(args.role) : undefined,
            username: args.username != null ? String(args.username) : undefined,
            tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
          },
          ro
        )
      );
    case 'delete_app_user':
      return textResult({ ok: await appUsers.deleteAppUser(client, String(args.user_id), ro) });
    case 'reset_app_user_password':
      return textResult({
        ok: await appUsers.resetAppUserPassword(
          client,
          { user_id: String(args.user_id), password: String(args.password) },
          ro
        ),
      });
    case 'login_app_user': {
      const result = await appUsers.loginAppUser(
        client,
        {
          project_id: String(args.project_id),
          tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
          email: args.email != null ? String(args.email) : undefined,
          phone: args.phone != null ? String(args.phone) : undefined,
          password: String(args.password),
        },
        ro
      );
      return textResult(result, appUsers.SENSITIVE_TOKEN_WARNING);
    }
    case 'google_oauth_state':
      return textResult({
        state: await appUsers.googleOAuthState(client, String(args.project_id), ro),
      });
    case 'login_app_user_google': {
      const result = await appUsers.loginAppUser(
        client,
        {
          project_id: String(args.project_id),
          tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
          auth_method: 'google',
          code: args.code != null ? String(args.code) : undefined,
          state: args.state != null ? String(args.state) : undefined,
          id_token: args.id_token != null ? String(args.id_token) : undefined,
        },
        ro
      );
      return textResult(result, appUsers.SENSITIVE_TOKEN_WARNING);
    }

    case 'get_schema_diff': {
      const diff = await client.getSchemaDiff(
        args.changeset_id != null ? String(args.changeset_id) : undefined
      );
      return textResult(diff);
    }
    case 'list_schema_versions':
      return textResult(
        await projectAdmin.listSchemaVersions(
          client,
          { limit: args.limit as number | undefined, offset: args.offset as number | undefined },
          ro
        )
      );
    case 'list_schema_change_events':
      return textResult(
        await projectAdmin.listSchemaChangeEvents(
          client,
          args.changeset_id != null ? String(args.changeset_id) : undefined,
          ro
        )
      );
    case 'discard_schema_draft':
      return textResult({
        ok: await projectAdmin.discardSchemaDraft(client, String(args.changeset_id), ro),
      });

    case 'list_roles':
      return textResult(await projectAdmin.listRoles(client, ro));
    case 'get_permissions_catalog':
      return textResult(await projectAdmin.getPermissionsCatalog(client, ro));
    case 'upsert_role':
      return textResult(
        await projectAdmin.upsertRole(
          client,
          {
            name: String(args.name),
            is_admin: args.is_admin as boolean | undefined,
            logic_executions: args.logic_executions as string[] | undefined,
            api_permissions: args.api_permissions as Record<string, unknown> | undefined,
          },
          ro
        )
      );
    case 'duplicate_role':
      return textResult(
        await projectAdmin.duplicateRole(
          client,
          { source_role: String(args.source_role), new_name: String(args.new_name) },
          ro
        )
      );
    case 'delete_role':
      return textResult(await projectAdmin.deleteRole(client, String(args.role), ro));
    case 'get_project_settings':
      return textResult(await projectAdmin.getProjectSettings(client, ro));
    case 'update_project_settings':
      return textResult(
        await projectAdmin.updateProjectSettings(
          client,
          {
            name: args.name != null ? String(args.name) : undefined,
            description: args.description != null ? String(args.description) : undefined,
            settings: args.settings as Record<string, unknown> | undefined,
          },
          ro
        )
      );
    case 'list_api_keys':
      return textResult(await projectAdmin.listApiKeys(client, ro));
    case 'create_api_key': {
      const result = await projectAdmin.createApiKey(
        client,
        {
          name: String(args.name),
          duration: String(args.duration),
          role: String(args.role),
        },
        ro
      );
      return textResult(result, appUsers.SENSITIVE_TOKEN_WARNING);
    }
    case 'delete_api_key':
      return textResult(
        await projectAdmin.deleteApiKey(
          client,
          { duration: String(args.duration), token: String(args.token) },
          ro
        )
      );
    case 'get_auth_settings':
      return textResult(
        await projectAdmin.getAuthSettings(
          client,
          args.project_id != null ? String(args.project_id) : undefined,
          ro
        )
      );
    case 'update_auth_settings':
      return textResult(
        await projectAdmin.updateAuthSettings(
          client,
          args.input as Record<string, unknown>,
          ro
        )
      );
    case 'get_storage_settings':
      return textResult(
        await projectAdmin.getStorageSettings(
          client,
          args.project_id != null ? String(args.project_id) : undefined,
          ro
        )
      );
    case 'update_storage_settings':
      return textResult(
        await projectAdmin.updateStorageSettings(
          client,
          args.input as Record<string, unknown>,
          ro
        )
      );
    case 'list_team_members':
      return textResult(await projectAdmin.listTeamMembers(client, ro));
    case 'update_team_members':
      return textResult(
        await projectAdmin.updateTeamMembers(
          client,
          {
            add_team_member: args.add_team_member as Record<string, unknown> | undefined,
            remove_team_member: args.remove_team_member as Record<string, unknown> | undefined,
          },
          ro
        )
      );

    case 'list_webhooks':
      return textResult(await integrations.listWebhooks(client, ro));
    case 'create_webhook':
      return textResult(
        await integrations.createWebhook(
          client,
          {
            events: args.events as string[],
            model: String(args.model),
            name: String(args.name),
            url: String(args.url),
            logic_executions: args.logic_executions as string[] | undefined,
          },
          ro
        )
      );
    case 'delete_webhook':
      return textResult(await integrations.deleteWebhook(client, String(args.id), ro));
    case 'list_plugins':
      return textResult(await integrations.listPlugins(client, String(args.type), ro));
    case 'configure_plugin':
      return textResult(
        await integrations.configurePlugin(
          client,
          {
            id: String(args.id),
            enable: args.enable as boolean | undefined,
            activate_status: args.activate_status != null ? String(args.activate_status) : undefined,
            env_vars: args.env_vars as Array<{ key: string; value: string }> | undefined,
          },
          ro
        )
      );
    case 'remove_plugin':
      return textResult(await integrations.removePlugin(client, String(args.id), ro));
    case 'list_functions':
      return textResult(await integrations.listFunctions(client, ro));
    case 'upsert_function':
      return textResult(
        await integrations.upsertFunction(
          client,
          {
            name: String(args.name),
            description: args.description != null ? String(args.description) : undefined,
            function_connected: args.function_connected as boolean | undefined,
            function_provider_id:
              args.function_provider_id != null ? String(args.function_provider_id) : undefined,
            update: args.update as boolean | undefined,
          },
          ro
        )
      );
    case 'delete_function':
      return textResult(await integrations.deleteFunction(client, String(args.function), ro));
    case 'list_media':
      return textResult(
        await integrations.listMedia(
          client,
          {
            limit: args.limit as number | undefined,
            page: args.page as number | undefined,
            search: args.search != null ? String(args.search) : undefined,
          },
          ro
        )
      );
    case 'upload_media_from_url':
      return textResult(await integrations.uploadMediaFromUrl(client, String(args.url), ro));
    case 'delete_media':
      return textResult(await integrations.deleteMedia(client, args.ids as string[], ro));

    case 'list_data':
      return textResult(
        await dataPlane.queryDataList(client, {
          model_name: String(args.model_name),
          page: args.page as number | undefined,
          limit: args.limit as number | undefined,
          where: args.where as Record<string, unknown> | undefined,
          status: args.status != null ? String(args.status) : undefined,
          search: args.search != null ? String(args.search) : undefined,
          tenant_id: args.tenant_id != null ? String(args.tenant_id) : undefined,
        })
      );
    case 'connect_relation': {
      const doc = await client.upsertModelData(
        String(args.model_name),
        (args.payload as Record<string, unknown>) ?? {},
        {
          _id: args._id != null ? String(args._id) : undefined,
          connect: args.connect as Record<string, unknown>,
        },
        ro
      );
      return textResult(doc);
    }
    case 'disconnect_relation': {
      const doc = await client.upsertModelData(
        String(args.model_name),
        {},
        {
          _id: String(args._id),
          disconnect: args.disconnect as Record<string, unknown>,
        },
        ro
      );
      return textResult(doc);
    }
    case 'get_model_document_counts':
      return textResult(
        await dataPlane.getModelDocumentCounts(
          client,
          args.models as string[] | undefined,
          ro
        )
      );
    case 'list_document_revisions':
      return textResult(
        await dataPlane.listDocumentRevisions(
          client,
          {
            _id: String(args._id),
            model: args.model != null ? String(args.model) : undefined,
          },
          ro
        )
      );
    case 'reorder_fields':
      return textResult(
        await dataPlane.reorderFields(
          client,
          {
            model_name: String(args.model_name),
            field_name: String(args.field_name),
            serial: Number(args.serial),
          },
          ro
        )
      );
    case 'get_saas_auth_guide':
      return textResult(getSaasAuthGuideContent());

    default:
      throw new Error(`Unknown platform tool: ${name}`);
  }
}

export const PLATFORM_TOOL_NAMES = new Set([
  'list_tenants',
  'create_tenant',
  'update_tenant',
  'delete_tenant',
  'generate_tenant_token',
  'search_tenant_by_domain',
  'search_app_users',
  'create_app_user',
  'update_app_user',
  'delete_app_user',
  'reset_app_user_password',
  'login_app_user',
  'google_oauth_state',
  'login_app_user_google',
  'get_schema_diff',
  'list_schema_versions',
  'list_schema_change_events',
  'discard_schema_draft',
  'list_roles',
  'get_permissions_catalog',
  'upsert_role',
  'duplicate_role',
  'delete_role',
  'get_project_settings',
  'update_project_settings',
  'list_api_keys',
  'create_api_key',
  'delete_api_key',
  'get_auth_settings',
  'update_auth_settings',
  'get_storage_settings',
  'update_storage_settings',
  'list_team_members',
  'update_team_members',
  'list_webhooks',
  'create_webhook',
  'delete_webhook',
  'list_plugins',
  'configure_plugin',
  'remove_plugin',
  'list_functions',
  'upsert_function',
  'delete_function',
  'list_media',
  'upload_media_from_url',
  'delete_media',
  'list_data',
  'connect_relation',
  'disconnect_relation',
  'get_model_document_counts',
  'list_document_revisions',
  'reorder_fields',
  'get_saas_auth_guide',
]);
