import { readFileSync, writeFileSync } from "fs";

import { showToast, Toast, Clipboard } from "@raycast/api";
import { useFetch, usePromise } from "@raycast/utils";

import { ChartsFileContent, ChartType, PullRequest, RawChart } from "./types";
import { CHART_TYPE_DATA, CHARTS_STORAGE_PATH } from "./constants";

const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";

export function usePullRequests(repo: string, userName?: string) {
  const GITHUB_API_URL = `https://api.github.com/repos/${repo}/pulls`;

  const { data = [], isLoading } = useFetch<PullRequest[]>(
    GITHUB_API_URL + "?per_page=100&sort=updated&direction=desc",
  );

  const pullRequests = data
    .filter((pr) => (userName ? pr.user.login === userName : true))
    .map((pr) => ({
      title: pr.title,
      branch: pr.head.ref,
      updatedAt: new Date(pr.updated_at),
      stagingUrl: makeStagingUrl(pr.head.ref),
    }));

  return { pullRequests, isLoading };
}

function makeStagingUrl(branchName: string) {
  return `http://staging-site-${branchName.slice(0, 28)}`;
}

function fetchFromDatasette<TRow>(query: string, options?: { ttl?: number }) {
  const queryParams: Record<string, string> = { sql: query };
  if (options?.ttl !== undefined) queryParams._ttl = options.ttl.toString();

  const searchParams = new URLSearchParams(queryParams);
  const datasetteUrl = `${DATASETTE_API_URL}?${searchParams}`;

  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: TRow[];
  }>(datasetteUrl);

  return { data, isLoading };
}

export function fetchChart({
  slug,
  chartId,
}: {
  slug?: string;
  chartId?: number;
}) {
  let query = "select id, slug, config from charts";

  const whereClauses = [];
  if (slug) whereClauses.push(`slug = '${slug}'`);
  if (chartId) whereClauses.push(`id = ${chartId}`);

  if (whereClauses.length > 0) query += ` where ${whereClauses.join(" or ")}`;
  query += " limit 1";

  const { data, isLoading } =
    fetchFromDatasette<[number, string, string]>(query);
  if (!slug && !chartId) return { isLoading }; // dismiss if no input params were given
  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];
  if (!firstRow) return { isLoading };

  return {
    id: firstRow[0],
    slug: firstRow[1],
    config: JSON.parse(firstRow[2]) as Record<string, unknown>,
    isLoading,
  };
}

export function fetchRandomCharts() {
  const query = `
    with randomRows as (
      select
        slug,
        type,
        row_number() over (
          partition by type
          order by
            random()
        ) as rn
      from
        charts
      where
        type in (
          'LineChart',
          'StackedArea',
          'StackedBar',
          'ScatterPlot',
          'DiscreteBar',
          'SlopeChart',
          'StackedDiscreteBar',
          'Marimekko'
        )
        and json_extract(configWithDefaults, '$.hasChartTab') is not false
    )
    select
      slug,
      type
    from
      randomRows
    where
      rn = 1
    limit
      8`;

  const { data, isLoading } = fetchFromDatasette<[string, string]>(query, {
    ttl: 0,
  });
  if (!data || !data.ok || !data.rows || data.rows.length === 0)
    return { charts: [], isLoading };

  return {
    charts: data.rows.map(([slug, type]) => ({
      slug,
      type,
      ...CHART_TYPE_DATA[type as ChartType],
    })),
    isLoading,
  };
}

export function fetchVariables(chartId: number) {
  const query = `
    select
      cd.variableId,
      v.name,
      v.display ->> 'name' as displayName
    from chart_dimensions cd
    join charts c on c.id = cd.chartId
    join variables v ON v.id = cd.variableId
    where c.id = ${chartId}`;

  const { data, isLoading } =
    fetchFromDatasette<[number, string, string]>(query);

  if (!data || !data.ok || !data.rows || data.rows.length === 0)
    return { variables: [], isLoading };

  const variables = data.rows.map(([variableId, name, displayName]) => ({
    id: variableId.toString(),
    name: displayName || name,
  }));

  return {
    variables,
    isLoading,
  };
}

export function persistCharts(content: ChartsFileContent) {
  try {
    const rawCharts = content.charts.map((chart) => ({
      ...chart,
      createdAt: chart.createdAt.toISOString(),
    }));
    writeJsonToFile({ charts: rawCharts }, CHARTS_STORAGE_PATH);
  } catch (err) {
    console.error("Error writing file:", err);
    throw err;
  }
}

export function loadCharts() {
  try {
    const data = readJsonFromFile(CHARTS_STORAGE_PATH) as {
      charts: RawChart[];
    };
    const charts = data.charts.map((chart) => ({
      ...chart,
      createdAt: new Date(chart.createdAt),
    }));
    return { charts } as ChartsFileContent;
  } catch (err) {
    console.error("Error reading file:", err);
    return { charts: [] } as ChartsFileContent;
  }
}

export function useClipboard() {
  const { data: clipboardText = "", isLoading } = usePromise(
    Clipboard.readText,
    [],
    {
      onError: async () => {
        showToast(Toast.Style.Failure, "Failed to read clipboard content");
      },
    },
  );
  return { clipboardText, isLoading };
}

export function writeJsonToFile(json: unknown, path: string) {
  writeFileSync(path, JSON.stringify(json, null, 2), "utf8");
}

export function readJsonFromFile(path: string) {
  const data = readFileSync(path, "utf8");
  return JSON.parse(data);
}

export function byCreatedAt(a: { createdAt: Date }, b: { createdAt: Date }) {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function makeThumbnailUrl(urlString: string) {
  const url = new URL(urlString);
  url.searchParams.set("imType", "og");
  url.pathname = url.pathname + ".png";
  return url.toString();
}
