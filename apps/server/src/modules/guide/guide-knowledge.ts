// 聚合全国目的地知识并提供按名称、别名和关键词查询的统一入口。
import {
  destinationGuidePlanRecords,
  destinationPlanAliases,
  travelDestinationKeywords
} from './guide-knowledge-data.js';

export type DestinationGuidePlan = {
  destination: string;
  sections: string[];
};

export const TRAVEL_DESTINATION_KEYWORDS = [...travelDestinationKeywords];

const destinationGuidePlans = Object.fromEntries(
  destinationGuidePlanRecords.map((record) => [record.destination, record.sections])
) as Record<string, string[]>;

export function findDestinationName(message: string): string | null {
  return (
    [...TRAVEL_DESTINATION_KEYWORDS]
      .sort((left, right) => right.length - left.length)
      .find((keyword) => message.includes(keyword)) ?? null
  );
}

export function findDestinationGuidePlan(message: string): DestinationGuidePlan | null {
  const destination = findDestinationName(message);

  if (!destination) {
    return null;
  }

  const canonicalDestination = destinationPlanAliases[destination] ?? destination;
  const sections = destinationGuidePlans[canonicalDestination];

  if (!sections) {
    return null;
  }

  return {
    destination: canonicalDestination,
    sections
  };
}
