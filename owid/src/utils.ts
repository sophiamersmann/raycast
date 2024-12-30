import { Icon, showToast, Toast, Clipboard } from "@raycast/api";
import { useFetch, usePromise } from "@raycast/utils";

const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";

export const CHART_TYPES = [
  "LineChart",
  "ScatterPlot",
  "DiscreteBar",
  "StackedDiscreteBar",
  "StackedBar",
  "StackedArea",
  "SlopeChart",
  "Marimekko",
] as const;

type ChartType = (typeof CHART_TYPES)[number];

const CHART_TYPE_DATA: Record<ChartType, { name: string; icon: Icon }> = {
  LineChart: { name: "Line Chart", icon: Icon.LineChart },
  ScatterPlot: { name: "Scatter Plot", icon: Icon.LineChart },
  StackedArea: { name: "Stacked Area Chart", icon: Icon.BarChart },
  StackedBar: { name: "Stacked Bar Chart", icon: Icon.BarChart },
  DiscreteBar: { name: "Discrete Bar Chart", icon: Icon.BarChart },
  SlopeChart: { name: "Slope Chart", icon: Icon.LineChart },
  StackedDiscreteBar: {
    name: "Stacked Discrete Bar Chart",
    icon: Icon.BarChart,
  },
  Marimekko: { name: "Marimekko Chart", icon: Icon.BarChart },
};

type PullRequest = {
  title: string;
  head: {
    ref: string;
  };
  user: {
    login: string;
  };
  updated_at: string;
};

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
      staging: `http://staging-site-${pr.head.ref}`,
    }));

  return { pullRequests, isLoading };
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
