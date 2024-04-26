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

export function makeGrapherURL(baseUrl: string, slug: string) {
  const baseUrlWithoutTrailingSlash = baseUrl.replace(/\/$/, "");
  return `${baseUrlWithoutTrailingSlash}/grapher/${slug}`;
}

export const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
