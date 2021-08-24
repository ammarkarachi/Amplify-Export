import { IBucket } from "@aws-cdk/aws-s3";
import {
  CfnInclude,
  IncludedNestedStack,
} from "@aws-cdk/cloudformation-include";
import * as cdk from "@aws-cdk/core";
import { assert } from "console";
import * as fs from "fs-extra";
import * as path from "path";
import { createAssetsAndUpdateParameters } from "./asset-manager";
import { Constants } from "./Constants";
import { CategoryStackMapping } from "./types/category-stack-mapping";
import { ExportManifest } from "./types/export-manifest";
export interface AmplifyExportedBackendProps {
  /**
   * The Amplify CLI environment that you would like to incorporate
   * see https://docs.amplify.aws/cli/teams/overview
   *
   */
  readonly env: string;

  /**
   * The path to the synthesized folder that contains the artifacts for the Amplify CLI backend
   * ex: ./amplify-synth-out/
   */
  readonly path: string;

  /**
   * 
   */
  readonly bucket?: IBucket;
}

export enum FrontendType {}

export interface IAmplifyExportedBackend {
  getNestedStacksByCategory(
    category: String,
    categoryName: string
  ): IncludedNestedStack[];

  getNestedStacksOutPutByCategory(
    category: String,
    categoryName: string
  ): cdk.CfnOutput[];

  generateExport(
    frontEndType: FrontendType,
    props: { objectKey: String }
  ): void;
}

export class AmplifyExportedBackend
  extends cdk.Construct
  implements IAmplifyExportedBackend
{
  constructor(
    scope: cdk.Construct,
    id: string,
    props: AmplifyExportedBackendProps
  ) {
    super(scope, id);
    const basePath = path.resolve(props.path);
    const manifestPath = path.join(
      basePath,
      Constants.AMPLIFY_EXPORT_MANIFEST_FILE
    );
    const categoryStackMapping = path.join(
      basePath,
      Constants.AMPLIFY_CATEGORY_MAPPING_FILE
    );

    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `${Constants.AMPLIFY_EXPORT_MANIFEST_FILE} file does not exist`
      );
    }

    if (!fs.existsSync(categoryStackMapping)) {
      throw new Error(
        `${Constants.AMPLIFY_CATEGORY_MAPPING_FILE} file does not exist`
      );
    }

    const amplifyBackend = JSON.parse(
      fs.readFileSync(manifestPath, { encoding: "utf-8" })
    ) as ExportManifest;

    const categoryStackMappings = JSON.parse(
      fs.readFileSync(categoryStackMapping, { encoding: "utf-8" })
    ) as CategoryStackMapping[];
    const stackProps = amplifyBackend.props;
    const deploymentBucketName = stackProps.parameters
      ? stackProps.parameters["DeploymentBucketName"]
      : undefined;
    assert(deploymentBucketName);
    const stack = new cdk.Stack(scope, "AmplifyStack", {
      stackName: amplifyBackend.stackName,
    });

    createAssetsAndUpdateParameters(
      stack,
      amplifyBackend.props,
      categoryStackMappings,
      basePath
    );

    const include = new CfnInclude(
      stack,
      "AmplifyInclude",
      amplifyBackend.props
    );
  }

  getNestedStacksOutPutByCategory(
    category: String,
    categoryName: string
  ): cdk.CfnOutput[] {
    throw new Error("Method not implemented.");
  }
  getNestedStacksByCategory(
    category: String,
    categoryName: string
  ): IncludedNestedStack[] {
    throw new Error("Method not implemented.");
  }

  generateExport(
    frontEndType: FrontendType,
    props: { objectKey: String }
  ): void {
    throw new Error("Method not implemented.");
  }
}
