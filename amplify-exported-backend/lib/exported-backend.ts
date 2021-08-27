import { Bucket } from "@aws-cdk/aws-s3";
import {
  CfnInclude,
  IncludedNestedStack,
} from "@aws-cdk/cloudformation-include";
import * as cdk from "@aws-cdk/core";
import { Stack } from "@aws-cdk/core";
import { AmplifyExportedBackendProps } from "./amplify-exported-backend-props";
import { createAssetsAndUpdateParameters } from "./asset-manager";
import { BaseAmplifyExportBackend } from "./base-exported-backend";
import { Constants } from "./constants";
import { APIGraphQLIncludedNestedStack, APIRestIncludedStack, AuthIncludedNestedStack, IAPIGraphQLIncludeNestedStack, IAPIRestIncludedStack, IAuthIncludeNestedStack } from "./include-nested-stacks";
import { ILambdaFunctionIncludedNestedStack, LambdaFunctionIncludedNestedStack } from "./include-nested-stacks/lambda-function/lambda-function-nested-stack";
const assert = require("assert");

const {
  API_CATEGORY,
  AUTH_CATEGORY,
  FUNCTION_CATEGORY,
} = Constants;

/**
 * Represents the Amplify Exported Backend Stack
 */
export interface IAmplifyExportedBackend {
  /**
   * Used to get the auth stack
   * @returns the nested stack of type {IAuthIncludeNestedStack}
   * @throws {AmplifyCategoryNotFoundError} if the auth stack doesn't exist
   */
  getAuthNestedStack(): IAuthIncludeNestedStack;

  /**
   * Used to get the api graphql stack from the backend
   * @returns the nested stack of type {IAPIGraphQLIncludeNestedStack}
   * @throws {AmplifyCategoryNotFoundError} if the API graphql stack doesn't exist
   */
  getAPIGraphQLNestedStacks(): IAPIGraphQLIncludeNestedStack;

  /**
   * Used to get rest api stack from the backend
   * @param resourceName
   * @return {IAPIRestIncludedStack} the nested of type Rest API
   * @throws {AmplifyCategoryNotFoundError} if the API Rest stack doesn't exist
   */
  getAPIRestNestedStack(resourceName: string): IAPIRestIncludedStack;

  /**
   * Used to get a specific lambda function from the backend
   * @returns {ILambdaFunctionIncludedNestedStack}
   * @param functionName the function name to get from the nested stack
   * @throws {AmplifyCategoryNotFoundError} if the lambda function stack doesn't exist
   */
  getLambdaFunctionNestedStackByName(
    functionName: string
  ): ILambdaFunctionIncludedNestedStack;

  /**
   * Used to get all the lambda functions from the backend
   * @returns {ILambdaFunctionIncludedNestedStack[]}
   * @throws {AmplifyCategoryNotFoundError} if the no Lambda Function stacks are found
   */
  getLambdaFunctionNestedStacks(): ILambdaFunctionIncludedNestedStack[];

  /**
   * Return the stacks defined in the backend
   * @param category of the categories defined in Amplify CLI like function, api, auth etc
   * @param resourceName @default is undefined
   */
  getNestedStacksByCategory(
    category: string,
    resourceName?: string
  ): IncludedNestedStack[];
}

/***
 * 
 */
export class AmplifyExportedBackend
  extends BaseAmplifyExportBackend
  implements IAmplifyExportedBackend
{
  rootStack: Stack;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: AmplifyExportedBackendProps
  ) {
    super(scope, id, props.path, props.stage);



    const stackProps = this.exportBackendManifest.props;
    const deploymentBucketName = stackProps.parameters
      ? stackProps.parameters["DeploymentBucketName"]
      : undefined;

    assert(deploymentBucketName);

    const rootStack = new cdk.Stack(scope, "AmplifyStack", {
      ...props,
      stackName: this.exportBackendManifest.stackName,
    });

    const bucket = Bucket.fromBucketName(
      rootStack,
      "deploymentBucket",
      deploymentBucketName
    );
    const categoryStackMappingWithDeployments = createAssetsAndUpdateParameters(
      rootStack,
      this.exportBackendManifest.props,
      this.categoryStackMappings,
      this.exportPath,
      bucket
    );
    const include = new CfnInclude(
      rootStack,
      "AmplifyCfnInclude",
      this.exportBackendManifest.props
    );
    this.cfnInclude = include;

    // add dependency to nested stack for each deployment
    categoryStackMappingWithDeployments.forEach((stackMapping) => {
      if (stackMapping.bucketDeployment) {
        const stack = include.getResource(
          stackMapping.category + stackMapping.resourceName
        );
        stack.node.addDependency(stackMapping.bucketDeployment);
      }
    });

    this.applyTags(rootStack, props.stage);
  }

  private applyTags(rootStack: cdk.Stack, env: string = 'dev') {
    this.exportTags.forEach(tag => {
      rootStack.tags.setTag(tag.Key, tag.Value.replace('{project-env}', env));
    })
  }

  getAuthNestedStack(): IAuthIncludeNestedStack {
    const cognitoResource = this.findResourceForNestedStack(
      AUTH_CATEGORY.NAME,
      AUTH_CATEGORY.SERVICE.COGNITO
    );
    const stack = this.getCategoryNestedStack(cognitoResource);
    return new AuthIncludedNestedStack(stack);
  }

  getAPIGraphQLNestedStacks(): IAPIGraphQLIncludeNestedStack {
    const categoryStackMapping = this.findResourceForNestedStack(
      API_CATEGORY.NAME,
      API_CATEGORY.SERVICE.APP_SYNC
    );
    return new APIGraphQLIncludedNestedStack(
      this.getCategoryNestedStack(categoryStackMapping)
    );
  }

  getLambdaFunctionNestedStacks(): ILambdaFunctionIncludedNestedStack[] {
    return this.filterCategory(
      FUNCTION_CATEGORY.NAME,
      FUNCTION_CATEGORY.SERVICE.LAMBDA_FUNCTION
    )
      .map(this.getCategoryNestedStack)
      .map((stack) => new LambdaFunctionIncludedNestedStack(stack));
  }

  getLambdaFunctionNestedStackByName(
    functionName: string
  ): ILambdaFunctionIncludedNestedStack {
    const category = this.findResourceForNestedStack(
      FUNCTION_CATEGORY.NAME,
      FUNCTION_CATEGORY.SERVICE.LAMBDA_FUNCTION,
      functionName
    );
    return new LambdaFunctionIncludedNestedStack(
      this.getCategoryNestedStack(category)
    );
  }

  getNestedStacksByCategory(
    category: string,
    resourceName?: string
  ): IncludedNestedStack[] {
    return this.filterCategory(category, undefined, resourceName).map(
      this.getCategoryNestedStack
    );
  }

  getAPIRestNestedStack(resourceName: string): IAPIRestIncludedStack {
    const categoryStackMapping = this.findResourceForNestedStack(
      API_CATEGORY.NAME,
      API_CATEGORY.SERVICE.API_GATEWAY,
      resourceName
    );
    const stack = this.getCategoryNestedStack(categoryStackMapping);
    return new APIRestIncludedStack(stack, resourceName);
  }
}
