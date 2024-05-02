import { Icon, Color } from "@raycast/api";
import { useFetch } from "@raycast/utils";

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

export function fetchSlugFromText(text: string) {
  // grab a part of the given text that looks like a slug
  const slugRegex = /^(?<maybeSlug>[a-z][a-z0-9-]+).*$/m;
  const slugWithQueryParamsRegex =
    /^(?<maybeSlug>[a-z][a-z0-9-]+)\??(?<queryParams>[a-zA-Z0-9-=&~%+]*).*$/m;
  const match = text.match(slugWithQueryParamsRegex) ?? text.match(slugRegex);
  const maybeSlug = match?.groups?.maybeSlug ?? "";

  const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [string][];
  }>(
    DATASETTE_API_URL +
      `?sql=select+slug+from+charts+where+slug+%3D+'${maybeSlug}'`,
  );

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    slug: firstRow[0],
    queryParams: match?.groups?.queryParams,
    isLoading,
  };
}

export function fetchChartId(slug: string) {
  const DATASETTE_API_URL = "https://datasette-public.owid.io/owid.json";
  const { data, isLoading } = useFetch<{
    ok: boolean;
    rows: [number][];
  }>(DATASETTE_API_URL + `?sql=select+id+from+charts+where+slug+%3D+'${slug}'`);

  if (!data || !data.ok) return { isLoading };

  const firstRow = data.rows[0];

  if (!firstRow) return { isLoading };

  return {
    chartId: firstRow[0],
    isLoading,
  };
}

export function makeGrapherURL(
  baseUrl: string,
  slug: string,
  queryParams?: string,
) {
  const baseUrlWithoutTrailingSlash = baseUrl.replace(/\/$/, "");
  let url = `${baseUrlWithoutTrailingSlash}/grapher/${slug}`;
  if (queryParams) {
    url += `?${queryParams}`;
  }
  return url;
}

export const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
