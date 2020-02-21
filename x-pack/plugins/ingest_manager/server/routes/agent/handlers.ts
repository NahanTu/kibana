/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { RequestHandler } from 'kibana/server';
import { TypeOf } from '@kbn/config-schema';
import {
  GetAgentsRequestSchema,
  GetOneAgentRequestSchema,
  UpdateAgentRequestSchema,
  DeleteAgentRequestSchema,
  GetOneAgentEventsRequestSchema,
  PostAgentCheckinRequestSchema,
  PostAgentEnrollRequestSchema,
  PostAgentAcksRequestSchema,
  PostAgentUnenrollRequestSchema,
  GetAgentStatusForPolicySchema,
  GetAgentsResponse,
  PostAgentUnenrollResponse,
  GetOneAgentResponse,
  GetOneAgentEventsResponse,
} from '../../types';
import * as AgentService from '../../services/agents';
import * as APIKeyService from '../../services/api_keys';
import { appContextService } from '../../services/app_context';

export const getAgentHandler: RequestHandler<TypeOf<
  typeof GetOneAgentRequestSchema.params
>> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    const agent = await AgentService.getAgent(soClient, request.params.agentId);

    const body: GetOneAgentResponse = {
      item: {
        ...agent,
        status: AgentService.getAgentStatus(agent),
      },
      success: true,
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom && e.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent ${request.params.agentId} not found` },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const getAgentEventsHandler: RequestHandler<
  TypeOf<typeof GetOneAgentEventsRequestSchema.params>,
  TypeOf<typeof GetOneAgentEventsRequestSchema.query>
> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    const { page, perPage, kuery } = request.query;
    const { items, total } = await AgentService.getAgentEvents(soClient, request.params.agentId, {
      page,
      perPage,
      kuery,
    });

    const body: GetOneAgentEventsResponse = {
      list: items,
      total,
      success: true,
      page,
      perPage,
    };

    return response.ok({
      body,
    });
  } catch (e) {
    if (e.isBoom && e.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent ${request.params.agentId} not found` },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const deleteAgentHandler: RequestHandler<TypeOf<
  typeof DeleteAgentRequestSchema.params
>> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    await AgentService.deleteAgent(soClient, request.params.agentId);

    const body = {
      success: true,
      action: 'deleted',
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom) {
      return response.customError({
        statusCode: e.output.statusCode,
        body: { message: `Agent ${request.params.agentId} not found` },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const updateAgentHandler: RequestHandler<
  TypeOf<typeof UpdateAgentRequestSchema.params>,
  undefined,
  TypeOf<typeof UpdateAgentRequestSchema.body>
> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    await AgentService.updateAgent(soClient, request.params.agentId, {
      userProvidedMetatada: request.body.user_provided_metadata,
    });
    const agent = await AgentService.getAgent(soClient, request.params.agentId);

    const body = {
      item: {
        ...agent,
        status: AgentService.getAgentStatus(agent),
      },
      success: true,
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom && e.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent ${request.params.agentId} not found` },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const postAgentCheckinHandler: RequestHandler<
  TypeOf<typeof PostAgentCheckinRequestSchema.params>,
  undefined,
  TypeOf<typeof PostAgentCheckinRequestSchema.body>
> = async (context, request, response) => {
  try {
    const soClient = appContextService.getInternalSavedObjectsClient();
    const callCluster = context.core.elasticsearch.adminClient.callAsCurrentUser;
    const res = await APIKeyService.verifyAccessApiKey({ headers: request.headers, callCluster });
    if (!res.valid) {
      return response.unauthorized({
        body: { message: 'Invalid Access API Key' },
      });
    }
    const agent = await AgentService.getAgentByAccessAPIKeyId(
      soClient,
      res.accessApiKeyId as string
    );
    const { actions } = await AgentService.agentCheckin(
      soClient,
      agent,
      request.body.events || [],
      request.body.local_metadata
    );
    const body = {
      action: 'checkin',
      success: true,
      actions: actions.map(a => ({
        type: a.type,
        data: a.data ? JSON.parse(a.data) : a.data,
        id: a.id,
      })),
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom && e.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent ${request.params.agentId} not found` },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const postAgentAcksHandler: RequestHandler<
  TypeOf<typeof PostAgentAcksRequestSchema.params>,
  undefined,
  TypeOf<typeof PostAgentAcksRequestSchema.body>
> = async (context, request, response) => {
  try {
    const soClient = appContextService.getInternalSavedObjectsClient();
    const callCluster = context.core.elasticsearch.adminClient.callAsCurrentUser;
    const res = await APIKeyService.verifyAccessApiKey({ headers: request.headers, callCluster });
    if (!res.valid) {
      return response.unauthorized({
        body: { message: 'Invalid Access API Key' },
      });
    }
    const agent = await AgentService.getAgentByAccessAPIKeyId(
      soClient,
      res.accessApiKeyId as string
    );

    await AgentService.acknowledgeAgentActions(soClient, agent, request.body.action_ids);

    const body = {
      action: 'acks',
      success: true,
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom) {
      return response.customError({
        statusCode: e.output.statusCode,
        body: { message: e.message },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const postAgentEnrollHandler: RequestHandler<
  undefined,
  undefined,
  TypeOf<typeof PostAgentEnrollRequestSchema.body>
> = async (context, request, response) => {
  try {
    const soClient = appContextService.getInternalSavedObjectsClient();
    const callCluster = context.core.elasticsearch.adminClient.callAsCurrentUser;
    const res = await APIKeyService.verifyEnrollmentAPIKey({
      soClient,
      headers: request.headers,
      callCluster,
    });
    if (!res.valid || !res.enrollmentAPIKey) {
      return response.unauthorized({
        body: { message: 'Invalid Enrollment API Key' },
      });
    }
    const agent = await AgentService.enroll(
      soClient,
      request.body.type,
      res.enrollmentAPIKey.policy_id as string,
      {
        userProvided: request.body.metadata.user_provided,
        local: request.body.metadata.local,
      },
      request.body.shared_id
    );
    const body = {
      action: 'created',
      success: true,
      item: {
        ...agent,
        status: AgentService.getAgentStatus(agent),
      },
    };

    return response.ok({ body });
  } catch (e) {
    if (e.isBoom) {
      return response.customError({
        statusCode: e.output.statusCode,
        body: { message: e.message },
      });
    }

    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const getAgentsHandler: RequestHandler<
  undefined,
  TypeOf<typeof GetAgentsRequestSchema.query>
> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    const { agents, total, page, perPage } = await AgentService.listAgents(soClient, {
      page: request.query.page,
      perPage: request.query.perPage,
      showInactive: request.query.showInactive,
      kuery: request.query.kuery,
    });

    const body: GetAgentsResponse = {
      list: agents.map(agent => ({
        ...agent,
        status: AgentService.getAgentStatus(agent),
      })),
      success: true,
      total,
      page,
      perPage,
    };
    return response.ok({ body });
  } catch (e) {
    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const postAgentsUnenrollHandler: RequestHandler<
  undefined,
  undefined,
  TypeOf<typeof PostAgentUnenrollRequestSchema.body>
> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    const kuery = (request.body as { kuery: string }).kuery;
    let toUnenrollIds: string[] = (request.body as { ids: string[] }).ids || [];

    if (kuery) {
      let hasMore = true;
      let page = 1;
      while (hasMore) {
        const { agents } = await AgentService.listAgents(soClient, {
          page: page++,
          perPage: 100,
          kuery,
          showInactive: true,
        });
        if (agents.length === 0) {
          hasMore = false;
        }
        const agentIds = agents.filter(a => a.active).map(a => a.id);
        toUnenrollIds = toUnenrollIds.concat(agentIds);
      }
    }
    const results = (await AgentService.unenrollAgents(soClient, toUnenrollIds)).map(
      ({
        success,
        id,
        error,
      }): {
        success: boolean;
        id: string;
        action: 'unenrolled';
        error?: {
          message: string;
        };
      } => {
        return {
          success,
          id,
          action: 'unenrolled',
          error: error && {
            message: error.message,
          },
        };
      }
    );

    const body: PostAgentUnenrollResponse = {
      results,
      success: results.every(result => result.success),
    };
    return response.ok({ body });
  } catch (e) {
    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};

export const getAgentStatusForPolicyHandler: RequestHandler<TypeOf<
  typeof GetAgentStatusForPolicySchema.params
>> = async (context, request, response) => {
  const soClient = context.core.savedObjects.client;
  try {
    const result = await AgentService.getAgentsStatusForPolicy(soClient, request.params.policyId);

    const body = { result, success: true };

    return response.ok({ body });
  } catch (e) {
    return response.customError({
      statusCode: 500,
      body: { message: e.message },
    });
  }
};
