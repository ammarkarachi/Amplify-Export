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
  categoryStackMappings: CategoryStackMapping[];
  cfnInclude: CfnInclude;


  findResourceForNestedStack(
    category: string,
    service: string
  ): CategoryStackMapping {
    const categoryStack = this.categoryStackMappings.find(
      (r) => r.category === category && r.service === service
    );
    if (!categoryStack) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStack;
  }
  
  filterCategory(category: string, service?: string): CategoryStackMapping[] {
    const categoryStackMapping = this.categoryStackMappings.filter(r => r.category === category && (service? r.service === service : true));
    if (categoryStackMapping.length === 0) {
      throw new AmplifyCategoryNotFoundError(category, service);
    }
    return categoryStackMapping;
  }

  getCategoryNestedStack(categoryStackMapping: CategoryStackMapping): IncludedNestedStack {
    return this.cfnInclude.getNestedStack(categoryStackMapping.category + categoryStackMapping.resourceName);
  }
}
