import { Icon, Color, showToast, Toast, Clipboard } from "@raycast/api";
import { useFetch, usePromise } from "@raycast/utils";

const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";

const CHART_TYPE_NAMES: Record<string, string> = {
  LineChart: "Line Chart",
  ScatterPlot: "Scatter Plot",
  StackedArea: "Stacked Area Chart",
  StackedBar: "Stacked Bar Chart",
  DiscreteBar: "Discrete Bar Chart",
  SlopeChart: "Slope Chart",
  StackedDiscreteBar: "Stacked Discrete Bar Chart",
  Marimekko: "Marimekko Chart",
};

type PullRequest = {
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

export function usePullRequests(repo: string, userName: string) {
  const GITHUB_API_URL = `https://api.github.com/repos/${repo}/pulls`;

  const { data = [], isLoading } = useFetch<PullRequest[]>(
    GITHUB_API_URL + "?per_page=100&sort=updated&direction=desc",
  );

  const pullRequests = data
    .filter((pr) => pr.user.login === userName)
    .map((pr) => ({
      branch: pr.head.ref,
      updatedAt: new Date(pr.updated_at),
      staging: `http://staging-site-${pr.head.ref}`,
    }));

  return { pullRequests, isLoading };
}

function fetchFromDatasette<TRow>(query: string) {
  const searchParams = new URLSearchParams({ sql: query });
  const datasetteUrl = `${DATASETTE_API_URL}?${searchParams}`;

  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: TRow[];
  }>(datasetteUrl);

  return { data, isLoading };
}

export function validateSlug(text: string) {
  const query = `select slug from charts where slug = '${text}' limit 1`;
  const { data, isLoading } = fetchFromDatasette<[string]>(query);
  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];
  if (!firstRow) return { isLoading };

  return {
    slug: firstRow[0],
    isLoading,
  };
}

export function fetchChart({
  slug = "",
  chartId = "",
}: {
  slug?: string;
  chartId?: string;
}) {
  const whereClauses = [];
  if (slug) whereClauses.push(`slug = '${slug}'`);
  if (chartId) whereClauses.push(`id = ${chartId}`);
  const query = `select id, slug from charts where ${whereClauses.join(" and ")} limit 1`;

  const { data, isLoading } = fetchFromDatasette<[number, string]>(query);
  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];
  if (!firstRow) return { isLoading };

  return {
    chartId: firstRow[0].toString(),
    slug: firstRow[1],
    isLoading,
  };
}

export function fetchRandomCharts() {
  const query = `
    select
      slug,
      type
    from
      charts
    where
      (
        type = 'LineChart'
        or type = 'StackedArea'
        or type = 'StackedBar'
        or type = 'ScatterPlot'
        or type = 'DiscreteBar'
        or type = 'SlopeChart'
        or type = 'StackedDiscreteBar'
        or type = 'Marimekko'
      )
      and configWithDefaults ->> "$.hasChartTab" is not false
    group by
      type
    order by
      random()
    limit
      8`;
  const { data, isLoading } = fetchFromDatasette<[string, string]>(query);
  if (!data || !data.ok || !data.rows || data.rows.length === 0)
    return { charts: [], isLoading };

  return {
    charts: data.rows.map(([slug, type]) => ({
      slug,
      type,
      name: CHART_TYPE_NAMES[type],
    })),
    isLoading,
  };
}

export function fetchVariables(slug: string) {
  const query = `
    with variableIds as (
      select
        c.id as chartId,
        d.value ->> "$.variableId" as variableId
      from
        charts c,
        json_each(config, '$.dimensions') d
      where
        c.slug = '${slug}'
    )
    select
      vid.variableId,
      v.name,
      v.display ->> "$.name" as displayName
    from
      variableIds vid
      join variables v on v.id = vid.variableId`;

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

export const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
