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
import {
  useClipboard,
  usePullRequests,
  fetchRandomCharts,
  fetchVariables,
  CHART_TYPES,
  fetchChart,
} from "./utils";

interface Data {
  clipboardText?: string;

  // url
  origin?: string;
  pathname?: string;
  queryParams?: string;

  // chart
  chartSlug?: string;
  chartId?: number;
  chartConfig?: Record<string, unknown>;

  isAdminUrl?: boolean;
}

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
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
  // fetch pull requests
  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );

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
    const chartId = content.pathname.match(
      /^\/admin\/charts\/(?<chartId>\d+).*/m,
    )?.groups?.chartId;
    const parsedChartId = parseInt(chartId ?? "");
    if (!isNaN(parsedChartId)) {
      content.chartId = parsedChartId;
    }
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

  // check if the copied text is a valid slug or chart id
  // and if so fetch its config
  const [maybeSlug, maybeQueryParams] = copiedText.split("?");
  let maybeChartId: number | undefined = parseInt(copiedText);
  if (isNaN(maybeChartId)) maybeChartId = undefined;
  const {
    id: chartId,
    slug: chartSlug,
    config: chartConfig,
    isLoading: isLoadingChart,
  } = fetchChart({
    slug: content.chartSlug ?? maybeSlug,
    chartId: content.chartId ?? maybeChartId,
  });
  if (chartId) {
    content.chartId = chartId;
    content.chartSlug = chartSlug;
    content.chartConfig = chartConfig;

    if (!content.pathname) {
      content.pathname = `/grapher/${chartSlug}`;
    }

    if (maybeSlug === chartSlug) {
      content.queryParams = maybeQueryParams;
    }
  }

  const isLoading =
    isLoadingClipboardText || isLoadingPullRequests || isLoadingChart;

  const liveUrl = content.isAdminUrl ? LIVE_ADMIN_URL : LIVE_URL;

  const detail = content.chartConfig
    ? makeDetail(content.chartConfig)
    : undefined;

  const detailProps = {
    hasDetail: !!detail,
    isShowingDetail,
    setIsShowingDetail,
  };

  return (
    <List isLoading={isLoading} isShowingDetail={!!detail && isShowingDetail}>
      <List.Item
        title={makeUrl(liveUrl, content.pathname, content.queryParams)}
        icon={linkIcon}
        accessories={[{ text: "Live" }]}
        detail={<List.Item.Detail markdown={detail} />}
        actions={
          <LinkActionPanel
            baseUrl={LIVE_URL}
            baseAdminUrl={LIVE_ADMIN_URL}
            data={content}
            {...detailProps}
          />
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
            baseAdminUrl={LOCAL_URL}
            data={content}
            {...detailProps}
          />
        }
      />
      <List.Section title="Staging">
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.staging}
            title={makeUrl(pr.staging, content.pathname, content.queryParams)}
            icon={linkIcon}
            accessories={[{ date: pr.updatedAt }]}
            detail={<List.Item.Detail markdown={detail} />}
            actions={
              <LinkActionPanel
                baseUrl={pr.staging}
                baseAdminUrl={pr.staging}
                branch={pr.branch}
                data={content}
                {...detailProps}
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
  baseAdminUrl,
  branch,
  data,
  hasDetail,
  isShowingDetail,
  setIsShowingDetail,
}: {
  baseUrl: string;
  baseAdminUrl: string;
  branch?: string;
  data: Data;
  hasDetail: boolean;
  isShowingDetail: boolean;
  setIsShowingDetail: (value: boolean) => void;
}) {
  const url = makeUrl(
    data.isAdminUrl ? baseAdminUrl : baseUrl,
    data.pathname,
    data.queryParams,
  );

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

  const OpenInBrowserAction = (
    <Action
      title={`Open in ${BROWSER_NAME}`}
      icon={Icon.Globe}
      onAction={() => {
        open(url, BROWSER_PATH);
      }}
    />
  );
  const OpenInArcAction = (
    <Action
      title="Open in Little Arc"
      icon={Icon.Globe}
      onAction={() => {
        open(url, ARC_PATH);
      }}
    />
  );
  const isLiveAdmin = baseUrl === LIVE_URL && data.isAdminUrl;

  return (
    <ActionPanel>
      {isLiveAdmin ? OpenInArcAction : OpenInBrowserAction}
      {isLiveAdmin ? OpenInBrowserAction : OpenInArcAction}
      <Action.CopyToClipboard
        title="Copy Link"
        content={url}
        shortcut={Keyboard.Shortcut.Common.Copy}
      />
      {branch && (
        <Action.CopyToClipboard
          title="Copy SSH Command"
          content={`ssh owid@staging-site-${branch}`}
        />
      )}

      <ActionPanel.Section>
        {data.chartSlug && (
          <Action.CopyToClipboard title="Copy Slug" content={data.chartSlug} />
        )}
        {data.chartId && (
          <Action.CopyToClipboard
            title="Copy Chart ID"
            content={data.chartId}
          />
        )}
        {hasDetail && (
          <Action
            title={(isShowingDetail ? "Hide" : "Show") + " Chart Config"}
            icon={Icon.Cog}
            onAction={() => {
              setIsShowingDetail(!isShowingDetail);
            }}
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
            }}
          />
        )}
        {!data.isAdminUrl && data.chartId && (
          <Action
            title="Open Chart Editor"
            icon={Icon.Pencil}
            onAction={() => {
              const chartEditorUrl = makeUrl(
                baseAdminUrl,
                `/admin/charts/${data.chartId}/edit`,
              );
              open(
                chartEditorUrl,
                baseUrl === LIVE_URL ? ARC_PATH : BROWSER_PATH,
              );
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
                }}
              />
            );
          })}
        </ActionPanel.Section>
      )}

      {branch && (
        <ActionPanel.Section title="SVG Tester">
          <Action.OpenInBrowser
            title="Open Default Views Report"
            icon={Icon.Shield}
            url={`raycast://script-commands/open-svg-tester-report-default-views?arguments=${branch}`}
          />
          <Action.OpenInBrowser
            title="Open All Views Report"
            icon={Icon.Shield}
            url={`raycast://script-commands/open-svg-tester-report-all-views?arguments=${branch}`}
          />
        </ActionPanel.Section>
      )}
    </ActionPanel>
  );
}

const makeUrl = (origin: string, pathname?: string, queryParams?: string) => {
  return origin + (pathname ?? "") + (queryParams ? `?${queryParams}` : "");
};

const makeDetail = (chartConfig: Record<string, unknown>) => {
  let detail = "```json\n";
  detail += JSON.stringify(chartConfig, null, 2);
  detail += "\n```";
  return detail;
};

const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
