import { Construct } from "@aws-cdk/core";
import { CfnIncludeProps } from "@aws-cdk/cloudformation-include";
import { assetHandler } from "./asset-handler";
import { CategoryStackMapping, CategoryStackMappingWithDeployment } from "./types/category-stack-mapping";
import { IBucket } from "@aws-cdk/aws-s3";
export function createAssetsAndUpdateParameters(
  scope: Construct,
  includeProps: CfnIncludeProps,
  stackMapping: CategoryStackMapping[],
  backendPath: string,
  bucket: IBucket
): CategoryStackMappingWithDeployment[] {
  return stackMapping.map((resource) => {
    const bucketDeployment = assetHandler(
      scope,
      includeProps,
      resource,
      backendPath,
      bucket
    );
    return {
      ...resource,
      bucketDeployment,
    };
  });
}
