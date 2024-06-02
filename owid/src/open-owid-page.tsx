import { useState } from "react";
import {
  Action,
  ActionPanel,
  List,
  Icon,
  open,
  Keyboard,
  Color,
} from "@raycast/api";
import { useFrecencySorting } from "@raycast/utils";
import {
  useClipboard,
  usePullRequests,
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
  chartSlug?: string;
  chartId?: string;
  chartConfig?: Record<string, unknown>;

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
  const copiedText = clipboardText.trim();

  const [isShowingDetail, setIsShowingDetail] = useState(false);

  const content: Data = {};

  // check if the clipboard content is an OWID URL
  try {
    const url = new URL(copiedText);
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
    // check if the url is a admin url
    if (content.pathname.startsWith("/admin")) {
      content.isAdminUrl = true;
    }

    // extract slug from grapher page url
    content.chartSlug = content.pathname.match(
      /^\/grapher\/(?<slug>.+)/m,
    )?.groups?.slug;

    // extract chart id from chart edit page url
    content.chartId = content.pathname.match(
      /^\/admin\/charts\/(?<chartId>\d+).*/m,
    )?.groups?.chartId;
  }

  // check if the copied text is a filename from the owid-grapher-svgs repo
  const fromFilename =
    copiedText.match(TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS)?.groups ??
    copiedText.match(TEST_SVG_FILENAME_REGEX)?.groups;
  if (fromFilename) {
    content.chartSlug = fromFilename.slug;
    content.pathname = `/grapher/${fromFilename.slug}`;
    content.queryParams = fromFilename.queryParams;
  }

  // check if the copied text is a valid slug associated with a chart
  const [maybeSlug, maybeQueryParams] = copiedText.split("?");
  const validationResult = validateSlug(maybeSlug);
  if (validationResult.slug) {
    content.chartSlug = validationResult.slug;
    content.pathname = `/grapher/${validationResult.slug}`;
    content.queryParams = maybeQueryParams;
  }

  // fetch chart info
  const {
    id: chartId,
    slug: chartSlug,
    config: chartConfig,
    isLoading: isLoadingChartInfo,
  } = fetchChart({
    slug: content.chartSlug,
    chartId: content.chartId,
  });
  if (chartId) content.chartId = chartId;
  if (chartSlug) content.chartSlug = chartSlug;
  if (chartConfig) content.chartConfig = chartConfig;

  const isLoading =
    isLoadingClipboardText ||
    isLoadingPullRequests ||
    validationResult.isLoading ||
    isLoadingChartInfo;

  const liveOriginUrl = content.isAdminUrl ? LIVE_ADMIN_URL : LIVE_URL;

  const detail = content.chartConfig
    ? makeDetails(content.chartConfig)
    : undefined;

  const detailProps = {
    hasDetail: !!detail,
    isShowingDetail,
    setIsShowingDetail,
  };

  return (
    <List isLoading={isLoading} isShowingDetail={!!detail && isShowingDetail}>
      <List.Item
        title={makeUrl(liveOriginUrl, content.pathname, content.queryParams)}
        icon={linkIcon}
        accessories={[{ text: "Live" }]}
        detail={<List.Item.Detail markdown={detail} />}
        actions={
          <LinkActionPanel baseUrl={LIVE_URL} data={content} {...detailProps} />
        }
      />
      <List.Item
        title={makeUrl(LOCAL_URL, content.pathname, content.queryParams)}
        icon={linkIcon}
        accessories={[{ text: "Local" }]}
        detail={<List.Item.Detail markdown={detail} />}
        actions={
          <LinkActionPanel
            baseUrl={LOCAL_URL}
            data={content}
            {...detailProps}
          />
        }
      />
      <List.Section title="Staging">
        {sortedPullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeUrl(pr.staging, content.pathname, content.queryParams)}
            icon={linkIcon}
            accessories={[{ date: pr.updatedAt }]}
            detail={<List.Item.Detail markdown={detail} />}
            actions={
              <LinkActionPanel
                baseUrl={pr.staging}
                data={content}
                {...detailProps}
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
  hasDetail,
  isShowingDetail,
  setIsShowingDetail,
  updateFrecency,
}: {
  baseUrl: string;
  data: Data;
  hasDetail: boolean;
  isShowingDetail: boolean;
  setIsShowingDetail: (value: boolean) => void;
  updateFrecency?: () => Promise<void>;
}) {
  const url = makeUrl(baseUrl, data.pathname, data.queryParams);

  const { charts: randomCharts, isLoading: isLoadingRandomCharts } =
    fetchRandomCharts();
  const randomChartsByType = new Map(
    randomCharts.map((chart) => [chart.type, chart]),
  );
  const randomChart =
    randomCharts[Math.floor(Math.random() * randomCharts.length)];

  const { variables, isLoading: isLoadingVariables } = fetchVariables(
    data.chartSlug ?? "",
  );

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

      <ActionPanel.Section>
        {data.chartSlug && (
          <Action.CopyToClipboard
            title="Copy Slug"
            content={data.chartSlug}
            onCopy={() => {
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {data.chartId && (
          <Action.CopyToClipboard
            title="Copy Chart ID"
            content={data.chartId}
            onCopy={() => {
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {hasDetail && (
          <Action
            title={(isShowingDetail ? "Hide" : "Show") + " Chart Config"}
            icon={Icon.Cog}
            onAction={() => setIsShowingDetail(!isShowingDetail)}
          />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section title="Related Pages">
        {data.isAdminUrl && data.chartSlug && (
          <Action
            title="Open Grapher Page"
            icon={Icon.LineChart}
            onAction={() => {
              const grapherPageUrl = makeUrl(
                baseUrl,
                `/grapher/${data.chartSlug}`,
              );
              open(grapherPageUrl, BROWSER_PATH);
              if (updateFrecency) updateFrecency();
            }}
          />
        )}
        {!data.isAdminUrl && data.chartId && (
          <Action
            title="Open Chart Editor"
            icon={Icon.Pencil}
            onAction={() => {
              const editorBaseUrl =
                baseUrl === LIVE_URL ? LIVE_ADMIN_URL : baseUrl;
              const chartEditorUrl = makeUrl(
                editorBaseUrl,
                `/admin/charts/${data.chartId}/edit`,
              );
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

      <ActionPanel.Section
        title={data.chartSlug || data.chartId ? "More Pages" : undefined}
      >
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
        {!isLoadingRandomCharts && randomChart && (
          <Action
            title="Open Random Chart"
            icon={Icon.LineChart}
            onAction={() => {
              open(
                makeUrl(baseUrl, `/grapher/${randomChart.slug}`),
                BROWSER_PATH,
              );
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
    </ActionPanel>
  );
}

const makeUrl = (origin: string, pathname?: string, queryParams?: string) => {
  return origin + (pathname ?? "") + (queryParams ? `?${queryParams}` : "");
};

const makeDetails = (chartConfig: Record<string, unknown>) => {
  let details = "```json\n";
  details += JSON.stringify(chartConfig, null, 2);
  details += "\n```";
  return details;
};

const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
