import {
  CfnInclude,
  IncludedNestedStack,
} from "@aws-cdk/cloudformation-include";
import { Construct } from "@aws-cdk/core";
import { CategoryStackMapping } from "./types/category-stack-mapping";
export class AmplifyCategoryNotFoundError extends Error {
  constructor(category: string, service?: string) {
    super(`The category: ${category}  ${service ? "of service: " + service: ''  } not found.`);
  }
}

export class BaseAmplifyExportBackend extends Construct {
  protected categoryStackMappings: CategoryStackMapping[];
  protected cfnInclude: CfnInclude;


  protected findResourceForNestedStack(
    category: string,
    service: string,
    resourceName?: string,

  ): CategoryStackMapping {
    const categoryStack = this.categoryStackMappings.find(
      (r) => r.category === category && r.service === service && (resourceName ? r.resourceName === resourceName : true)
    );
    if (!categoryStack) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStack;
  }
  
  protected filterCategory(category: string, service?: string, resourceName? : string): CategoryStackMapping[] {
    const categoryStackMapping = this.categoryStackMappings.filter(r => r.category === category && (service? r.service === service : true) && (resourceName? r.resourceName === resourceName : true));
    if (categoryStackMapping.length === 0) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStackMapping;
  }

  protected getCategoryNestedStack(categoryStackMapping: CategoryStackMapping): IncludedNestedStack {
    return this.cfnInclude.getNestedStack(categoryStackMapping.category + categoryStackMapping.resourceName);
  }
}
