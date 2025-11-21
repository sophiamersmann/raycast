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
  usePullRequests,
  fetchRandomCharts,
  fetchVariables,
  fetchChart,
  useClipboard,
  makeThumbnailUrl,
} from "./utils/helpers";
import { ARC_PATH, GOOGLE_CHROME_PATH, CHART_TYPES } from "./utils/constants";
import {
  OpenInArcAction,
  OpenInChromeAction,
  OpenInFirefoxAction,
} from "./utils/components";

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

const LIVE_URL = "https://ourworldindata.org";
const LOCAL_DEV_URL = "http://localhost:3030";
const LOCAL_AGENT_URL = "http://localhost:3031";

const LIVE_ADMIN_URL = "https://admin.owid.io";

// matches filenames in the owid-grapher-svgs repo
const TEST_SVG_FILENAME_REGEX = /^svg\/(?<slug>.+)_v\d+.+$/m;
const TEST_SVG_FILENAME_REGEX_WITH_QUERY_PARAMS =
  /^all-views\/svg\/(?<slug>.+)\?(?<queryParams>.+)_v\d+.+$/m;

enum StagingSitesFilter {
  Mine = "mine",
  Team = "team",
}

export default function Command() {
  const { clipboardText, isLoading: isLoadingClipboardText } = useClipboard();
  const copiedText = clipboardText.trim();

  const [isShowingChartConfigDetail, setIsShowingChartConfigDetail] =
    useState(false);
  const [isShowingChartPreviewDetail, setIsShowingChartPreviewDetail] =
    useState(false);

  const [stagingSitesFilter, setStagingSitesFilter] = useState(
    StagingSitesFilter.Mine,
  );

  // fetch pull requests
  const fetchMyPullRequestsOnly =
    stagingSitesFilter === StagingSitesFilter.Mine;
  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    fetchMyPullRequestsOnly ? GITHUB_USER_NAME : undefined,
  );

  const content: Data = {};

  // check if the clipboard content is an OWID URL
  try {
    const url = new URL(copiedText);
    const owidUrls = [
      LIVE_URL,
      LIVE_ADMIN_URL,
      LOCAL_DEV_URL,
      LOCAL_AGENT_URL,
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

  const liveUrl = content.isAdminUrl ? LIVE_ADMIN_URL : LIVE_URL;

  const isLoading =
    isLoadingClipboardText || isLoadingPullRequests || isLoadingChart;

  const isShowingDetail =
    isShowingChartConfigDetail || isShowingChartPreviewDetail;
  const hasChartConfigDetail = !!content.chartConfig;
  const hasChartPreviewDetail = !!content.chartSlug;
  const hasDetail = hasChartConfigDetail || hasChartPreviewDetail;
  const detailType = isShowingChartConfigDetail
    ? "config"
    : isShowingChartPreviewDetail
      ? "preview"
      : "none";
  const detailProps = {
    hasChartConfigDetail,
    hasChartPreviewDetail,
    isShowingChartConfigDetail,
    setIsShowingChartConfigDetail,
    isShowingChartPreviewDetail,
    setIsShowingChartPreviewDetail,
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={hasDetail && isShowingDetail}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Select which staging sites to show"
          defaultValue={StagingSitesFilter.Mine}
          onChange={(newValue) =>
            setStagingSitesFilter(newValue as StagingSitesFilter)
          }
        >
          <List.Dropdown.Item
            title="My Staging Sites"
            value={StagingSitesFilter.Mine}
          />
          <List.Dropdown.Item
            title="The Team's Staging Sites"
            value={StagingSitesFilter.Team}
          />
        </List.Dropdown>
      }
    >
      <List.Item
        title={`Prod`}
        subtitle={makeUrl(liveUrl, content.pathname, content.queryParams)}
        icon={linkIcon}
        detail={
          <List.Item.Detail
            markdown={makeDetail(LIVE_URL, content, detailType)}
          />
        }
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
        title={`Dev`}
        subtitle={makeUrl(LOCAL_DEV_URL, content.pathname, content.queryParams)}
        icon={linkIcon}
        actions={
          <LinkActionPanel
            baseUrl={LOCAL_DEV_URL}
            baseAdminUrl={LOCAL_DEV_URL}
            data={content}
            {...detailProps}
          />
        }
      />
      <List.Item
        title={`Agent`}
        subtitle={makeUrl(
          LOCAL_AGENT_URL,
          content.pathname,
          content.queryParams,
        )}
        icon={linkIcon}
        actions={
          <LinkActionPanel
            baseUrl={LOCAL_AGENT_URL}
            baseAdminUrl={LOCAL_AGENT_URL}
            data={content}
            {...detailProps}
          />
        }
      />
      <List.Section
        title={`Staging Sites`}
        subtitle={`${makePartialUrl(content.pathname, content.queryParams)}`}
      >
        {pullRequests.map((pr) => (
          <List.Item
            key={pr.stagingUrl}
            title={`${pr.title}`}
            icon={linkIcon}
            accessories={[{ date: pr.updatedAt }]}
            keywords={[pr.branch]}
            detail={
              <List.Item.Detail
                markdown={makeDetail(pr.stagingUrl, content, detailType)}
              />
            }
            actions={
              <LinkActionPanel
                baseUrl={pr.stagingUrl}
                baseAdminUrl={pr.stagingUrl}
                branch={pr.branch}
                staging={pr.staging}
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
  staging,
  data,
  hasChartConfigDetail,
  hasChartPreviewDetail,
  isShowingChartConfigDetail,
  setIsShowingChartConfigDetail,
  isShowingChartPreviewDetail,
  setIsShowingChartPreviewDetail,
}: {
  baseUrl: string;
  baseAdminUrl: string;
  branch?: string;
  staging?: string;
  data: Data;
  hasChartConfigDetail: boolean;
  hasChartPreviewDetail: boolean;
  isShowingChartConfigDetail: boolean;
  setIsShowingChartConfigDetail: (value: boolean) => void;
  isShowingChartPreviewDetail: boolean;
  setIsShowingChartPreviewDetail: (value: boolean) => void;
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
    data.chartId ?? 0,
  );

  const isLivePage = baseUrl === LIVE_URL;
  const isLiveAdmin = isLivePage && data.isAdminUrl;

  const isAgentPage = baseUrl === LOCAL_AGENT_URL;

  return (
    <ActionPanel>
      {isLiveAdmin ? (
        <OpenInArcAction url={url} />
      ) : isAgentPage ? (
        <OpenInFirefoxAction url={url} />
      ) : (
        <OpenInChromeAction url={url} />
      )}
      {isLiveAdmin ? (
        isAgentPage ? (
          <OpenInFirefoxAction url={url} />
        ) : (
          <OpenInChromeAction url={url} />
        )
      ) : (
        <OpenInArcAction url={url} />
      )}
      {!data.isAdminUrl && !data.chartSlug && (
        <Action
          title="Open Admin"
          icon={Icon.Globe}
          onAction={() => {
            const adminUrl = isLivePage
              ? LIVE_ADMIN_URL
              : makeUrl(baseUrl, "/admin");
            open(adminUrl, isLivePage ? ARC_PATH : GOOGLE_CHROME_PATH);
          }}
        />
      )}
      {!data.isAdminUrl && data.chartId && (
        <Action
          title="Open Admin"
          icon={Icon.Globe}
          onAction={() => {
            const chartEditorUrl = makeUrl(
              baseAdminUrl,
              `/admin/charts/${data.chartId}/edit`,
            );
            open(
              chartEditorUrl,
              baseUrl === LIVE_URL ? ARC_PATH : GOOGLE_CHROME_PATH,
            );
          }}
        />
      )}
      {data.isAdminUrl && data.chartSlug && (
        <Action
          title="Open Grapher Page"
          icon={Icon.LineChart}
          onAction={() => {
            const grapherPageUrl = makeUrl(
              baseUrl,
              `/grapher/${data.chartSlug}`,
            );
            open(grapherPageUrl, GOOGLE_CHROME_PATH);
          }}
        />
      )}

      <ActionPanel.Section>
        <Action.CopyToClipboard
          title="Copy Link"
          content={url}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
        {data.chartSlug && (
          <Action.CopyToClipboard title="Copy Slug" content={data.chartSlug} />
        )}
        {data.chartId && (
          <Action.CopyToClipboard
            title="Copy Chart ID"
            content={data.chartId}
          />
        )}
        {branch && (
          <Action.CopyToClipboard
            title="Copy SSH Command"
            content={`ssh owid@${staging}`}
          />
        )}
        {branch && (
          <Action.CopyToClipboard
            title="Copy Destroy Command"
            content={`owid-lxc destroy ${staging}`}
          />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section>
        {hasChartPreviewDetail && (
          <Action
            title={
              (isShowingChartPreviewDetail ? "Hide" : "Show") + " Chart Preview"
            }
            icon={
              isShowingChartPreviewDetail
                ? Icon.ArrowsContract
                : Icon.ArrowsExpand
            }
            onAction={() => {
              setIsShowingChartPreviewDetail(!isShowingChartPreviewDetail);
              setIsShowingChartConfigDetail(false);
            }}
          />
        )}
        {hasChartConfigDetail && (
          <Action
            title={
              (isShowingChartConfigDetail ? "Hide" : "Show") + " Chart Config"
            }
            icon={
              isShowingChartConfigDetail
                ? Icon.ArrowsContract
                : Icon.ArrowsExpand
            }
            onAction={() => {
              setIsShowingChartConfigDetail(!isShowingChartConfigDetail);
              setIsShowingChartPreviewDetail(false);
            }}
          />
        )}
        {data.chartSlug && (
          <Action
            title="Open Chart Config (API)"
            icon={Icon.Globe}
            onAction={() => {
              const configUrl = makeUrl(
                LIVE_URL,
                `/grapher/${data.chartSlug}.config.json`,
              );
              open(configUrl, GOOGLE_CHROME_PATH);
            }}
          />
        )}
      </ActionPanel.Section>

      {!isLivePage && (
        <ActionPanel.Section title="Test Pages">
          {!data.isAdminUrl && (
            <Action
              title="Open Test Page"
              icon={Icon.Bug}
              onAction={() => {
                const adminTestUrl = makeUrl(baseAdminUrl, "/admin/test");
                open(
                  adminTestUrl,
                  baseUrl === LIVE_URL ? ARC_PATH : GOOGLE_CHROME_PATH,
                );
              }}
            />
          )}
          {!data.isAdminUrl && data.chartId && (
            <Action
              title="Open Chart Test Page"
              icon={Icon.Bug}
              onAction={() => {
                const chartTestUrl = makeUrl(
                  baseAdminUrl,
                  `/admin/test/embeds?ids=${data.chartId}`,
                );
                open(
                  chartTestUrl,
                  baseUrl === LIVE_URL ? ARC_PATH : GOOGLE_CHROME_PATH,
                );
              }}
            />
          )}
        </ActionPanel.Section>
      )}

      <ActionPanel.Section title="Charts">
        {data.pathname !== "/grapher/life-expectancy" && (
          <Action
            title="Open Life Expectancy Chart"
            icon={Icon.LineChart}
            onAction={() => {
              open(
                makeUrl(baseUrl, "/grapher/life-expectancy"),
                GOOGLE_CHROME_PATH,
              );
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
                GOOGLE_CHROME_PATH,
              );
            }}
          />
        )}
        {!isLoadingRandomCharts && randomCharts.length > 0 && (
          <>
            {CHART_TYPES.map((chartType) => {
              const randomChart = randomChartsByType.get(chartType);
              if (!randomChart) return null;
              return (
                <Action
                  key={randomChart.slug}
                  title={`Open ${randomChart.name}`}
                  icon={Icon.LineChart}
                  onAction={() => {
                    open(
                      makeUrl(baseUrl, `/grapher/${randomChart.slug}`),
                      GOOGLE_CHROME_PATH,
                    );
                  }}
                />
              );
            })}
          </>
        )}
      </ActionPanel.Section>

      {!isLoadingVariables && (
        <ActionPanel.Section title="Variables Metadata">
          {variables.map((variable) => (
            <Action
              key={variable.id}
              title={variable.name}
              icon={Icon.Receipt}
              onAction={() => {
                open(
                  `https://api.ourworldindata.org/v1/indicators/${variable.id}.metadata.json`,
                  GOOGLE_CHROME_PATH,
                );
              }}
            />
          ))}
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

const makePartialUrl = (pathname?: string, queryParams?: string) => {
  if (!pathname) return "";
  return `${pathname}${queryParams ? `?${queryParams}` : ""}`;
};

const makeChartConfigDetail = (chartConfig?: Record<string, unknown>) => {
  if (!chartConfig) return undefined;
  let detail = "```json\n";
  detail += JSON.stringify(chartConfig, null, 2);
  detail += "\n```";
  return detail;
};

const makeChartPreviewDetail = (baseUrl: string, chartSlug?: string) => {
  if (!chartSlug) return undefined;
  const url = makeUrl(baseUrl, `/grapher/${chartSlug}`);
  const thumbnailUrl = makeThumbnailUrl(url);
  return `![Chart](${thumbnailUrl})`;
};

const makeDetail = (
  baseUrl: string,
  data: Data,
  type: "config" | "preview" | "none",
) => {
  switch (type) {
    case "none":
      return undefined;
    case "config":
      return makeChartConfigDetail(data.chartConfig);
    case "preview":
      return makeChartPreviewDetail(baseUrl, data.chartSlug);
  }
};

const linkIcon = {
  source: Icon.Link,
  tintColor: {
    light: Color.SecondaryText,
    dark: Color.SecondaryText,
    adjustContrast: true,
  },
};
