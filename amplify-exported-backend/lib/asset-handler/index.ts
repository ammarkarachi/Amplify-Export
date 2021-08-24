import { CfnIncludeProps } from "@aws-cdk/cloudformation-include";
import { Constants } from "../Constants";
import * as path from "path";
import * as fs from "fs-extra";
import { Asset, AssetProps, } from "@aws-cdk/aws-s3-assets";
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment'
import { AssetHashType, AssetStaging, BundlingOutput, Construct, DefaultStackSynthesizer, DockerImage, FileAssetPackaging, IAsset, Stack } from "@aws-cdk/core";
import { CategoryStackMapping } from "../types/category-stack-mapping";
import { AssetManifestArtifact } from "@aws-cdk/core/node_modules/@aws-cdk/cx-api";
import { Bucket } from "@aws-cdk/aws-s3";
import { v4, v5 } from 'uuid';
const { FUNCTION_CATEGORY, API_CATEGORY, AMPLIFY_BUILDS, AMPLIFY_APPSYNC_FILES, STACK_PARAMETERS } = Constants;

function uploadLambdaZip(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string
) {
  const filePath = path.join(
    backendPath,
    FUNCTION_CATEGORY.NAME,
    resourceName,
    AMPLIFY_BUILDS
  );
  
  const buildFile = path.join(filePath, validateFilesAndReturnPath(filePath));
  const asset = new Asset(scope, `${resourceName}-asset`, {
    path: buildFile,
  });
  const stacks = includeProps.loadNestedStacks;
  const logicalId = `${FUNCTION_CATEGORY.NAME}${resourceName}`;
  if (stacks) {
    const parameters = stacks[logicalId].parameters;
    if (parameters) {
      parameters[STACK_PARAMETERS.FUNCTION.DEPLOYMENT_BUCKET_NAME] =
        asset.s3BucketName;
      parameters[STACK_PARAMETERS.FUNCTION.S3_KEY] = asset.s3ObjectKey;
    }
  }
}


function uploadAppSyncFiles(
  scope: Construct,
  includeProps: CfnIncludeProps,
  resourceName: string,
  backendPath: string
) {
  const filePath = path.join(
    backendPath,
    API_CATEGORY.NAME,
    resourceName,
    AMPLIFY_APPSYNC_FILES,
  );
  if (!fs.existsSync(filePath)) {
    throw new Error("Cannot find appsync resources")
  }
  const destinationKey = `assets/${AMPLIFY_APPSYNC_FILES}/${v4().replace('-', '')}`;
  const schemaFile = "schema.graphql";
  const location = (scope as Stack).synthesizer.addFileAsset({
    packaging: FileAssetPackaging.FILE,
    sourceHash: path.join(destinationKey, schemaFile),
    fileName: path.join(filePath, schemaFile)
  })
  DefaultStackSynthesizer.DEFAULT_QUALIFIER
  const bucket = Bucket.fromBucketName(scope, "deploymentBucket", location.bucketName);
  new BucketDeployment(scope, `Appsync-${resourceName}-deployment`, {
    destinationBucket: bucket,
    sources: [Source.asset(filePath, {})],
    destinationKeyPrefix: destinationKey,
  })
  

   const stacks = includeProps.loadNestedStacks;
   const logicalId = `${API_CATEGORY.NAME}${resourceName}`;
   if (stacks && stacks[logicalId]) {
     const parameters = stacks[logicalId].parameters;
     if (parameters) {
       parameters[STACK_PARAMETERS.API.DEPLOYMENT_BUCKET_NAME] = location.bucketName;
       parameters[STACK_PARAMETERS.API.DEPLOYMENT_ROOT_KEY] = destinationKey;
     }
   }
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
      backendPath: string
    ) => void;
  };
} = {
  function: {
    Lambda: uploadLambdaZip,
    LambdaLayer: uploadLambdaZip,
  },
  api: {
    AppSync: uploadAppSyncFiles
  }
};

export function assetHandler(scope: Construct, includeProps: CfnIncludeProps, resource: CategoryStackMapping, backendPath: string): void {
  if (resource.category in assetHandlerMap) {
    if (resource.service in assetHandlerMap[resource.category]) {
      assetHandlerMap[resource.category][resource.service](scope, includeProps, resource.resourceName, backendPath);
    }
  }
}
