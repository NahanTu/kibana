/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import {
  CoreSetup,
  CoreStart,
  Plugin,
  PluginInitializerContext,
  SavedObjectsLegacyService,
} from 'kibana/server';
import { SavedObjectsClient } from '../../../../src/core/server';
import { LicensingPluginSetup } from '../../licensing/server';
import { EncryptedSavedObjectsPluginStart } from '../../encrypted_saved_objects/server';
import { SecurityPluginSetup } from '../../security/server';
import { PluginSetupContract as FeaturesPluginSetup } from '../../features/server';
import {
  PLUGIN_ID,
  AGENT_SAVED_OBJECT_TYPE,
  AGENT_EVENT_SAVED_OBJECT_TYPE,
  ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
} from './constants';

import {
  registerEPMRoutes,
  registerDatasourceRoutes,
  registerAgentConfigRoutes,
  registerFleetSetupRoutes,
  registerAgentRoutes,
  registerEnrollmentApiKeyRoutes,
  registerInstallScriptRoutes,
} from './routes';

import { IngestManagerConfigType } from '../common';
import { appContextService } from './services';

export interface IngestManagerSetupDeps {
  licensing: LicensingPluginSetup;
  security?: SecurityPluginSetup;
  features?: FeaturesPluginSetup;
}

/**
 * Describes a set of APIs that is available in the legacy platform only and required by this plugin
 * to function properly.
 */
export interface LegacyAPI {
  savedObjects: SavedObjectsLegacyService;
}

export interface IngestManagerAppContext {
  encryptedSavedObjects: EncryptedSavedObjectsPluginStart;
  security?: SecurityPluginSetup;
  config$?: Observable<IngestManagerConfigType>;
  internalSavedObjectsClient: SavedObjectsClient;
}

export class IngestManagerPlugin implements Plugin {
  private config$: Observable<IngestManagerConfigType>;
  private security: SecurityPluginSetup | undefined;

  constructor(private readonly initializerContext: PluginInitializerContext) {
    this.config$ = this.initializerContext.config.create<IngestManagerConfigType>();
  }

  public async setup(core: CoreSetup, deps: IngestManagerSetupDeps) {
    if (deps.security) {
      this.security = deps.security;
    }

    // Register feature
    // TODO: Flesh out privileges
    if (deps.features) {
      deps.features.registerFeature({
        id: PLUGIN_ID,
        name: 'Ingest Manager',
        icon: 'savedObjectsApp',
        navLinkId: PLUGIN_ID,
        app: [PLUGIN_ID, 'kibana'],
        privileges: {
          all: {
            api: [PLUGIN_ID],
            savedObject: {
              all: [
                AGENT_SAVED_OBJECT_TYPE,
                AGENT_EVENT_SAVED_OBJECT_TYPE,
                ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
              ],
              read: [],
            },
            ui: ['show', 'read', 'write'],
          },
          read: {
            api: [PLUGIN_ID],
            savedObject: {
              all: [],
              read: [
                AGENT_SAVED_OBJECT_TYPE,
                AGENT_EVENT_SAVED_OBJECT_TYPE,
                ENROLLMENT_API_KEYS_SAVED_OBJECT_TYPE,
              ],
            },
            ui: ['show', 'read'],
          },
        },
      });
    }

    const router = core.http.createRouter();
    const config = await this.config$.pipe(first()).toPromise();

    // Register routes
    registerAgentConfigRoutes(router);
    registerDatasourceRoutes(router);
    registerAgentRoutes(router);
    registerEnrollmentApiKeyRoutes(router);
    registerInstallScriptRoutes({
      router,
      serverInfo: core.http.getServerInfo(),
      basePath: core.http.basePath,
    });

    // Conditional routes
    if (config.epm.enabled) registerEPMRoutes(router);
    if (config.fleet.enabled) registerFleetSetupRoutes(router);
  }

  public async start(
    core: CoreStart,
    plugins: {
      encryptedSavedObjects: EncryptedSavedObjectsPluginStart;
    }
  ) {
    const internalSavedObjectsClient = new SavedObjectsClient(
      core.savedObjects.createInternalRepository()
    );
    appContextService.start({
      encryptedSavedObjects: plugins.encryptedSavedObjects,
      security: this.security,
      config$: this.config$,
      internalSavedObjectsClient,
    });
  }

  public async stop() {
    appContextService.stop();
  }
}
