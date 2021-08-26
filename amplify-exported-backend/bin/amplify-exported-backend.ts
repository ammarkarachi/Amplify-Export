#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AmplifyExportedBackend } from '../lib/exported-backend';

const app = new cdk.App();

const amplifyBackend = new AmplifyExportedBackend(app, "AmplifyBackend", {
  stage: 'dev',
  path: "./amplify-stuff",

})

amplifyBackend.getAuthNestedStack().getIdentityPool();