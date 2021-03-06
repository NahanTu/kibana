/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { storiesOf } from '@storybook/react';
import React from 'react';
import { HttpSetup } from 'kibana/public';
import { AgentConfiguration } from '../../../../../../common/agent_configuration/configuration_types';
import { FETCH_STATUS } from '../../../../../hooks/useFetcher';
import { createCallApmApi } from '../../../../../services/rest/createCallApmApi';
import { AgentConfigurationCreateEdit } from './index';
import {
  ApmPluginContext,
  ApmPluginContextValue
} from '../../../../../context/ApmPluginContext';

storiesOf(
  'app/Settings/AgentConfigurations/AgentConfigurationCreateEdit',
  module
).add(
  'with config',
  () => {
    const httpMock = {};

    // mock
    createCallApmApi((httpMock as unknown) as HttpSetup);

    const contextMock = {
      core: {
        notifications: { toasts: { addWarning: () => {}, addDanger: () => {} } }
      }
    };
    return (
      <ApmPluginContext.Provider
        value={(contextMock as unknown) as ApmPluginContextValue}
      >
        <AgentConfigurationCreateEdit
          pageStep="choose-settings-step"
          existingConfigResult={{
            status: FETCH_STATUS.SUCCESS,
            data: {
              service: { name: 'opbeans-node', environment: 'production' },
              settings: {}
            } as AgentConfiguration
          }}
        />
      </ApmPluginContext.Provider>
    );
  },
  {
    info: {
      source: false
    }
  }
);
