#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AmplifyExportedBackend } from '../lib/exported-backend';

const app = new cdk.App();

new AmplifyExportedBackend(app, "AmplifyBackend", {
  env: 'dev',
  path: "./amplify-stuff",

})