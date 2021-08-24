import { Construct } from "@aws-cdk/core"
import { CfnIncludeProps } from "@aws-cdk/cloudformation-include";
import { assetHandler} from "./asset-handler";
import { CategoryStackMapping } from "./types/category-stack-mapping";
export function createAssetsAndUpdateParameters(scope: Construct, includeProps: CfnIncludeProps, stackMapping : CategoryStackMapping[], backendPath: string ) {
    stackMapping.forEach((resource) => {
      assetHandler(scope, includeProps, resource, backendPath);
    });
}