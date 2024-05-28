import { Action, ActionPanel, List, Icon, open, Keyboard } from "@raycast/api";
import { useFrecencySorting } from "@raycast/utils";
import {
  useClipboard,
  usePullRequests,
  linkIcon,
  validateSlug,
  fetchRandomCharts,
  fetchVariables,
  fetchChart,
  CHART_TYPES,
} from "./utils";

interface Data {
  clipboardText?: string;

  // url
  origin?: string;
  pathname?: string;
  queryParams?: string;

  // chart
  slug?: string;
  chartId?: string;

  isAdminUrl?: boolean;
}

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome Dev.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_URL = "http://localhost:3030";

const LIVE_ADMIN_URL = "https://admin.owid.io";

// matches filenames in the owid-grapher-svgs repo
const TEST_SVG_FILENAME_REGEX = /^svg\/(?<slug>.+)_v\d+.+$/m;
const TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS =
  /^all-views\/svg\/(?<slug>.+)\?(?<queryParams>.+)_v\d+.+$/m;

export default function Command() {
  // fetch pull requests and sort them by frecency
  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );
  const { data: sortedPullRequests, visitItem: visitStaging } =
    useFrecencySorting(pullRequests, { key: (item) => item.branch });

  const { clipboardText, isLoading: isLoadingClipboardText } = useClipboard();
  const maybeSlugOrUrl = clipboardText.trim();

  const content: Data = {};

  // check if the clipboard content is an OWID URL
  try {
    const url = new URL(maybeSlugOrUrl);
    const owidUrls = [
      LIVE_URL,
      LIVE_ADMIN_URL,
      LOCAL_URL,
      "http://staging-site-",
    ];
    const isOwidUrl = owidUrls.some((validUrl) =>
      url.origin.startsWith(validUrl),
    );
    if (isOwidUrl) {
      content.origin = url.origin;
      content.pathname = url.pathname;
      content.queryParams = url.search.slice(1);
    }
  } catch (error) {
    // intentionally empty
  }

  if (content.pathname) {
    // extract slug from grapher page url
    const isGrapherUrl = content.pathname.startsWith("/grapher/");
    if (isGrapherUrl) {
      content.slug = content.pathname.match(
        /^\/grapher\/(?<slug>.+)/m,
      )?.groups?.slug;
    }

    // check if the url is a admin url
    if (content.pathname.startsWith("/admin")) {
      content.isAdminUrl = true;
    }

    // extract chart id from chart edit page url
    if (content.pathname.startsWith("/admin/charts")) {
      content.chartId = content.pathname.match(
        /^\/admin\/charts\/(?<chartId>\d+).*/m,
      )?.groups?.chartId;
    }
  }

  // check if the copied text is a filename from the owid-grapher-svgs repo
  const fromFilename =
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS)?.groups ??
    maybeSlugOrUrl.match(TEST_SVG_FILENAME_REGEX)?.groups;
  if (fromFilename) {
    content.slug = fromFilename.slug;
    content.pathname = `/grapher/${fromFilename.slug}`;
    content.queryParams = fromFilename.queryParams;
  }

  // check if the copied text is a valid slug associated with a chart
  const [maybeSlug, maybeQueryParams] = maybeSlugOrUrl.split("?");
  const validationResult = validateSlug(maybeSlug);
  if (validationResult.slug) {
    content.slug = validationResult.slug;
    content.pathname = `/grapher/${validationResult.slug}`;
    content.queryParams = maybeQueryParams;
  }

  // fetch chart info
  const {
    chartId,
    slug,
    isLoading: isLoadingChartInfo,
  } = fetchChart({
    slug: content.slug,
    chartId: content.chartId,
  });
  if (chartId) content.chartId = chartId;
  if (slug) content.slug = slug;

  const isLoading =
    isLoadingClipboardText ||
    isLoadingPullRequests ||
    validationResult.isLoading ||
    isLoadingChartInfo;

  const liveOriginUrl = content.isAdminUrl ? LIVE_ADMIN_URL : LIVE_URL;

  return (
    <List isLoading={isLoading}>
      <List.Item
        key="prod"
        title={makeUrl(liveOriginUrl, content.pathname, content.queryParams)}
        accessories={[{ text: "Live" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LIVE_URL} data={content} />}
      />
      <List.Item
        key="local"
        title={makeUrl(LOCAL_URL, content.pathname, content.queryParams)}
        accessories={[{ text: "Local" }]}
        icon={linkIcon}
        actions={<LinkActionPanel baseUrl={LOCAL_URL} data={content} />}
      />
      <List.Section key="Staging" title="Staging">
        {sortedPullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeUrl(pr.staging, content.pathname, content.queryParams)}
            accessories={[{ date: pr.updatedAt }]}
            icon={linkIcon}
            actions={
              <LinkActionPanel
                baseUrl={pr.staging}
                data={content}
                updateFrecency={() => visitStaging(pr)}
              />
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function LinkActionPanel({
  baseUrl,
  data,
  updateFrecency,
}: {
  baseUrl: string;
  data: Data;
  updateFrecency?: () => Promise<void>;
}) {
  const url = makeUrl(baseUrl, data.pathname, data.queryParams);

  const { charts: randomCharts, isLoading: isLoadingRandomCharts } =
    fetchRandomCharts();
  const randomChartsByType = new Map(
    randomCharts.map((chart) => [chart.type, chart]),
  );
  const randomSlug =
    randomCharts[Math.floor(Math.random() * randomCharts.length)];

  const { variables, isLoading: isLoadingVariables } = fetchVariables(
    data.slug ?? "",
  );

  let chartEditorUrl = "";
  if (!data.isAdminUrl && data.chartId) {
    const editorBaseUrl = baseUrl === LIVE_URL ? LIVE_ADMIN_URL : baseUrl;
    chartEditorUrl = makeUrl(
      editorBaseUrl,
      `/admin/charts/${data.chartId}/edit`,
    );
  }

  let grapherPageUrl = "";
  if (data.isAdminUrl && data.slug) {
    grapherPageUrl = makeUrl(baseUrl, `/grapher/${data.slug}`);
  }

  return (
    <ActionPanel>
      <Action
        title={`Open in ${BROWSER_NAME}`}
        icon={Icon.Globe}
        onAction={() => {
          open(url, BROWSER_PATH);
          if (updateFrecency) updateFrecency();
        }}
      />
      <Action
        title="Open in Little Arc"
        icon={Icon.Globe}
        onAction={() => {
          open(url, ARC_PATH);
          if (updateFrecency) updateFrecency();
        }}
      />
      <Action.CopyToClipboard
        title="Copy Link"
        content={url}
        shortcut={Keyboard.Shortcut.Common.Copy}
        onCopy={() => {
          if (updateFrecency) updateFrecency();
        }}
      />

      <ActionPanel.Section title="Related pages">
        {grapherPageUrl && (
          <Action
            title="Open Grapher Page"
            icon={Icon.LineChart}
            onAction={() => {
              open(grapherPageUrl, BROWSER_PATH);
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {chartEditorUrl && (
          <Action
            title="Open Chart Editor"
            icon={Icon.Pencil}
            onAction={() => {
              open(
                chartEditorUrl,
                baseUrl === LIVE_URL ? ARC_PATH : BROWSER_PATH,
              );
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {!isLoadingVariables && variables.length === 1 && (
          <Action
            title="Open Metadata"
            icon={Icon.Receipt}
            onAction={() => {
              const variable = variables[0];
              open(
                `https://api.ourworldindata.org/v1/indicators/${variable.id}.metadata.json`,
                BROWSER_PATH,
              );
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section title="More pages">
        {data.pathname !== "/grapher/life-expectancy" && (
          <Action
            title="Open Life Expectancy Chart"
            icon={Icon.LineChart}
            onAction={() => {
              open(makeUrl(baseUrl, "/grapher/life-expectancy"), BROWSER_PATH);
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {!isLoadingRandomCharts && randomSlug && (
          <Action
            title="Open Random Chart"
            icon={Icon.LineChart}
            onAction={() => {
              open(makeUrl(baseUrl, `/grapher/${randomSlug}`), BROWSER_PATH);
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
      </ActionPanel.Section>

      {!isLoadingRandomCharts && randomCharts.length > 0 && (
        <ActionPanel.Section title="More Random Charts">
          {CHART_TYPES.map((chartType) => {
            const randomChart = randomChartsByType.get(chartType);
            if (!randomChart) return null;
            return (
              <Action
                key={randomChart.slug}
                title={`Open ${randomChart.name}`}
                icon={randomChart.icon}
                onAction={() => {
                  open(
                    makeUrl(baseUrl, `/grapher/${randomChart.slug}`),
                    BROWSER_PATH,
                  );
                  if (updateFrecency) updateFrecency();
                }}
              />
            );
          })}
        </ActionPanel.Section>
      )}

      {!isLoadingVariables && variables.length > 1 && (
        <ActionPanel.Section title="Variables Metadata">
          {variables.map((variable) => (
            <Action
              key={variable.id}
              title={variable.name}
              icon={Icon.Receipt}
              onAction={() => {
                open(
                  `https://api.ourworldindata.org/v1/indicators/${variable.id}.metadata.json`,
                  BROWSER_PATH,
                );
                if (updateFrecency) updateFrecency();
              }}
            />
          ))}
        </ActionPanel.Section>
      )}
    </ActionPanel>
  );
}

const makeUrl = (origin: string, pathname?: string, queryParams?: string) => {
  return origin + (pathname ?? "") + (queryParams ? `?${queryParams}` : "");
};
