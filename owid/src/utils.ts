import { Icon, Color } from "@raycast/api";
import { useFetch } from "@raycast/utils";

const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";

// TODO: See https://developers.raycast.com/utilities/react-hooks/usecachedpromise#mutation-and-optimistic-updates

type PullRequest = {
  head: {
    ref: string;
  };
  user: {
    login: string;
  };
  updated_at: string;
};

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

export function validateSlug(text: string) {
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [string, string][];
  }>(
    DATASETTE_API_URL +
      `?sql=select+id,slug+from+charts+where+slug+%3D+'${encodeURIComponent(text)}'`,
  );

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    chartId: firstRow[0],
    slug: firstRow[1],
    isLoading,
  };
}

export function fetchRandomSlug() {
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [string][];
  }>(
    DATASETTE_API_URL +
      `?sql=select+slug+from+charts+order+by+random%28%29+limit+1`,
  );

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    slug: firstRow[0],
    isLoading,
  };
}

export function fetchChartId(slug: string) {
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [number][];
  }>(
    DATASETTE_API_URL +
      `?sql=select+id+from+charts+where+slug+%3D+'${encodeURIComponent(slug)}'`,
  );

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    chartId: firstRow[0],
    isLoading,
  };
}

export function fetchSlug(chartId: string) {
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [string][];
  }>(
    DATASETTE_API_URL +
      `?sql=select+slug+from+charts+where+id+%3D+'${encodeURIComponent(chartId)}'`,
  );

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    slug: firstRow[0],
    isLoading,
  };
}

export function fetchVariables(slug: string) {
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [number, string, string | undefined][];
  }>(
    DATASETTE_API_URL +
      `?sql=with+variableIds+as+%28%0D%0A++select%0D%0A++++c.id+as+chartId%2C%0D%0A++++d.value+-%3E%3E+%22%24.variableId%22+as+variableId%0D%0A++from%0D%0A++++charts+c%2C%0D%0A++++json_each%28config%2C+%27%24.dimensions%27%29+d%0D%0A++where%0D%0A++++c.slug+%3D+%27${encodeURIComponent(slug)}%27%0D%0A%29%0D%0Aselect%0D%0A++vid.variableId%2C%0D%0A++v.name%2C%0D%0A++v.display+-%3E%3E+%22%24.name%22+as+displayName%0D%0Afrom%0D%0A++variableIds+vid%0D%0A++join+variables+v+on+v.id+%3D+vid.variableId`,
  );

  if (!data || !data.ok || !data.rows || data.rows.length === 0)
    return { variables: [], isLoading };

  return {
    variables: data.rows.map(([variableId, name, displayName]) => ({
      id: variableId,
      name: displayName || name,
    })),
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
