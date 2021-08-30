import { CfnIncludeProps } from "@aws-cdk/cloudformation-include";
import { Constants } from "../constants";
import * as path from "path";
import * as fs from "fs-extra";
import { BucketDeployment, Source } from "@aws-cdk/aws-s3-deployment";
import { Construct, NestedStack } from "@aws-cdk/core";
import { CategoryStackMapping } from "../types/category-stack-mapping";
import { v4 } from "uuid";
import { IBucket } from "@aws-cdk/aws-s3";
import * as _ from 'lodash'
const {
  FUNCTION_CATEGORY,
  API_CATEGORY,
  AUTH_CATEGORY,
  AMPLIFY_BUILDS,
  AMPLIFY_APPSYNC_FILES,
  STACK_PARAMETERS,
} = Constants;

function uploadLambdaZip(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string,
  bucket: IBucket
): BucketDeployment {
  const filePath = path.join(
    backendPath,
    FUNCTION_CATEGORY.NAME,
    resourceName,
    AMPLIFY_BUILDS
  );
  const buildFile = path.join(filePath, validateFilesAndReturnPath(filePath));
  const deployment = new BucketDeployment(scope, `${resourceName}-deployment`, {
    destinationBucket: bucket,
    sources: [Source.asset(filePath)],
    destinationKeyPrefix: AMPLIFY_BUILDS,
    prune: false,
  });
  const stacks = includeProps.loadNestedStacks;
  const logicalId = `${FUNCTION_CATEGORY.NAME}${resourceName}`;
  if (stacks) {
    const parameters = stacks[logicalId].parameters;
    if (parameters) {
      parameters[STACK_PARAMETERS.FUNCTION.DEPLOYMENT_BUCKET_NAME] =
        bucket.bucketName;
      parameters[
        STACK_PARAMETERS.FUNCTION.S3_KEY
      ] = `${AMPLIFY_BUILDS}/${path.basename(buildFile)}`;
    }
  }
  return deployment;
}

function uploadLambdaLayerZip(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string,
  bucket: IBucket
): BucketDeployment {
  const filePath = path.join(
    backendPath,
    FUNCTION_CATEGORY.NAME,
    resourceName,
    AMPLIFY_BUILDS
  );
  const deployment = new BucketDeployment(scope, `${resourceName}-deployment`, {
    destinationBucket: bucket,
    sources: [Source.asset(filePath)],
    destinationKeyPrefix: AMPLIFY_BUILDS,
    prune: false,
  });
  const stacks = includeProps.loadNestedStacks;
  const logicalId = `${FUNCTION_CATEGORY.NAME}${resourceName}`;
  if (stacks) {
    const parameters = stacks[logicalId].parameters;
    if (parameters) {
      parameters[STACK_PARAMETERS.FUNCTION.DEPLOYMENT_BUCKET_NAME] =
        bucket.bucketName;
      parameters[STACK_PARAMETERS.FUNCTION.S3_KEY] = AMPLIFY_BUILDS;
    }
  }
  return deployment;
}

function uploadAppSyncFiles(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string,
  bucket: IBucket
): BucketDeployment {
  const filePath = path.join(
    backendPath,
    API_CATEGORY.NAME,
    resourceName,
    AMPLIFY_APPSYNC_FILES
  );
  if (!fs.existsSync(filePath)) {
    throw new Error("Cannot find appsync resources");
  }
  const destinationKey = `assets/${AMPLIFY_APPSYNC_FILES}/${v4().replace(
    "-",
    ""
  )}`;
  const bucketDeployment = new BucketDeployment(
    scope,
    `Appsync-${resourceName}-deployment`,
    {
      destinationBucket: bucket,
      sources: [Source.asset(filePath)],
      destinationKeyPrefix: destinationKey,
    }
  );

  const stacks = includeProps.loadNestedStacks;
  const logicalId = `${API_CATEGORY.NAME}${resourceName}`;
  if (stacks && stacks[logicalId]) {
    const parameters = stacks[logicalId].parameters;
    if (parameters) {
      parameters[STACK_PARAMETERS.API.DEPLOYMENT_BUCKET_NAME] =
        bucket.bucketName;
      parameters[STACK_PARAMETERS.API.DEPLOYMENT_ROOT_KEY] = destinationKey;
    }
  }
  return bucketDeployment;
}

function uploadAuthTriggerFiles(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string,
){
  // const logicalId = `${AUTH_CATEGORY.NAME}${resourceName}`;
  // const nestedStacks = includeProps.loadNestedStacks;
  // const verificationBucketName = _.get(includeProps.loadNestedStacks, [logicalId, 'parameters', AUTH_VERIFICATION_BUCKET_NAME]);
  // if () {
  // }

  // return;
}

function validateFilesAndReturnPath(filePath: string): string {
  const allFiles = fs.readdirSync(filePath);
  if (allFiles?.length > 1) {
    throw new Error();
  }
  const zipFile = allFiles.find((file) => path.extname(file) === ".zip");
  if (zipFile) {
    return zipFile;
  }

  throw new Error(`Zip file not found for category`);
}

const assetHandlerMap: {
  [category: string]: {
    [service: string]: (
      scope: Construct,
      includeProps: CfnIncludeProps,
      resourceName: string,
      backendPath: string,
      bucket: IBucket
    ) => BucketDeployment | undefined;
  };
} = {
  function: {
    Lambda: uploadLambdaZip,
    LambdaLayer: uploadLambdaLayerZip,
  },
  api: {
    AppSync: uploadAppSyncFiles,
  },
  // auth: {
  //   Cognito: uploadAuthTriggerFiles,
  // }
};

export function assetHandler(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resource: CategoryStackMapping,
  backendPath: string,
  bucket: IBucket
): BucketDeployment | undefined {
  if (resource.category in assetHandlerMap) {
    if (resource.service in assetHandlerMap[resource.category]) {
      return assetHandlerMap[resource.category][resource.service](
        scope,
        includeProps,
        resource.resourceName,
        backendPath,
        bucket
      );
    }
  }
  return;
}
