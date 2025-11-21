import { CHART_TYPES } from "./constants";

export type ChartType = (typeof CHART_TYPES)[number];

export type PullRequest = {
  title: string;
  head: {
    ref: string;
  };
  user: {
    login: string;
  };
  updated_at: string;
};

export interface RawChart {
  id: string;
  chartType: string;
  tagLine: string;
  url: string;
  type: "explorer" | "grapher";
  createdAt: string;
}

export interface Chart extends Omit<RawChart, "createdAt"> {
  createdAt: Date;
}

export interface ChartsFileContent {
  charts: Chart[];
}

export interface SearchResult {
  title: string;
  slug: string;
  subtitle: string;
  type: string;
  url: string;
  availableEntities?: string[];
  availableTabs?: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}
