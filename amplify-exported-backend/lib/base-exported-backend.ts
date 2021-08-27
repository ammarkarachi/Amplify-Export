import {
  CfnInclude,
  IncludedNestedStack,
} from "@aws-cdk/cloudformation-include";
import { Construct } from "@aws-cdk/core";
import { CategoryStackMapping } from "./types/category-stack-mapping";
import * as path from 'path';
import * as fs from "fs-extra";
import { ExportManifest } from "./types/export-manifest";
import { Constants } from "./constants";
import { ExportTag } from "./types/export-tags";

const {
  AMPLIFY_EXPORT_MANIFEST_FILE,
  AMPLIFY_EXPORT_TAG_FILE,
  AMPLIFY_CATEGORY_MAPPING_FILE,
} = Constants;
class AmplifyCategoryNotFoundError extends Error {
  constructor(category: string, service?: string) {
    super(`The category: ${category}  ${service ? "of service: " + service: ''  } not found.`);
  }
}

/**
 * Contains all the utility functions
 */
export class BaseAmplifyExportBackend extends Construct {
  protected categoryStackMappings: CategoryStackMapping[];
  cfnInclude: CfnInclude;
  protected exportPath: string;
  protected exportBackendManifest: ExportManifest;
  protected exportTags: ExportTag[];
  constructor(scope: Construct, id: string, exportPath: string, stage: string = 'dev') {
    super(scope, id);
    this.exportPath = path.resolve(exportPath);
    const exportBackendManifest = this.getExportedDataFromFile<ExportManifest>(
      AMPLIFY_EXPORT_MANIFEST_FILE
    );
    this.exportBackendManifest = this.updatePropsToIncludeEnv(exportBackendManifest, stage)
    this.categoryStackMappings = this.getExportedDataFromFile<
      CategoryStackMapping[]
    >(AMPLIFY_CATEGORY_MAPPING_FILE);
    this.exportTags = this.getExportedDataFromFile<ExportTag[]>(
      AMPLIFY_EXPORT_TAG_FILE
    );
  }

  protected findResourceForNestedStack(
    category: string,
    service: string,
    resourceName?: string
  ): CategoryStackMapping {
    const categoryStack = this.categoryStackMappings.find(
      (r) =>
        r.category === category &&
        r.service === service &&
        (resourceName ? r.resourceName === resourceName : true)
    );
    if (!categoryStack) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStack;
  }

  protected filterCategory(
    category: string,
    service?: string,
    resourceName?: string
  ): CategoryStackMapping[] {
    const categoryStackMapping = this.categoryStackMappings.filter(
      (r) =>
        r.category === category &&
        (service ? r.service === service : true) &&
        (resourceName ? r.resourceName === resourceName : true)
    );
    if (categoryStackMapping.length === 0) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStackMapping;
  }

  protected getCategoryNestedStack(
    categoryStackMapping: CategoryStackMapping
  ): IncludedNestedStack {
    return this.cfnInclude.getNestedStack(
      categoryStackMapping.category + categoryStackMapping.resourceName
    );
  }

  protected getExportedDataFromFile<T>(fileName: string): T {
    const filePath = path.join(this.exportPath, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${fileName} file does not exist`);
    }
    return JSON.parse(fs.readFileSync(fileName, { encoding: "utf-8" })) as T;
  }

  private updatePropsToIncludeEnv(
    exportManifest: ExportManifest,
    env: string = "dev"
  ): ExportManifest {
    const props = exportManifest.props;
    const splitValues = exportManifest.stackName.split("-");
    splitValues[2] = env;
    exportManifest.stackName = splitValues.join("-");
    if (!props.parameters) {
      throw new Error("Root Stack Parameters cannot be null");
    }
    const parameterKeysToUpdate = [
      "AuthRoleName",
      "UnauthRoleName",
      "DeploymentBucketName",
    ];

    for (const parameterKey of parameterKeysToUpdate) {
      if (parameterKey in props.parameters) {
        const val = props.parameters[parameterKey];
        const values = val.split("-");
        values[2] = env;
        props.parameters[parameterKey] = values.join("-");
      } else {
        throw new Error(`${parameterKey} not present in Root Stack Parameters`);
      }
    }
    const nestedStacks = props.loadNestedStacks;
    if (nestedStacks) {
      Object.keys(nestedStacks).forEach((nestedStackKey) => {
        const nestedStack = nestedStacks[nestedStackKey];
        if (nestedStack.parameters) {
          nestedStack.parameters["env"] = env;
        }
      });
    }
    return exportManifest;
  }
}
