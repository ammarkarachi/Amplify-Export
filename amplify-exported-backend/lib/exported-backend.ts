import { Bucket } from "@aws-cdk/aws-s3";
import {
  CfnInclude,
  IncludedNestedStack,
} from "@aws-cdk/cloudformation-include";
import * as cdk from "@aws-cdk/core";
import * as fs from "fs-extra";
import * as path from "path";
import { AmplifyExportedBackendProps } from "./amplify-exported-backend-props";
import { createAssetsAndUpdateParameters } from "./asset-manager";
import { BaseAmplifyExportBackend } from "./base-exported-backend";
import { Constants } from "./constants";
import { APIGraphQLIncludedNestedStack, AuthIncludedNestedStack, IAPIGraphQLIncludeNestedStack, IAuthIncludeNestedStack } from "./include-nested-stacks";
import { ILambdaFunctionIncludedNestedStack, LambdaFunctionIncludedNestedStack } from "./include-nested-stacks/lambda-function/lambda-function-nested-stack";
import { CategoryStackMapping } from "./types/category-stack-mapping";
import { ExportManifest } from "./types/export-manifest";
const assert = require("assert");

const {
  API_CATEGORY,
  AUTH_CATEGORY,
  FUNCTION_CATEGORY
} = Constants;

export interface IAmplifyExportedBackend {
  getNestedStacksByCategory(
    category: String,
    categoryName?: string
  ): IncludedNestedStack[];

  getNestedStacksOutPutByCategory(
    category: String,
    categoryName: string
  ): cdk.CfnOutput[];

  /**
   * Used to get the auth stack
   * @returns the nested stack of type {IAuthIncludeNestedStack}
   * @throws {AmplifyCategoryNotFoundError} if the auth stack doesn't exist
   */
  getAuthNestedStack(): IAuthIncludeNestedStack;

  /**
   * Used to get the api graphql stack
   * @returns the nested stack of type {IAPIGraphQLIncludeNestedStack}
   * @throws {AmplifyCategoryNotFoundError} if the API graphql stack doesn't exist
   */
  getAPIGraphQLNestedStack(): IAPIGraphQLIncludeNestedStack;

  getLambdaFunctionNestedStack(): ILambdaFunctionIncludedNestedStack[];
}

export class AmplifyExportedBackend
  extends BaseAmplifyExportBackend
  implements IAmplifyExportedBackend
{

  constructor(
    scope: cdk.Construct,
    id: string,
    props: AmplifyExportedBackendProps
  ) {
    super(scope, id);

    const { categoryStackMappings, amplifyBackend, basePath } =
      this.readExportedFileData(props);



    this.categoryStackMappings = categoryStackMappings;
    const stackProps = amplifyBackend.props;
    const deploymentBucketName = stackProps.parameters
      ? stackProps.parameters["DeploymentBucketName"]
      : undefined;
    
    assert(deploymentBucketName);

    const stack = new cdk.Stack(scope, "AmplifyStack", {
      ...props,
      stackName: amplifyBackend.stackName,
    });

    
    const bucket = Bucket.fromBucketName(
      stack,
      "deploymentBucket",
      deploymentBucketName
    );
    const categoryStackMappingWithDepoyments = createAssetsAndUpdateParameters(
       stack,
       amplifyBackend.props,
       categoryStackMappings,
       basePath,
       bucket
     );
    const include = new CfnInclude(
      stack,
      "AmplifyInclude",
      amplifyBackend.props
    );
    this.cfnInclude = include;

    // add dependency to nested stack for each deployment
    categoryStackMappingWithDepoyments.forEach(stackMapping => {
      if (stackMapping.bucketDeployment) {
        const stack = include.getResource(stackMapping.category + stackMapping.resourceName);
        stack.node.addDependency(stackMapping.bucketDeployment);
      }
    })
    
  }

  private readExportedFileData(props: AmplifyExportedBackendProps) {
    const basePath = path.resolve(props.path);
    const manifestPath = path.join(
      basePath,
      Constants.AMPLIFY_EXPORT_MANIFEST_FILE
    );
    const categoryStackMappingFile = path.join(
      basePath,
      Constants.AMPLIFY_CATEGORY_MAPPING_FILE
    );

    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `${Constants.AMPLIFY_EXPORT_MANIFEST_FILE} file does not exist`
      );
    }

    if (!fs.existsSync(categoryStackMappingFile)) {
      throw new Error(
        `${Constants.AMPLIFY_CATEGORY_MAPPING_FILE} file does not exist`
      );
    }
    const amplifyBackend = JSON.parse(
      fs.readFileSync(manifestPath, { encoding: "utf-8" })
    ) as ExportManifest;

    this.updatePropsToIncludeEnv(amplifyBackend, props.stage);
    const categoryStackMappings = JSON.parse(
      fs.readFileSync(categoryStackMappingFile, { encoding: "utf-8" })
    ) as CategoryStackMapping[];
    return { categoryStackMappings, amplifyBackend, basePath };
  }

  private updatePropsToIncludeEnv(exportManifest: ExportManifest, env: string = 'dev'): ExportManifest {
    const props = exportManifest.props;
    const splitValues = exportManifest.stackName.split('-');
    splitValues[2] = env;
    exportManifest.stackName = splitValues.join('-');
    if (!props.parameters) {
      throw new Error("Root Stack Parameters cannot be null");
    }
    const parameterKeysToUpdate = ["AuthRoleName", "UnauthRoleName", "DeploymentBucketName"];

    for (const parameterKey of parameterKeysToUpdate) {
      if (parameterKey in props.parameters) {
        const val = props.parameters[parameterKey];
        const values = val.split('-');
        values[2] = env;
        props.parameters[parameterKey] = values.join('-');
      } else {
        throw new Error(`${parameterKey} not present in Root Stack Parameters`);
      }   
    }
    const nestedStacks = props.loadNestedStacks;
    if (nestedStacks) {
      Object.keys(nestedStacks).forEach(nestedStackKey => {
        const nestedStack = nestedStacks[nestedStackKey];
        if (nestedStack.parameters) {
          nestedStack.parameters['env'] = env;
        }
      })
    }
    return exportManifest;

  }

  getAuthNestedStack(): IAuthIncludeNestedStack {
    const cognitoResource = this.findResourceForNestedStack(AUTH_CATEGORY.NAME, AUTH_CATEGORY.SERVICE.COGNITO);
    const stack = this.getCategoryNestedStack(cognitoResource);
    return new AuthIncludedNestedStack(stack);
  }

  getAPIGraphQLNestedStack(): IAPIGraphQLIncludeNestedStack {
    const categoryStackMapping = this.findResourceForNestedStack(API_CATEGORY.NAME, API_CATEGORY.SERVICE.APP_SYNC);
    return new APIGraphQLIncludedNestedStack(this.getCategoryNestedStack(categoryStackMapping))
  }

  getLambdaFunctionNestedStack(): ILambdaFunctionIncludedNestedStack[] {
    return  this.filterCategory(FUNCTION_CATEGORY.NAME, FUNCTION_CATEGORY.SERVICE.LAMBDA_FUNCTION)
      .map(this.getCategoryNestedStack)
      .map(stack => new LambdaFunctionIncludedNestedStack(stack))
  }

  getNestedStacksOutPutByCategory(
    category: String,
    categoryName: string
  ): cdk.CfnOutput[] {
    throw new Error("Method not implemented.");
  }
  getNestedStacksByCategory(
    category: String,
    categoryName?: string
  ): IncludedNestedStack[] {
    throw new Error("Method not implemented.");
  }
}
