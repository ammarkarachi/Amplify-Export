import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AmplifyExportedBackend from '../lib/exported-backend';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
  const stack = new AmplifyExportedBackend.AmplifyExportedBackend(app, 'MyTestStack', {
      path: './'
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
